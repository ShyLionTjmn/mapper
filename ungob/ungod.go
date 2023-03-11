package main

import (
  "fmt"
  "os"
  "bytes"
  "encoding/gob"
  "github.com/gomodule/redigo/redis"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

func main() {
  if len(os.Args) == 1 ||
     (os.Args[1] != "GET" && os.Args[1] != "HGET") ||
     (os.Args[1] == "GET" && len(os.Args) != 3) ||
     (os.Args[1] == "HGET" && len(os.Args) != 4) ||
  false {
    fmt.Println("Usage: " + os.Args[0] + " " + "(GET key|HGET hash hash_key)")
    return
  }

  var err error
  var red redis.Conn

  if red, err = RedisCheck(red, "unix", REDIS_SOCKET, "0"); err != nil { panic(err) }
  defer red.Close()

  rargs := redis.Args{}
  for _, arg := range os.Args[2:] {
    rargs = rargs.Add(arg)
  }

  var redbytes []byte
  if redbytes, err = redis.Bytes(red.Do(os.Args[1], rargs...)); err != nil {
    if err == redis.ErrNil {
      return
    }
    panic(err)
  }

  gob.Register(M{})
  gob.Register(map[string]interface{}{})
  gob.Register([]interface{}{})

  buf := bytes.NewBuffer(redbytes)
  dec := gob.NewDecoder(buf)
  var m M
  if err = dec.Decode(&m); err != nil { panic(err) }

  fmt.Println(m.ToJsonStr(true))
}
