# redsub

```go
import "github.com/ShyLionTjmn/redsub"


// this call will try to subscribe to channel on given redis socket or address
// will return (nil, error) on connection error
// on success there will be goroutine lanuched, listening for messages
// it will send received "message" down to string channel sub.C
// on any redis error will send error down to error channel sub.E AND terminate
// closing redis connection and both channels
// caller should wait on sub.W sync.WaitGroup before continue
// Close() redis connection sub.Conn to terminate

sub, err := redsub.New("unix", "/tmp/redis.sock", "0" /*redis db for connection checks only*/, "channel", 1 /*message channel length*/)

if err == nil {

  timer := time.NewTimer(time.Minute)
  time_to_exit := false
  
LOOP:
  for !time_to_exit {
    select {
    case <-timer.C:
      //time to exit
      time_to_exit = true
      sub.Conn.Close()
      break LOOP
    case m := <-sub.C:
      // got message on channel
      fmt.Println(m)
    case e := <=sub.E:
      // got error from goroutine, it will terminate itself
      if !time_to_exit {
        //this wasn't us!
        fmt.Fprint(os.Stderr, e.Error())
      }
      break LOOP
    }
  }
  sub.W.Wait()
}
```
