package mapaux

import (
  "regexp"
  "strconv"
  "errors"
  "strings"
  "fmt"

  w "github.com/jimlawless/whereami"
)

var graphDevKey_regex *regexp.Regexp
var graphIntKey_regex *regexp.Regexp
var graphDevNeKey_regex *regexp.Regexp
var graphIntNeKey_regex *regexp.Regexp

var alertKey_regex *regexp.Regexp

func init() {
  w.WhereAmI()
  fmt.Sprint()
  graphDevKey_regex = regexp.MustCompile(`^dev\.([0-9a-zA-Z_]+)[ \t]*(==|=~|!=|!~)[ \t]*([^\s])`)
  graphIntKey_regex = regexp.MustCompile(`^int\.([0-9a-zA-Z_]+)[ \t]*(==|=~|!=|!~)[ \t]*([^\s])`)
  graphDevNeKey_regex = regexp.MustCompile(`^not_empty +dev\.([0-9a-zA-Z_]+)\s*($|[^\s])`)
  graphIntNeKey_regex = regexp.MustCompile(`^not_empty +int\.([0-9a-zA-Z_]+)\s*($|[^\s])`)

  alertKey_regex = regexp.MustCompile(`^([0-9a-zA-Z_]+)[ \t]*(==|=~|!=|!~)[ \t]*([^\s])`)
}


