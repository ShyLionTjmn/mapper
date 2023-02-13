package main

import (
  "fmt"
  "sync"
  "os"
  "log"
  "time"
  "syscall"
  "os/signal"
  "regexp"
  "errors"
  "strings"
  "strconv"
  "flag"
  "runtime"

  "github.com/gomodule/redigo/redis"
  "github.com/marcsauter/single"
  rrd "github.com/multiplay/go-rrd"

  w "github.com/jimlawless/whereami"
  "github.com/fatih/color"

  . "github.com/ShyLionTjmn/mapper/mapaux"
  "github.com/ShyLionTjmn/mapper/redsub"
)

const DB_REFRESH_TIME= 10

const REDIS_SOCKET="/var/run/redis/redis.sock"
const REDIS_DB="0"
const REDIS_ERR_SLEEP=5
const IP_GRAPHS_REFRESH=90

const RRD_ROOT="/var/lib/rrdcached/db/mapper"
const RRD_SOCKET="/var/run/rrdcached.sock"

const MAX_INTERPOLATE_INTERVALS=10

var red_db string=REDIS_DB

const IP_REGEX=`^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`
var ip_reg *regexp.Regexp

var globalMutex = &sync.RWMutex{}
//locks this maps:
var data = make(M)
var opt_v int
var opt_Q bool
var opt_1 bool

var opt_d string

//const TRY_OPEN_FILES uint64=65536
//var max_open_files uint64

type GraphItem struct {
  Ip	string
  Key	string
  Item	string
  Value string
  Uptime uint64
}

var mainQueue chan GraphItem

var creates_loaded int64

func init() {

  data["ip_graphs"] = make(M)
  data["creates"] = make(M)
  data["created"] = make(M)

  mainQueue = make(chan GraphItem, 100)
  w.WhereAmI()
  errors.New("")
  strconv.Itoa(0)

  ip_reg = regexp.MustCompile(IP_REGEX)

  flag.IntVar(&opt_v, "v", 0, "set verbosity level")
  flag.BoolVar(&opt_Q, "Q", false, "Ignore published data")
  flag.BoolVar(&opt_1, "1", false, "Quit after initializing")
  flag.StringVar(&opt_d, "d", RRD_ROOT, "RRD files root dir, should be in rrdcached -b option path")

  flag.Parse()
}

var red_state_mutex = &sync.Mutex{}
//locks this vars
var red_good int64
var red_bad int64

func redState(ok bool) {
  red_state_mutex.Lock()
  defer red_state_mutex.Unlock()

  if ok {
    if red_good < red_bad {
      red_good = time.Now().Unix()
      fmt.Fprintln(os.Stderr, "redis is back")
    }
  } else {
    if red_bad <= red_good {
      red_bad = time.Now().Unix()
      fmt.Fprintln(os.Stderr, "redis is down")
    }
  }
}

var rrd_state_mutex = &sync.Mutex{}
//locks this vars
var rrd_good int64
var rrd_bad int64

func rrdState(ok bool) {
  rrd_state_mutex.Lock()
  defer rrd_state_mutex.Unlock()

  if ok {
    if rrd_good < rrd_bad {
      rrd_good = time.Now().Unix()
      fmt.Fprintln(os.Stderr, "rrd_cached is back")
    }
  } else {
    if rrd_bad <= rrd_good {
      rrd_bad = time.Now().Unix()
      fmt.Fprintln(os.Stderr, "rrd_cached is down")
    }
  }
}

func graph_sub(stop_ch chan string, wg *sync.WaitGroup) {
  //defer func() { r := recover(); if r != nil { fmt.Println("queue_data_sub: recover from:", r) } }()
  //defer func() { fmt.Println("queue_data_sub: return") }()
  defer wg.Done()

  var err error

  stop_signalled := false

  for !stop_signalled {

    var rsub *redsub.Redsub
    rsub, err = redsub.New("unix", REDIS_SOCKET, red_db, "graph", 100)
    if err == nil {
      redState(true)
L66:  for !stop_signalled {
        select {
        case <- stop_ch:
          stop_signalled = true
          //fmt.Println("queue_data_sub: quit")
          rsub.Conn.Close()
          break L66
        case err = <-rsub.E:
          if !stop_signalled {
            //fmt.Println("subscriber got error: "+err.Error())
          }
          break L66
        case reply := <-rsub.C:
          a := strings.Split(reply, " ")
          if len(a) == 4 && ip_reg.MatchString(a[0]) && !opt_Q {
            ip := a[0]
            uptime, _ := strconv.ParseUint(a[1], 10, 64)
            item := a[2]
            value := a[3]

            dot_pos := strings.Index(item, ".")
            var key string
            if dot_pos > 0 {
              key = item[:dot_pos]
            } else {
              key = item
            }
            mainQueue <- GraphItem{Ip: ip, Key: key, Item: item, Value: value, Uptime: uptime}
          }
        }
      }
      rsub.W.Wait()
      if !stop_signalled { redState(false) }
    } else {
      if !stop_signalled {
        redState(false)
        if opt_v > 0 {
          color.Red("subscriber returned error: %s", err.Error())
        }
      }
    }
  // something went wrong, sleep for a while


    if !stop_signalled {
      timer := time.NewTimer(REDIS_ERR_SLEEP*time.Second)
      select {
      case <- stop_ch:
        timer.Stop()
        if opt_v > 0 {
          fmt.Println("queue_data_sub: quit while error wait")
        }
        return
      case <- timer.C:
        //do nothing, try whole cycle again
      }
    }
  }
}

