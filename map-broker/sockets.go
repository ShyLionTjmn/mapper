package main

import (
  "net"
  "time"
  "sync"
  "fmt"
  "os"
  "errors"
  "strings"
  "encoding/gob"
  "encoding/json"
  "github.com/gomodule/redigo/redis"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

func init() {
  gob.Register(M{})
  gob.Register(map[string]interface{}{})
}

func socket_listener(stop chan string, wg *sync.WaitGroup) {
  defer wg.Done()

  var err error

  _, serr := os.Stat(config.Broker_unix_socket)
  if serr == nil {
    os.Remove(config.Broker_unix_socket)
  }
  listener, listen_err := net.Listen("unix", config.Broker_unix_socket)
  if listen_err != nil {
    panic("Listening error: "+listen_err.Error())
  }
  os.Chmod(config.Broker_unix_socket, 0777)

  var lwg sync.WaitGroup

  go func() {
    lwg.Add(1)
    defer lwg.Done()
    for {
      conn, acc_err := listener.Accept()
      if acc_err != nil {
        if errors.Is(acc_err, net.ErrClosed) {
          fmt.Println("\nStoping listener")
        } else {
          fmt.Println("Accept error: "+acc_err.Error())
        }
        break
      }
      go func() {
        lwg.Add(1)
        defer lwg.Done()
        defer conn.Close()


        cmd_ch := make(chan string)

        go func(ch chan string) {
          var cmd string
          for {
            var buff []byte
            buff = make([]byte, 1024)
            read, rerr := conn.Read(buff)
            if rerr != nil {
              return
            }
            if read > 0 {
              cmd += string(buff[:read])

              if idx := strings.LastIndex(cmd, "\n"); idx >= 0 {
                ch <- cmd[:idx]
                return
              }
            }
          }
        } (cmd_ch)

        var command string

        cmd_timer := time.NewTimer(1000 * time.Millisecond)

        have_command := false

        select {
        case command = <-cmd_ch:
          //we have command
          cmd_timer.Stop()
          have_command = true
        case <-cmd_timer.C:
        case <-stop:
        }

        if !have_command {
          return
        }

        var red redis.Conn
        if red, err = RedisCheck(red, "unix", config.Redis_socket, config.Redis_db); err != nil { return }
        defer red.Close()

        var fields_json []byte
        fields_json, err = redis.Bytes(red.Do("GET", "broker." + command + "_fields"))
        if err == redis.ErrNil {
          fields_json = []byte{}
        } else if err != nil {
          return
        }

        var fields M

        if len(fields_json) > 0 {
          if err = json.Unmarshal(fields_json, &fields); err != nil {
            fields = nil
          }
        }

        //if fields != nil {
        //  fmt.Println(fields.ToJsonStr(true))
        //}

        globalMutex.RLock()
        defer globalMutex.RUnlock()

        out := M{}
        enc := gob.NewEncoder(conn)

        switch command {
        case "":
          out = devs

        case "acl-gen":
          for id, _ := range devs {
            ip_count := 0
            dev_ips := []string{}
            for ifName, _ := range devs.VM(id, "interfaces") {
              for ip, _ := range devs.VM(id, "interfaces", ifName, "ips") {
                if devs.Vu(id, "interfaces", ifName, "ifAdminStatus") == 1 &&
                   !strings.HasPrefix(ip, "127.") &&
                   !strings.HasPrefix(ip, "0.") &&
                true {
                  ip_count ++
                  dev_ips = append(dev_ips, ip)
                }
              }
            }
            if ip_count > 1 {
              dev := out.MkM(id)
              dev["overall_status"] = devs.Vs(id, "overall_status")
              dev["data_ip"] = devs.Vs(id, "data_ip")
              dev["short_name"] = devs.Vs(id, "short_name")
              dev["ips"] = dev_ips
              dev["model_short"] = devs.Vs(id, "model_short")
              dev["sysObjectID"] = devs.Vs(id, "sysObjectID")
            }
          }

        default:
          for id, _ := range devs {
            ip_count := 0
            dev_ips := []string{}
            for ifName, _ := range devs.VM(id, "interfaces") {
              for ip, _ := range devs.VM(id, "interfaces", ifName, "ips") {
                if devs.Vu(id, "interfaces", ifName, "ifAdminStatus") == 1 &&
                   !strings.HasPrefix(ip, "127.") &&
                   !strings.HasPrefix(ip, "0.") &&
                true {
                  ip_count ++
                  dev_ips = append(dev_ips, ip)
                }
              }
            }
            var out_dev M

            if fields != nil {
              out_dev = front_dev(devs.VM(id), fields)
            } else {
              out_dev = devs.VM(id)
            }
            out_dev["ips_count"] = ip_count
            out_dev["ips"] = dev_ips

            out[id] = out_dev
          }

          //switch
        }
        enc.Encode(out)
      } ()
    }

  }()

  <-stop
  listener.Close()

  WaitTimeout(&lwg, 1*time.Second)
}