func ParseGraphIntRules(s string) ([]string, []string, []string, []string, error) {
  s_pos := 0
  ret_d := make([]string, 0)
  ret_i := make([]string, 0)

  ret_ned := make([]string, 0)
  ret_nei := make([]string, 0)

  par_open := 0
  and_or_started := false

L1:for s_pos < len(s) {
    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return nil, nil, nil, nil, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return nil, nil, nil, nil, errors.New("No next expression after logical operator")
      }
      return ret_d, ret_ned, ret_i, ret_nei, nil
    }
    and_or_started = false
    op := ""
    if m := graphDevKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key := s[s_pos+m[2]:s_pos+m[3]]
      if IndexOf(ret_d, key) < 0 {
        ret_d = append(ret_d, key)
      }
      op = s[s_pos+m[4]:s_pos+m[5]]
      s_pos += m[6] //at least 1 symbol left in string
    } else if m := graphIntKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key := s[s_pos+m[2]:s_pos+m[3]]
      if IndexOf(ret_i, key) < 0 {
        ret_i = append(ret_i, key)
      }
      op = s[s_pos+m[4]:s_pos+m[5]]
      s_pos += m[6] //at least 1 symbol left in string
    } else if m := graphDevNeKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key := s[s_pos+m[2]:s_pos+m[3]]
      if IndexOf(ret_ned, key) < 0 {
        ret_ned = append(ret_ned, key)
      }
      op = "not_empty"
      s_pos += m[4] //at first non space char or at the end of script
    } else if m := graphIntNeKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key := s[s_pos+m[2]:s_pos+m[3]]
      if IndexOf(ret_nei, key) < 0 {
        ret_nei = append(ret_nei, key)
      }
      op = "not_empty"
      s_pos += m[4] //at first non space char or at the end of script
    } else if s[s_pos] == '(' {
      par_open++
      s_pos++
      continue L1
    } else {
      return nil, nil, nil, nil, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

    if op == "==" || op == "!=" {
      var str_start int
      var str_stop int
      _ = str_start
      _ = str_stop
      if s[s_pos] != '"' {
        str_start = s_pos
        for s_pos < len(s) && s[s_pos] != ' ' && s[s_pos] != '\t' && s[s_pos] != '\n' { s_pos++ }
        str_stop = s_pos
      } else {
        quote_closed := false
        s_pos++
        str_start = s_pos
        for s_pos < len(s) {
          if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '"') {
            s_pos += 2
          } else if s[s_pos] == '"' {
            str_stop = s_pos
            s_pos++
            quote_closed = true
            if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
              return nil, nil, nil, nil, errors.New("Syntax error: trailing symbols after quote at "+strconv.Itoa(s_pos))
            }
            break
          } else if s[s_pos] == '\n' {
            return nil, nil, nil, nil, errors.New("Syntax error: unclosed quote on newline at "+strconv.Itoa(s_pos))
          } else {
            s_pos++
          }
        }
        if !quote_closed {
          return nil, nil, nil, nil, errors.New("Syntax error: unclosed quote at "+strconv.Itoa(s_pos))
        }
      }
    } else if op == "=~" || op == "!~" {
      if s[s_pos] != '/' {
        return nil, nil, nil, nil, errors.New("Syntax error: no regex opening symbol \"/\" at "+strconv.Itoa(s_pos))
      }
      s_pos++
      regex_start := s_pos
      regex_closed := false
      regex_pattern := ""
      for s_pos < len(s) {
        if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '/') {
          regex_pattern += string(s[s_pos+1])
          s_pos += 2
        } else if s[s_pos] == '/' {
          s_pos++
          regex_closed = true
          if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
            return nil, nil, nil, nil, errors.New("Syntax error: trailing symbols after regex end at "+strconv.Itoa(s_pos))
          }
          break
        } else if s[s_pos] == '\n' {
          return nil, nil, nil, nil, errors.New("Syntax error: unclosed regex at "+strconv.Itoa(s_pos))
        } else {
          regex_pattern += string(s[s_pos])
          s_pos++
        }
      }
      if !regex_closed {
        return nil, nil, nil, nil, errors.New("Syntax error: no regex closing at "+strconv.Itoa(s_pos))
      }
      if _, err := regexp.Compile(regex_pattern); err != nil {
        return nil, nil, nil, nil, errors.New("Syntax error: regex compile error at "+strconv.Itoa(regex_start))
      }
    }


    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return nil, nil, nil, nil, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return nil, nil, nil, nil, errors.New("No next expression after logical operator")
      }
      return ret_d, ret_ned, ret_i, ret_nei, nil
    }

    for s_pos < len(s) && s[s_pos] == ')' {
      if par_open == 0 {
        return nil, nil, nil, nil, errors.New("No opening parenthesis for ) at "+strconv.Itoa(s_pos))
      }
      if and_or_started {
        return nil, nil, nil, nil, errors.New("Syntax error: unexpected ) at "+strconv.Itoa(s_pos))
      }
      par_open--
      s_pos ++
      for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    }


    if s_pos == len(s) {
      if par_open != 0 {
        return nil, nil, nil, nil, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return nil, nil, nil, nil, errors.New("No next expression after logical operator")
      }
      return ret_d, ret_ned, ret_i, ret_nei, nil
    } else if strings.Index(s[s_pos:], "||") == 0 || strings.Index(s[s_pos:], "&&") == 0 {
      if and_or_started {
        return nil, nil, nil, nil, errors.New("Syntax error: unexpected logical operator at "+strconv.Itoa(s_pos))
      } else {
        and_or_started = true
        s_pos += 2
      }
    } else {
      return nil, nil, nil, nil, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

  }
  return ret_d, ret_ned, ret_i, ret_nei, nil
}

