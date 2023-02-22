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
  var result interface{}

  fmt.Print()
  _ = spew.Sdump(nil)

  defer func() { if red != nil { red.Close() } } ()

  var err error

  if len(os.Args)  < 3 {
    fmt.Println("Usage: ", os.Args[0], " out_file key1 [key2 ...]")
  }

  red, err = RedisCheck(red, "unix", REDIS_SOCKET, REDIS_DB)

  if err != nil {
    panic(err)
  }

  out := M{}

  for i, arg := range os.Args {
    if i < 2 { continue }
    cursor := "0"
    for {
      result, err = red.Do("SCAN", cursor, "MATCH", arg, "COUNT", 1000)
      if err != nil { panic(err) }
      cursor = string(result.([]interface{})[0].([]uint8))
      values := result.([]interface{})[1].([]interface{})
      for _, vali := range values {
        key := string(vali.([]uint8))
        var key_type string
        if key_type, err = redis.String(red.Do("TYPE", key)); err != nil { panic(err) }
        fmt.Println(key, key_type)

        var save_data interface{}

        switch key_type {
        case "string":
          save_data, err = redis.Bytes(red.Do("GET", key))
        case "hash":
          save_data, err = redis.ByteSlices(red.Do("HGETALL", key))
        case "list":
          save_data, err = redis.ByteSlices(red.Do("LRANGE", key, 0, -1))
        default:
          continue
        }

        if err != nil { panic(err) }

        out[key] = M{"type": key_type, "data": save_data}

      }
      if cursor == "0" { break }
    }
  }

  if len(out) != 0 {
    var fh *os.File
    if fh, err = os.OpenFile(os.Args[1], os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o660); err != nil { panic(err) }
    defer fh.Close()

    enc := gob.NewEncoder(fh)
    if err = enc.Encode(out); err != nil { panic(err) }
  }
}
