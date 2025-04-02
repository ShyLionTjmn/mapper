package main

import (
  "errors"
  "strconv"
  "strings"
  "github.com/gomodule/redigo/redis"
)

func mac_vendor(mac string, red redis.Conn) (vendor string, err error) {
  if len(mac) != 12 { return "", errors.New("mac_vendor: Bad mac") }

  oui := strings.ToLower(mac[:6])
  oui28 := strings.ToLower(mac[:7])
  oui36 := strings.ToLower(mac[:9])

  var first_octet uint64

  first_octet, err = strconv.ParseUint(mac[1:2], 16, 4)
  if err != nil { return "", err }

  if (first_octet & 0x01) > 0 {
    return "MULTICAST", nil
  } else if (first_octet & 0x02) > 0 {
    return "RANDOM", nil
  }

  vendor, err = redis.String(red.Do("HGET", "oui", oui))

  if err == redis.ErrNil { return "n/d", err }
  if err != nil { return "", err }

  if vendor != "IEEE Registration Authority" { return }

  vendor, err = redis.String(red.Do("HGET", "oui", oui36))
  if err == nil { return }
  if err != redis.ErrNil { return "", err }

  vendor, err = redis.String(red.Do("HGET", "oui", oui28))
  if err == redis.ErrNil { return "n/d", err }
  if err == nil { return }
  return "", err
}