func MatchGraphIntRules(s string, dev M, ifName string) (bool, error) {
  s_pos := 0
  par_open := 0
  and_or_started := false

  stack := make([]interface{}, 0)

L1:for s_pos < len(s) {
    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return false, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return false, errors.New("No next expression after logical operator")
      }
      return resolveStack(stack)
    }
    and_or_started = false
    op := ""
    key := ""
    var cmp_value interface{}


    if m := graphDevKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key = s[s_pos+m[2]:s_pos+m[3]]
      op = s[s_pos+m[4]:s_pos+m[5]]
      s_pos += m[6] //at least 1 symbol left in string

      cmp_value, _ = dev.VAe(key)

    } else if m := graphIntKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key = s[s_pos+m[2]:s_pos+m[3]]
      op = s[s_pos+m[4]:s_pos+m[5]]
      s_pos += m[6] //at least 1 symbol left in string

      cmp_value, _ = dev.VAe("interfaces", ifName, key)

    } else if m := graphDevNeKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key = s[s_pos+m[2]:s_pos+m[3]]
      op = "not_empty"
      s_pos += m[4] //at first non space char or at the end of script

      if dev.EvM(key) {
        stack = append(stack, len(dev.VM(key)) > 0)
      } else if dev.EvA(key) {
        switch dev.VA(key).(type) {
        case []interface{}:
          stack = append(stack, len(dev.VA(key).([]interface{})) > 0)
        case []string:
          stack = append(stack, len(dev.VA(key).([]string)) > 0)
        case []int64:
          stack = append(stack, len(dev.VA(key).([]int64)) > 0)
        case []uint64:
          stack = append(stack, len(dev.VA(key).([]uint64)) > 0)
        default:
          stack = append(stack, true)
        }
      } else {
        stack = append(stack, false)
      }
    } else if m := graphIntNeKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key = s[s_pos+m[2]:s_pos+m[3]]
      op = "not_empty"
      s_pos += m[4] //at first non space char or at the end of script

      if dev.EvM("interfaces", ifName, key) {
        stack = append(stack, len(dev.VM("interfaces", ifName, key)) > 0)
      } else if dev.EvA("interfaces", ifName, key) {
        switch dev.VA("interfaces", ifName, key).(type) {
        case []interface{}:
          stack = append(stack, len(dev.VA("interfaces", ifName, key).([]interface{})) > 0)
        case []string:
          stack = append(stack, len(dev.VA("interfaces", ifName, key).([]string)) > 0)
        case []int64:
          stack = append(stack, len(dev.VA("interfaces", ifName, key).([]int64)) > 0)
        case []uint64:
          stack = append(stack, len(dev.VA("interfaces", ifName, key).([]uint64)) > 0)
        default:
          stack = append(stack, true)
        }
      } else {
        stack = append(stack, false)
      }
    } else if s[s_pos] == '(' {
      stack = append(stack, "(")
      par_open++
      s_pos++
      continue L1
    } else {
      return false, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

    if op == "==" || op == "!=" {
      var str_start int
      var str_stop int
      if s[s_pos] != '"' {
        str_start = s_pos
        for s_pos < len(s) && s[s_pos] != ' ' && s[s_pos] != '\t' && s[s_pos] != '\n' { s_pos++ }
        str_stop = s_pos
      } else {
        quote_closed := false
        s_pos++
        str_start = s_pos
        for s_pos < len(s) {
          if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '"') {
            s_pos += 2
          } else if s[s_pos] == '"' {
            str_stop = s_pos
            s_pos++
            quote_closed = true
            if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
              return false, errors.New("Syntax error: trailing symbols after quote at "+strconv.Itoa(s_pos))
            }
            break
          } else if s[s_pos] == '\n' {
            return false, errors.New("Syntax error: unclosed quote on newline at "+strconv.Itoa(s_pos))
          } else {
            s_pos++
          }
        }
        if !quote_closed {
          return false, errors.New("Syntax error: unclosed quote at "+strconv.Itoa(s_pos))
        }
      }

      v := op != "=="
      switch cmp_value.(type) {
      case string,int,int8,int16,int32,int64,uint,uint8,uint16,uint32,uint64,bool,float32,float64:
        if s[str_start:str_stop] == fmt.Sprint(cmp_value) {
          v = op == "=="
        }
      case []string:
        for _, sv := range cmp_value.([]string) {
          if s[str_start:str_stop] == sv {
            v = op == "=="
            break
          }
        }
      case []int64:
        for _, sv := range cmp_value.([]int64) {
          if s[str_start:str_stop] == fmt.Sprint(sv) {
            v = op == "=="
            break
          }
        }
      case []uint64:
        for _, sv := range cmp_value.([]uint64) {
          if s[str_start:str_stop] == fmt.Sprint(sv) {
            v = op == "=="
            break
          }
        }
      }

      stack = append(stack, v)

    } else if op == "=~" || op == "!~" {
      if s[s_pos] != '/' {
        return false, errors.New("Syntax error: no regex opening symbol \"/\" at "+strconv.Itoa(s_pos))
      }
      s_pos++
      regex_start := s_pos
      regex_closed := false
      regex_pattern := ""
      for s_pos < len(s) {
        if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '/') {
          regex_pattern += string(s[s_pos+1])
          s_pos += 2
        } else if s[s_pos] == '/' {
          s_pos++
          regex_closed = true
          if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
            return false, errors.New("Syntax error: trailing symbols after regex end at "+strconv.Itoa(s_pos))
          }
          break
        } else if s[s_pos] == '\n' {
          return false, errors.New("Syntax error: unclosed regex at "+strconv.Itoa(s_pos))
        } else {
          regex_pattern += string(s[s_pos])
          s_pos++
        }
      }
      if !regex_closed {
        return false, errors.New("Syntax error: no regex closing at "+strconv.Itoa(s_pos))
      }
      if reg, err := regexp.Compile("(?i:"+regex_pattern+")"); err != nil {
        return false, errors.New("Syntax error: regex compile error at "+strconv.Itoa(regex_start))
      } else {


        v := op != "=~"
        switch cmp_value.(type) {
        case string,int,int8,int16,int32,int64,uint,uint8,uint16,uint32,uint64,bool,float32,float64:
          if reg.MatchString(fmt.Sprint(cmp_value)) {
            v = op == "=~"
          }
        case []string:
          for _, sv := range cmp_value.([]string) {
            if reg.MatchString(fmt.Sprint(sv)) {
              v = op == "=~"
              break
            }
          }
        case []int64:
          for _, sv := range cmp_value.([]int64) {
            if reg.MatchString(fmt.Sprint(sv)) {
              v = op == "=~"
              break
            }
          }
        case []uint64:
          for _, sv := range cmp_value.([]uint64) {
            if reg.MatchString(fmt.Sprint(sv)) {
              v = op == "=~"
              break
            }
          }
        }

        stack = append(stack, v)
      }
    }

    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return false, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return false, errors.New("No next expression after logical operator")
      }
      return resolveStack(stack)
    }

    for s_pos < len(s) && s[s_pos] == ')' {
      if par_open == 0 {
        return false, errors.New("No opening parenthesis for ) at "+strconv.Itoa(s_pos))
      }
      if and_or_started {
        return false, errors.New("Syntax error: unexpected ) at "+strconv.Itoa(s_pos))
      }
      par_open--
      s_pos ++
      stack = append(stack, ")")
      for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    }

    if s_pos == len(s) {
      if par_open != 0 {
        return false, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return false, errors.New("No next expression after logical operator")
      }
      return resolveStack(stack)
    } else if strings.Index(s[s_pos:], "||") == 0 || strings.Index(s[s_pos:], "&&") == 0 {
      if and_or_started {
        return false, errors.New("Syntax error: unexpected logical operator at "+strconv.Itoa(s_pos))
      } else {
        stack = append(stack, s[s_pos:s_pos+2])
        and_or_started = true
        s_pos += 2
      }
    } else {
      return false, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

  }

  return resolveStack(stack)
}

