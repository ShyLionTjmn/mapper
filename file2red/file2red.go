package main

import (
  "fmt"
  "os"
  "encoding/gob"

  "github.com/davecgh/go-spew/spew"
  "github.com/gomodule/redigo/redis"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)


func init() {
  gob.Register(M{})
  gob.Register([][]uint8{})
}

func main() {
  var red redis.Conn
  fmt.Print()
  _ = spew.Sdump(nil)

  defer func() { if red != nil { red.Close() } } ()

  var err error

  if len(os.Args)  < 2 || (os.Args[1] == "-y" && len(os.Args)  < 3) {
    fmt.Println("Usage: ", os.Args[0], " [-y] in_file [key1 ...]\n"+
                "\t-y\t - Really set values\n\tkey\t - keys list to set\n",
    )
  }

  opt_y := false
  var opt_f string

  var keys []string

  if os.Args[1] == "-y" {
    opt_y = true
    opt_f = os.Args[2]
    keys = os.Args[3:]
  } else {
    opt_f = os.Args[1]
    keys = os.Args[2:]
  }

  red, err = RedisCheck(red, "unix", REDIS_SOCKET, REDIS_DB)

  if err != nil {
    panic(err)
  }

  var in M

  var fh *os.File
  if fh, err = os.Open(opt_f); err != nil { panic(err) }
  defer fh.Close()

  dec := gob.NewDecoder(fh)
  if err = dec.Decode(&in); err != nil { panic(err) }

  if in == nil { return }

  for key, data := range in {
    fmt.Print(key, " ")
    if len(keys) == 0 || IndexOf(keys, key) >= 0 {

      rargs := redis.Args{}.Add(key)
      rcmd := ""

      switch(data.(M)["type"].(string)) {
      case "string":
        rcmd = "SET"
        rargs = rargs.Add(data.(M)["data"])
      case "hash":
        rcmd = "HSET"
        for _, arg := range data.(M)["data"].([][]uint8) {
          rargs = rargs.Add(arg)
          //fmt.Println("\t", string(arg))
        }
      case "list":
        rcmd = "RPUSH"
        for _, arg := range data.(M)["data"].([][]uint8) {
          rargs = rargs.Add(arg)
        }
      default:
        fmt.Println("Unsupported type")
        continue
      }
      fmt.Println(data.(M)["type"])
      //spew.Dump(rargs)
      if opt_y {
        if _, err = red.Do("DEL", key); err != nil { panic(err) }
        if _, err = red.Do(rcmd, rargs...); err != nil { panic(err) }
      }
    }
  }
}