func main() {

  var err error

  single_run := single.New("map-grapher."+red_db) // add redis_db here later

  if err = single_run.CheckLock(); err != nil && err == single.ErrAlreadyRunning {
    log.Fatal("another instance of the app is already running, exiting")
  } else if err != nil {
    // Another error occurred, might be worth handling it as well
    log.Fatalf("failed to acquire exclusive app lock: %v", err)
  }
  defer single_run.TryUnlock()
/*
  var rLimit syscall.Rlimit
  err = syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rLimit)
  if err != nil {
    fmt.Fprintf(os.Stderr, "Error getting ulimit")
    return
  }

  max_open_files = rLimit.Cur

  if rLimit.Max != rLimit.Cur {
    rLimit.Cur = rLimit.Max
  }

  err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit)
  if err != nil {
    fmt.Fprintf(os.Stderr, "Error raising ulimit")
  } else {
    max_open_files = rLimit.Cur

    if rLimit.Cur < TRY_OPEN_FILES {
      rLimit.Cur = TRY_OPEN_FILES
      rLimit.Max = TRY_OPEN_FILES

      err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit)
      if err == nil {
        max_open_files = rLimit.Cur
      }
    }
  }

*/

  //fmt.Println("Max open files:", max_open_files)

  sig_ch := make(chan os.Signal, 1)
  signal.Notify(sig_ch, syscall.SIGHUP)
  signal.Notify(sig_ch, syscall.SIGINT)
  signal.Notify(sig_ch, syscall.SIGTERM)
  signal.Notify(sig_ch, syscall.SIGQUIT)


  var wg sync.WaitGroup
  var stop_channels []chan string

  redis_loaded := false
  graph_sub_launched := false

  var red redis.Conn

  defer func() { if red != nil { red.Close() } } ()

  var report_once sync.Once

MAIN_LOOP:
  for {

    red, err = RedisCheck(red, "unix", REDIS_SOCKET, red_db)

    redState(red != nil && err == nil)

    if red != nil && (creates_loaded + IP_GRAPHS_REFRESH) < time.Now().Unix() {
      //check graph_create
      if opt_v > 1 {
        fmt.Println("Checking graph_create")
      }
      var r_time string
      r_time, err = redis.String(red.Do("HGET", "graph_create", "time"))
      if err == nil {
        creates_loaded = time.Now().Unix()
        globalMutex.Lock()
        if !data.EvM("creates") || r_time != data.Vs("creates", "time") {
          if opt_v > 1 {
            fmt.Println("Loading graph_create")
          }
          var redmap map[string]string
          redmap, err = redis.StringMap(red.Do("HGETALL", "graph_create"))
          if err == nil {
            c_h := data.MkM("creates")
            for k, _ := range redmap {
              c_h[k] = redmap[k]
            }
            redis_loaded = true
          } else {
            if opt_v > 1 {
              fmt.Println("Error loading graph_create:", err.Error())
            }
          }
        } else {
          if opt_v > 1 {
            fmt.Println("graph_create not changed")
          }
        }
        globalMutex.Unlock()
      } else if err == redis.ErrNil {
        creates_loaded = time.Now().Unix()
        err = nil
        if opt_v > 1 {
          fmt.Println("graph_create not found")
        }
      } else {
        if opt_v > 1 {
          fmt.Println("Error loading graph_create:", err.Error())
        }
      }
    }

    if redis_loaded && !graph_sub_launched {
      if opt_v > 0 {
        fmt.Println("Start processing live reports")
      }
      graph_sub_stop := make(chan string, 1)
      stop_channels = append(stop_channels, graph_sub_stop)

      wg.Add(1)
      graph_sub_launched = true
      go graph_sub(graph_sub_stop, &wg)

      for i := 0; i < runtime.NumCPU(); i++ {
        worker_sub_stop := make(chan string, 1)
        stop_channels = append(stop_channels, worker_sub_stop)

        wg.Add(1)
        go worker_sub(worker_sub_stop, &wg, i)
      }
      if opt_v > 0 {
        fmt.Println(runtime.NumCPU(), "workers started")
      }
    }

    if opt_1 {
      //leave so soon?
      break MAIN_LOOP
    }

    if redis_loaded && graph_sub_launched {
      report_once.Do(func() { fmt.Println("ready to serve") })
    }
    main_timer := time.NewTimer(DB_REFRESH_TIME * time.Second)

    select {
    case s := <-sig_ch:
      main_timer.Stop()
      if opt_v > 0 {
        fmt.Println("\nmain got signal")
      }
      if s != syscall.SIGHUP && s != syscall.SIGUSR1 {
        break MAIN_LOOP
      }
      continue MAIN_LOOP
    case <- main_timer.C:
      if redis_loaded && red != nil && red.Err() == nil {
        if opt_v > 2 {
          fmt.Println("main timer: cleanup and status check")
        }

        globalMutex.Lock()
        globalMutex.Unlock()
      }
      //restart main loop
      continue MAIN_LOOP
    }
  } //MAIN_LOOP

  for _, ch := range stop_channels {
    //ch <- "stop"
    close(ch)
  }
  if WaitTimeout(&wg, 5*time.Second) {
    fmt.Println("main wait timed out")
  }

  fmt.Println("main done")
}

