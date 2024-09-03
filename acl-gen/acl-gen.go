package main

import (
  "fmt"
  "log"
  "time"
  "net"
  "os"
  "io/fs"
  "bufio"
  "strings"
  "os/signal"
  "syscall"
  "sync"
  "regexp"
  "flag"
  "encoding/gob"
  . "github.com/ShyLionTjmn/mapper/mapaux"

  "github.com/marcsauter/single"

  "database/sql"
  _ "github.com/go-sql-driver/mysql"
)

var devs M
var database M

type StatusMsg struct {
  id string
  msg string
}

var masklen2mask []string  = []string{
  "0.0.0.0", // /0
  "128.0.0.0",
  "192.0.0.0",
  "224.0.0.0",
  "240.0.0.0",
  "248.0.0.0",
  "252.0.0.0",
  "254.0.0.0",
  "255.0.0.0", // /8
  "255.128.0.0",
  "255.192.0.0",
  "255.224.0.0",
  "255.240.0.0",
  "255.248.0.0",
  "255.252.0.0",
  "255.254.0.0",
  "255.255.0.0", // /16
  "255.255.128.0",
  "255.255.192.0",
  "255.255.224.0",
  "255.255.240.0",
  "255.255.248.0",
  "255.255.252.0",
  "255.255.254.0",
  "255.255.255.0", // /24
  "255.255.255.128",
  "255.255.255.192",
  "255.255.255.224",
  "255.255.255.240",
  "255.255.255.248",
  "255.255.255.252",
  "255.255.255.254",
  "255.255.255.255",
}

var g_og_entry_reg *regexp.Regexp
var g_cisco_pager_reg *regexp.Regexp

var opt_i bool // ignore cache file
var opt_c string // mapper.conf location

func init() {
  gob.Register(M{})
  gob.Register(map[string]interface{}{})

  g_og_entry_reg = regexp.MustCompile(` ((?:host|\d+\.\d+\.\d+\.\d+) \d+\.\d+\.\d+\.\d+)$`)
  g_cisco_pager_reg = regexp.MustCompile(`--[Mm]ore--`)
}

var config Config

