package mapaux

import (
  "strconv"
  "reflect"
  "encoding/json"
  "math"
)

const INT64_MIN int64= -9223372036854775808
const INT64_ERR =INT64_MIN
const INT64_MAX int64= 9223372036854775807
const INT64_MAXu uint64= 9223372036854775807

const UINT64_MAX uint64= 18446744073709551615
const UINT64_ERR = UINT64_MAX

const STRING_ERROR = "M.vs.error"

type M map[string]interface{}

func (m M) e(k string) bool {
  _, ret := m[k]
  return ret
}

func (m M) Evu(k ... string) bool {
  if len(k) == 0 { return false }

  if !m.e(k[0]) { return false }
  switch v := m[k[0]].(type) {
  case M:
    return m[k[0]].(M).Evu(k[1:]...)
  case uint64,uint,uint32,uint16,uint8:
    return len(k) == 1
  case int64:
    if v < 0 { return false }
    return len(k) == 1
  case int:
    if v < 0 { return false }
    return len(k) == 1
  case int32:
    if v < 0 { return false }
    return len(k) == 1
  case int16:
    if v < 0 { return false }
    return len(k) == 1
  case int8:
    if v < 0 { return false }
    return len(k) == 1
  case string:
    _, err := strconv.ParseUint(v, 10, 64)
    return err == nil && len(k) == 1
  default:
    return false
  }
}

