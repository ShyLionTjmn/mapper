redis mutex
===========

requires "github.com/gomodule/redigo/redis"

get new mutex by calling redmutex.New("key")

lock with mutex.Lock(red redis.Conn, d time.Duration, timeout time.Duration)
unlock with mutex.Unlock()

based on: https://redis.io/topics/distlock
