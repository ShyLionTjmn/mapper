package redsub

import (
  "sync"
  "fmt"
  //"errors"

  "github.com/gomodule/redigo/redis"
)

/*
  to kill just close connection by r.Conn.Close()
  and call r.W.Wait() before continue
*/

type Redsub struct {
  W		sync.WaitGroup
  C		chan string
  E		chan error
  Debug		bool
  Conn		redis.Conn
}

func New(red_stype, red_socket, red_db, red_channel string, chan_len int) (*Redsub, error) {

  r := &Redsub{}

  var err error

  r.Conn, err = redis.Dial(red_stype, red_socket)
  if err != nil {
    return nil, err
  }

  _, err = r.Conn.Do("SELECT", red_db)
  if err != nil {
    r.Conn.Close()
    return nil, err
  }

  r.C = make(chan string, chan_len)
  r.E = make(chan error, 1)

  r.Conn.Send("SUBSCRIBE", red_channel)
  r.Conn.Flush()

  r.W.Add(1)
  go func(r *Redsub) {
    defer func() { if r.Debug { fmt.Println("redsub: return") } } ()
    defer r.W.Done()
    defer close(r.C)
    defer close(r.E)
    defer r.Conn.Close()

    for {
      reply, err := r.Conn.Receive()
      if err != nil {
        if r.Debug { fmt.Println("redsub: got error", err) }
        r.E <- err
        return
      } else {
        if r.Debug { fmt.Println("redsub: got reply", reply) }
        var ok bool
        var ra []interface{}
        var bytes []uint8
        var kind string

        ra, ok = reply.([]interface{})
        if !ok {
          if r.Debug {
            fmt.Println("Type assertion error of reply:", reply)
          }
        }

        if ok && len(ra) != 3 {
          if r.Debug {
            fmt.Println("Short reply:", reply)
          }
          ok = false
        }
        if ok {
          bytes, ok = ra[0].([]uint8)
          if !ok {
            if r.Debug {
              fmt.Println("Type assertion error of reply kind:", reply)
            }
          } else {
            kind = string(bytes)
          }
        }

        if ok {
          _, ok = ra[1].([]uint8)
          if !ok {
            if r.Debug {
              fmt.Println("Type assertion error of reply channel:", reply)
            }
          }
        }

        if ok  && kind == "message" {
          bytes, ok = ra[2].([]uint8)
          if !ok {
            if r.Debug {
              fmt.Println("Type assertion error of reply message:", reply)
            }
          } else {
            message := string(bytes)
            r.C <- message
          }
        }
      }
    }
  } (r)

  return r, nil
}