func main() {
  var err error


  flag.BoolVar(&opt_i, "i", false, "Ignore cache file")
  flag.StringVar(&opt_c, "c", DEFAULT_CONFIG_FILE, "mapper.conf location")
  flag.Parse()

  config = LoadConfig(opt_c, FlagPassed("c"))

  single_run := single.New("acl-gen")

  if err = single_run.CheckLock(); err != nil && err == single.ErrAlreadyRunning {
    log.Fatal("another instance of the app is already running, exiting")
  } else if err != nil {
    log.Fatalf("failed to acquire exclusive app lock: %v", err)
  }
  defer single_run.TryUnlock()

  conn, err := net.DialTimeout("unix", config.Broker_unix_socket, time.Second)
  if err != nil {
    panic(err)
  }
  defer conn.Close()

  _, err = conn.Write([]byte("acl-gen\n"))
  if err != nil {
    panic(err)
  }

  dec := gob.NewDecoder(conn)

  err = dec.Decode(&devs)

  if err != nil {
    panic(err)
  }

  devs_list := []string{}

  for id, _ := range devs {
    if true &&
       strings.HasPrefix(strings.ToLower(devs.Vs(id, "model_short")), "cisco") &&
       ( len(flag.Args()) == 0 ||
         IndexOf(flag.Args(), devs.Vs(id, "short_name")) >= 0 ||
         ArraysIntersect(flag.Args(), devs.VA(id, "ips").([]string)) ||
       false) &&
    true {
      fname := config.Devs_configs_dir + "/" + devs.Vs(id, "short_name") + ".config"
      fstat, err := os.Stat(fname)
      if err != nil ||
         fstat.IsDir() ||
         (fstat.Mode() & fs.ModeType) > 0 ||
      false {
        fmt.Printf("% -20s  % -15s  % -20s: no config\n",
          devs.Vs(id, "short_name"),
          devs.Vs(id, "data_ip"),
          devs.Vs(id, "model_short"),
        )
      } else {
        fh, err := os.Open(fname)
        if err == nil {
          has_ob := false
          scanner := bufio.NewScanner(fh)
          for scanner.Scan() {
            if strings.HasPrefix(scanner.Text(), "object-group") {
              has_ob = true
              break
            }
          }
          fh.Close()
          if has_ob {
            if devs.Vs(id, "overall_status") == "ok" {
              devs_list = append(devs_list, id)
            } else {
              fmt.Printf("% -20s  % -15s  % -20s: is down\n",
                devs.Vs(id, "short_name"),
                devs.Vs(id, "data_ip"),
                devs.Vs(id, "model_short"),
              )
            }
          } else {
            fmt.Printf("% -20s  % -15s  % -20s: OB not supported\n",
              devs.Vs(id, "short_name"),
              devs.Vs(id, "data_ip"),
              devs.Vs(id, "model_short"),
            )
          }
        } else {
          fmt.Println(err.Error())
        }
      }
    }
  }

  if len(devs_list) == 0 {
    fmt.Println("No suitable device found")
    return
  }

  var db *sql.DB
  var query string

  if db, err = sql.Open("mysql", config.Ipdb_dsn); err != nil { panic(err) }
  defer db.Close()

  query = "SELECT t.tag_id, t.tag_name" +
          " FROM tags t INNER JOIN tags pt ON t.tag_fk_tag_id = pt.tag_id" +
          " WHERE pt.tag_api_name='router_groups'"

  tags, err := Return_query_M(db, query, "tag_id")
  if err != nil { panic(err) }

  query = "SELECT INET_NTOA(v4oob_addr) as ip, v4oob_mask as mask, v4oob_tags as tags" +
          " FROM v4oobs" +
          " WHERE v4oob_tags != ''"
  oobs, err := Return_query_A(db, query)
  if err != nil { panic(err) }

  database = M{}

  for _, oob_row := range oobs {
    for _, tag_id := range strings.Split(oob_row.Vs("tags"), ",") {
      if tags.EvM(tag_id) {
        //fmt.Println(oob_row.Vs("ip"),"/",oob_row.Vs("mask"), ": ", tags.Vs(tag_id, "tag_name"))
        var ipmask string
        if oob_row.Vu("mask") == 32 {
          ipmask = "host " + oob_row.Vs("ip")
        } else {
          ipmask = oob_row.Vs("ip") + " " + masklen2mask[oob_row.Vu("mask")]
        }
        database.MkM("ACLGEN_" + tags.Vs(tag_id, "tag_name"))[ipmask] = 1
      }
    }
  }

  //fmt.Println(database.ToJsonStr(true))

  var wg sync.WaitGroup
  stop_ch := make(StopCloseChan)

  sig_ch := make(chan os.Signal, 1)
  signal.Notify(sig_ch, syscall.SIGHUP)
  signal.Notify(sig_ch, syscall.SIGINT)
  signal.Notify(sig_ch, syscall.SIGTERM)
  signal.Notify(sig_ch, syscall.SIGQUIT)

  status_ch := make(chan StatusMsg, 10)

  for _, id := range devs_list {
    wg.Add(1)
    go work_router(id, stop_ch, &wg, status_ch)
  }

  wait_ch := make(chan struct{})

  go func() {
    wg.Wait()
    close(wait_ch)
    fmt.Println("main: Wait finished")
  } ()

  ticker := time.NewTicker(5 * time.Second)

  devs_status := M{}

  MAIN_LOOP:  for {
    select {
    case <-wait_ch:
      //all goroutines finished normally
      fmt.Println("main: Normal finish")
      break MAIN_LOOP
    case s := <-sig_ch:
      if s != syscall.SIGHUP && s != syscall.SIGUSR1 {
        fmt.Println("main: User exit signalled, terminating workers")
        close(stop_ch)
        break MAIN_LOOP
      }
    case status := <-status_ch:
      if strings.HasPrefix(status.msg, "exit") {
        devs_list = StrExclude(devs_list, status.id)
      }
      devs_status[status.id] = status.msg
    case <-ticker.C:
      fmt.Println("main: still working on:")
      for _, id := range devs_list {
        fmt.Printf("\t% -20s  %s", devs.Vs(id, "short_name"), devs.Vs(id, "data_ip"))
        if devs_status.Evs(id) {
          fmt.Print("  " + devs_status.Vs(id))
        }
        fmt.Println()
      }
      fmt.Println()
    }
  }

  if WaitTimeout(&wg, 5 * time.Second) {
    fmt.Println("main: Tired of wating. Just quitting")
  }

  fmt.Println("Summary")
  for id, _ := range devs_status {
    fmt.Printf("\t% -20s  % -15s  %s\n", devs.Vs(id, "short_name"), devs.Vs(id, "data_ip"), devs_status[id])
  }
}

