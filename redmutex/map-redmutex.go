package redmutex

import (
  "github.com/gomodule/redigo/redis"
  "time"
  "fmt"
  "errors"
)

const waitTime = 500*time.Millisecond

const del_script=`if redis.call("exists", KEYS[1]) == 1
then
  if redis.call("get",KEYS[1]) == ARGV[1]
  then
    return redis.call("del",KEYS[1])
  else
    return 0
  end
else
  return -1
end
`

type Mutex struct {
  key		string
  lock		string
  Locked	bool
  script	*redis.Script
}

func New(key string) *Mutex {
  return &Mutex{key: key, script: redis.NewScript(1, del_script)}
}

var ErrTimeout = errors.New("Mutex wait timed out")
var ErrAlreadyLocked = errors.New("Mutex already locked by us")
var ErrNotLocked = errors.New("Mutex not locked")
var ErrExpired = errors.New("Mutex key already expired")
var ErrNotUs = errors.New("Mutex key locked by other process")
var ErrScriptError = errors.New("Mutex del script returned unknown value")


// return nil if lock successfull
// return error if redis error
// return ErrAlreadyLocked if was already locked by us
// return ErrTimeout if locked by other process and wait timed out
//
func (m *Mutex)Lock(red redis.Conn, d time.Duration, timeout time.Duration) error {
  if m.Locked {
    //Lock should not be called after locking by same process
    return ErrAlreadyLocked
  }
  deadline := time.Now().Add(timeout)

  var res interface{}
  var err error

  for {
    lock := time.Now().String()
    res, err = red.Do("SET", m.key, lock, "PX", fmt.Sprintf("%v", d.Milliseconds()), "NX")
    if err != nil {
      return err
    }
    if res != nil {
      m.Locked = true
      m.lock = lock
      return nil
    } else {
      if time.Now().Add(waitTime).After(deadline) {
        return ErrTimeout
      } else {
        time.Sleep(waitTime)
      }
    }
  }
}


// return nil if prolonged
// return ErrNotLocked if was not locked by us
// return ErrExpired if key already expired
// return error if redis error
func (m *Mutex)Prolong(red redis.Conn, d time.Duration) (error) {
  if !m.Locked {
    return ErrNotLocked
  }
  res, err := red.Do("PEXPIRE", m.key, fmt.Sprintf("%v", d.Milliseconds()))

  if err != nil {
    return err
  }

  if res.(int64) != 1 {
    return ErrExpired
  } else {
    return nil
  }
}

// return nil if unlocked
// return ErrNotLocked if was not locked by us
// return ErrExpired if key already expired
// return ErrNotUs if key locked by other process
func (m *Mutex)Unlock(red redis.Conn) (error) {
  if !m.Locked {
    return ErrNotLocked
  }
  m.Locked = false

  res, err := m.script.Do(red, m.key, m.lock)

  if err != nil {
    return err
  }


  switch res.(int64) {
  case 1:
    return nil
  case 0:
    return ErrNotUs
  case -1:
    return ErrExpired
  default:
    return ErrScriptError
  }
}