func isBool(b interface{}) bool {
  switch b.(type) {
  case bool:
    return true
  default:
    return false
  }
}

func resolveStack(a []interface{}) (bool, error) {
  b := make([]interface{}, len(a))
  copy(b, a)
  if len(a) == 0 { return false, errors.New("Empty stack") }

  for len(a) > 1 {
    if len(a) < 3 { return false, errors.New("Subexpression too short") }
    if !isBool(a[0]) && a[0] != "(" { return false, errors.New("Non bool or \"(\" start of subexpression") }
    if isBool(a[0]) {
      if isBool(a[1]) || (a[1].(string) != "&&" && a[1].(string) != "||") { return false, errors.New("Bool followed by wrong type") }
      if !isBool(a[2]) && a[2].(string) != "(" { return false, errors.New("Second expression is not bool and not subexpression") }

      if !isBool(a[2]) { // a[2] == "("
        var i int
        ////////////////////
        //i  0    1  2 3   4
        //   bool |& ( ... ) |& ( ... )
        //   bool |& ( ( ...) |& bool )
        open_par := 1
        for i = 3; i < len(a); i++ {
          if !isBool(a[i]) {
            if a[i].(string) == ")" {
              if open_par == 0 {
                return false, errors.New("Should not get here")
              }
              open_par--
              if open_par == 0 {
                break
              }
            } else if a[i].(string) == "(" {
              open_par++
            }
          }
        }

        if open_par > 0 { return false, errors.New("No closing ) found") }
        sub := append([]interface{}{}, a[3:i]...)
        sub_res, err := resolveStack(sub)
        if err != nil { return false, err }
        aa := append(a[:2], sub_res)
        a = append(aa, a[i+1:]...)
      } else {
        /////////////////////////
        //i  0    1   2
        //   bool &|  bool
        if a[1].(string) == "&&" {
          res := a[0].(bool) && a[2].(bool)
          aa := []interface{}{res}
          a = append(aa, a[3:]...)
        } else {
          sub := append([]interface{}{}, a[2:]...)
          sub_res, err := resolveStack(sub)
          if err != nil { return false, err }
          res := a[0].(bool) || sub_res
          a = append([]interface{}{}, res)
        }
      }
    } else { //non bool
      var i int
      ///////////////////
      //i   0   1   2
      //    (   .... 
      open_par := 1
      for i = 1; i < len(a); i++ {
        if !isBool(a[i]) {
          if a[i].(string) == ")" {
            if open_par == 0 {
              return false, errors.New("Should not get here")
            }
            open_par--
            if open_par == 0 {
              break
            }
          } else if a[i].(string) == "(" {
            open_par++
          }
        }
      }

      if open_par > 0 { return false, errors.New("No closing ) found") }
      sub := append([]interface{}{}, a[1:i]...)
      sub_res, err := resolveStack(sub)
      if err != nil { return false, err }
      aa := []interface{}{sub_res}
      a = append(aa, a[i+1:]...)
    }
  }
  if len(a) != 1 { return false, errors.New("Bad resulting len") }
  if !isBool(a[0]) { return false, errors.New("Bad resulting type") }
//fmt.Println(b, "=", a[0])
  return a[0].(bool), nil
}