func (m M) Evi(k ... string) bool {
  if len(k) == 0 { return false }

  if !m.e(k[0]) { return false }
  switch v := m[k[0]].(type) {
  case M:
    return m[k[0]].(M).Evi(k[1:]...)
  case int64, int, int32, int16, int8, uint32, uint16, uint8:
    return len(k) == 1
  case uint64:
    if v > INT64_MAXu { return false }
    return len(k) == 1
  case uint:
    if uint64(v) > INT64_MAXu { return false }
    return len(k) == 1
  case string:
    _, err := strconv.ParseInt(v, 10, 64)
    return err == nil && len(k) == 1
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
  case uint64, uint, uint32, uint16, uint8, int64, int, int32, int16, int8, float32, float64:
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

func (m M) Vi(k ... string) int64 {
  if len(k) == 0 { return INT64_ERR }
  if !m.e(k[0]) { return INT64_ERR }

  switch v := m[k[0]].(type) {
  case M:
    if len(k) == 1 { return INT64_ERR }
    return m[k[0]].(M).Vi(k[1:]...)
  case int64:
    if len(k) != 1 { return INT64_ERR }
    return int64(v)
  case int:
    if len(k) != 1 { return INT64_ERR }
    return int64(v)
  case int32:
    if len(k) != 1 { return INT64_ERR }
    return int64(v)
  case int16:
    if len(k) != 1 { return INT64_ERR }
    return int64(v)
  case int8:
    if len(k) != 1 { return INT64_ERR }
    return int64(v)
  case uint64:
    if len(k) != 1 || uint64(v) > INT64_MAXu { return INT64_ERR }
    return int64(v)
  case uint:
    if len(k) != 1 || uint64(v) > INT64_MAXu { return INT64_ERR }
    return int64(v)
  case uint32:
    if len(k) != 1 || uint64(v) > INT64_MAXu { return INT64_ERR }
    return int64(v)
  case uint16:
    if len(k) != 1 || uint64(v) > INT64_MAXu { return INT64_ERR }
    return int64(v)
  case uint8:
    if len(k) != 1 || uint64(v) > INT64_MAXu { return INT64_ERR }
    return int64(v)
  case string:
    if len(k) != 1 { return INT64_ERR }
    ret, err := strconv.ParseInt(v, 10, 64)
    if err != nil { return INT64_ERR }
    return ret
  default:
    return INT64_ERR
  }
}

func (m M) Vu(k ... string) uint64 {
  if len(k) == 0 { return UINT64_ERR }
  if !m.e(k[0]) { return UINT64_ERR }

  switch v := m[k[0]].(type) {
  case M:
    if len(k) == 1 { return UINT64_ERR }
    return m[k[0]].(M).Vu(k[1:]...)
  case uint64:
    if len(k) != 1 { return UINT64_ERR }
    return uint64(v)
  case uint:
    if len(k) != 1 { return UINT64_ERR }
    return uint64(v)
  case uint32:
    if len(k) != 1 { return UINT64_ERR }
    return uint64(v)
  case uint16:
    if len(k) != 1 { return UINT64_ERR }
    return uint64(v)
  case uint8:
    if len(k) != 1 { return UINT64_ERR }
    return uint64(v)
  case int64:
    if len(k) != 1 || v < 0 { return UINT64_ERR }
    return uint64(v)
  case int:
    if len(k) != 1 || v < 0 { return UINT64_ERR }
    return uint64(v)
  case int32:
    if len(k) != 1 || v < 0 { return UINT64_ERR }
    return uint64(v)
  case int16:
    if len(k) != 1 || v < 0 { return UINT64_ERR }
    return uint64(v)
  case int8:
    if len(k) != 1 || v < 0 { return UINT64_ERR }
    return uint64(v)
  case string:
    if len(k) != 1 { return UINT64_ERR }
    ret, err := strconv.ParseUint(v, 10, 64)
    if err != nil { return UINT64_ERR }
    return ret
  default:
    return UINT64_ERR
  }
}

func (m M) Vs(k ... string) string {
  if len(k) == 0 { return STRING_ERROR }
  if !m.e(k[0]) { return STRING_ERROR }

  switch v := m[k[0]].(type) {
  case M:
    if len(k) == 1 { return STRING_ERROR }
    return m[k[0]].(M).Vs(k[1:]...)
  case uint64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(v, 10)
  case uint:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(uint64(v), 10)
  case uint32:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(uint64(v), 10)
  case uint16:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(uint64(v), 10)
  case uint8:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatUint(uint64(v), 10)
  case int64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(int64(v), 10)
  case int:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(int64(v), 10)
  case int32:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(int64(v), 10)
  case int16:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(int64(v), 10)
  case int8:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatInt(int64(v), 10)
  case float64:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatFloat(float64(v), 'f', -1, 64)
  case float32:
    if len(k) != 1 { return STRING_ERROR }
    return strconv.FormatFloat(float64(v), 'f', -1, 32)
  case string:
    if len(k) != 1 { return STRING_ERROR }
    return m[k[0]].(string)
  default:
    return STRING_ERROR+" "+reflect.TypeOf(m[k[0]]).String()
  }
}

func (m M) Vsr(r string, k ... string) string {
  if len(k) == 0 { return r }
  if !m.e(k[0]) { return r }

  switch m[k[0]].(type) {
  case M:
    if len(k) == 1 { return STRING_ERROR }
    return m[k[0]].(M).Vsr(r, k[1:]...)
  default:
    return m.Vs(k[0])
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

  if !m.Evi(k...) { return 0, false }
  return m.Vi(k...), true
}

func (m M) Vue(k ... string) (uint64, bool) {
  if len(k) == 0 { return 0, false }
  if !m.e(k[0]) { return 0, false }

  if !m.Evu(k...) { return 0, false }
  return m.Vu(k...), true
}

func (m M) Vse(k ... string) (string, bool) {
  if len(k) == 0 { return "", false }
  if !m.e(k[0]) { return "", false }

  if !m.Evs(k...) { return "", false }
  return m.Vs(k...), true
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
    switch vv := v.(type) {
    case M:
      ret[k] = vv.Copy()
    case []string:
      ret[k] = append([]string{}, vv...)
    case []int64:
      ret[k] = append([]int64{}, vv...)
    case []int:
      ret[k] = append([]int{}, vv...)
    case []int32:
      ret[k] = append([]int32{}, vv...)
    case []int16:
      ret[k] = append([]int16{}, vv...)
    case []int8:
      ret[k] = append([]int8{}, vv...)
    case []uint64:
      ret[k] = append([]uint64{}, vv...)
    case []uint:
      ret[k] = append([]uint{}, vv...)
    case []uint32:
      ret[k] = append([]uint32{}, vv...)
    case []uint16:
      ret[k] = append([]uint16{}, vv...)
    case []uint8:
      ret[k] = append([]uint8{}, vv...)
    case []float64:
      ret[k] = append([]float64{}, vv...)
    case []float32:
      ret[k] = append([]float32{}, vv...)
    case []interface{}:
      ret[k] = append([]interface{}{}, vv...)
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

func (m M) Has(k string) (bool) {
  _, ex := m[k]
  return ex
}

func (m M) Uint64(k string) (uint64, bool) {
  var v interface{}
  var ok bool
  if v, ok = m[k]; !ok { return 0, false }

  switch v.(type) {
  case uint64:
    return v.(uint64), true
  case uint32:
    return uint64(v.(uint32)), true
  case uint:
    return uint64(v.(uint)), true
  case uint16:
    return uint64(v.(uint16)), true
  case uint8:
    return uint64(v.(uint8)), true
  case int64:
    if v.(int64) < 0 { return 0, false }
    return uint64(v.(int64)), true
  case int:
    if v.(int) < 0 { return 0, false }
    return uint64(v.(int)), true
  case int32:
    if v.(int32) < 0 { return 0, false }
    return uint64(v.(int32)), true
  case int16:
    if v.(int16) < 0 { return 0, false }
    return uint64(v.(int16)), true
  case int8:
    if v.(int8) < 0 { return 0, false }
    return uint64(v.(int8)), true
  case string:
    ret, err := strconv.ParseUint(v.(string), 10, 64)
    if err != nil { return 0, false }
    return ret, true
  case float64:
    if v.(float64) < float64(0) { return 0, false }
    if math.Floor(v.(float64)) > math.MaxUint64 { return 0, false }
    return uint64(math.Floor(v.(float64))), true
  }
  return 0, false
}

func (m M) Int64(k string) (int64, bool) {
  var v interface{}
  var ok bool
  if v, ok = m[k]; !ok { return 0, false }

  switch v.(type) {
  case uint64:
    if v.(uint64) > 9223372036854775807 { return 0, false }
    return int64(v.(uint64)), true
  case uint32:
    return int64(v.(uint32)), true
  case uint:
    return int64(v.(uint)), true
  case uint16:
    return int64(v.(uint16)), true
  case uint8:
    return int64(v.(uint8)), true
  case int64:
    return v.(int64), true
  case int:
    return int64(v.(int)), true
  case int32:
    return int64(v.(int32)), true
  case int16:
    return int64(v.(int16)), true
  case int8:
    return int64(v.(int8)), true
  case string:
    ret, err := strconv.ParseInt(v.(string), 10, 64)
    if err != nil { return 0, false }
    return ret, true
  case float64:
    if v.(float64) < math.MinInt64 { return 0, false }
    if math.Floor(v.(float64)) > math.MaxInt64 { return 0, false }
    return int64(math.Floor(v.(float64))), true
  }
  return 0, false
}

func (m M) UintString(k string) (string, bool) {
  var v uint64
  var ok bool
  v, ok = m.Uint64(k)
  if !ok { return "", false }
  return strconv.FormatUint(v, 10), true
}

func (m M) IntString(k string) (string, bool) {
  var v int64
  var ok bool
  v, ok = m.Int64(k)
  if !ok { return "", false }
  return strconv.FormatInt(v, 10), true
}

func (m M) String(k string) (string, bool) {
  var v string
  var ok bool
  if _, ok = m[k]; !ok { return "", false }
  v, ok = m[k].(string)
  if !ok { return "", false }
  return v, true
}

func (m M) AnyString(k string) (string, bool) {
  var v interface{}
  var ok bool
  if v, ok = m[k]; !ok { return "", false }

  switch v.(type) {
  case uint64:
    return strconv.FormatUint(v.(uint64), 10), true
  case uint32:
    return strconv.FormatUint(uint64(v.(uint32)), 10), true
  case uint:
    return strconv.FormatUint(uint64(v.(uint)), 10), true
  case uint16:
    return strconv.FormatUint(uint64(v.(uint16)), 10), true
  case uint8:
    return strconv.FormatUint(uint64(v.(uint8)), 10), true
  case int64:
    return strconv.FormatInt(v.(int64), 10), true
  case int:
    return strconv.FormatInt(int64(v.(int)), 10), true
  case int32:
    return strconv.FormatInt(int64(v.(int32)), 10), true
  case int16:
    return strconv.FormatInt(int64(v.(int16)), 10), true
  case int8:
    return strconv.FormatInt(int64(v.(int8)), 10), true
  case string:
    return v.(string), true
  }
  return "", false
}
