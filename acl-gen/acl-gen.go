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
  "encoding/gob"
  . "github.com/ShyLionTjmn/mapper/mapaux"

  "github.com/marcsauter/single"

  "database/sql"
  _ "github.com/go-sql-driver/mysql"
)

const CONFIGS_DIR = "/data/configs/"
const DB_DIR = "/data/apps_db/acl-gen/"

func init() {
  gob.Register(M{})
  gob.Register(map[string]interface{}{})
}

func main() {
  var err error

  single_run := single.New("acl-gen")

  if err = single_run.CheckLock(); err != nil && err == single.ErrAlreadyRunning {
    log.Fatal("another instance of the app is already running, exiting")
  } else if err != nil {
    log.Fatalf("failed to acquire exclusive app lock: %v", err)
  }
  defer single_run.TryUnlock()

  conn, err := net.DialTimeout("unix", BROKER_UNIX_SOCKET, time.Second)
  if err != nil {
    panic(err)
  }
  dec := gob.NewDecoder(conn)

  var devs M

  err = dec.Decode(&devs)

  conn.Close()

  if err != nil {
    panic(err)
  }

  devs_list := []string{}

  for id, _ := range devs {
    ip_count := 0
    dev_ips := []string{}
    for ifName, _ := range devs.VM(id, "interfaces") {
      for ip, _ := range devs.VM(id, "interfaces", ifName, "ips") {
        if devs.Vu(id, "interfaces", ifName, "ifOperStatus") == 1 &&
           !strings.HasPrefix(ip, "127.") &&
        true {
          ip_count ++
          dev_ips = append(dev_ips, ip)
        }
      }
    }
    if true &&
       ip_count > 1 &&
       strings.HasPrefix(strings.ToLower(devs.Vs(id, "model_short")), "cisco") &&
       ( len(os.Args) == 1 ||
         IndexOf(os.Args[1:], devs.Vs(id, "short_name")) >= 0 ||
         ArraysIntersect(os.Args[1:], dev_ips) ||
       false) &&
    true {
      fname := CONFIGS_DIR + devs.Vs(id, "short_name") + ".config"
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

  if db, err = sql.Open("mysql", IPDB_DSN); err != nil { panic(err) }
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

  database := M{}

  for _, oob_row := range oobs {
    for _, tag_id := range strings.Split(oob_row.Vs("tags"), ",") {
      if tags.EvM(tag_id) {
        //fmt.Println(oob_row.Vs("ip"),"/",oob_row.Vs("mask"), ": ", tags.Vs(tag_id, "tag_name"))
        database.MkM(tags.Vs(tag_id, "tag_name"))[ oob_row.Vs("ip") ] = oob_row.Vu("mask")
      }
    }
  }

  //fmt.Println(database.ToJsonStr(true))


  for _, id := range devs_list {
    fmt.Printf("% -20s  % -15s  % -20s: work\n",
      devs.Vs(id, "short_name"),
      devs.Vs(id, "data_ip"),
      devs.Vs(id, "model_short"),
    )
  }
}