func ParseAlertRule(s string) ([]string, error) {
  s_pos := 0
  ret_s := make([]string, 0)

  par_open := 0
  and_or_started := false

L1:for s_pos < len(s) {
    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return nil, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return nil, errors.New("No next expression after logical operator")
      }
      return ret_s, nil
    }
    and_or_started = false
    op := ""
    if m := alertKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key := s[s_pos+m[2]:s_pos+m[3]]
      if IndexOf(ret_s, key) < 0 {
        ret_s = append(ret_s, key)
      }
      op = s[s_pos+m[4]:s_pos+m[5]]
      s_pos += m[6] //at least 1 symbol left in string
    } else if s[s_pos] == '(' {
      par_open++
      s_pos++
      continue L1
    } else {
      return nil, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

    if op == "==" || op == "!=" {
      var str_start int
      var str_stop int
      _ = str_start
      _ = str_stop
      if s[s_pos] != '"' {
        str_start = s_pos
        for s_pos < len(s) && s[s_pos] != ' ' && s[s_pos] != '\t' && s[s_pos] != '\n' { s_pos++ }
        str_stop = s_pos
      } else {
        quote_closed := false
        s_pos++
        str_start = s_pos
        for s_pos < len(s) {
          if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '"') {
            s_pos += 2
          } else if s[s_pos] == '"' {
            str_stop = s_pos
            s_pos++
            quote_closed = true
            if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
              return nil, errors.New("Syntax error: trailing symbols after quote at "+strconv.Itoa(s_pos))
            }
            break
          } else if s[s_pos] == '\n' {
            return nil, errors.New("Syntax error: unclosed quote on newline at "+strconv.Itoa(s_pos))
          } else {
            s_pos++
          }
        }
        if !quote_closed {
          return nil, errors.New("Syntax error: unclosed quote at "+strconv.Itoa(s_pos))
        }
      }
    } else if op == "=~" || op == "!~" {
      if s[s_pos] != '/' {
        return nil, errors.New("Syntax error: no regex opening symbol \"/\" at "+strconv.Itoa(s_pos))
      }
      s_pos++
      regex_start := s_pos
      regex_closed := false
      regex_pattern := ""
      for s_pos < len(s) {
        if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '/') {
          regex_pattern += string(s[s_pos+1])
          s_pos += 2
        } else if s[s_pos] == '/' {
          s_pos++
          regex_closed = true
          if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
            return nil, errors.New("Syntax error: trailing symbols after regex end at "+strconv.Itoa(s_pos))
          }
          break
        } else if s[s_pos] == '\n' {
          return nil, errors.New("Syntax error: unclosed regex at "+strconv.Itoa(s_pos))
        } else {
          regex_pattern += string(s[s_pos])
          s_pos++
        }
      }
      if !regex_closed {
        return nil, errors.New("Syntax error: no regex closing at "+strconv.Itoa(s_pos))
      }
      if _, err := regexp.Compile(regex_pattern); err != nil {
        return nil, errors.New("Syntax error: regex compile error at "+strconv.Itoa(regex_start))
      }
    }


    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return nil, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return nil, errors.New("No next expression after logical operator")
      }
      return ret_s, nil
    }

    for s_pos < len(s) && s[s_pos] == ')' {
      if par_open == 0 {
        return nil, errors.New("No opening parenthesis for ) at "+strconv.Itoa(s_pos))
      }
      if and_or_started {
        return nil, errors.New("Syntax error: unexpected ) at "+strconv.Itoa(s_pos))
      }
      par_open--
      s_pos ++
      for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    }


    if s_pos == len(s) {
      if par_open != 0 {
        return nil, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return nil, errors.New("No next expression after logical operator")
      }
      return ret_s, nil
    } else if strings.Index(s[s_pos:], "||") == 0 || strings.Index(s[s_pos:], "&&") == 0 {
      if and_or_started {
        return nil, errors.New("Syntax error: unexpected logical operator at "+strconv.Itoa(s_pos))
      } else {
        and_or_started = true
        s_pos += 2
      }
    } else {
      return nil, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

  }
  return ret_s, nil
}

