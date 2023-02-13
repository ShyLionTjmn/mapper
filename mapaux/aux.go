package mapaux

import (
  "strings"
  "strconv"
  "sync"
  "time"
  "runtime"
  "fmt"
  "errors"
  "encoding/json"
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

type M map[string]interface{}

func (m M) e(k string) bool {
  _, ret := m[k]
  return ret
}

func (m M) Evu(k ... string) bool {
  if len(k) == 0 { return false }

  if !m.e(k[0]) { return false }
  switch m[k[0]].(type) {
  case M:
    return m[k[0]].(M).Evu(k[1:]...)
  case uint64:
    return len(k) == 1
  default:
    return false
  }
}

func (m M) Evi(k ... string) bool {
  if len(k) == 0 { return false }

  if !m.e(k[0]) { return false }
  switch m[k[0]].(type) {
  case M:
    return m[k[0]].(M).Evi(k[1:]...)
  case int64:
    return len(k) == 1
  default:
    return false
  }
}

func (m M) Evs(k ... string) bool {
  if len(k) == 0 { return false }

  if !m.e(k[0]) { return false }
  switch m[k[0]].(type) {
  case M:
    return m[k[0]].(M).Evs(k[1:]...)
  case string:
    return len(k) == 1
  default:
    return false
  }
}

func (m M) EvM(k ... string) bool {
  if len(k) == 0 { return false }
  if !m.e(k[0]) {
    return false
  }
  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 {
      return true
    } else {
      return m[k[0]].(M).EvM(k[1:]...)
    }
  default:
    return false
  }
}

func (m M) EvA(k ... string) bool {
  if len(k) == 0 { return false }
  if !m.e(k[0]) {
    return false
  }
  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 {
      return false
    } else {
      return m[k[0]].(M).EvA(k[1:]...)
    }
  default:
    return len(k) == 1
  }
}

func (m M) MkM(k ... string) M {
  if len(k) == 0 { return nil }
  if !m.e(k[0]) {
    m[k[0]] = make(M)
  } else if !m.EvM(k[0]) {
    return nil //key exists and NOT hash
  }
  if len(k) == 1 { return m[k[0]].(M) }

  return m[k[0]].(M).MkM(k[1:]...)
}

const INT64_MIN int64= -9223372036854775808
const INT64_ERR =INT64_MIN
const INT64_MAX int64= 9223372036854775807
const INT64_MAXu uint64= 9223372036854775807

const UINT64_MAX uint64= 18446744073709551615
const UINT64_ERR = UINT64_MAX

const STRING_ERROR = "M.vs.error"

func (m M) Vi(k ... string) int64 {
  if len(k) == 0 { return INT64_ERR }
  if !m.e(k[0]) { return INT64_ERR }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return INT64_ERR }
    return m[k[0]].(M).Vi(k[1:]...)
  case int64:
    if len(k) != 1 { return INT64_ERR }
    return m[k[0]].(int64)
  case uint64:
    if len(k) != 1 || m[k[0]].(uint64) > INT64_MAXu { return INT64_ERR }
    return int64(m[k[0]].(uint64))
  case string:
    if len(k) != 1 { return INT64_ERR }
    ret, err := strconv.ParseInt(m[k[0]].(string), 10, 64)
    if err != nil { return INT64_ERR }
    return ret
  default:
    return INT64_ERR
  }
}

func (m M) Vu(k ... string) uint64 {
  if len(k) == 0 { return UINT64_ERR }
  if !m.e(k[0]) { return UINT64_ERR }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return UINT64_ERR }
    return m[k[0]].(M).Vu(k[1:]...)
  case uint64:
    if len(k) != 1 { return UINT64_ERR }
    return m[k[0]].(uint64)
  case int64:
    if len(k) != 1 || m[k[0]].(int64) < 0 { return UINT64_ERR }
    return uint64(m[k[0]].(int64))
  case string:
    if len(k) != 1 { return UINT64_ERR }
    ret, err := strconv.ParseUint(m[k[0]].(string), 10, 64)
    if err != nil { return UINT64_ERR }
    return ret
  default:
    return UINT64_ERR
  }
}

func (m M) Vs(k ... string) string {
  if len(k) == 0 { return STRING_ERROR }
  if !m.e(k[0]) { return STRING_ERROR }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return STRING_ERROR }
    return m[k[0]].(M).Vs(k[1:]...)
  case uint64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(m[k[0]].(uint64), 10)
  case int64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(m[k[0]].(int64), 10)
  case string:
    if len(k) != 1 { return STRING_ERROR }
    return m[k[0]].(string)
  default:
    return STRING_ERROR
  }
}

func (m M) Vsr(r string, k ... string) string {
  if len(k) == 0 { return r }
  if !m.e(k[0]) { return r }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return STRING_ERROR }
    return m[k[0]].(M).Vsr(r, k[1:]...)
  case uint64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(m[k[0]].(uint64), 10)
  case int64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(m[k[0]].(int64), 10)
  case string:
    if len(k) != 1 { return STRING_ERROR }
    return m[k[0]].(string)
  default:
    return STRING_ERROR
  }
}

func (m M) VM(k ... string) M {
  if len(k) == 0 { return m }
  if !m.e(k[0]) { return nil }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return m[k[0]].(M) }
    return m[k[0]].(M).VM(k[1:]...)
  default:
    return nil
  }
}

