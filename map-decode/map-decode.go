package main

import (
  "os"
  "fmt"
  "github.com/gomodule/redigo/redis"
  . "github.com/ShyLionTjmn/mapper/mapaux"
  . "github.com/ShyLionTjmn/mapper/decode_dev"
)

func main() {
  if len(os.Args) == 1 {
    return
  }

  var err error
  var red redis.Conn

  config := LoadConfig(DEFAULT_CONFIG_FILE, true)

  red, err = RedisCheck(red, "unix", config.Redis_socket, config.Redis_db)

  if red == nil {
    panic(err)
  }

  defer red.Close()

  ip := os.Args[1]

  raw, err := GetRawRed(red, ip)
  if red == nil {
    panic(err)
  }

  device := Dev{ Opt_m: true, Opt_a: true, Dev_ip: ip }

  err = device.Decode(raw)
  if err != nil {
    panic(err)
  }

  dev := device.Dev

  out := M{"dev": dev, "raw": raw}
  fmt.Println(out.ToJsonStr(true))
}