func work_router(id string, stop_ch StopCloseChan, wg *sync.WaitGroup, status_ch chan StatusMsg) {
  defer wg.Done()

  status_ch <- StatusMsg{id: id, msg: "startup"}

  fmt.Printf("% -20s  % -15s  % -20s: work\n",
    devs.Vs(id, "short_name"),
    devs.Vs(id, "data_ip"),
    devs.Vs(id, "model_short"),
  )

  var err error

  dev_cache := M{}

  del_items := M{}
  add_items := M{}

  ssh_connected := false

  con := NewSshConn()
  con.Lines = 0
  con.Cols = 0
  con.Term = "xterm"
  con.PagerReg = g_cisco_pager_reg
  con.PagerSend = " "

  exec_exp := "^" + regexp.QuoteMeta(devs.Vs(id, "short_name") + "#")
  // tmn-pleh-back4451xve
  conf_short_name := devs.Vs(id, "short_name")
  if len(conf_short_name) > 20 {
    conf_short_name = conf_short_name[:20]
  }

  config_exp := "^" + regexp.QuoteMeta(conf_short_name + "(config)#")
  config_og_exp := "^" + regexp.QuoteMeta(conf_short_name + "(config-network-group)#")


  cache_loaded := false
  cache_fn := config.Acl_gen_db_dir + devs.Vs(id, "short_name") + ".hash"

  del_count := 0

  if !opt_i {
    fh, err := os.Open(cache_fn)

    if err == nil {
      status_ch <- StatusMsg{id: id, msg: "cache load"}
      sc := bufio.NewScanner(fh)

      for sc.Scan() {
        line := sc.Text()
        pos := strings.Index(line, "!")
        if pos <= 0 {
          continue
        }
        rg := line[:pos]
        pairs := strings.Split(line[pos+1:], ":")

        if len(pairs) > 0 {
          for _, pair := range pairs {
            if !database.EvA(rg, pair) {
              del_items.MkM(rg)[pair] = 1
              del_count++
            } else {
              dev_cache.MkM(rg)[pair] = 1
            }
          }
        }
      }

      fh.Close()

      if sc.Err() != nil {
        fmt.Println(devs.Vs(id, "short_name") + ": " + sc.Err().Error())
        status_ch <- StatusMsg{id: id, msg: "exit cache scan error: " + sc.Err().Error()}
        return
      }

      cache_loaded = true
    }
  }

  if !cache_loaded {
    status_ch <- StatusMsg{id: id, msg: "connecting"}
    err = con.Connect(devs.Vs(id, "data_ip"), config.Acl_gen_user, config.Acl_gen_pass, stop_ch)
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + " SSH ERROR: " + err.Error())
      status_ch <- StatusMsg{id: id, msg: "exit ssh connect error: " + err.Error()}
      return
    }
    defer con.Close()

    ssh_connected = true

    status_ch <- StatusMsg{id: id, msg: "wait prompt"}

    res, err := con.Expect(3*time.Second, exec_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit start expect exec_prompt error: " + err.Error() + "\n" + res}
      return
    }

    status_ch <- StatusMsg{id: id, msg: "term len 0"}

    con.Cmd("term len 0")

    status_ch <- StatusMsg{id: id, msg: "wait prompt"}

    res, err = con.Expect(3*time.Second, exec_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit term len 0 expect exec_prompt error: " + err.Error() + "\n" + res}
      return
    }

    status_ch <- StatusMsg{id: id, msg: "listing object-groups"}

    for rg, _ := range database {
      status_ch <- StatusMsg{id: id, msg: "listing object-group " + rg}
      con.Cmd("show run | sect object-group network " + rg)

      res, err = con.Expect(5*time.Second, exec_exp, "")
      if err != nil {
        fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
        fmt.Println("result:\n" + res + "\n")
        status_ch <- StatusMsg{id: id, msg: "exit list ob expect exec_prompt error: " + err.Error() + "\n" + res}
        return
      }

      count := 0

      for _, line := range strings.Split(res, "\n") {
        if a := g_og_entry_reg.FindStringSubmatch(line); a != nil {
          pair := a[1]
          count++

          status_ch <- StatusMsg{id: id, msg: "listing object-group " + rg + fmt.Sprintf(" %d lines", count)}

          if !database.EvA(rg, pair) {
            del_items.MkM(rg)[pair] = 1
            del_count++
          } else {
            dev_cache.MkM(rg)[pair] = 1
          }
        } else {
          //fmt.Printf("Not matched: \"%s\" vs `%s`\n", line, g_og_entry_reg.String())
          //fmt.Println([]byte(line))
        }
      }
    }
  }

  add_count := 0

  for rg, _ := range database {
    for pair, _ := range database.VM(rg) {
      if !dev_cache.EvA(rg, pair) {
        dev_cache.MkM(rg)[pair] = 1
        add_items.MkM(rg)[pair] = 1
        add_count++
      }
    }
  }

  fmt.Println(devs.Vs(id, "short_name") + " add: " + fmt.Sprintf("%d lines", add_count) + " del: " + fmt.Sprintf("%d lines", del_count))

  if len(add_items) == 0 && len(del_items) == 0 {
    fmt.Println(devs.Vs(id, "short_name") + ": nothing to do")
    status_ch <- StatusMsg{id: id, msg: "exit nothing to do"}
    return
  }

  if !ssh_connected {
    status_ch <- StatusMsg{id: id, msg: "connecting"}
    err = con.Connect(devs.Vs(id, "data_ip"), config.Acl_gen_user, config.Acl_gen_pass, stop_ch)
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + " SSH ERROR: " + err.Error())
      status_ch <- StatusMsg{id: id, msg: "exit connect ssh error: " + err.Error()}
      return
    }
    defer con.Close()

    ssh_connected = true

    status_ch <- StatusMsg{id: id, msg: "wait prompt"}
    res, err := con.Expect(3*time.Second, exec_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit start expect exec_prompt error: " + err.Error() + "\n" + res}
      return
    }

    status_ch <- StatusMsg{id: id, msg: "term len 0"}

    con.Cmd("term len 0")

    status_ch <- StatusMsg{id: id, msg: "wait prompt"}

    res, err = con.Expect(3*time.Second, exec_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit term len 0 expect exec_prompt error: " + err.Error() + "\n" + res}
      return
    }

  }

  con.Cmd("configure terminal")

  status_ch <- StatusMsg{id: id, msg: "wait prompt for \"conf t\""}

  res, err := con.Expect(10*time.Second, config_exp, "")
  if err != nil {
    fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
    fmt.Println("result:\n" + res + "\n")
    status_ch <- StatusMsg{id: id, msg: "exit start expect config_prompt error: " + err.Error() + "\n" + res}
    return
  }


  for rg, _ := range del_items {
    status_ch <- StatusMsg{id: id, msg: "deleting from " + rg}

    con.Cmd("object-group network " + rg)

    count := 0
    total_count := len(del_items.VM(rg))

    res, err = con.Expect(10*time.Second, config_og_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit del start expect config_ob_prompt error: " + err.Error() + "\n" + res}
      return
    }

    for pair, _ := range del_items.VM(rg) {

      status_ch <- StatusMsg{id: id, msg: "deleting from " + rg + fmt.Sprintf(" %d of %d", count, total_count)}

      con.Cmd("no " + pair)

      res, err = con.Expect(10*time.Second, config_og_exp, "")
      if err != nil {
        fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
        fmt.Println("result:\n" + res + "\n")
        status_ch <- StatusMsg{id: id, msg: "exit del pair expect config_ob_prompt error: " + err.Error() + "\n" + res}
        return
      }
      count++
    }

    status_ch <- StatusMsg{id: id, msg: "return to config after del from " + rg}
    con.Cmd("exit")

    res, err = con.Expect(10*time.Second, config_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit del exit expect config_prompt error: " + err.Error() + "\n" + res}
      return
    }
  }

  for rg, _ := range add_items {
    status_ch <- StatusMsg{id: id, msg: "adding to " + rg}

    con.Cmd("object-group network " + rg)

    res, err = con.Expect(10*time.Second, config_og_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit add start expect config_ob_prompt error: " + err.Error() + "\n" + res}
      return
    }

    count := 0
    total_count := len(add_items.VM(rg))

    for pair, _ := range add_items.VM(rg) {
      status_ch <- StatusMsg{id: id, msg: "adding to " + rg + fmt.Sprintf(" %d of %d", count, total_count)}

      con.Cmd(pair)

      res, err = con.Expect(10*time.Second, config_og_exp, "")
      if err != nil {
        fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
        fmt.Println("result:\n" + res + "\n")
        status_ch <- StatusMsg{id: id, msg: "exit add pair expect config_ob_prompt error: " + err.Error() + "\n" + res}
        return
      }

      count++
    }

    status_ch <- StatusMsg{id: id, msg: "return to config after add to " + rg}
    con.Cmd("exit")

    res, err = con.Expect(10*time.Second, config_exp, "")
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      fmt.Println("result:\n" + res + "\n")
      status_ch <- StatusMsg{id: id, msg: "exit add exit expect config_prompt error: " + err.Error() + "\n" + res}
      return
    }
  }

  status_ch <- StatusMsg{id: id, msg: "return to exec after del/add"}
  con.Cmd("end")

  res, err = con.Expect(10*time.Second, exec_exp, "")
  if err != nil {
    fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
    fmt.Println("result:\n" + res + "\n")
    status_ch <- StatusMsg{id: id, msg: "exit end expect exec_prompt error: " + err.Error() + "\n" + res}
    return
  }

  status_ch <- StatusMsg{id: id, msg: "saving config"}
  con.Cmd("write memory")

  res, err = con.Expect(60*time.Second, exec_exp, "")
  if err != nil {
    fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
    fmt.Println("result:\n" + res + "\n")
    status_ch <- StatusMsg{id: id, msg: "exit write mem expect exec_prompt error: " + err.Error() + "\n" + res}
    return
  }

  status_ch <- StatusMsg{id: id, msg: "quitting session"}
  con.Cmd("exit")

  status_ch <- StatusMsg{id: id, msg: "saving cache"}
  fh, err := os.Create(cache_fn)
  if err != nil {
    fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
    status_ch <- StatusMsg{id: id, msg: "exit saving cache error: " + err.Error()}
    return
  }
  defer fh.Close()

  for rg, _ := range dev_cache {
    _, err = fh.Write([]byte(rg + "!"))
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      status_ch <- StatusMsg{id: id, msg: "exit saving cache error: " + err.Error()}
      return
    }
    pairs := []string{}
    for pair, _ := range dev_cache.VM(rg) {
      pairs = append(pairs, pair)
    }
    _, err = fh.Write([]byte( strings.Join(pairs, ":") + "\n" ))
    if err != nil {
      fmt.Println(devs.Vs(id, "short_name") + ": " + err.Error())
      status_ch <- StatusMsg{id: id, msg: "exit saving cache error: " + err.Error()}
      return
    }
  }
  fmt.Println(devs.Vs(id, "short_name") + ": Done")
  status_ch <- StatusMsg{id: id, msg: "exit done"}
}
