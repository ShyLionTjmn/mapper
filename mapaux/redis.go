package mapaux

import (
  "errors"
  "strings"
  "math/rand"
  "net"
  "time"
  "github.com/gomodule/redigo/redis"
)

func RedisCheck(r redis.Conn, red_sock_type, red_sock, red_db string) (redis.Conn, error) {
  var err error
  var red = r

  if r != nil && r.Err() == nil {
    _, err = r.Do("SELECT", red_db)
    if err != nil {
      r.Close()
      red = nil
    } else {
      return red, nil
    }
  }

  err = nil

  if red == nil {
    tries := 10
    for tries != 0 {
      red, err = redis.Dial(red_sock_type, red_sock)
      if err == nil {
        break
      }
      if nerr, ok := err.(net.Error); ok && nerr.Temporary() {
        time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
      } else {
        break
      }
      tries--
    }
  }

  if err != nil { return nil, err }

  _, err = red.Do("SELECT", red_db)
  if err != nil {
    red.Close()
    red = nil
  }

  return red, err
}


func RedHKeys(red redis.Conn, hash, prefix string) ([]string, error) {

  ret := []string{}

  arr, err := redis.Strings(red.Do("HKEYS", hash))
  if err == redis.ErrNil { return []string{}, nil }
  if err != nil { return nil, err }

  for _, key := range arr {
    if strings.HasPrefix(key, prefix) {
      ret = append(ret, key)
    }
  }

  return ret, nil
}
func RedKeys(red redis.Conn, pattern string) ([]string, error) {

  cursor := "0"

  ret := []string{}

  for {
    arr, err := redis.Values(red.Do("SCAN", cursor, "MATCH", pattern))
    if err == redis.ErrNil { return []string{}, nil }
    if err != nil { return nil, err }
    if len(arr) != 2 { return nil, errors.New("RedKeys: SCAN returned invalid result") }

    cursor, _ = redis.String(arr[0], nil)
    k, _ := redis.Strings(arr[1], nil)
    ret = append(ret, k...)

    if cursor == "0" {
        break
    }
  }
  return ret, nil
}
