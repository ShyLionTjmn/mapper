package main

import (
  "fmt"
  "os"
  "errors"
  "flag"

  "github.com/ShyLionTjmn/mapper/redsub"
  . "github.com/ShyLionTjmn/mapper/mapaux"

)


var opt_v int
var channel string

func init() {
  errors.New("")

  flag.IntVar(&opt_v, "v", 0, "set verbosity level")

  flag.Parse()

  if flag.NArg() != 1 {
    fmt.Fprintln(os.Stderr, "one channel name should be set after all flags")
    os.Exit(1)
  }
  channel = flag.Arg(0)
}

func main() {
  config := LoadConfig(DEFAULT_CONFIG_FILE, true)

  sub, err := redsub.New("unix", config.Redis_socket, config.Redis_db, channel, 1)

  if err == nil {

LOOP:
    for {
      select {
      case m := <-sub.C:
        // got message on channel
        fmt.Println(m)
      case e := <-sub.E:
        // got error from goroutine, it will terminate itself
        fmt.Fprint(os.Stderr, e.Error())
        break LOOP
      }
    }
    sub.W.Wait()
  } else {
    fmt.Println(err.Error())
  }
}