func MatchAlertRule(s string, alert map[string]string) (bool, error) {
  s_pos := 0
  par_open := 0
  and_or_started := false

  stack := make([]interface{}, 0)

L1:for s_pos < len(s) {
    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return false, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return false, errors.New("No next expression after logical operator")
      }
      return resolveStack(stack)
    }
    and_or_started = false
    op := ""
    key := ""
    cmp_value := ""


    if m := alertKey_regex.FindStringSubmatchIndex(s[s_pos:]); m != nil {
      key = s[s_pos+m[2]:s_pos+m[3]]
      op = s[s_pos+m[4]:s_pos+m[5]]
      s_pos += m[6] //at least 1 symbol left in string

      cmp_value, _ = alert[key]
    } else if s[s_pos] == '(' {
      stack = append(stack, "(")
      par_open++
      s_pos++
      continue L1
    } else {
      return false, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

    if op == "==" || op == "!=" {
      var str_start int
      var str_stop int
      if s[s_pos] != '"' {
        str_start = s_pos
        for s_pos < len(s) && s[s_pos] != ' ' && s[s_pos] != '\t' && s[s_pos] != '\n' { s_pos++ }
        str_stop = s_pos
      } else {
        quote_closed := false
        s_pos++
        str_start = s_pos
        for s_pos < len(s) {
          if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '"') {
            s_pos += 2
          } else if s[s_pos] == '"' {
            str_stop = s_pos
            s_pos++
            quote_closed = true
            if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
              return false, errors.New("Syntax error: trailing symbols after quote at "+strconv.Itoa(s_pos))
            }
            break
          } else if s[s_pos] == '\n' {
            return false, errors.New("Syntax error: unclosed quote on newline at "+strconv.Itoa(s_pos))
          } else {
            s_pos++
          }
        }
        if !quote_closed {
          return false, errors.New("Syntax error: unclosed quote at "+strconv.Itoa(s_pos))
        }
      }

      if op == "==" {
        stack = append(stack, s[str_start:str_stop] == cmp_value)
      } else {
        stack = append(stack, s[str_start:str_stop] != cmp_value)
      }
    } else if op == "=~" || op == "!~" {
      if s[s_pos] != '/' {
        return false, errors.New("Syntax error: no regex opening symbol \"/\" at "+strconv.Itoa(s_pos))
      }
      s_pos++
      regex_start := s_pos
      regex_closed := false
      regex_pattern := ""
      for s_pos < len(s) {
        if s[s_pos] == '\\' && (s_pos+1) < len(s) && (s[s_pos+1] == '\\' || s[s_pos+1] == '/') {
          regex_pattern += string(s[s_pos+1])
          s_pos += 2
        } else if s[s_pos] == '/' {
          s_pos++
          regex_closed = true
          if s_pos < len(s) && s[s_pos] != '\n' && s[s_pos] != ' ' && s[s_pos] != '\t' {
            return false, errors.New("Syntax error: trailing symbols after regex end at "+strconv.Itoa(s_pos))
          }
          break
        } else if s[s_pos] == '\n' {
          return false, errors.New("Syntax error: unclosed regex at "+strconv.Itoa(s_pos))
        } else {
          regex_pattern += string(s[s_pos])
          s_pos++
        }
      }
      if !regex_closed {
        return false, errors.New("Syntax error: no regex closing at "+strconv.Itoa(s_pos))
      }
      if reg, err := regexp.Compile("(?i:"+regex_pattern+")"); err != nil {
        return false, errors.New("Syntax error: regex compile error at "+strconv.Itoa(regex_start))
      } else {
        if op == "=~" {
          stack = append(stack, reg.MatchString(cmp_value))
        } else {
          stack = append(stack, !reg.MatchString(cmp_value))
        }
      }
    }

    for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    if s_pos == len(s) {
      if par_open != 0 {
        return false, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return false, errors.New("No next expression after logical operator")
      }
      return resolveStack(stack)
    }

    for s_pos < len(s) && s[s_pos] == ')' {
      if par_open == 0 {
        return false, errors.New("No opening parenthesis for ) at "+strconv.Itoa(s_pos))
      }
      if and_or_started {
        return false, errors.New("Syntax error: unexpected ) at "+strconv.Itoa(s_pos))
      }
      par_open--
      s_pos ++
      stack = append(stack, ")")
      for s_pos < len(s) && (s[s_pos] == ' ' || s[s_pos] == '\n' || s[s_pos] == '\t') { s_pos++ }
    }

    if s_pos == len(s) {
      if par_open != 0 {
        return false, errors.New("No closing parenthesis")
      }
      if and_or_started {
        return false, errors.New("No next expression after logical operator")
      }
      return resolveStack(stack)
    } else if strings.Index(s[s_pos:], "||") == 0 || strings.Index(s[s_pos:], "&&") == 0 {
      if and_or_started {
        return false, errors.New("Syntax error: unexpected logical operator at "+strconv.Itoa(s_pos))
      } else {
        stack = append(stack, s[s_pos:s_pos+2])
        and_or_started = true
        s_pos += 2
      }
    } else {
      return false, errors.New("Syntax error: unexpected expression at "+strconv.Itoa(s_pos))
    }

  }
  return resolveStack(stack)
}

func AlertRuleFieldValue(v interface{}) string {
  switch v.(type) {
  case []string:
    return strings.Join(v.([]string), ",")
  case []int64:
    str_a := make([]string, len(v.([]int64)))
    for idx, val := range v.([]int64) { str_a[idx] = strconv.FormatInt(val, 10) }
    return strings.Join(str_a, ",")
  case []uint64:
    str_a := make([]string, len(v.([]uint64)))
    for idx, val := range v.([]uint64) { str_a[idx] = strconv.FormatUint(val, 10) }
    return strings.Join(str_a, ",")
  case []interface{}:
    str_a := make([]string, len(v.([]interface{})))
    for idx, val := range v.([]interface{}) { str_a[idx] = AlertRuleFieldValue(val) }
    return strings.Join(str_a, ",")
  default:
    return fmt.Sprint(v)
  }
}