func (m M) VA(k ... string) interface{} {
  if len(k) == 0 { return nil }
  if !m.e(k[0]) { return nil }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return m[k[0]] }
    return m[k[0]].(M).VA(k[1:]...)
  default:
    if len(k) == 1 { return m[k[0]] }
    return nil
  }
}

func (m M) Vie(k ... string) (int64, bool) {
  if len(k) == 0 { return 0, false }
  if !m.e(k[0]) { return 0, false }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return 0, false }
    return m[k[0]].(M).Vie(k[1:]...)
  case int64:
    if len(k) != 1 { return 0, false }
    return m[k[0]].(int64), true
  case uint64:
    if len(k) != 1 || m[k[0]].(uint64) > INT64_MAXu { return 0, false }
    return int64(m[k[0]].(uint64)), true
  case string:
    if len(k) != 1 { return 0, false }
    ret, err := strconv.ParseInt(m[k[0]].(string), 10, 64)
    if err != nil { return 0, false }
    return ret, true
  default:
    return 0, false
  }
}

func (m M) Vue(k ... string) (uint64, bool) {
  if len(k) == 0 { return 0, false }
  if !m.e(k[0]) { return 0, false }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return 0, false }
    return m[k[0]].(M).Vue(k[1:]...)
  case uint64:
    if len(k) != 1 { return 0, false }
    return m[k[0]].(uint64), true
  case int64:
    if len(k) != 1 || m[k[0]].(int64) < 0 { return 0, false }
    return uint64(m[k[0]].(int64)), true
  case string:
    if len(k) != 1 { return 0, false }
    ret, err := strconv.ParseUint(m[k[0]].(string), 10, 64)
    if err != nil { return 0, false }
    return ret, true
  default:
    return 0, false
  }
}

func (m M) Vse(k ... string) (string, bool) {
  if len(k) == 0 { return "", false }
  if !m.e(k[0]) { return "", false }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return "", false }
    return m[k[0]].(M).Vse(k[1:]...)
  case uint64:
    if len(k) != 1 { return "", false }
    return strconv.FormatUint(m[k[0]].(uint64), 10), true
  case int64:
    if len(k) != 1 { return "", false }
    return strconv.FormatInt(m[k[0]].(int64), 10), true
  case string:
    if len(k) != 1 { return "", false }
    return m[k[0]].(string), true
  default:
    return "", false
  }
}

func (m M) VMe(k ... string) (M, bool) {
  if len(k) == 0 { return m, true }
  if !m.e(k[0]) { return nil, false }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return m[k[0]].(M), true }
    return m[k[0]].(M).VMe(k[1:]...)
  default:
    return nil, false
  }
}

func (m M) VAe(k ... string) (interface{}, bool) {
  if len(k) == 0 { return nil, false }
  if !m.e(k[0]) { return nil, false }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return m[k[0]], true }
    return m[k[0]].(M).VAe(k[1:]...)
  default:
    if len(k) == 1 { return m[k[0]], true }
    return nil, false
  }
}

func (m M) Copy() M {
  ret := make(M)

  for k, v := range m {
    switch v.(type) {
    case M:
      ret[k] = v.(M).Copy()
    case []string:
      ret[k] = append([]string{}, v.([]string)...)
    case []int64:
      ret[k] = append([]int64{}, v.([]int64)...)
    case []uint64:
      ret[k] = append([]uint64{}, v.([]uint64)...)
    case []interface{}:
      ret[k] = append([]interface{}{}, v.([]interface{})...)
    default:
      ret[k] = v
    }
  }
  return ret
}

func IsM(m interface{}) bool {
  switch m.(type) {
  case M:
    return true
  }
  return false
}

func unmarshall_any(rm json.RawMessage) (interface{}, error) {
  var err error
  switch rm[0] {
  case byte('{'):
    var tm M
    err = json.Unmarshal(rm, &tm)
    return tm, err
  case byte('['):
    var a []json.RawMessage
    if err = json.Unmarshal(rm, &a); err != nil { return nil, err }
    reta := make([]interface{}, len(a))
    for index, a_rm := range a {
      reta[index], err = unmarshall_any(a_rm)
      if err != nil { return nil, err }
    }
    return reta, nil
  case byte('"'):
    var str string
    err = json.Unmarshal(rm, &str)
    return str, err
  default:
    var u64 uint64
    var i64 int64
    var f64 float64
    var i interface{}
    err := json.Unmarshal(rm, &u64 )
    if err == nil { return u64, nil }
    err = json.Unmarshal(rm, &i64 )
    if err == nil { return i64, nil }
    err = json.Unmarshal(rm, &f64 )
    if err == nil { return f64, nil }
    err = json.Unmarshal(rm, &i )
    if err == nil { return i, nil }
    return nil, err
  }
}

func (m *M) UnmarshalJSON(bytes []byte) error {
  var temp map[string]json.RawMessage
  if err := json.Unmarshal(bytes, &temp); err != nil { return err }

  (*m) = M{}

  for key, rm := range temp {
    val, err := unmarshall_any(rm)
    if err != nil { return err }
    (*m)[key] = val
  }
  return nil
}

func (m M) ToJsonStr(pretty bool) string {
  var ret []byte
  var err error

  if pretty {
    ret, err = json.MarshalIndent(m, "", "  ")
  } else {
    ret, err = json.Marshal(m)
  }
  if err != nil {
    return ""
  } else {
    return string(ret)
  }
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

