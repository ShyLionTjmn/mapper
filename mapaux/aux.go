package mapaux

import (
  "strings"
  "strconv"
  "sync"
  "time"
  "runtime"
  "fmt"
  "errors"
  "math/rand"
)

func SplitByNum(s string) []interface{} {
  ret := make([]interface{}, 0)
  cur := int(0)
  for len(s[cur:]) > 0 {
    numpos := strings.IndexAny(s[cur:], "0123456789")
    if numpos == 0 {
      nnpos := 0
      for len(s[cur+nnpos:]) > 0 && strings.Index("0123456789", s[cur+nnpos:cur+nnpos+1]) >= 0 {
        nnpos++
      }
      ival, _ := strconv.ParseInt(s[cur:cur+nnpos], 10, 64)
      ret = append(ret, ival)
      cur += nnpos
    } else if numpos > 0 {
      ret = append(ret, s[cur:cur+numpos])
      cur += numpos
    } else {
      ret = append(ret, s[cur:])
      break
    }
  }
  return ret
}

type ByNum []string

func (a ByNum) Len() int		{ return len(a) }
func (a ByNum) Swap(i, j int)		{ a[i], a[j] = a[j], a[i] }
func (a ByNum) Less(i, j int) bool {
  aa := SplitByNum(a[i])
  ba := SplitByNum(a[j])

  alen := len(aa)
  blen := len(ba)

  mlen := alen
  if blen > alen { mlen=blen }

  for idx := 0; idx < mlen; idx++ {
    if idx >= alen {
      return true
    } else if idx >= blen {
      return false
    }

    switch aa[idx].(type) {
    case int64:

      switch ba[idx].(type) {
      case int64:
        if aa[idx].(int64) != ba[idx].(int64) {
          return aa[idx].(int64) < ba[idx].(int64)
        }
      case string:
        return true
      }

    case string:

      switch ba[idx].(type) {
      case int64:
        return false
      case string:
        if aa[idx].(string) != ba[idx].(string) {
          return strings.Compare(aa[idx].(string), ba[idx].(string)) < 0
        }
      }
    }
  }
  return true
}

type StrByNum []string

func (a StrByNum) Len() int		{ return len(a) }
func (a StrByNum) Swap(i, j int)		{ a[i], a[j] = a[j], a[i] }
func (a StrByNum) Less(i, j int) bool {
  ai, _ := strconv.Atoi(a[i])
  aj, _ := strconv.Atoi(a[j])
  return ai < aj
}

func IsHexNumber(s string) bool {
  if len(s) == 0 { return false }
  for c := 0; c < len(s); c++ {
    if strings.Index("0123456789abcdefABCDEF", s[c:c+1]) < 0 {
      return false
    }
  }
  return true
}

func IsNumber(s string) bool {
  if len(s) == 0 { return false }
  for c := 0; c < len(s); c++ {
    if strings.Index("0123456789", s[c:c+1]) < 0 {
      return false
    }
  }
  return true
}

func WaitTimeout(wg *sync.WaitGroup, timeout time.Duration) bool {
  c := make(chan struct{})
  go func() {
    defer close(c)
    wg.Wait()
  }()

  select {
    case <-c:
      return false // completed normally
    case <-time.After(timeout):
      return true // timed out
  }
}

func GetMemUsage() string {
  var m runtime.MemStats
  runtime.ReadMemStats(&m)
  // For info on each, see: https://golang.org/pkg/runtime/#MemStats
  return fmt.Sprintf("Alloc = %v KiB\tTotalAlloc = %v KiB\tSys = %v KiB\tNumGC = %v", BToKb(m.Alloc), BToKb(m.TotalAlloc), BToKb(m.Sys), m.NumGC)
}

func BToKb(b uint64) uint64 {
  return b / 1024
}

func IndexOf(a []string, k string) int64 {
  var i int64
  for i = 0; i < int64(len(a)); i++ { if a[i] == k { return i } }
  return -1
}

func ArraysIntersect(a, b []string) bool {
  for _, av := range a {
    if IndexOf(b, av) >= 0 { return true }
  }
  return false
}

func StrAppendOnce(a []string, s string) []string {
  if IndexOf(a, s) < 0 {
    return append(a, s)
  } else {
    return a
  }
}

func StrExclude(a []string, s string) []string {
	ret := make([]string, 0)
	for _, val := range a {
		if val != s {
			ret = append(ret, val)
		}
	}
	return ret
}

func StrSepIntErr(s string, sep string) (string, int64, error) {
  a := strings.Split(s, sep)
  if len(a) != 2 { return "", 0 , errors.New("no separator") }
  i, err := strconv.ParseInt(a[1], 10, 64)
  if err != nil { return "", 0 , err }
  return a[0], i, nil
}

func IntSepStrErr(s string, sep string) (int64, string, error) {
  a := strings.Split(s, sep)
  if len(a) != 2 { return 0, "", errors.New("no separator") }
  i, err := strconv.ParseInt(a[0], 10, 64)
  if err != nil { return 0, "", err }
  return i, a[1], nil
}

func LastResultDecode(s string) (string, int64, int64, string, error) {
  a:= strings.Split(s, ":")
  if len(a) < 4 { return "", 0, 0, "", errors.New("bad last_result format") }

  i1, err := strconv.ParseInt(a[1], 10, 64)
  if err != nil { return "", 0, 0, "", errors.New("bad last_result format") }

  i2, err := strconv.ParseInt(a[2], 10, 64)
  if err != nil { return "", 0, 0, "", errors.New("bad last_result format") }

  return a[0], i1, i2, strings.Join(a[3:], ":"), nil
}

func SafeDevId(s string) string {
  ret := s
  ret = strings.ReplaceAll(ret, " ", "_")
  ret = strings.ReplaceAll(ret, "/", "s")
  ret = strings.ReplaceAll(ret, "#", "S")
  ret = strings.ReplaceAll(ret, ":", "c")
  ret = strings.ReplaceAll(ret, "\t", "_")
  ret = strings.ReplaceAll(ret, ">", "_")
  ret = strings.ReplaceAll(ret, "<", "_")
  return ret
}

func SafeIntId(s string) string {
  ret := s
  ret = strings.ReplaceAll(ret, " ", "_")
  ret = strings.ReplaceAll(ret, "\t", "_")
  ret = strings.ReplaceAll(ret, ">", "_")
  ret = strings.ReplaceAll(ret, "<", "_")
  ret = strings.ReplaceAll(ret, "/", "s")
  ret = strings.ReplaceAll(ret, "#", "S")
  ret = strings.ReplaceAll(ret, ":", "c")
  return ret
}


var key_chars = []rune("abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTVWXY23456789")

func KeyGen(n int) string {
  b := make([]rune, n)
  for i := range b {
    b[i] = key_chars[rand.Intn(len(key_chars))]
  }
  return string(b)
}

