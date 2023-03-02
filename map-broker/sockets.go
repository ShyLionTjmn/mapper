package main

import (
  "net"
  "time"
  "sync"
  "fmt"
  "os"
  "errors"
  "encoding/gob"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

func init() {
  gob.Register(M{})
  gob.Register(map[string]interface{}{})
}

func socket_listener(stop chan string, wg *sync.WaitGroup) {
  defer wg.Done()

  listener, listen_err := net.Listen("unix", opt_u)
  if listen_err != nil {
    panic("Listening error: "+listen_err.Error())
  }
  os.Chmod(opt_u, 0777)

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

        globalMutex.RLock()
        defer globalMutex.RUnlock()

        enc := gob.NewEncoder(conn)
        enc.Encode(devs)
      } ()
    }

  }()

  <-stop
  listener.Close()

  WaitTimeout(&lwg, 1*time.Second)
}
