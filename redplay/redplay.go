package main

import (
  "fmt"
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

  red, err = RedisCheck(red, "unix", REDIS_SOCKET, REDIS_DB)
  if err != nil { panic(err) }

  rargs := redis.Args{}.Add("testkey")

  arr := [][]uint8{ []uint8("k1"), []uint8("v1"), []uint8("k2"), []uint8("v2") }

  for _, v := range arr {
    rargs = rargs.Add(v)
  }

  _, err = red.Do("HSET", rargs...)
  if err != nil { panic(err) }
}
