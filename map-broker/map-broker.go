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
  "math"

  "github.com/gomodule/redigo/redis"
  "github.com/marcsauter/single"

  w "github.com/jimlawless/whereami"
  // "github.com/davecgh/go-spew/spew"
  "github.com/fatih/color"

  . "github.com/ShyLionTjmn/mapper/mapaux"
  "github.com/ShyLionTjmn/mapper/redsub"

  "database/sql"
  _ "github.com/go-sql-driver/mysql"


)

//const WARN_AGE=300
const DEAD_AGE=300

const DB_REFRESH_TIME= 10
const DB_ERROR_TIME= 5

const AUX_DATA_REFRESH=10
const IPDB_REFRESH=60

const ERROR_SLEEP=15
const IDLE_SLEEP=600

// set in mapaux/local.go // TODO move to config file
//const IPDB_DSN="DP_USER:DB_PASS@unix(/var/run/mysqld/mysqld.sock)/ipdb_db_name"

var red_db string=REDIS_DB

const IP_REGEX=`^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`
var ip_reg *regexp.Regexp

var globalMutex = &sync.RWMutex{}
//locks this maps:
var devs = make(M)
var devs_macs = make(M)
var devs_arp = make(M)
var data = make(M)
var l2Matrix = make(M) // working map with alternatives
var dev_refs = make(M) // device references for faster lookups
var graph_int_rules string
var graph_int_rules_time int64
var graph_int_watch_dev []string
var graph_int_watch_int []string
var graph_int_watch_dev_ne []string
var graph_int_watch_int_ne []string
var alert_fields []string
var ip_neighbours_rule string
var ip_neighbours_fields []string
var ip_neighbours_ignored map[string]struct{}

var ip2name = make(map[string]string)
var ip2site = make(map[string]string)
var net2site = M{}
var net2name = M{}
var ip2projects = make(map[string][]string)
var net2projects = make(map[string][]string)
var tags = make([]M, 0)
var tags_indexes = make(map[string]int)
var sites_root_tag = ""
var projects_root_tag = ""

var aux_data_time int64
var ipdb_time int64

const PNG_MAX_AGE = 60*time.Second


var opt_Q bool
var opt_P bool
var opt_1 bool
var opt_v int
var opt_l bool
var opt_n bool
var opt_d bool
var opt_w string //www root
var opt_u string //unix socket

const TRY_OPEN_FILES uint64=65536
var max_open_files uint64

var g_dev_front_fields_l2  M
var g_dev_front_fields_l3  M