func RrdConnCheck(rrdc *rrd.Client) (*rrd.Client, error) {
  var err error
  ret := rrdc
  if ret != nil {
    err = ret.Ping()
    if err != nil {
      ret.Close()
      ret = nil
    } else {
      rrdState(true)
      return ret, nil
    }
  }

  ret, err = rrd.NewClient(RRD_SOCKET, rrd.Unix)
  if err != nil {
    if opt_v > 1 {
      fmt.Println("Error connecting to rrd_cached:", err.Error())
    }
    rrdState(false)
    return nil, err
  } else {
    rrdState(true)
    return ret, nil
  }
}

func worker_sub(stop_ch chan string, wg *sync.WaitGroup, sub_num int) {
  defer wg.Done()

  var red redis.Conn
  var err error

  var rrdc *rrd.Client

  defer func() {
    if red != nil && err == nil {
      red.Close()
    }
    if rrdc != nil {
      rrdc.Close()
    }
  }()

  red, _ = RedisCheck(red, "unix", REDIS_SOCKET, red_db)
  rrdc, _ = RrdConnCheck(rrdc)

  ticker := time.NewTicker(10*time.Second)
  defer ticker.Stop()

S:for {
    select {
    case <- stop_ch:
      return
    case <- ticker.C:
      red, _ = RedisCheck(red, "unix", REDIS_SOCKET, red_db)
      rrdc, _ = RrdConnCheck(rrdc)
    case gi := <-mainQueue:
      if red != nil && rrdc != nil {
        globalMutex.Lock()
        if !data.EvM("ip_graphs", gi.Ip) || (data.Vi("ip_graphs", gi.Ip, "_loaded") + IP_GRAPHS_REFRESH) < time.Now().Unix() {
          if opt_v > 1 {
            fmt.Println("Checking ip_graphs."+gi.Ip)
          }
          r_time, _err := redis.String(red.Do("HGET", "ip_graphs."+gi.Ip, "time"))

          g_time, found := data.Vse("ip_graphs", gi.Ip, "items", "time")

          if _err == redis.ErrNil {
            //no data in redis, skip data
            delete(data.VM("ip_graphs"), gi.Ip)
            ip_h := data.MkM("ip_graphs", gi.Ip)
            ip_h["_loaded"] = time.Now().Unix() // will stop tries for IP_GRAPHS_REFRESH
            if opt_v > 1 {
              fmt.Println("No ip_graphs."+gi.Ip,"in redis, pause checking for", IP_GRAPHS_REFRESH, "seconds")
            }
          } else if _err != nil {
            if opt_v > 1 {
              fmt.Println("redis error", _err.Error())
            }
            globalMutex.Unlock()
            red.Close()
            red = nil
            redState(false)
            continue S
          } else if !found || r_time != g_time {
            // time to load ip_graphs.ip
            if opt_v > 1 {
              fmt.Println("Loading ip_graphs."+gi.Ip)
            }
            redmap, _err := redis.StringMap(red.Do("HGETALL", "ip_graphs."+gi.Ip))
            if _err != nil && _err != redis.ErrNil {
              globalMutex.Unlock()
              red.Close()
              red = nil
              redState(false)
              continue S
            }
            delete(data.VM("ip_graphs"), gi.Ip)
            ip_h := data.MkM("ip_graphs", gi.Ip)
            if _err != redis.ErrNil {
              ip_i_h := ip_h.MkM("items")
              for k, _ := range redmap {
                ip_i_h[k] = redmap[k]
              }
            }
            ip_h["_loaded"] = time.Now().Unix()
            if opt_v > 2 {
              fmt.Println("Loaded:", data.VM("ip_graphs", gi.Ip))
            }
          } else {
            // redis data not changed, postprone
            data.VM("ip_graphs", gi.Ip)["_loaded"] = time.Now().Unix()
          }
        }
        gf, gf_found := data.Vse("ip_graphs", gi.Ip, "items", gi.Item)
        cr, cr_found := data.Vse("creates", gi.Key)

        created := data.EvA("created", gi.Ip, gi.Item)

        if opt_v > 3 {
          fmt.Println("Worker:", sub_num, gi, gf, gf_found)
          fmt.Println("Worker:", sub_num, "create", cr, cr_found)
          fmt.Println("Worker:", sub_num, "created", created)
        }

        if gf_found && cr_found {
          if !created {
            _, rrd_err := rrdc.Exec("CREATE "+opt_d+"/"+gf+" "+cr)
            if rrd_err != nil && !rrd.IsExist(rrd_err) {
              if opt_v > 1 {
                fmt.Println("Error creating rrd:", rrd_err.Error())
              }
              globalMutex.Unlock()
              rrdc.Close()
              rrdc = nil
              rrdState(false)
              continue S
            } else {
               data.MkM("created", gi.Ip)[gi.Item] = int64(1)
            }
          }
          globalMutex.Unlock()

          rrd_file := opt_d+"/"+gf

          last_update_str, _err := redis.String(red.Do("HGET", "ip_graph_updates."+gi.Ip, rrd_file))

          if _err == nil {
            lu_a := strings.Split(last_update_str, " ")
            if len(lu_a) == 3 {
              last_update_time, _err1 := strconv.ParseInt( lu_a[0], 10, 64 )
              last_update_uptime, _err2 := strconv.ParseUint( lu_a[1], 10, 64 )

              last_update_value, _err3 := strconv.ParseInt( lu_a[2], 10, 64 )
              new_value, _err4 := strconv.ParseInt( gi.Value, 10, 64 )

              now_time := time.Now().Unix()

              if _err1 == nil && _err2 == nil && _err3 == nil && _err4 == nil {
                if gi.Uptime > last_update_uptime && (now_time - last_update_time) > 60 && (now_time - last_update_time) < 60*MAX_INTERPOLATE_INTERVALS {
                  intervals := int64((now_time - last_update_time)/60)+1
                  timestep := int64((now_time - last_update_time)/intervals)
                  valuestep := int64((new_value - last_update_value)/intervals)
                  for i := int64(1); i < intervals; i++ {
                    cur_time := last_update_time + i*timestep
                    cur_value := last_update_value + i*valuestep

                    rrd_err := rrdc.Update(rrd_file, rrd.NewUpdate(time.Unix(cur_time, 0), cur_value))
                    if rrd_err != nil {
                      if rrd.IsNotExist(rrd_err) {
                        if opt_v > 1 {
                          fmt.Println("rrd file gone?:", rrd_err.Error())
                        }
                        globalMutex.Lock()
                        if data.EvA("created", gi.Ip, gi.Item) {
                          delete(data.VM("created", gi.Ip), gi.Item)
                        }
                        globalMutex.Unlock()
                      } else {
                        if opt_v > 1 {
                          fmt.Println("Error updating rrd:", rrd_err.Error())
                        }
                        rrdc.Close()
                        rrdc = nil
                        rrdState(false)
                      }
                      continue S
                    }
                  }
                }
              }
            }
          }

          rrd_err := rrdc.Update(rrd_file, rrd.NewUpdateNow(gi.Value))
          if rrd_err != nil {
            if rrd.IsNotExist(rrd_err) {
              if opt_v > 1 {
                fmt.Println("rrd file gone?:", rrd_err.Error())
              }
              globalMutex.Lock()
              if data.EvA("created", gi.Ip, gi.Item) {
                delete(data.VM("created", gi.Ip), gi.Item)
              }
              globalMutex.Unlock()
            } else {
              if opt_v > 1 {
                fmt.Println("Error updating rrd:", rrd_err.Error())
              }
              rrdc.Close()
              rrdc = nil
              rrdState(false)
            }
            continue S
          } else {
            red.Do("HSET", "ip_graph_updates."+gi.Ip, rrd_file, strconv.FormatInt(time.Now().Unix(), 10)+" "+strconv.FormatUint( gi.Uptime, 10)+" "+gi.Value)
          }
        } else {
          globalMutex.Unlock()
        }
      }
    } // select 
  } // S:for
}