func init() {
  data["l2_links"] = make(M) // exported map with actual links. Keep link with down (2) state if both devices in db and no neighbours and any of it is down or interface is down
  data["l3_links"] = make(M)
  data["dev_list"] = make(M)
  data["sysoids"] = make(M)

  w.WhereAmI()
  errors.New("")
  strconv.Itoa(0)

  ip_reg = regexp.MustCompile(IP_REGEX)

  flag.BoolVar(&opt_Q, "Q", false, "ignore queue saves from mapper")
  flag.BoolVar(&opt_P, "P", false, "No periodic status update for outdated devs")
  flag.BoolVar(&opt_1, "1", false, "startup and finish")
  flag.BoolVar(&opt_l, "l", false, "log link discovery and change")
  flag.BoolVar(&opt_n, "n", false, "auto add ip Neighbours")
  flag.BoolVar(&opt_d, "d", false, "debug")
  flag.IntVar(&opt_v, "v", 0, "set verbosity level")
  flag.StringVar(&opt_w, "w", WWW_ROOT, "www root")
  flag.StringVar(&opt_u, "u", BROKER_UNIX_SOCKET, "Broker Unix socket")

  flag.Parse()

  g_dev_front_fields_l2 = M{
    "safe_dev_id": 1,
    "CiscoConfChange": 1,
    "CiscoConfSave": 1,
    "CPUs": 1,
    "memoryUsed": 1,
    "memorySize": 1,
    "data_ip": 1,
    "id": 1,
    "interfaces_sorted": 1,
    "interfaces": M{
      "*": M{
        "safe_if_name": 1,
        "ifAdminStatus": 1,
        "ifAlias": 1,
        "ifDescr": 1,
        "ifHighSpeed": 1,
        "ifInCRCErrors": 1,
        "ifIndex": 1,
        "ifName": 1,
        "ifOperStatus": 1,
        "ifSpeed": 1,
        "ifType": 1,
        "ips": 1,
        "l2_links": 1,
        "tunnelSrcIfName": 1,
        "portMode": 1,
        "portTrunkVlans": 1,
        "portPvid": 1,
        "portVvid": 1,
        "portHybridTag": 1,
        "portHybridUntag": 1,
        "lag_parent": 1,
        "lag_members": 1,
        "pagp_parent": 1,
        "pagp_members": 1,
      },
    },
    "last_seen": 1,
    "model_short": 1,
    "overall_status": 1,
    "run": 1,
    "short_name": 1,
    "sysLocation": 1,
    "sysUpTimeStr": 1,
  }

  g_dev_front_fields_l3 = M{
    "safe_dev_id": 1,
    "CiscoConfChange": 1,
    "CiscoConfSave": 1,
    "CPUs": 1,
    "memoryUsed": 1,
    "memorySize": 1,
    "data_ip": 1,
    "id": 1,
    "interfaces_sorted": 1,
    "interfaces": M{
      "*": M{
        "safe_if_name": 1,
        "eigrpIfPeerCount": 1,
        "eigrpIfPkts": 1,
        "eigrp_found_count": 1,
        "ifAdminStatus": 1,
        "ifAlias": 1,
        "ifDescr": 1,
        "ifDelay": 1,
        "ifHighSpeed": 1,
        "ifInCRCErrors": 1,
        "ifIndex": 1,
        "ifName": 1,
        "ifOperStatus": 1,
        "ifSpeed": 1,
        "ifType": 1,
        "ips": 1,
        "tunnelSrcIfName": 1,
        "lag_parent": 1,
        "lag_members": 1,
        "pagp_parent": 1,
        "pagp_members": 1,
      },
    },
    "last_seen": 1,
    "model_short": 1,
    "overall_status": 1,
    "run": 1,
    "short_name": 1,
    "sysLocation": 1,
    "sysUpTimeStr": 1,
  }
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

func read_devlist (red redis.Conn) (M, error) {
  ret := make(M)
  var err error
  var hash map[string]string

  hash, err = redis.StringMap(red.Do("HGETALL", "dev_list"))
  if err != nil { return nil, err }

  for ip, val := range hash {
    a := strings.Split(val, ":")
    if len(a) == 2 && ip_reg.MatchString(ip) && a[1] != "ignore" {
      var t int64
      t, err = strconv.ParseInt(a[0], 10, 64)
      if err == nil && t <= time.Now().Unix() {
        ret[ip] = make(M)
        ret[ip].(M)["time"] = t
        ret[ip].(M)["state"] = a[1]
      }
    }
  }

  return ret, nil
}

func png_cache_cleaner(stop_ch chan string, wg *sync.WaitGroup) {
  defer wg.Done()

  stop_signalled := false

  for !stop_signalled {
    var dir []os.DirEntry
    var err error
    dir, err = os.ReadDir(PNG_CACHE + "/")
    if err == nil {
      for _, dirent := range dir {
        fi, fierr := dirent.Info()
        if strings.HasSuffix(dirent.Name(), ".png") && (dirent.Type() & os.ModeType) == 0 &&
           fierr == nil &&
           time.Now().Sub(fi.ModTime()) > PNG_MAX_AGE*2 &&
        true {
          os.Remove(PNG_CACHE + "/" + dirent.Name())
        }
      }
    }

    timer := time.NewTimer(PNG_MAX_AGE)
    select {
    case <- stop_ch:
      stop_signalled = true
      timer.Stop()
    case <- timer.C:
    }
  }
}

func queue_data_sub(stop_ch chan string, wg *sync.WaitGroup) {
  //defer func() { r := recover(); if r != nil { fmt.Println("queue_data_sub: recover from:", r) } }()
  //defer func() { fmt.Println("queue_data_sub: return") }()
  defer wg.Done()

  var err error

  stop_signalled := false

  for !stop_signalled {

    var rsub *redsub.Redsub
    rsub, err = redsub.New("unix", REDIS_SOCKET, red_db, "queue_saved", 100)
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
          a := strings.Split(reply, ":")
          if len(a) >= 2 && a[0] == "0" && ip_reg.MatchString(a[1]) && !opt_Q {
            wg.Add(1)
            go process_ip_data(wg, a[1], false)
          }
          //fmt.Println(time.Now().Format("15:04:05"), reply)
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
  var sysoids_time string
  var alert_config_time string
  var ip_neighbours_time string

  single_run := single.New("map-broker."+red_db) // add redis_db here later

  if err = single_run.CheckLock(); err != nil && err == single.ErrAlreadyRunning {
    log.Fatal("another instance of the app is already running, exiting")
  } else if err != nil {
    // Another error occurred, might be worth handling it as well
    log.Fatalf("failed to acquire exclusive app lock: %v", err)
  }
  defer single_run.TryUnlock()

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


  //fmt.Println("Max open files:", max_open_files)

  sig_ch := make(chan os.Signal, 1)
  signal.Notify(sig_ch, syscall.SIGHUP)
  signal.Notify(sig_ch, syscall.SIGINT)
  signal.Notify(sig_ch, syscall.SIGTERM)
  signal.Notify(sig_ch, syscall.SIGQUIT)


  var wg sync.WaitGroup
  var stop_channels []chan string

  redis_loaded := false
  queue_data_sub_launched := false
  http_launched := false

  var red redis.Conn

  defer func() { if red != nil { red.Close() } } ()

  var report_once sync.Once

  png_stop_ch := make(chan string, 1)
  stop_channels = append(stop_channels, png_stop_ch)

  wg.Add(1)

  go png_cache_cleaner(png_stop_ch, &wg)

MAIN_LOOP:
  for {

    red, err = RedisCheck(red, "unix", REDIS_SOCKET, red_db)

    redState(red != nil && err == nil)

    if red != nil {
      var redstr string
      redstr, err = redis.String(red.Do("GET", "graph_int_rules"))
      if err == nil {
        globalMutex.Lock()
        if redstr != graph_int_rules {
          if d, dne, i, ine, _err := ParseGraphIntRules(redstr); err == nil {
            graph_int_rules = redstr
            graph_int_rules_time = time.Now().Unix()
            graph_int_watch_dev = d
            graph_int_watch_int = i
            graph_int_watch_dev_ne = dne
            graph_int_watch_int_ne = ine
          } else {
            if opt_v > 1 {
              color.Red("Error parsing graph_int_rules: %s", _err.Error())
            }
          }
        }
        globalMutex.Unlock()
      }
    }

    if (aux_data_time + AUX_DATA_REFRESH) < time.Now().Unix() && red != nil && red.Err() == nil {
      aux_data_time = time.Now().Unix()
      var r_time string
      r_time, err = redis.String(red.Do("HGET", "sysoids.short", "time"))
      if err == nil && r_time != sysoids_time {
        var redmap map[string]string
        redmap, err = redis.StringMap(red.Do("HGETALL", "sysoids.short"))
        redmap2, err2 := redis.StringMap(red.Do("HGETALL", "sysoids.long"))
        if err == nil && err2 == nil {
          globalMutex.Lock()
          sysoids_time = r_time
          delete(data, "sysoids")
          data["sysoids"] = make(M)
          for key, short := range redmap {
            if long, ok := redmap2[key]; ok {
              data.VM("sysoids")[key] = make(M)
              data.VM("sysoids", key)["short"] = short
              data.VM("sysoids", key)["long"] = long
            }
          }
          globalMutex.Unlock()
        }
      }
      r_time, err = redis.String(red.Do("HGET", "alert_config", "time"))
      if err == nil && r_time != alert_config_time {
        var redmap map[string]string
        redmap, err = redis.StringMap(red.Do("HGETALL", "alert_config"))
        if err == nil {
          new_fields := make([]string, 0)
          for key, rule := range redmap {
            if dotpos := strings.Index(key, "."); dotpos > 0 && len(key[dotpos+1:]) > 0 {
              if key[:dotpos] == "rule" || key[:dotpos] == "group" {
                var rule_fields []string
                rule_fields, err = ParseAlertRule(rule)
                if err != nil {
                  break
                }
                for _, field := range rule_fields {
                  new_fields = StrAppendOnce(new_fields, field)
                }
              }
            }
          }
          if err == nil {
            alert_config_time = r_time
            globalMutex.Lock()
            alert_fields = new_fields
            globalMutex.Unlock()
          }
        }
      }
      r_time, err = redis.String(red.Do("GET", "config.ip_neighbours.time"))
      if err == nil && r_time != ip_neighbours_time {
        var redstr string
        redstr, err = redis.String(red.Do("GET", "config.ip_neighbours.rule"))
        if err == nil {
          var new_fields []string
          new_fields, err = ParseAlertRule(redstr)
          if err == nil {
            globalMutex.Lock()
            ip_neighbours_time = r_time
            ip_neighbours_rule = redstr
            ip_neighbours_fields = new_fields
            ip_neighbours_ignored = make(map[string]struct{})
            globalMutex.Unlock()
          }
        }
      }
    }

    if (ipdb_time + IPDB_REFRESH) < time.Now().Unix() && red != nil && red.Err() == nil {
      ipdb_time = time.Now().Unix()
      ipdb_proc := func ()(error) {
        var db *sql.DB
        var query string
        var err error
        var u64 uint64
        var var_ok bool

        if db, err = sql.Open("mysql", IPDB_DSN); err != nil { return err }
        defer db.Close()

        query = "SELECT * FROM tags ORDER BY tag_sort"
        var rows []M
        new_tags_indexes := make(map[string]int)

        if rows, err = Return_query_A(db, query); err != nil { return err }
        new_tags := make([]M, len(rows))

        new_sites_root := ""
        new_projects_root := ""

        new_ip2site := make(map[string]string)
        new_net2site := M{}
        new_net2name := M{}
        new_ip2projects := make(map[string][]string)
        new_net2projects := make(map[string][]string)

        for i, tag := range rows {
          tag_id := tag.Vs("tag_id")
          if tag_id == STRING_ERROR { return errors.New("no tag_id") } //unlikely
          if tag["tag_api_name"] != nil {
            tag_api_name := tag.Vs("tag_api_name")
            if tag_api_name == STRING_ERROR {
              if opt_v > 1 {
                fmt.Println(tag)
              }
              return errors.New("no tag_api_name: tag_id: "+tag_id)
            } //unlikely
            if tag_api_name == IPDB_SITES_ROOT_API_NAME {
              new_sites_root = tag_id
            }
            if tag_api_name == IPDB_PROJECTS_ROOT_API_NAME {
              new_projects_root = tag_id
            }
          }

          new_tags_indexes[tag_id] = i

          new_tags[i] = M{
            "id": tag_id,
            "text": tag.Vs("tag_name"),
            "children": []string{},
            "data": M{
              "descr": tag.Vs("tag_descr"),
              "flags": tag.Vu("tag_flags"),
            },
          }
        }

        for i, tag := range rows {
          tag_id := tag.Vs("tag_id")
          if tag_id == STRING_ERROR { return errors.New("no tag_id") } //unlikely

          if tag["tag_fk_tag_id"] != nil {
            parent_id := tag.Vs("tag_fk_tag_id")
            if parent_id == STRING_ERROR { return errors.New("no tag_fk_tag_id") } //unlikely
            new_tags[i]["data"].(M)["parent_id"] = parent_id
            parent_index, ex := new_tags_indexes[parent_id]
            if !ex { return errors.New("no tag_fk_tag_id index") } //unlikely
            new_tags[parent_index]["children"] = append(new_tags[parent_index]["children"].([]string), tag_id)
          }
        }

        var tag_has_root func(string, string, int) (bool)

        tag_has_root = func(tag_id, root_id string, counter int) (bool) {
          var tag_index int
          var b bool
          if counter > 100 { return false }
          tag_index, b = new_tags_indexes[tag_id]
          if !b { return false }
          if tag_id == root_id { return true }
          if new_tags[tag_index]["data"].(M)["has_root_"+root_id] != nil { return true }
          if new_tags[tag_index]["data"].(M)["no_root_"+root_id] != nil { return false }
          if new_tags[tag_index]["data"].(M)["parent_id"] == nil { return false }

          if new_tags[tag_index]["data"].(M)["parent_id"].(string) == root_id {
            new_tags[tag_index]["data"].(M)["has_root_"+root_id] = struct{}{}
            return true
          }
          b = tag_has_root(new_tags[tag_index]["data"].(M)["parent_id"].(string), root_id, counter + 1)
          if b {
            new_tags[tag_index]["data"].(M)["has_root_"+root_id] = struct{}{}
          } else {
            new_tags[tag_index]["data"].(M)["no_root_"+root_id] = struct{}{}
          }
          return b
        }

        query = "SELECT v4net_addr, v4net_last, v4net_mask, v4net_tags, v4net_name FROM v4nets"
        if rows, err = Return_query_A(db, query); err != nil { return err }

        for _, row := range rows {
          if u64, var_ok = row.Uint64("v4net_addr"); !var_ok { return errors.New("no v4net_addr") }
          if u64 > math.MaxUint32 { return errors.New("bad ip") }
          net_addr := V4long2ip(uint32(u64))
          first := uint32(u64)

          if u64, var_ok = row.Uint64("v4net_last"); !var_ok { return errors.New("no v4net_last") }
          if u64 > math.MaxUint32 { return errors.New("bad last ip") }
          last := uint32(u64)

          if u64, var_ok = row.Uint64("v4net_mask"); !var_ok { return errors.New("no v4net_mask") }
          if u64 > 32 { return errors.New("bad mask") }
          mask := uint32(u64)

          net := fmt.Sprintf("%s/%d", net_addr, u64)

          new_net2name[net] = M{"name": row.Vs("v4net_name"), "mask": mask, "first": first, "last": last}

          net_tags, _ := row.String("v4net_tags")

          for _, tag_id := range strings.Split(net_tags, ",") {
            tag_id = strings.TrimSpace(tag_id)
            if _, ex := new_tags_indexes[tag_id]; !ex { continue }

            if new_sites_root != "" && tag_has_root(tag_id, new_sites_root, 0) {
              new_net2site[net] = M{"tag_id": tag_id, "first": first, "last": last}
            }

            if new_projects_root != "" && tag_has_root(tag_id, new_projects_root, 0) {
              if new_net2projects[net] == nil {
                new_net2projects[net] = make([]string, 0)
              }
              new_net2projects[net] = append(new_net2projects[net], tag_id)
            }
          }
        }

        query = "SELECT v4ip_addr, iv_value FROM"+
                " (((v4ips INNER JOIN v4nets ON v4ip_fk_v4net_id=v4net_id)"+
                " INNER JOIN n4cs ON nc_fk_v4net_id=v4net_id)"+
                " INNER JOIN ics ON nc_fk_ic_id=ic_id)"+
                " INNER JOIN i4vs ON iv_fk_ic_id=nc_fk_ic_id AND iv_fk_v4ip_id=v4ip_id"+
                " WHERE iv_value != '' AND (ic_type='tag' OR ic_type='multitag')"
        if rows, err = Return_query_A(db, query); err != nil { return err }

        for _, row := range rows {
          if u64, var_ok = row.Uint64("v4ip_addr"); !var_ok { return errors.New("no v4ip_addr") }
          if u64 > math.MaxUint32 { return errors.New("bad ip") }
          ip := V4long2ip(uint32(u64))

          ip_tags, _ := row.String("iv_value")

          for _, tag_id := range strings.Split(ip_tags, ",") {
            tag_id = strings.TrimSpace(tag_id)
            if _, ex := new_tags_indexes[tag_id]; !ex { continue }

            if new_sites_root != "" && tag_has_root(tag_id, new_sites_root, 0) {
              new_ip2site[ip] = tag_id
            }

            if new_projects_root != "" && tag_has_root(tag_id, new_projects_root, 0) {
              if new_ip2projects[ip] == nil {
                new_ip2projects[ip] = make([]string, 0)
              }
              new_ip2projects[ip] = append(new_ip2projects[ip], tag_id)
            }
          }
        }

        new_ip2name := make(map[string]string)

        query = "SELECT v4ip_addr, iv_value FROM"+
                " (((v4ips INNER JOIN v4nets ON v4ip_fk_v4net_id=v4net_id)"+
                " INNER JOIN n4cs ON nc_fk_v4net_id=v4net_id)"+
                " INNER JOIN ics ON nc_fk_ic_id=ic_id)"+
                " INNER JOIN i4vs ON iv_fk_ic_id=nc_fk_ic_id AND iv_fk_v4ip_id=v4ip_id"+
                " WHERE ic_api_name = 'hostname'"
        if rows, err = Return_query_A(db, query); err != nil { return err }

        for _, row := range rows {
          if u64, var_ok = row.Uint64("v4ip_addr"); !var_ok { return errors.New("no v4ip_addr") }
          if u64 > math.MaxUint32 { return errors.New("bad ip") }
          ip := V4long2ip(uint32(u64))

          hostname := strings.TrimSpace(row.Vs("iv_value"))
          new_ip2name[ip] = hostname
        }


        globalMutex.Lock()
        ip2name = new_ip2name
        ip2site = new_ip2site
        net2site = new_net2site
        net2name = new_net2name
        ip2projects = new_ip2projects
        net2projects = new_net2projects
        tags = new_tags
        tags_indexes = new_tags_indexes
        sites_root_tag = new_sites_root
        projects_root_tag = new_projects_root
        globalMutex.Unlock()

        return nil
      }
      err = ipdb_proc()
      if err != nil && opt_v > 0 {
        fmt.Println(err.Error())
      }
    }

    if !redis_loaded && red != nil && red.Err() == nil {
      var dev_map M

      dev_map, err = read_devlist(red)
      if err == nil {
        total_ips := uint64(len(dev_map))
        fast_start := max_open_files > total_ips+20
        var wg_ sync.WaitGroup
        for ip, _ := range dev_map {
          if ip_reg.MatchString(ip) && dev_map.Vs(ip, "state") != "conflict" {
            if opt_v > 1 {
              fmt.Println("Load IP", ip)
            }
            if fast_start {
              wg_.Add(1)
              go process_ip_data(&wg_, ip, true)
            } else {
              process_ip_data(nil, ip, true)
            }
          }
        }
        if fast_start { wg_.Wait() }
        redis_loaded = true

        globalMutex.Lock()
        for _, dev_m := range devs {
          ip_debug, _ := redis.String(red.Do("GET", "ip_debug."+dev_m.(M).Vs("data_ip")))
          processLinks(red, dev_m.(M), true, ip_debug)
        }
        globalMutex.Unlock()
      }
    }

    if redis_loaded && !queue_data_sub_launched {
      if opt_v > 0 {
        fmt.Println("Start processing live reports")
      }
      queue_data_sub_stop := make(chan string, 1)
      stop_channels = append(stop_channels, queue_data_sub_stop)

      wg.Add(1)
      queue_data_sub_launched = true
      go queue_data_sub(queue_data_sub_stop, &wg)
    }

    if opt_1 {
      //leave so soon?
      break MAIN_LOOP
    }

    if redis_loaded && !http_launched {
      if opt_v > 0 {
        fmt.Println("Starting listeners")
      }
      _stop_ch := make(chan string, 1)
      stop_channels = append(stop_channels, _stop_ch)

      wg.Add(1)
      http_launched = true
      go http_server(_stop_ch, &wg)

      sock_stop_ch := make(chan string, 1)
      stop_channels = append(stop_channels, sock_stop_ch)
      wg.Add(1)
      go socket_listener(sock_stop_ch, &wg)
    }

    if redis_loaded && queue_data_sub_launched && http_launched {
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
      if redis_loaded && red != nil && red.Err() == nil && !opt_P{
        if opt_v > 2 {
          fmt.Println("main timer: cleanup and status check")
        }
        var dev_map M
        dev_map, err = read_devlist(red)
        if err != nil {
          continue MAIN_LOOP
        }

        var mapper_run int64 = 0
        var redstr string
        redstr, err = redis.String(red.Do("GET", "mapper.run"))
        if err == nil {
          var gm_start int64
          var gm_last int64
          a := strings.Split(redstr, ":")
          if len(a) == 2 {
            gm_start, err = strconv.ParseInt(a[0], 10, 64)
            if err != nil { continue MAIN_LOOP }
            gm_last, err = strconv.ParseInt(a[1], 10, 64)
            if err != nil { continue MAIN_LOOP }
            mapper_run = gm_last - gm_start
          }
        }
        if err == redis.ErrNil { err = nil }
        if err != nil { continue MAIN_LOOP }

        globalMutex.Lock()

        //check for deleted ips from dev_list
        for ip, _ := range data.VM("dev_list") {
          if _, ok := dev_map[ip]; !ok {
            //no such ip in redis dev_list
            if dev_id, ok := data.Vse("dev_list", ip, "id"); ok {

              if opt_v > 1 {
                fmt.Println("main timer: wipe dev:", dev_id, "ip:", ip)
              }
              wipe_dev(dev_id)
            }
            delete(data.VM("dev_list"), ip)
          }
        }

        now_unix := time.Now().Unix()

        for dev_id, _ := range devs {
          ip := devs.Vs(dev_id, "data_ip")
          //check if dev ip is not in lists
          if _, ok := dev_map[ip]; !ok || !data.EvM("dev_list", ip) {
            if opt_v > 1 {
              fmt.Println("main timer: wipe dev:", dev_id, "ip:", ip)
            }
            wipe_dev(dev_id)
            delete(data.VM("dev_list"), ip)
          } else {
            /*if opt_v > 2 {
              fmt.Println("main timer: status check:", dev_id, "ip:", ip)
              fmt.Println("\tmapper_run:", mapper_run)
              fmt.Println("\tdev time age:", now_unix - devs.Vi(dev_id, "last_seen"))
              fmt.Println("\tdev_list time age:", now_unix - dev_map.Vi(ip, "time"))
              fmt.Println("\tdev_list state:", dev_map.Vs(ip, "state"))
            }*/
            // Process ip data to generte WARN/ERROR status
            //if mapper_run > 90 && (now_unix - devs.Vi(dev_id, "last_seen")) > WARN_AGE &&
            if mapper_run > 90 && (now_unix - devs.Vi(dev_id, "last_seen")) > DEAD_AGE &&
                    (now_unix - dev_map.Vi(ip, "time")) > 90 && dev_map.Vs(ip, "state") == "run" {
              wg.Add(1)
              go process_ip_data(&wg, ip, false)
            }
          }
        }

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
