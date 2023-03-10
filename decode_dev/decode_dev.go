package decode_dev

import (
  "errors"
  "strings"
  "strconv"
  "net"
  "encoding/hex"
  "fmt"
  "os"
  "time"
  "sort"
  "reflect"
  "regexp"
  "github.com/gomodule/redigo/redis"
  "github.com/ShyLionTjmn/mapper/redmutex"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

var huiOntCheckKeys = []string{ "huiOntDevAuthMethod", "huiOntDevLineProf", "huiOntDevSrvProf", "huiOntDevDescr", "huiOntDevAdminStatus",
  "huiOntDevVendorId", "huiOntDevProdId", "huiOnuModel", "huiOntDevSwVer", "huiOntDevRunStatus", "huiOntDevConfStatus", "huiOntDevMatchStatus",
  "huiOntDevLastUp", "huiOntDevLastDown", "huiOntDevLastDownCause", "huiOntDevLastGasp", "huiOntOptTxPower", "huiOntOptRxPower", "huiOltOptRxPower",
  "huiOltOptDistance",
}

var keys_regex *regexp.Regexp

var ErrorQueuesMismatch = errors.New("Queues _added mismatch")

func init() {
  keys_regex = regexp.MustCompile(`^(\d+):(\d+):(one|table):(int|uns|oid|str|hex):(.*)$`)
}

func hui_time(s string) int64 {
  if len(s) != len("07e30b09093417002b0500") { return 0 }
  year, err := strconv.ParseInt(s[:4], 16, 64)
  if err != nil { return 0 }

  month, err := strconv.ParseInt(s[4:6], 16, 64)
  if err != nil { return 0 }

  day, err := strconv.ParseInt(s[6:8], 16, 64)
  if err != nil { return 0 }

  hour, err := strconv.ParseInt(s[8:10], 16, 64)
  if err != nil { return 0 }

  min, err := strconv.ParseInt(s[10:12], 16, 64)
  if err != nil { return 0 }

  sec, err := strconv.ParseInt(s[12:14], 16, 64)
  if err != nil { return 0 }

  _, err = strconv.ParseInt(s[14:16], 16, 64)
  if err != nil { return 0 }

  sign_b, err := strconv.ParseInt(s[16:18], 16, 64)
  if err != nil { return 0 }

  sign := string(byte(sign_b))

  tzHH, err := strconv.ParseInt(s[18:20], 16, 64)
  if err != nil { return 0 }

  tzMM, err := strconv.ParseInt(s[20:22], 16, 64)
  if err != nil { return 0 }

  t, err := time.Parse(time.RFC3339, fmt.Sprintf("%04d-%02d-%02dT%02d:%02d:%02d%s%02d:%02d", year, month, day, hour, min, sec, sign, tzHH, tzMM))
  if err != nil { return 0 }

  return t.Unix()
}

func vlans_list(s string) string {
  s_len := len(s)
  ret := ""
  cur_vlan := int64(0)
  last_vlan := int64(-1)
  seq_start := int64(-1)

  for o := 0; o < s_len; o++ {
    if s[o] == 'f' && seq_start >= 0 {
      last_vlan += 4
      cur_vlan += 4
      continue
    }

    if s[o] == '0' && seq_start < 0 {
      cur_vlan += 4
      continue
    }

    nibble, err := strconv.ParseUint(s[o:o+1], 16, 4)
    if err != nil { return "" }

    for i := 0; i < 4; i++ {
      if (nibble & 0x8) != 0 {
        if seq_start >= 0 && (cur_vlan-last_vlan) == 1 {
          last_vlan = cur_vlan
        } else if seq_start < 0 {
          seq_start = cur_vlan
          last_vlan = cur_vlan
        }
      } else {
        if seq_start >= 0 {
          if ret != "" {
            ret += ","+strconv.FormatInt(seq_start, 10)
          } else {
            ret = strconv.FormatInt(seq_start, 10)
          }
          if seq_start != last_vlan {
            ret += "-"+strconv.FormatInt(last_vlan, 10)
          }
          seq_start = -1
          last_vlan = -1
        }
      }
      cur_vlan ++
      nibble = nibble << 1
    }
  }
  if seq_start >= 0 {
    if ret != "" {
      ret += ","+strconv.FormatInt(seq_start, 10)
    } else {
      ret = strconv.FormatInt(seq_start, 10)
    }
    if seq_start != last_vlan {
      ret += "-"+strconv.FormatInt(last_vlan, 10)
    }
  }
  return ret
}

func port_list(s string) []string {
  s_len := len(s)
  ret := make([]string, 0)

  cur_port := int64(1)

  for o := 0; o < s_len; o++ {
    nibble, err := strconv.ParseUint(s[o:o+1], 16, 4)
    if err != nil { return nil }
    if (nibble & 0x8) != 0 {
      ret = append(ret, strconv.FormatInt(cur_port+0, 10))
    }
    if (nibble & 0x4) != 0 {
      ret = append(ret, strconv.FormatInt(cur_port+1, 10))
    }
    if (nibble & 0x2) != 0 {
      ret = append(ret, strconv.FormatInt(cur_port+2, 10))
    }
    if (nibble & 0x1) != 0 {
      ret = append(ret, strconv.FormatInt(cur_port+3, 10))
    }
    cur_port += 4
  }

  return ret
}

func array_to_list(aa []string) string {
  a_len := len(aa)
  ret := ""

  c := int64(-1)
  cs := ""
  rng := false

  for i := 0; i < a_len; i++ {
    var a int64
    a, err := strconv.ParseInt(aa[i], 10, 64)
    if err != nil { return "" }
    if c < 0 {
      ret = aa[i]
    } else {
      if a <= c {
        return ""
      }
      if a == (c+1) {
        if !rng {
          ret += "-"
          rng = true
        }
      } else {
        if rng {
          ret += cs
          rng = false
        }
        ret += ","+aa[i]
      }
    }
    c = a
    cs = aa[i]
  }
  if rng {
    ret += cs
  }
  return ret
}

type Dev struct {
  Dev M
  Dev_macs M
  Dev_arp M
  Warnings []string
  Opt_m bool
  Opt_a bool
  Dev_ip string
}

func GetRawRed(red redis.Conn, dev_ip string) (M, error) {
  var err error
  if red == nil || red.Err() != nil || dev_ip == "" {
    err = errors.New("GetRawRed: bad args")
    return nil, err
  }

  lock_key := fmt.Sprintf("ip_lock.%s", dev_ip)
  redm := redmutex.New(lock_key)

  err = redm.Lock(red, time.Second, 10*time.Second)
  if err != nil { return nil, err }

  defer redm.Unlock(red)

  queues_key := fmt.Sprintf("ip_queues.%s", dev_ip)

  var queues map[string]string

  queues, err = redis.StringMap(red.Do("HGETALL", queues_key))
  if err != nil {
    return nil, err
  }

  if len(queues) == 0 {
    err = errors.New(fmt.Sprintf("No queues list for %s, cannot continue", dev_ip))
    return nil, err
  }

  var queue_list []string

  zero_queue_found := false

  for qs, _ := range queues {
    var qi int64
    qi, err = strconv.ParseInt(qs, 10, 64)
    if err != nil {
      return nil, err
    }
    queue_list = append(queue_list, qs)
    if qi == 0 {
      zero_queue_found= true
    }
  }

  if !zero_queue_found {
    err = errors.New(fmt.Sprintf("No zero queue in ip_queues.%s key in redis, cannot continue", dev_ip))
    return nil, err
  }

  var raw = make(M)

  raw["_queues"] = queue_list

  for _, queue := range queue_list {
    var queue_keys map[string]string
    var queue_data map[string]string

    keys_key := fmt.Sprintf("ip_keys.%s.%s", queue, dev_ip)
    data_key := fmt.Sprintf("ip_data.%s.%s", queue, dev_ip)
    last_result_key := fmt.Sprintf("ip_last_result.%s.%s", queue, dev_ip)


    queue_keys, err = redis.StringMap(red.Do("HGETALL", keys_key))
    if err != nil {
      return nil, err
    }

    if len(queue_keys) == 0 {
      err = errors.New(fmt.Sprintf("No keys hash for queue %s", queue))
      return nil, err
    }

    if len(queue_keys) < 3 {
      err = errors.New(fmt.Sprintf("Too short keys hash for queue %s", queue))
      return nil, err
    }


    queue_data, err = redis.StringMap(red.Do("HGETALL", data_key))
    if err != nil {
      return nil, err
    }

    if len(queue_data) == 0 {
      err = errors.New(fmt.Sprintf("No data hash for queue %s", queue))
      return nil, err
    }

    if len(queue_data) < 3 {
      err = errors.New(fmt.Sprintf("Too short data hash for queue %s", queue))
      return nil, err
    }

    var last_result string
    last_result, err = redis.String(red.Do("GET", last_result_key))
    if err != nil {
      return nil, err
    }


    lr_h := raw.MkM("_last_result")
    lr_h[queue] = last_result

    for keyAndIndex, value := range queue_data {
      if len(keyAndIndex) == 0 {
        err = errors.New(fmt.Sprintf("Zero length key in queue %s", queue))
        return nil, err
      }
      pointPos := strings.Index(keyAndIndex, ".")
      var key string = ""
      var index string = ""
      if pointPos < 0 {
        key = keyAndIndex
      } else {
        key = keyAndIndex[:pointPos]
        index = keyAndIndex[pointPos+1:]
        if len(index) == 0 {
          err = errors.New(fmt.Sprintf("Zero index in key %s, queue %s", key, queue))
          return nil, err
        }
        _, e := raw[key]
        if !e {
          raw[key] = make(M)
        }
      }

      key_str, e := queue_keys[key]
      if !e {
        err = errors.New(fmt.Sprintf("ip_data and ip_keys mismatch on key %s", key))
        return nil, err
      }

      m := keys_regex.FindStringSubmatch(key_str)
      if m == nil {
        err = errors.New(fmt.Sprintf("bad key info on key %s", key))
        return nil, err
      }

      key_start, _err := strconv.ParseInt(m[1], 10, 64)
      if _err != nil {
        return nil, _err
      }

      key_stop, _err := strconv.ParseInt(m[2], 10, 64)
      if _err != nil {
        return nil, _err
      }

      if keyAndIndex[0] != '_' {
        raw.MkM("_key_start")[key] = key_start
        raw.MkM("_key_stop")[key] = key_stop
        raw.MkM("_key_duration")[key] = key_stop - key_start
        raw.MkM("_key_queue")[key] = queue
      }

      var v interface{}

      switch m[4] {
      case "int":
        v, err = strconv.ParseInt(value, 10, 64)
        if err != nil { return nil, err }
      case "uns":
        v, err = strconv.ParseUint(value, 10, 64)
        if err != nil { return nil, err }
      case "str","hex","oid":
        v = value
      default:
        err = errors.New(fmt.Sprintf("Unhandled type for key %s", key))
        return nil, err
      }

      if m[5] != "" {
        ko_h := raw.MkM("_keys_options", key)
        key_options := strings.Split(m[5], ",")
        for _, ko_str := range key_options {
          opt_val_pair := strings.Split(ko_str, " ")
          if len(opt_val_pair) == 1 {
            ko_h[opt_val_pair[0]]=""
          } else {
            ko_h[opt_val_pair[0]]=strings.Join(opt_val_pair[1:], " ")
          }
        }
      }

      if keyAndIndex[0] == '_' {
        queue_h := raw.MkM(keyAndIndex)
        queue_h[queue] = v
      } else {

        if pointPos < 0 {
          raw[keyAndIndex] = v
        } else {
          raw[key].(M)[index] = v
        }
      }
    }
  }

  if !raw.EvM("_added") {
    err = errors.New("No _added key in data")
    return nil, err
  }

  var last_added interface{}

  for _, queue := range queue_list {
    if !raw.EvA("_added", queue) {
      err = errors.New("No _added key in data")
      return nil, err
    }

    if last_added != nil {
      if reflect.TypeOf(last_added) != reflect.TypeOf(raw.VM("_added")[queue]) {
        err = errors.New("_added key value type mismatch")
        return nil, err
      }
      if last_added != raw.VM("_added")[queue] {
        err = ErrorQueuesMismatch
        return nil, err
      }
    } else {
      last_added = raw.VM("_added")[queue]
    }
  }

  return raw, nil
}

func (d *Dev) Decode(raw M) error {
  d.Warnings = make([]string, 0)
  var err error
  var var_ok bool

  if !raw.Evs("sysObjectID") {
    err = errors.New("No sysObjectID in data, giving up")
    return err
  }

  if d.Dev_ip == "" {
    err = errors.New("No Dev_ip in d")
    return err
  }

  d.Dev = make(M)
  var dev = d.Dev

  var dev_id string

  var i64 int64

  if raw.Evs("locChassisId") && len(raw.Vs("locChassisId")) > 0 {
    s := strings.ToLower(raw.Vs("locChassisId"))
    dev_id = "lldp:"+s
    raw["locChassisId"] = s
  } else if raw.Evs("BDCOMlocChassisId") && len(raw.Vs("BDCOMlocChassisId")) > 0 {
    s := strings.ReplaceAll(strings.ToLower(raw.Vs("BDCOMlocChassisId")), ".", "")
    dev_id = "lldp:"+s
    raw["locChassisId"] = s
    raw["locChassisIdSubtype"] = "4"
  } else if raw.Evs("serial") && len(raw.Vs("serial")) > 0 {
    dev_id = "serial:"+raw.Vs("serial")
  } else if raw.Evs("sysName") && len(raw.Vs("sysName")) > 0 {
    dev_id = "name:"+strings.ToLower(raw.Vs("sysName"))
  } else {
    dev_id = "ip:"+d.Dev_ip
  }

// fix raw data
  if raw.EvM("vlanNames") && !raw.Evs("vlanNames", "1") {
    raw["vlanNames"].(M)["1"] = "default"
  }

  if raw.EvM("ifIndexToPort") {
    if !raw.EvM("portToIfIndex") {
      raw["portToIfIndex"] = make(M)
    }
    for i, _ := range raw.VM("ifIndexToPort") {
      raw.VM("portToIfIndex")[ raw.Vs("ifIndexToPort", i) ], _  = strconv.ParseInt(i, 10, 64)
    }
  }

  if raw.EvA("memorySizeK") && !raw.EvA("memorySize") {
    raw["memorySize"] = raw.Vi("memorySizeK")*1024
  }
  if raw.EvA("memoryUsedK") && !raw.EvA("memoryUsed") {
    raw["memoryUsed"] = raw.Vi("memoryUsedK")*1024
  }
//
  dev["id"] = dev_id
  dev["data_ip"] = d.Dev_ip

  var sysName string
  if raw.Evs("sysName") {
    sysName = raw.Vs("sysName")
    i := strings.Index(sysName, ".")
    if i >= 0 {
      sysName = sysName[:i]
    }
  }

  if sysName == "" {
    sysName = d.Dev_ip
  }

  dev["short_name"] = sysName

  for key, val := range raw {
    switch val.(type) {
    case M:
      if key == "vlanNames" || key == "ifName" || key[0] == '_' || raw.EvA("_keys_options", key, "auto") {
        dev[key] = make(M)
        for i, v := range val.(M) { dev[key].(M)[i] = v }
      }
    default:
      dev[key] = val
    }
  }

  dev["interfaces"] = make(M)

  if raw.EvM("huiOntDevSn") {
    check_ok := true
    // check if all huiOnt hashes is in place
    for _, hui_key := range huiOntCheckKeys {
      if !raw.EvM(hui_key) {
        check_ok = false
        break
      }
    }
    if check_ok {
      for index, _ := range raw.VM("huiOntDevSn") {
        // check if all huiOnt hashes has this index value
        check_ok = true
        for _, hui_key := range huiOntCheckKeys {
          if !raw.EvA(hui_key, index) {
            check_ok = false
            break
          }
        }
        if !check_ok { continue }
        dot_index := strings.Index(index, ".")
        if dot_index <= 0 { continue }
        parent_ifIndex := index[:dot_index]
        ont_index := index[dot_index+1:]

        if dev.Evs("ifName", parent_ifIndex) {
          parent_ifName := dev.Vs("ifName", parent_ifIndex)
          ifName := parent_ifName+":"+ont_index
          i64, err = strconv.ParseInt(ont_index, 10, 64)
          if err != nil { continue }
          ifIndex := fmt.Sprintf("%s%03d", parent_ifIndex, i64)

          int_h := dev.MkM("interfaces", ifName)

          int_h["ifIndex"] = ifIndex
          int_h["ifName"] = ifName
          int_h["ifAlias"] = raw.VA("huiOntDevDescr", index)

          int_h["ifAdminStatus"] = raw.VA("huiOntDevAdminStatus", index)
          int_h["ifOperStatus"] = raw.VA("huiOntDevRunStatus", index)

          int_h["ifSpeed"] = int64(1000000000)
          int_h["ifHighSpeed"] = int64(1000)
          int_h["ifType"] = int64(1)

          int_h["ifHCInOctets"] = int64(0)
          int_h["ifInBroadcastPkts"] = int64(0)
          int_h["ifInErrors"] = int64(0)
          int_h["ifInMulticastPkts"] = int64(0)
          int_h["ifInOctets"] = int64(0)
          int_h["ifInUnicastPkts"] = int64(0)

          int_h["ifHCOutOctets"] = int64(0)
          int_h["ifOutBroadcastPkts"] = int64(0)
          int_h["ifOutMulticastPkts"] = int64(0)
          int_h["ifOutOctets"] = int64(0)
          int_h["ifOutUnicastPkts"] = int64(0)

          lastUp := hui_time(raw.Vs("huiOntDevLastUp", index))
          lastDown := hui_time(raw.Vs("huiOntDevLastDown", index))
          lastChange := lastUp
          if lastDown > lastUp { lastChange = lastDown }
          int_h["ifLastChange"] = lastChange

          int_h["onuVendor"] = "HUI"

          oltRxPower := (raw.Vi("huiOltOptRxPower", index) - 10000)/10
          if raw.Vi("huiOltOptRxPower", index) == 2147483647 {
            oltRxPower= -65535
          }
          int_h["oltRxPower"] = oltRxPower

          onuRxPower := raw.Vi("huiOntOptRxPower", index)/10
          if raw.Vi("huiOntOptRxPower", index) == 2147483647 {
            onuRxPower= -65535
          }
          int_h["onuRxPower"] = onuRxPower

          int_h["onuDistance"] = raw.VA("huiOltOptDistance", index)
          int_h["onuMAC"] = raw.VA("huiOntDevSn", index)

          onuStatus := int64(3)
          if raw.Vi("huiOntDevRunStatus", index) != 1 {
            onuStatus = 2
          }
          int_h["onuStatus"] = onuStatus

          for _, hui_key := range []string{ "huiOntDevAuthMethod", "huiOntDevLineProf", "huiOntDevSrvProf",
                                            "huiOntDevVendorId", "huiOntDevProdId", "huiOnuModel", "huiOntDevSwVer",
                                            "huiOntDevRunStatus", "huiOntDevConfStatus", "huiOntDevMatchStatus",
                                            "huiOntDevLastDownCause", "huiOntOptTxPower",
          } {
             int_h[hui_key] = raw.VA(hui_key, index)
          }
          for _, hui_key := range []string{ "huiOntDevLastUp", "huiOntDevLastDown", "huiOntDevLastGasp" } {
             int_h[hui_key] = hui_time(raw.Vs(hui_key, index))
          }
          int_h["onuModel"] = raw.VA("huiOnuModel", index)
        }
      }
    }
  } //hui cycle

  //interfaces cycle
  if dev.EvM("ifName") {
IF: for ifIndex_str, ifName_i := range dev.VM("ifName") {
      var ifIndex int64
      ifName := ifName_i.(string)
      ifIndex, err = strconv.ParseInt(ifIndex_str, 10, 64)
      if err != nil { return err }
      if dev.EvA("interfaces", ifName) {
        //err = errors.New(fmt.Sprintf("Duplicate ifName %s", ifName))
        fmt.Fprintf(os.Stderr, "Duplicate ifName %s\n", ifName)
        continue
      }
      for _, attr := range []string { "ifType", "ifAdminStatus", "ifOperStatus", "ifInOctets", "ifOutOctets" } {
        if !raw.EvA(attr,ifIndex_str) {
          //probably gone during long scan
          continue IF
        }
      }
      int_h := dev.MkM("interfaces", ifName)
      int_h["ifName"] = ifName
      int_h["ifIndex"] = ifIndex

      //#fill global tables for look back
      //$dev_if_index{$dev_id}{$ifName} = $ifIndex;
      //$dev_if_name{$dev_id}{$ifIndex} = $ifName;

      for _, attr := range []string { "ifAlias", "ifType", "ifSpeed", "ifHighSpeed", "ifAdminStatus", "ifOperStatus", "ifInOctets", "ifOutOctets",
                                      "ifInErrors", "ifInCRCErrors", "ifDelay", "oltRxPower", "onuVendor", "onuModel", "onuRxPower", "onuStatus",
                                      "onuDistance", "onuMAC", "ifHCInOctets", "ifHCOutOctets", "ifInMulticastPkts", "ifInBroadcastPkts", "ifOutMulticastPkts",
                                      "ifOutBroadcastPkts", "ifLastChange", "ifPhysAddr", "ifInUnicastPkts", "ifOutUnicastPkts", "portMacCountLimitCurNum",
                                      "portMacCountLimitConfigNum", "ifDescr",
      } {
        if raw.EvA(attr, ifIndex_str) {
          attr_val := raw.VA(attr, ifIndex_str)
          if attr == "ifInErrors" || attr == "ifInOctets" || attr == "ifOutOctets" || attr == "ifInMulticastPkts" || attr == "ifInBroadcastPkts" ||
             attr == "ifOutMulticastPkts" || attr == "ifOutBroadcastPkts" || attr == "ifInUnicastPkts" || attr == "ifOutUnicastPkts" ||
             false {
            //if
            switch attr_val.(type) {
            case int64:
              if attr_val.(int64) == 4294967295 {
                attr_val = int64(0)
              }
            case uint64:
              if attr_val.(uint64) == 4294967295 {
                attr_val = uint64(0)
              }
            }
          } else if attr == "ifHCInOctets" || attr == "ifHCOutOctets" || false {
            switch attr_val.(type) {
            case int64:
              if attr_val.(int64) == INT64_MAX {
                attr_val = int64(0)
              }
            case uint64:
              if attr_val.(uint64) == UINT64_MAX {
                attr_val = uint64(0)
              }
            }
          }
          //
          int_h[attr] = attr_val
        }
      }
    }
  } //interfaces cycle

  i := 0
  int_list := make([]string, len(dev.VM("interfaces")))
  for ifName,_ := range dev.VM("interfaces") {
    int_list[i] = ifName
    i++
  }

  sort.Sort(ByNum(int_list))

  dev["interfaces_sorted"] = int_list

  //ips
  if raw.EvM("ifIpIfId") && raw.EvM("ifIpAddr") && raw.EvM("ifIpMask") {
    for ipkey, ip_if_index_i := range raw.VM("ifIpIfId") {
      var if_index string
      switch ip_if_index_i.(type) {
      case int64:
        if_index = strconv.FormatInt(ip_if_index_i.(int64), 10)
      case uint64:
        if_index = strconv.FormatUint(ip_if_index_i.(uint64), 10)
      case string:
        if_index = ip_if_index_i.(string)
      }
      if raw.Evs("ifIpAddr", ipkey) &&
         raw.Evs("ifIpMask", ipkey) &&
         dev.Evs("ifName", if_index ) {
        //
        ifName := dev.Vs("ifName", if_index)
        if dev.EvM("interfaces", ifName) {
          ip := raw.Vs("ifIpAddr", ipkey)
          mask := raw.Vs("ifIpMask", ipkey)

          iph := dev.MkM("interfaces", ifName, "ips", ip)

          iph["mask"] = mask

          nip := net.ParseIP(ip).To4()
          nmask := net.IPMask(net.ParseIP(mask).To4())
          if nip != nil && nmask != nil {
            ones, bits := nmask.Size()
            if bits == 32 {
              net_ip := nip.Mask(nmask)
              iph["net"] = fmt.Sprintf("%v/%d", net_ip, ones)
              iph["masklen"] = int64(ones)
              iph["v"] = "4"
              iph["ipu"], _ = V4ip2long(nip.String())
            }
          }
        }
      }
    }
  } //ips

  port_eq_ifindex := 0
  port_ne_ifindex := 0

  if raw.EvM("portToIfIndex") {
    for port_s, port_ii := range raw.VM("portToIfIndex") {
      var port_i int64
      port_i, err = strconv.ParseInt(port_s, 10, 64)
      if err != nil { return err }

      var port_iii int64
      var port_iis string
      switch port_ii.(type) {
      case int64:
        port_iii = port_ii.(int64)
        port_iis = strconv.FormatInt(port_ii.(int64), 10)
      case uint64:
        port_iii = int64( port_ii.(int64) )
        port_iis = strconv.FormatUint(port_ii.(uint64), 10)
      case string:
        port_iii, err = strconv.ParseInt(port_ii.(string), 10, 64)
        if err != nil { return err }
        port_iis = strconv.FormatInt(port_iii, 10)
      default:
        err = errors.New("Unhandled portToIfIndex value type")
        return err
      }

      if port_i == port_iii {
        port_eq_ifindex++
      } else {
        port_ne_ifindex++
      }

      if dev.Evs("ifName", port_iis) {
        ifName := dev.Vs("ifName", port_iis)
        if dev.EvM("interfaces", ifName) {
          dev["interfaces"].(M)[ifName].(M)["lldp_portIndex"] = port_i
          dev["interfaces"].(M)[ifName].(M)["portIndex"] = port_i
        }
      }
    }
  } //portToIfIndex

  if raw.EvM("stpPortState") {
    for key, val := range raw.VM("stpPortState") {
      dot_pos := strings.Index(key, ".")
      if dot_pos < 0 {
        stp_inst := int64(0)
        stp_port := key
        if raw.Evi("portToIfIndex", stp_port) && dev.EvM("ifName") && val.(int64) == 2 {
          ifIndex_s := strconv.FormatInt(raw.Vi("portToIfIndex", stp_port), 10)
          if dev.Evs("ifName", ifIndex_s) {
            ifName := dev.Vs("ifName", ifIndex_s)
            if dev.EvM("interfaces", ifName) {
              if !dev.EvA("interfaces", ifName, "stpBlockInstances") {
                dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = make([]int64, 0)
              }
              dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = append(dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"].([]int64), stp_inst)
            }
          }
        }
      }
    }
  } else if raw.EvM("snrStpPortState") {
    for key, val := range raw.VM("snrStpPortState") {
      dot_pos := strings.Index(key, ".")
      next_dot := -1
      if dot_pos > 0 {
        next_dot = strings.Index(key[dot_pos+1:], ".")
      }
      if dot_pos > 0 && next_dot < 0 && len(key[dot_pos+1:]) > 0 {
        var stp_inst int64
        stp_inst, err = strconv.ParseInt(key[:dot_pos], 10, 64)
        if err != nil { return err }
        stp_port := key[dot_pos+1:]
        if raw.Evi("portToIfIndex", stp_port) && dev.EvM("ifName") && val.(int64) == 0 {
          ifIndex_s := strconv.FormatInt(raw.Vi("portToIfIndex", stp_port), 10)
          if dev.Evs("ifName", ifIndex_s) {
            ifName := dev.Vs("ifName", ifIndex_s)
            if dev.EvM("interfaces", ifName) {
              if !dev.EvA("interfaces", ifName, "stpBlockInstances") {
                dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = make([]int64, 0)
              }
              dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = append(dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"].([]int64), stp_inst)
            }
          }
        }
      }
    }
  } else if raw.EvM("orionStpPortState") {
    for key, val := range raw.VM("orionStpPortState") {
      dot_pos := strings.Index(key, ".")
      next_dot := -1
      if dot_pos > 0 {
        next_dot = strings.Index(key[dot_pos+1:], ".")
      }
      if dot_pos > 0 && next_dot < 0 && len(key[dot_pos+1:]) > 0 {
        var stp_inst int64
        stp_inst, err = strconv.ParseInt(key[:dot_pos], 10, 64)
        if err != nil { return err }
        stp_port := key[dot_pos+1:]
        if raw.Evi("portToIfIndex", stp_port) && dev.EvM("ifName") && val.(int64) == 1 {
          ifIndex_s := strconv.FormatInt(raw.Vi("portToIfIndex", stp_port), 10)
          if dev.Evs("ifName", ifIndex_s) {
            ifName := dev.Vs("ifName", ifIndex_s)
            if dev.EvM("interfaces", ifName) {
              if !dev.EvA("interfaces", ifName, "stpBlockInstances") {
                dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = make([]int64, 0)
              }
              dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = append(dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"].([]int64), stp_inst)
            }
          }
        }
      }
    }
  } else if raw.EvM("eltexStpPortRole") {
    for key, val := range raw.VM("eltexStpPortRole") {
      dot_pos := strings.Index(key, ".")
      if dot_pos < 0 {
        var stp_inst int64 = 0
        stp_port := key
        if raw.Evi("portToIfIndex", stp_port) && dev.EvM("ifName") && (val.(int64) == 2 || val.(int64) == 3) {
          ifIndex_s := strconv.FormatInt(raw.Vi("portToIfIndex", stp_port), 10)
          if dev.Evs("ifName", ifIndex_s) {
            ifName := dev.Vs("ifName", ifIndex_s)
            if dev.EvM("interfaces", ifName) {
              if !dev.EvA("interfaces", ifName, "stpBlockInstances") {
                dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = make([]int64, 0)
              }
              dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = append(dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"].([]int64), stp_inst)
            }
          }
        }
      }
    }
  } else if raw.EvM("ciscoStpPortRole") {
    for key, val := range raw.VM("ciscoStpPortRole") {
      dot_pos := strings.Index(key, ".")
      next_dot := -1
      if dot_pos > 0 {
        next_dot = strings.Index(key[dot_pos+1:], ".")
      }
      if dot_pos > 0 && next_dot < 0 && len(key[dot_pos+1:]) > 0 {
        var stp_inst int64
        stp_inst, err = strconv.ParseInt(key[:dot_pos], 10, 64)
        if err != nil { return err }
        stp_port := key[dot_pos+1:]
        if raw.Evi("portToIfIndex", stp_port) && dev.EvM("ifName") && (val.(int64) == 4 || val.(int64) == 5) {
          ifIndex_s := strconv.FormatInt(raw.Vi("portToIfIndex", stp_port), 10)
          if dev.Evs("ifName", ifIndex_s) {
            ifName := dev.Vs("ifName", ifIndex_s)
            if dev.EvM("interfaces", ifName) {
              if !dev.EvA("interfaces", ifName, "stpBlockInstances") {
                dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = make([]int64, 0)
              }
              dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"] = append(dev["interfaces"].(M)[ifName].(M)["stpBlockInstances"].([]int64), stp_inst)
            }
          }
        }
      }
    }
  } //stp port state

  if d.Opt_m {

    var macs_time int64 = 0

    if !raw.EvM("vlanMacTable") && raw.EvM("portVlanMacTable") {
      if !raw.Evi("_key_stop", "portVlanMacTable") {
        err = errors.New("No _key_stop for portVlanMacTable")
        return err
      }
      macs_time = raw.Vi("_key_stop", "portVlanMacTable") / 1000

      raw["vlanMacTable"] = make(M)
      for port_mac, port := range raw.VM("portVlanMacTable") {
        a := strings.Split(port_mac, ".")
        if len(a) == 8 {
          raw["vlanMacTable"].(M)[strings.Join(a[1:], ".")] = port
        }
      }
    }  //portVlanMacTable

    if !raw.EvM("vlanMacTable") && raw.EvM("macTable") {
      if !raw.Evi("_key_stop", "macTable") {
        err = errors.New("No _key_stop for macTable")
        return err
      }
      macs_time = raw.Vi("_key_stop", "macTable") / 1000

      raw["vlanMacTable"] = make(M)
      for mac, port := range raw.VM("macTable") {
        raw["vlanMacTable"].(M)["0."+mac] = port
      }
    }

    if !raw.EvM("vlanMacTable") && raw.EvM("huiMacVlanPort") {
      if !raw.Evi("_key_stop", "huiMacVlanPort") {
        err = errors.New("No _key_stop for huiMacVlanPort")
        return err
      }
      macs_time = raw.Vi("_key_stop", "huiMacVlanPort") / 1000
      for mac_vlan_vsi, _ := range raw.VM("huiMacVlanPort") {
        a := strings.Split(mac_vlan_vsi, ".")
        if len(a) >= 7 {
          raw.MkM("vlanMacTable")[ a[6]+"."+strings.Join(a[:6], ".") ] =
            raw.VA("huiMacVlanPort", mac_vlan_vsi)
        }
      }
    }

    if !raw.EvM("vlanMacTable") && raw.EvM("huiMacVlanIfIndex") {
      if !raw.Evi("_key_stop", "huiMacVlanIfIndex") {
        err = errors.New("No _key_stop for huiMacVlanIfIndex")
        return err
      }
      macs_time = raw.Vi("_key_stop", "huiMacVlanIfIndex") / 1000
      for mac_vlan_vsi, _ := range raw.VM("huiMacVlanIfIndex") {
        a := strings.Split(mac_vlan_vsi, ".")
        if len(a) >= 7 {
          if ifName, ex := raw.Vse("ifName", raw.Vs("huiMacVlanIfIndex", mac_vlan_vsi));
          ex && dev.Evi("interfaces", ifName, "portIndex") {
            raw.MkM("vlanMacTable")[ a[6]+"."+strings.Join(a[:6], ".") ] =
              dev.Vi("interfaces", ifName, "portIndex")
          }
        }
      }
    }

    if raw.EvM("vlanMacTable") {
      if macs_time == 0 {
        if !raw.Evi("_key_stop", "vlanMacTable") {
          err = errors.New("No _key_stop for vlanMacTable")
          return err
        }
        macs_time = raw.Vi("_key_stop", "vlanMacTable") / 1000
      }

      d.Dev_macs = make(M)
      dev_macs := d.Dev_macs

      for vlan_mac, port := range raw.VM("vlanMacTable") {
        a := strings.Split(vlan_mac, ".")
        port_s := strconv.FormatInt(port.(int64), 10)
        if len(a) == 7 {
          vlan_s := a[0]
          var m0, m1, m2, m3, m4, m5 uint64
          m0, err = strconv.ParseUint(a[1], 10, 8)
          if err != nil { return err }
          m1, err = strconv.ParseUint(a[2], 10, 8)
          if err != nil { return err }
          m2, err = strconv.ParseUint(a[3], 10, 8)
          if err != nil { return err }
          m3, err = strconv.ParseUint(a[4], 10, 8)
          if err != nil { return err }
          m4, err = strconv.ParseUint(a[5], 10, 8)
          if err != nil { return err }
          m5, err = strconv.ParseUint(a[6], 10, 8)
          if err != nil { return err }
          mac := fmt.Sprintf("%02x%02x%02x%02x%02x%02x", m0, m1, m2, m3, m4, m5)
          if port_eq_ifindex > 0 && port_ne_ifindex == 0 && dev.Evs("ifName", port_s) {
            ifName := dev.Vs("ifName", port_s)
            if dev.EvM("interfaces", ifName) {
              count, _ := dev.Vie("interfaces", ifName, "macs_count")
              m_h := dev_macs.MkM(ifName)
              if !m_h.EvA(vlan_s) {
                m_h[vlan_s] = make([]string, 0)
              }
              m_h[vlan_s] = append(m_h[vlan_s].([]string), mac)
              dev.VM("interfaces", ifName)["macs_count"] = count + 1
            }
          } else if raw.EvA("portToIfIndex", port_s) {
            ifIndex_s := raw.Vs("portToIfIndex", port_s)
            if dev.Evs("ifName", ifIndex_s) {
              ifName := dev.Vs("ifName", ifIndex_s)
              if dev.EvM("interfaces", ifName) {
                count, _ := dev.Vie("interfaces", ifName, "macs_count")
                m_h := dev_macs.MkM(ifName)
                if !m_h.EvA(vlan_s) {
                  m_h[vlan_s] = make([]string, 0)
                }
                m_h[vlan_s] = append(m_h[vlan_s].([]string), mac)
                dev.VM("interfaces", ifName)["macs_count"] = count + 1
              }
            }
          } else {
          }
        }
      }
      if len(d.Dev_macs) > 0 {
        dev["macs_time"] = macs_time
      }
    } //macs
  }

  if raw.EvM("locPortId") && raw.EvM("locPortIdSubtype") {
    for port_index, _ := range raw.VM("locPortId") {
      if raw.Evi("locPortIdSubtype", port_index) {
        subtype := raw.Vi("locPortIdSubtype", port_index)
        port_id := raw.Vs("locPortId", port_index)
        if (subtype == 5 || subtype == 7) && len(port_id)%2 == 0 { //interfaceName(5) or local(7)
          // port id is hex encoded string
          //trim trailing zeros
          for len(port_id) >= 2 && port_id[len(port_id)-2:] == "00" {
            port_id = port_id[:len(port_id)-2]
          }
          s := ""
          for c := 0; c < len(port_id); c += 2 {
            var b uint64
            b, err = strconv.ParseUint(port_id[c:c+2], 16, 8)
            if err != nil { return err }
            s += string(byte(b))
          }

          port_id = s
        }
        lldp_port_h := dev.MkM("lldp_ports", port_index)
        lldp_port_h["subtype"] = subtype
        lldp_port_h["port_id"] = port_id

        dev.MkM("lldp_id2port_index")
        dev["lldp_id2port_index"].(M)[port_id] = port_index

        if subtype == 5 && dev.EvM("interfaces", port_id) { // interface name as port_id
          dev["lldp_ports"].(M)[port_index].(M)["ifName"] = port_id
          dev["interfaces"].(M)[port_id].(M)["lldp_portIndex"] = port_index
        } else if subtype == 7 && port_eq_ifindex > 0 && port_ne_ifindex == 0 && IsNumber(port_id) {
          // numeric port number as port_id
          if dev.Evs("ifName", port_id) && dev.EvM("interfaces", dev.Vs("ifName", port_id)) {
            dev["lldp_ports"].(M)[port_index].(M)["ifName"] = dev.Vs("ifName", port_id)
            dev["interfaces"].(M)[dev.Vs("ifName", port_id)].(M)["lldp_portIndex"] = port_index
          }
        } else if subtype == 7 && strings.Index(dev.Vs("sysObjectID"), ".1.3.6.1.4.1.3320.1.") == 0 &&
                  strings.Index(port_id, "Gig") == 0 &&
        true { //BDCOM
          a := SplitByNum(port_id) //GigX/Y
          if len(a) == 4 &&
             reflect.TypeOf(a[0]) == reflect.TypeOf("") && a[0] == "Gig" &&
             reflect.TypeOf(a[1]) == reflect.TypeOf(int64(0)) &&
             reflect.TypeOf(a[2]) == reflect.TypeOf("") && a[2] == "/" &&
             reflect.TypeOf(a[3]) == reflect.TypeOf(int64(0)) {
            //if
            ifName := fmt.Sprintf("GigaEthernet%d/%d", a[1], a[3])
            if dev.EvM("interfaces", ifName) {
              dev["lldp_ports"].(M)[port_index].(M)["ifName"] = ifName
              dev["interfaces"].(M)[ifName].(M)["lldp_portIndex"] = port_index
            }
          }
        } else if subtype == 7 && strings.Index(dev.Vs("sysObjectID"), ".1.3.6.1.4.1.4808.301.1.") == 0 { //NSGATE
          if dev.Evs("ifName", port_index) && dev.EvM("interfaces", dev.Vs("ifName", port_index) ) {
            ifName := dev.Vs("ifName", port_index)
            dev["lldp_ports"].(M)[port_index].(M)["ifName"] = ifName
            dev["interfaces"].(M)[ifName].(M)["lldp_portIndex"] = port_index
          }
        } else if subtype == 1 && strings.Index(dev.Vs("sysObjectID"), ".1.3.6.1.4.1.171.") == 0 { //DLINK
          if dev.Evs("ifName", port_index) && dev.EvM("interfaces", dev.Vs("ifName", port_index) ) {
            ifName := dev.Vs("ifName", port_index)
            dev["lldp_ports"].(M)[port_index].(M)["ifName"] = ifName
            dev["interfaces"].(M)[ifName].(M)["lldp_portIndex"] = port_index
          }
        } else if subtype == 3 { //find interface by MAC address, index must match ifIndex and its ifPhysAddr
          if dev.Evs("ifName", port_index) {
            ifName := dev.Vs("ifName", port_index)
            if dev.Evs("interfaces", ifName, "ifPhysAddr") && dev.Vs("interfaces", ifName, "ifPhysAddr") == port_id {
              dev["lldp_ports"].(M)[port_index].(M)["ifName"] = ifName
              dev["interfaces"].(M)[ifName].(M)["lldp_portIndex"] = port_index
            }
          }
        } else if subtype == 7 && raw.Evs("portToIfIndex", port_id) &&
                  dev.Evs("ifName", raw.Vs("portToIfIndex", port_id)) &&
                  dev.EvM("interfaces", dev.Vs("ifName", raw.Vs("portToIfIndex", port_id))) &&
        true {
            ifName := dev.Vs("ifName", raw.Vs("portToIfIndex", port_id))
            dev.VM("lldp_ports", port_index)["ifName"] = ifName
            dev.VM("interfaces", ifName)["lldp_portIndex"] = port_index
        } else { //give up
          dev["lldp_ports"].(M)[port_index].(M)["error"] = "ifName not found"
        }
      }
    }
  } //locPortId

  if !raw.EvM("lldpRemChassisId") && raw.EvM("BDCOMlldpRemChassisId") {
    port_seq := make(map[int64]int64)
    for seq, rcid := range raw.VM("BDCOMlldpRemChassisId") {
      if raw.Evi("BDCOMlldpRemTimeMark", seq) &&
         raw.Evi("BDCOMlldpRemLocalPortNum", seq) &&
         raw.Evi("BDCOMlldpRemChassisIdSubType", seq) &&
         raw.Evi("BDCOMlldpRemPortIdSubtype", seq) &&
         raw.Evs("BDCOMlldpRemPortId", seq) &&
         raw.Evs("BDCOMlldpRemPortDescr", seq) &&
         raw.Evs("BDCOMlldpRemSysName", seq) &&
         raw.Evs("BDCOMlldpRemCaps", seq) &&
         true {
        //if
        timemark := raw.Vi("BDCOMlldpRemTimeMark", seq)
        port := raw.Vi("BDCOMlldpRemLocalPortNum", seq)
        if raw.Vi("BDCOMlldpRemChassisIdSubType", seq) == 4 {
          a := strings.Split(rcid.(string), ".")
          if len(a) == 3 && IsHexNumber(a[0]) && IsHexNumber(a[1]) && IsHexNumber(a[2]) && len(a[0]) == 4 && len(a[1]) == 4 && len(a[2]) == 4 {
            rcid = strings.ToLower(a[0]+a[1]+a[2])
          }
        }

        _, exists := port_seq[port]
        if exists {
          port_seq[port]++
        } else {
          port_seq[port] = 1
        }

        index := fmt.Sprintf("%d.%d.%d", timemark, port, port_seq[port])
        for _, attr := range []string{ "lldpRemChassisId", "lldpRemChassisIdSubtype", "lldpRemPortIdSubtype",
                                       "lldpRemPortId", "lldpRemPortDescr", "lldpRemSysName", "lldpRemSysDescr",
                                       "lldpRemSysCaps" } {
          //for
          raw.MkM(attr)
        }
        raw["lldpRemChassisId"].(M)[index] = rcid
        raw["lldpRemChassisIdSubtype"].(M)[index] = raw.VA("BDCOMlldpRemChassisIdSubType", seq)
        raw["lldpRemPortIdSubtype"].(M)[index] = raw.VA("BDCOMlldpRemPortIdSubtype", seq)
        raw["lldpRemPortId"].(M)[index] = raw.VA("BDCOMlldpRemPortId", seq)
        raw["lldpRemPortDescr"].(M)[index] = raw.VA("BDCOMlldpRemPortDescr", seq)
        raw["lldpRemSysName"].(M)[index] = raw.VA("BDCOMlldpRemSysName", seq)
        raw["lldpRemSysCaps"].(M)[index] = raw.VA("BDCOMlldpRemCaps", seq)
        if raw.Evs("BDCOMlldpRemSysDescr", seq) {
          raw["lldpRemSysDescr"].(M)[index] = raw.VA("BDCOMlldpRemSysDescr", seq)
        } else {
          raw["lldpRemSysDescr"].(M)[index] = ""
        }
      }
    }
  } // BDCOMlldpRemChassisId
///

  if raw.EvM("lldpRemChassisId") {
    for lldp_rem, rcid_ := range raw.VM("lldpRemChassisId") {
      rcid := rcid_.(string)
      a := strings.Split(lldp_rem, ".")
      if raw.Evi("lldpRemChassisIdSubtype", lldp_rem) &&
         raw.Evi("lldpRemPortIdSubtype", lldp_rem) &&
         raw.Evs("lldpRemPortId", lldp_rem) &&
         raw.Evs("lldpRemPortDescr", lldp_rem) &&
         raw.Evs("lldpRemSysName", lldp_rem) &&
         raw.Evs("lldpRemPortId", lldp_rem) &&
         (len(a) == 3 || (len(a) == 4 && strings.Index(dev.Vs("sysObjectID"), ".1.3.6.1.4.1.2011.") == 0)) &&
         true {
        //if
        timemark := a[0]
        port := a[1]
        seq := a[2]
        if !dev.EvM("lldp_ports", port) {
          if dev.Evs("ifName", port) {
            subtype := int64(5)
            port_index := port
            port_id := dev.Vs("ifName", port)
            lldp_port_h := dev.MkM("lldp_ports", port_index)
            lldp_port_h["subtype"] = subtype
            lldp_port_h["port_id"] = port_id

            dev.MkM("lldp_id2port_index")
            dev["lldp_id2port_index"].(M)[port_id] = port_index

            if dev.EvM("interfaces", port_id) {
              dev["lldp_ports"].(M)[port_index].(M)["ifName"] = port_id
              dev["interfaces"].(M)[port_id].(M)["lldp_portIndex"] = port_index
            }
          }
        }
        if dev.EvM("lldp_ports", port) {
          if len(rcid) == 34 && raw.Vi("lldpRemChassisIdSubtype", lldp_rem) == 4 &&
             rcid[4:6] == "2d" && rcid[10:12] == "2d" && rcid[16:18] == "2d" &&
             rcid[22:24] == "2d" && rcid[28:30] == "2d" { // fix stupid morons, passing mac as ascii string with colons
            s := ""
            c := 0
            for c < len(rcid) {
              var b uint64
              b, err = strconv.ParseUint(rcid[c:c+2], 16, 8)
              if err != nil { return err }
              s += string(byte(b))
              c += 2
              b, err = strconv.ParseUint(rcid[c:c+2], 16, 8)
              if err != nil { return err }
              s += string(byte(b))
              c += 2
              if c < len(rcid) { c+= 2 }
            }
            rcid = s
          }
          subtype := raw.Vi("lldpRemPortIdSubtype", lldp_rem)
          port_id := raw.Vs("lldpRemPortId", lldp_rem)
          if subtype == 5 || subtype == 7 && len(port_id)%2 == 0 {  //interfaceName(5) or local(7)
            // port id is hex encoded string
            //trim trailing zeros
            for len(port_id) >= 2 && port_id[len(port_id)-2:] == "00" {
              port_id = port_id[:len(port_id)-2]
            }
            s := ""
            for c := 0; c < len(port_id); c += 2 {
              var b uint64
              b, err = strconv.ParseUint(port_id[c:c+2], 16, 8)
              if err != nil { return err }
              s += string(byte(b))
            }
            port_id = s
          }
          raw.MkM("lldp_seq_port")
          raw["lldp_seq_port"].(M)[seq] = port

          nei_h := dev.MkM("lldp_ports", port, "neighbours", seq)

          nei_h["RemTimeMark"] = timemark
          nei_h["RemChassisId"] = rcid
          nei_h["RemChassisIdSubtype"] = raw.VA("lldpRemChassisIdSubtype", lldp_rem)
          nei_h["RemPortIdSubtype"] = raw.VA("lldpRemPortIdSubtype", lldp_rem)
          nei_h["RemPortId"] = port_id
          nei_h["RemPortDescr"] = raw.VA("lldpRemPortDescr", lldp_rem)
          nei_h["RemSysName"] = raw.VA("lldpRemSysName", lldp_rem)
          nei_h["RemSysCaps"] = raw.Vs("lldpRemSysCaps", lldp_rem)

          caps := make([]string,0)

          caps_hex := nei_h["RemSysCaps"].(string)
          if len(caps_hex) > 1 && (len(caps_hex)%2) == 0 {
            if caps_bin, parse_err := strconv.ParseUint(caps_hex[0:2], 16, 8); parse_err == nil {
              if (caps_bin & 0x80) > 0 { caps = append(caps, "other") }
              if (caps_bin & 0x40) > 0 { caps = append(caps, "repeater") }
              if (caps_bin & 0x20) > 0 { caps = append(caps, "bridge") }
              if (caps_bin & 0x10) > 0 { caps = append(caps, "ap") }
              if (caps_bin & 0x08) > 0 { caps = append(caps, "router") }
              if (caps_bin & 0x04) > 0 { caps = append(caps, "phone") }
              if (caps_bin & 0x02) > 0 { caps = append(caps, "docsis") }
              if (caps_bin & 0x01) > 0 { caps = append(caps, "station") }
            }
            if len(caps) > 0 {
              nei_h["RemSysCapsDecoded"] = strings.Join(caps, ",")
            } else {
              nei_h["RemSysCapsDecoded"] = "none"
            }
          } else {
            nei_h["RemSysCapsDecoded"] = "error"
          }

          if raw.Evs("lldpRemSysDescr", lldp_rem) {
            nei_h["RemSysDescr"] = raw.VA("lldpRemSysDescr", lldp_rem)
          } else {
            nei_h["RemSysDescr"] = ""
          }

          if ifName, var_ok := dev.Vse("lldp_ports", port, "ifName"); var_ok {
            var count uint64

            if count, var_ok = dev.Vue("interfaces", ifName, "lldp_count"); var_ok {
              count++
            } else {
              count = 1
            }
            dev.VM("interfaces", ifName)["lldp_count"] = count
          }
        } else {
        }
      }
    }
  } //lldpRemChassisId

  if raw.EvM("lldpRemManAddrIfSubtype") {
    for mkey, _ := range raw.VM("lldpRemManAddrIfSubtype") {
      a := strings.Split(mkey, ".")
      var port string = ""
      var seq string = ""
      var af string = ""
      var addr string = ""
      if len(a) == 8 { // 0 . 1:port . 2:seq . 3 = 1 . (4,5,6,7) = ipv4
        port = a[1]
        seq = a[2]
        af = "1"
        addr = strings.Join(a[4:8], ".")
        if addr == "0.0.0.0" { addr = "" }
      } else if len(a) == 9 && a[4] == "4" { // 0 . 1:port . 2:seq . 3 = 1 . 4 = 4 . (5-8) = ipv4
        port = a[1]
        seq = a[2]
        af = "1"
        addr = strings.Join(a[5:9], ".")
      } else if len(a) == 21 && a[3] == "2" && a[4] == "16" { // 0 . 1:port . 2:seq . 3 = 2 . 4 = 16 . (5-20) = ipv6
        port = a[1]
        seq = a[2]
        af = "2"
        ipv6 := make(net.IP, 0)
        for c := 5; c < 21; c++ {
          var b uint64
          b, err = strconv.ParseUint(a[c], 10, 8)
          if err != nil { return err }
          ipv6 = append(ipv6, byte(b))
        }
        addr = ipv6.String()
      }
      if addr != "" && dev.EvM("lldp_ports", port, "neighbours", seq) {
        a_h := dev.MkM("lldp_ports", port, "neighbours", seq, "RemMgmtAddr")
        a_h[af] = addr
      }
    }
  } //lldpRemManAddrIfSubtype

  if raw.EvM("BDCOMlldpRemMgmtAddress") {
    for seq, addr_ := range raw.VM("BDCOMlldpRemMgmtAddress") {
      if raw.Evs("lldp_seq_port", seq) && raw.Evi("BDCOMlldpRemMgmtSubtype", seq) {
        port := raw.Vs("lldp_seq_port", seq)
        proto := raw.Vi("BDCOMlldpRemMgmtSubtype", seq)
        af := strconv.FormatInt(proto, 10)
        if dev.EvM("lldp_ports", port, "neighbours", seq) {
          a_h := dev.MkM("lldp_ports", port, "neighbours", seq, "RemMgmtAddr")
          a_h[af] = addr_.(string)
        }
      }
    }
  } //BDCOMlldpRemMgmtAddress


  if raw.EvM("huiOntAutoFindSn") {
    for key, sn := range raw.VM("huiOntAutoFindSn") {
      a := strings.Split(key, ".")
      if len(a) == 2 {
        parent_ifIndex := a[0]
        ont_index := a[1]
        if dev.Evs("ifName", parent_ifIndex) && dev.EvM("interfaces", dev.Vs("ifName", parent_ifIndex) ) &&
           raw.Evi("huiOntAutoFindVendorId", key) && raw.Evs("huiOntAutoFindEqId", key) && raw.Evs("huiOntAutoFindTime", key) {

          parent_ifName := dev.Vs("ifName", parent_ifIndex)
          ont_h := dev.MkM("interfaces", parent_ifName, "autoFindOnus", ont_index)
          ont_h["sn"] = sn.(string)
          ont_h["vendorId"] = strconv.FormatInt(raw.Vi("huiOntAutoFindVendorId", key), 10)
          ont_h["eqId"] = raw.Vs("huiOntAutoFindEqId", key)
          ont_h["findTime"] = hui_time(raw.Vs("huiOntAutoFindTime", key))
        }
      }
    }
  } //huiOntAutoFindSn

  if raw.EvM("arpTable") && d.Opt_a {
    arp_time, ok := raw.Vie("_key_stop", "arpTable")
    if !ok {
      err = errors.New("No _key_stop for arpTable")
      return err
    }

    d.Dev_arp = make(M)
    dev_arp := d.Dev_arp

    for key, mac := range raw.VM("arpTable") {
      var ifIndex string = ""
      var ip string = ""
      a := strings.Split(key, ".")
      var v string
      if len(a) == 7 && a[1] == "1" && a[2] == "4" { // 0 = ifIndex . 1 = 1 . 2 = 4 . (3-6) = IPv4
        ifIndex = a[0]
        ip = strings.Join(a[3:7], ".")
        v = "4"
      } else if len(a) == 19 && a[1] == "2" && a[2] == "16" { // 0 = ifIndex . 1 = 2 . 2 = 16 . (3-18) = IPv6
        ipv6 := make(net.IP, 0)
        for c := 3; c < 19; c++ {
          var b uint64
          b, err = strconv.ParseUint(a[c], 10, 8)
          if err != nil { return err }
          ipv6 = append(ipv6, byte(b))
        }
        ifIndex = a[0]
        ip = ipv6.String()
        v = "6"
      }

      if v == "4" && ifIndex != "" && dev.Evs("ifName", ifIndex) {
        ipu, ipu_ok := V4ip2long(ip)
        ifName := dev.Vs("ifName", ifIndex)
        if ipu_ok && dev.EvM("interfaces", ifName) {
          for dev_ip,_ := range dev.VM("interfaces", ifName, "ips") {
            if masklen, ok := dev.Vue("interfaces", ifName, "ips", dev_ip, "masklen"); ok &&
               dev.Vs("interfaces", ifName, "ips", dev_ip, "v") == "4" &&
            true {
              dev_ipu := dev.VA("interfaces", ifName, "ips", dev_ip, "ipu").(uint32)
              if Ip4net(ipu, uint32(masklen)) == Ip4net(dev_ipu, uint32(masklen)) {
                arp_h := dev_arp.MkM(ifName)
                arp_h[ip] = mac

                int_arp_count := uint64(0)
                if dev.Evu("interfaces", ifName, "arp_count") {
                  int_arp_count = dev.Vu("interfaces", ifName, "arp_count")
                }
                int_arp_count++
                dev.VM("interfaces", ifName)["arp_count"] = int_arp_count
              }
            }
          }
        }
      }
    }
    if len(d.Dev_arp) > 0 {
      dev["arp_time"] = arp_time
    }
  } //arpTable

  if raw.EvM("arpTableOld") && d.Opt_a {
    arp_time, ok := raw.Vie("_key_stop", "arpTableOld")
    if !ok {
      err = errors.New("No _key_stop for arpTableOld")
      return err
    }

    if d.Dev_arp == nil { d.Dev_arp = make(M) }
    dev_arp := d.Dev_arp

    for key, mac := range raw.VM("arpTableOld") {
      a := strings.Split(key, ".")
      if len(a) == 5 && dev.Evs("ifName", a[0]) {
        ip := strings.Join(a[1:], ".")
        ipu, ipu_ok := V4ip2long(ip)
        ifName := dev.Vs("ifName", a[0])

        if ipu_ok && dev.EvM("interfaces", ifName) {
          for dev_ip,_ := range dev.VM("interfaces", ifName, "ips") {
            if masklen, ok := dev.Vue("interfaces", ifName, "ips", dev_ip, "masklen"); ok &&
               dev.Vs("interfaces", ifName, "ips", dev_ip, "v") == "4" &&
            true {
              dev_ipu := dev.VA("interfaces", ifName, "ips", dev_ip, "ipu").(uint32)
              if Ip4net(ipu, uint32(masklen)) == Ip4net(dev_ipu, uint32(masklen)) {
                arp_h := dev_arp.MkM(ifName)
                arp_h[ip] = mac

                int_arp_count := uint64(0)
                if dev.Evu("interfaces", ifName, "arp_count") {
                  int_arp_count = dev.Vu("interfaces", ifName, "arp_count")
                }
                int_arp_count++
                dev.VM("interfaces", ifName)["arp_count"] = int_arp_count
              }
            }
          }
        }
      }
    }
    dev["arp_time"] = arp_time
  } //arpTableOld

  if raw.EvM("portMode") {
    for port, mode := range raw.VM("portMode") {
      if raw.Evi("portToIfIndex", port) {
        ifIndex := strconv.FormatInt(raw.Vi("portToIfIndex", port), 10)
        if dev.Evs("ifName", ifIndex) {
          ifName := dev.Vs("ifName", ifIndex)
          if dev.EvM("interfaces", ifName) {
            dev["interfaces"].(M)[ifName].(M)["portMode"] = mode

            if raw.Evi("portPvid", port) {
              dev["interfaces"].(M)[ifName].(M)["portPvid"] = raw.VA("portPvid", port)
            }
            if raw.Evs("portTrunkVlans", port) {
              dev["interfaces"].(M)[ifName].(M)["portTrunkVlans"] = vlans_list(raw.Vs("portTrunkVlans", port))
            }
            if raw.Evs("portHybridTag", port) {
              dev["interfaces"].(M)[ifName].(M)["portHybridTag"] = vlans_list(raw.Vs("portHybridTag", port))
            }
            if raw.Evs("portHybridUntag", port) {
              dev["interfaces"].(M)[ifName].(M)["portHybridUntag"] = vlans_list(raw.Vs("portHybridUntag", port))
            }
          }
        }
      }
    } //for portMode
  } else if raw.EvM("dot1qPvid") && raw.EvM("dot1qVlanStaticEgressPorts") && raw.EvM("dot1qVlanStaticUntaggedPorts") && raw.EvM("portToIfIndex") {
    port_vlans := make(M)
    go_on := true

    for port, index := range raw.VM("portToIfIndex") {

      ifIndex := strconv.FormatInt(index.(int64), 10)

      if dev.Evs("ifName", ifIndex) {
        if dev.EvM("interfaces", dev.Vs("ifName", ifIndex)) {

          port_vlans[port] = make(M)
          port_vlans[port].(M)["member"] = make([]string, 0)
          port_vlans[port].(M)["untag"] = make([]string, 0)
          if raw.Evu("dot1qPvid", port) {
            port_vlans[port].(M)["pvid"] = raw.VA("dot1qPvid", port)
          } else {
            port_vlans[port].(M)["pvid"] = uint64(0)
          }
          port_vlans[port].(M)["ifName"] = dev.Vs("ifName", ifIndex)
        }
      }
    }

    vlan_list := make([]string, 0)
    for v, _ := range raw.VM("dot1qVlanStaticEgressPorts") {
      if !raw.Evs("dot1qVlanStaticUntaggedPorts", v) {
        go_on = false
        break
      }
      vlan_list = append(vlan_list, v)
    }

    if go_on {
      sort.Sort(StrByNum(vlan_list))
      for _, v := range vlan_list {
        d1q_egr := port_list(raw.Vs("dot1qVlanStaticEgressPorts", v))
        d1q_untag := port_list(raw.Vs("dot1qVlanStaticUntaggedPorts", v))

        for port, _ := range port_vlans {
          for _, p := range d1q_egr {
            if p == port {
              port_vlans[port].(M)["member"] = append(port_vlans[port].(M)["member"].([]string), v)
              break
            }
          }
          for _, p := range d1q_untag {
            if p == port {
              port_vlans[port].(M)["untag"] = append(port_vlans[port].(M)["untag"].([]string), v)
              break
            }
          }
        }
      }


      for port, _ := range port_vlans {
        ifName := port_vlans[port].(M)["ifName"].(string)
        dev["interfaces"].(M)[ifName].(M)["portPvid"] = port_vlans[port].(M)["pvid"]

        if len(port_vlans[port].(M)["member"].([]string)) == 1 && len(port_vlans[port].(M)["untag"].([]string)) == 1 &&
           port_vlans[port].(M)["member"].([]string)[0] == port_vlans[port].(M)["untag"].([]string)[0] &&
           port_vlans[port].(M)["member"].([]string)[0] == strconv.FormatUint( port_vlans[port].(M)["pvid"].(uint64), 10) {
          //if
          dev["interfaces"].(M)[ifName].(M)["portMode"] = int64(1)     // access mode
        } else if len(port_vlans[port].(M)["untag"].([]string)) == 1 &&
           port_vlans[port].(M)["untag"].([]string)[0] == strconv.FormatUint( port_vlans[port].(M)["pvid"].(uint64), 10) {
          //if
          dev["interfaces"].(M)[ifName].(M)["portMode"] = int64(2)     // trunk mode
          dev["interfaces"].(M)[ifName].(M)["portTrunkVlans"] = array_to_list(port_vlans[port].(M)["member"].([]string))
        } else {
          dev["interfaces"].(M)[ifName].(M)["portMode"] = int64(3)
          dev["interfaces"].(M)[ifName].(M)["portHybridUntag"] = array_to_list(port_vlans[port].(M)["untag"].([]string))
          tag_list := make([]string, 0)
          for _, vlan := range port_vlans[port].(M)["member"].([]string) {
            found := false
            for _, v := range port_vlans[port].(M)["untag"].([]string) {
              if v == vlan {
                found = true
                break
              }
            }
            if !found {
              tag_list = append(tag_list, vlan)
            }
          }
          dev["interfaces"].(M)[ifName].(M)["portHybridTag"] = array_to_list(tag_list)
        }
      }
    }
  } else if raw.EvM("hwL2IfPortType") && raw.EvM("hwL2IfPortIfIndex") {
    for port_id, _ := range raw.VM("hwL2IfPortIfIndex") {
      ifIndex := raw.Vs("hwL2IfPortIfIndex", port_id)
      if ifName, ex := dev.Vse("ifName", ifIndex); ex && dev.EvM("interfaces", ifName) {
        pvid := int64(0)
        if raw.Evi("hwL2IfPVID", port_id) {
          pvid = raw.Vi("hwL2IfPVID", port_id)
        }
        dev.VM("interfaces", ifName)["portPvid"] = pvid
        p_type := raw.Vi("hwL2IfPortType", port_id)
        if raw.Evi("hwL2IfPortActiveType", port_id) {
          p_type = raw.Vi("hwL2IfPortActiveType", port_id)
        }
        switch p_type {
        case 1:
          // huawei trunk mode
          dev.VM("interfaces", ifName)["portMode"] = uint64(2)
          list := "0"
          if raw.Evs("hwL2IfTrunkVlansLow", port_id) && raw.Evs("hwL2IfTrunkVlansHigh", port_id) {
            list = vlans_list(raw.Vs("hwL2IfTrunkVlansLow", port_id) + raw.Vs("hwL2IfTrunkVlansHigh", port_id))
          }
          dev.VM("interfaces", ifName)["portTrunkVlans"] = list
        case 2:
          // huawei access mode
          dev.VM("interfaces", ifName)["portMode"] = uint64(1)
        case 3:
          // huawei hybrid mode
          dev.VM("interfaces", ifName)["portMode"] = uint64(3)
          list := "0"
          if raw.Evs("hwL2IfHybridTagLow", port_id) && raw.Evs("hwL2IfHybridTagHigh", port_id) {
            list = vlans_list(raw.Vs("hwL2IfHybridTagLow", port_id) + raw.Vs("hwL2IfHybridTagHigh", port_id))
          }
          dev.VM("interfaces", ifName)["portHybridTag"] = list
          list = "0"
          if raw.Evs("hwL2IfHybridUntagLow", port_id) && raw.Evs("hwL2IfHybridUntagHigh", port_id) {
            list = vlans_list(raw.Vs("hwL2IfHybridUntagLow", port_id) + raw.Vs("hwL2IfHybridUntagHigh", port_id))
          }
          dev.VM("interfaces", ifName)["portHybridUntag"] = list
        default:
          dev.VM("interfaces", ifName)["portMode"] = uint64(p_type)
        }
      }
    }
  } //dot1q


  // Stupid NSGATE puts mgmt IP data onto switchport while having CPU port
  if strings.Index(dev.Vs("sysObjectID"), ".1.3.6.1.4.1.4808.301.1.70") == 0 && dev.EvM("interfaces", "Port.1") && dev.EvM("interfaces", "CPU port") {
    if dev.EvM("interfaces", "Port.1", "ips") {
      dev["interfaces"].(M)["CPU port"].(M)["ips"] = dev.VM("interfaces", "Port.1", "ips")
      delete(dev["interfaces"].(M)["Port.1"].(M), "ips")
    }
    if dev.EvM("interfaces", "Port.1", "arp_table") {
      dev["interfaces"].(M)["CPU port"].(M)["arp_table"] = dev.VM("interfaces", "Port.1", "arp_table")
      delete(dev["interfaces"].(M)["Port.1"].(M), "arp_table")
    }
  }

  cpu_num := int64(0)

  if raw.EvM("CiscoCPU1mLoad") {
    for cpu_index, load := range raw.VM("CiscoCPU1mLoad") {
      cpu_name := "CPU"
      if raw.Evi("CiscoCPUPhysEnt", cpu_index) {
        cpu_phy_ent := raw.Vs("CiscoCPUPhysEnt", cpu_index)
        if raw.Evs("CiscoEntNames", cpu_phy_ent) {
          cpu_name = raw.Vs("CiscoEntNames", cpu_phy_ent)
        }
      }
      cpu_h := dev.MkM("CPUs", strconv.FormatInt(cpu_num, 10))
      cpu_h["name"] = cpu_name
      cpu_h["_graph_key"] = "CiscoCPU1mLoad."+cpu_index
      cpu_h["cpu1MinLoad"] = load
      cpu_num++
    }
  } else if raw.Evi("cpu1MinLoad") {
    cpu_h := dev.MkM("CPUs", strconv.FormatInt(cpu_num, 10))
    cpu_h["name"] = "CPU"
    cpu_h["_graph_key"] = "cpu1MinLoad.0"
    cpu_h["cpu1MinLoad"] = raw.Vu("cpu1MinLoad")
    cpu_num++
  }

  if raw.EvM("CiscoQFPLoad") {
    for qfp_key, load := range raw.VM("CiscoQFPLoad") {
      a := strings.Split(qfp_key, ".")
      if len(a) == 2 && a[1] == "2" {
        qfp_phy_ent := a[0]
        qfp_name := "QFP "+qfp_phy_ent
        if raw.Evs("CiscoEntNames", qfp_phy_ent) {
          qfp_name = raw.Vs("CiscoEntNames", qfp_phy_ent)
        }
        cpu_h := dev.MkM("CPUs", strconv.FormatInt(cpu_num, 10))
        cpu_h["name"] = qfp_name
        cpu_h["_graph_key"] = "CiscoQFPLoad."+qfp_key
        cpu_h["cpu1MinLoad"] = load
        cpu_num++
      }
    }
  }

  if raw.EvM("snrMirrorDestIfName") {
    for monitor_session,_ := range raw.VM("snrMirrorDestIfName") {
      if dev.EvM("interfaces", raw.Vs("snrMirrorDestIfName", monitor_session)) {
        dev.VM("interfaces", raw.Vs("snrMirrorDestIfName", monitor_session))["monitorDstSession"] = monitor_session
      }
    }
  }

  // CDP

  if raw.Evs("locCdpDevId") && raw.EvM("locCdpIfEnabled") {
    dev["locCdpDevId"] = raw.Vs("locCdpDevId")

    cdp_ports := make(M)
    cdp_ifname2cdp_port := make(M)

    for cdp_index, _ := range raw.VM("locCdpIfEnabled") {
      a := strings.Split(cdp_index, ".")
      if len(a) != 1 { continue }
      cdpIfName, var_ok := raw.Vse("locCdpIfName", cdp_index)
      if !var_ok {
        if_name, var_ok := dev.Vse("ifName", cdp_index)
        if var_ok && dev.Evs("interfaces", if_name, "ifDescr") {
          cdpIfName = dev.Vs("interfaces", if_name, "ifDescr")
        } else {
          continue
        }
      }

      cdpIfEnabled, var_ok := raw.Vie("locCdpIfEnabled", cdp_index)
      if !var_ok {
        continue
      }

      cdp_ports[cdp_index] = M{
        "locCdpIfName": cdpIfName,
        "locCdpIfEnabled": cdpIfEnabled,
      }
      if ifName, ex := dev.Vse("ifName", cdp_index); ex && dev.EvM("interfaces", ifName) {
        cdp_ports[cdp_index].(M)["ifName"] = ifName
        dev.VM("interfaces", ifName)["cdp_portIndex"] = cdp_index
      } else {
        cdp_ports[cdp_index].(M)["error"] = "ifName not found"
      }

      cdp_ifname2cdp_port[cdpIfName] = cdp_index
    }

    if raw.EvM("cdpRemDevId") && raw.EvM("cdpRemIfName") {
      for rem_index, _ := range raw.VM("cdpRemDevId") {
        a := strings.Split(rem_index, ".")
        ifName := cdp_ports.Vs(a[0], "ifName")
        if len(a) == 2 &&
           ifName != STRING_ERROR &&
           raw.Evs("cdpRemIfName", rem_index) &&
           raw.Evs("cdpRemDevId", rem_index) &&
           raw.Evs("cdpRemCaps", rem_index) &&
        true {
          nei := M{
            "cdpRemIfName": raw.Vs("cdpRemIfName", rem_index),
            "cdpRemDevId": raw.Vs("cdpRemDevId", rem_index),
            "cdpRemCaps": raw.Vs("cdpRemCaps", rem_index),
            "cdpRemSoftware": raw.Vsr("", "cdpRemSoftware", rem_index),
            "cdpRemPlatform": raw.Vsr("", "cdpRemPlatform", rem_index),
          }
          caps_bin, perr := strconv.ParseUint(raw.Vs("cdpRemCaps", rem_index), 16, 32)
          if perr != nil {
            var caps_bytes []byte
            caps_bytes, perr = hex.DecodeString(raw.Vs("cdpRemCaps", rem_index))
            if perr != nil {
              nei["cdpRemCapsDecoded"] = "error"
            } else {
              caps_bin = 0
              if strings.Index(string(caps_bytes), "Router ") >= 0 { caps_bin |= 0x0001 }
              if strings.Index(string(caps_bytes), "Trans-Bridge ") >= 0 { caps_bin |= 0x0002 }
              if strings.Index(string(caps_bytes), "Source-Route-Bridge ") >= 0 { caps_bin |= 0x0004 }
              if strings.Index(string(caps_bytes), "Switch ") >= 0 { caps_bin |= 0x0008 }
              if strings.Index(string(caps_bytes), "Host ") >= 0 { caps_bin |= 0x0010 }
              if strings.Index(string(caps_bytes), "IGMP ") >= 0 { caps_bin |= 0x0020 }
              if strings.Index(string(caps_bytes), "Repeater ") >= 0 { caps_bin |= 0x0040 }
              if strings.Index(string(caps_bytes), "Phone ") >= 0 { caps_bin |= 0x0080 }

              if caps_bin == 0 { perr = errors.New("Dumb old Cisco") }
            }
          }
          if perr == nil {
            caps := make([]string, 0)
            if (caps_bin & 0x0001) > 0 { caps = append(caps, "router") }
            if (caps_bin & 0x0002) > 0 { caps = append(caps, "bridge") }
            if (caps_bin & 0x0004) > 0 { caps = append(caps, "srbrid") }
            if (caps_bin & 0x0008) > 0 { caps = append(caps, "switch") }
            if (caps_bin & 0x0010) > 0 { caps = append(caps, "host") }
            if (caps_bin & 0x0020) > 0 { caps = append(caps, "igmp") }
            if (caps_bin & 0x0040) > 0 { caps = append(caps, "repeater") }
            if (caps_bin & 0x0080) > 0 { caps = append(caps, "phone") }
            if (caps_bin & 0x0100) > 0 { caps = append(caps, "remote") }
            if (caps_bin & 0x0200) > 0 { caps = append(caps, "cvta") }
            if (caps_bin & 0x0400) > 0 { caps = append(caps, "macrelay") }
            if len(caps) > 0 {
              nei["cdpRemCapsDecoded"] = strings.Join(caps, ",")
            } else {
              nei["cdpRemCapsDecoded"] = "none"
            }
          } else {
            nei["cdpRemCapsDecoded"] = "error"
          }

          if raw.Evi("cdpRemAddrType", rem_index) && raw.Evs("cdpRemAddr", rem_index) {
            addr_type := raw.Vi("cdpRemAddrType", rem_index)
            addr_hex := raw.Vs("cdpRemAddr", rem_index)

            nei["cdpRemAddrType"] = addr_type
            nei["cdpRemAddr"] = addr_hex

            if addr_type == 1 && len(addr_hex) == 8 {
              addr_u, perr := strconv.ParseUint(addr_hex, 16, 32)
              if perr == nil {
                nei["cdpRemAddrDecoded"] = V4long2ip(uint32(addr_u))
              }
            }
          }
          cdp_ports.MkM(a[0], "neighbours")[a[1]] = nei

          var count uint64

          if count, var_ok = dev.Vue("interfaces", ifName, "cdp_count"); var_ok {
            count++
          } else {
            count = 1
          }
          dev.VM("interfaces", ifName)["cdp_count"] = count
        }
      }
    }
    dev["cdp_ports"] = cdp_ports
    dev["cdp_ifname2cdp_port"] = cdp_ifname2cdp_port
  }

  var eigrpCount = make(map[string]uint64)

  if raw.EvM("eigrpPeerAddrType") {
    for peer_key, _ := range raw.VM("eigrpPeerAddrType") {
      addr_type, ex1 := raw.Vse("eigrpPeerAddrType", peer_key)
      addr_hex, ex2 := raw.Vse("eigrpPeerAddr", peer_key)
      peer_ifindex, ex3 := raw.Vse("eigrpPeerIfIndex", peer_key)

      if ex1 && ex2 && ex3 {
        var addr string
        if addr_type == "1" {
          addr_u, addr_err := strconv.ParseUint(addr_hex, 16, 32)
          if addr_err == nil {
            addr = V4long2ip(uint32(addr_u))
          }
        } else {
          addr = addr_hex
        }
        if ifName, ex := dev.Vse("ifName", peer_ifindex); addr != "" && ex &&
           dev.EvM("interfaces", ifName) &&
        true {
          dev.MkM("interfaces", ifName, "eigrp_peers", addr_type, addr)
          if _, ex := eigrpCount[ifName]; !ex { eigrpCount[ifName] = 0 }
          eigrpCount[ifName] = eigrpCount[ifName] + 1
        }
      }
    }
  }

  for ifName, count := range eigrpCount {
    dev.VM("interfaces", ifName)["eigrp_found_count"] = count
  }

  if raw.EvM("eigrpIfPeerCount") {
    for if_key, _ := range raw.VM("eigrpIfPeerCount") {
      a := strings.Split(if_key, ".")
      if len(a) == 3 && dev.Evs("ifName", a[2]) &&
         raw.Evu("eigrpIfPeerCount", if_key) &&
         raw.Evu("eigrpIfPkts1", if_key) &&
         raw.Evu("eigrpIfPkts2", if_key) &&
         raw.Evu("eigrpIfPkts3", if_key) &&
         raw.Evu("eigrpIfPkts4", if_key) &&
         dev.EvM("interfaces", dev.Vs("ifName", a[2])) &&
      true {
        pkts := raw.Vu("eigrpIfPkts1", if_key) + raw.Vu("eigrpIfPkts2", if_key) +
                raw.Vu("eigrpIfPkts3", if_key) + raw.Vu("eigrpIfPkts4", if_key)
        dev.VM("interfaces", dev.Vs("ifName", a[2]))["eigrpIfPeerCount"] = raw.Vu("eigrpIfPeerCount", if_key)
        dev.VM("interfaces", dev.Vs("ifName", a[2]))["eigrpIfPkts"] = pkts
      }
    }
  }

  if raw.EvM("tunnelEncap") {
    for if_index, _ := range raw.VM("tunnelEncap") {
      if raw.Evi("tunnelSec", if_index) &&
         raw.Evi("tunnelAddrType", if_index) &&
         raw.Evs("tunnelSrc", if_index) &&
         raw.Evs("tunnelDst", if_index) &&
         dev.Evs("ifName", if_index) &&
         dev.EvM("interfaces", dev.Vs("ifName", if_index)) &&
      true {
        dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelEncap"] = raw.Vi("tunnelEncap", if_index)
        dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelSec"] = raw.Vi("tunnelSec", if_index)
        dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelAddrType"] = raw.Vi("tunnelAddrType", if_index)
        dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelSrc"] = raw.Vs("tunnelSrc", if_index)
        dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelDst"] = raw.Vs("tunnelDst", if_index)

        if raw.Vi("tunnelAddrType", if_index) == 1 { //ipv4
          src_str := raw.Vs("tunnelSrc", if_index)
          dst_str := raw.Vs("tunnelDst", if_index)
          if len(src_str) == 8 {
            addr_u, perr := strconv.ParseUint(src_str, 16, 32)
            if perr == nil {
              addr := V4long2ip(uint32(addr_u))
              dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelSrcDecoded"] = addr

              for ifName, _ := range dev.VM("interfaces") {
                if dev.EvM("interfaces", ifName, "ips", addr) {
                  dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelSrcIfName"] = ifName
                }
              }
            }
          }
          if len(dst_str) == 8 {
            addr_u, perr := strconv.ParseUint(dst_str, 16, 32)
            if perr == nil {
              addr := V4long2ip(uint32(addr_u))
              dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelDstDecoded"] = addr
              for ifName, _ := range dev.VM("interfaces") {
                if dev.EvM("interfaces", ifName, "ips", addr) {
                  dev.VM("interfaces", dev.Vs("ifName", if_index))["tunnelDstIfName"] = ifName
                }
              }
            }
          }
        }
      }
    }
  }

  if raw.EvM("routedIfVlan") {
    for key, _ := range raw.VM("routedIfVlan") {
      a := strings.Split(key, ".")
      if len(a) == 2 {
        if_index := raw.Vs("routedIfVlan", key)
        if dev.Evs("ifName", if_index) && dev.EvM("interfaces", dev.Vs("ifName", if_index)) {
          dev.VM("interfaces", dev.Vs("ifName", if_index))["routedVlan"] = a[0]
          if dev.Evs("ifName", a[1]) {
            dev.VM("interfaces", dev.Vs("ifName", if_index))["routedVlanParent"] = dev.Vs("ifName", a[1])
          }
        }
      }
    }
  }

  if raw.EvM("ciscoPortTrunkVlans") {
    for key, _ := range raw.VM("ciscoPortTrunkVlans") {
      if ifName, var_ok := dev.Vse("ifName", key); var_ok && dev.EvM("interfaces", ifName) {
        dev.VM("interfaces", ifName)["portTrunkVlans"] = vlans_list(raw.Vs("ciscoPortTrunkVlans", key))
      }
    }
  }


  if raw.EvM("ciscoPortIsTrunk") {
    for key, _ := range raw.VM("ciscoPortIsTrunk") {
      if ifName, var_ok := dev.Vse("ifName", key); var_ok && dev.EvM("interfaces", ifName) {
        if raw.Vi("ciscoPortIsTrunk", key) == 1 {
          dev.VM("interfaces", ifName)["portMode"] = uint64(2) //trunk
          if raw.EvA("ciscoPortTrunkPvid", key) {
            dev.VM("interfaces", ifName)["portPvid"] = raw.VA("ciscoPortTrunkPvid", key)
          }
        } else {
          dev.VM("interfaces", ifName)["portMode"] = uint64(1) //access
          if raw.EvA("ciscoPortAccessVlan", key) {
            dev.VM("interfaces", ifName)["portPvid"] = raw.VA("ciscoPortAccessVlan", key)
          }
          if raw.EvA("ciscoPortVoiceVlan", key) {
            dev.VM("interfaces", ifName)["portVvid"] = raw.VA("ciscoPortVoiceVlan", key)
          }
        }
      }
    }
  }

  if !raw.EvA("memorySize") && raw.EvM("ciscoMemPoolUsed") && raw.EvM("ciscoMemPoolFree") {
    total_mem := uint64(0)
    total_used := uint64(0)
    for key, _ := range raw.VM("ciscoMemPoolUsed") {
      mem_used, used_ex := raw.Vue("ciscoMemPoolUsed", key)
      mem_free, free_ex := raw.Vue("ciscoMemPoolFree", key)
      if used_ex && free_ex {
        total_mem += (mem_used + mem_free)
        total_used += mem_used
      }
    }

    if total_mem > 0 {
      dev["memorySize"] = total_mem
      dev["memoryUsed"] = total_used

      dev.MkM("proc_graph")["memoryUsed"] = 1
    }
  }

  if raw.EvM("lagParentIfIndex") {
    for ifIndex, _ := range raw.VM("lagParentIfIndex") {
      parentIfIndex := raw.Vs("lagParentIfIndex", ifIndex)
      memIfName, mem_ok := dev.Vse("ifName", ifIndex)
      parIfName, par_ok := dev.Vse("ifName", parentIfIndex)
      if mem_ok && par_ok && dev.EvM("interfaces", memIfName) && dev.EvM("interfaces", parIfName) {
        dev.VM("interfaces", memIfName)["lag_parent"] = parIfName

        var lag_members []string
        if dev.EvA("interfaces", parIfName, "lag_members") {
          lag_members = dev.VA("interfaces", parIfName, "lag_members").([]string)
        } else {
          lag_members = []string{}
        }
        lag_members = append(lag_members, memIfName)
        dev.VM("interfaces", parIfName)["lag_members"] = lag_members
      }
    }
  }

  if raw.EvM("pagpMode") && raw.EvM("pagpParentIfIndex") {
    for ifIndex, _ := range raw.VM("pagpMode") {
      mode := raw.Vi("pagpMode", ifIndex)
      if mode == 2 || mode == 3 && raw.Evi("pagpParentIfIndex", ifIndex) {
        parentIfIndex := raw.Vs("pagpParentIfIndex", ifIndex)
        memIfName, mem_ok := dev.Vse("ifName", ifIndex)
        parIfName, par_ok := dev.Vse("ifName", parentIfIndex)
        if mem_ok && par_ok && dev.EvM("interfaces", memIfName) && dev.EvM("interfaces", parIfName) {
          dev.VM("interfaces", memIfName)["pagp_parent"] = parIfName
          if mode == 2 {
            dev.VM("interfaces", memIfName)["pagp_mode"] = "manual"
          } else {
            dev.VM("interfaces", memIfName)["pagp_mode"] = "PAGP"
          }

          var pagp_members []string
          if dev.EvA("interfaces", parIfName, "pagp_members") {
            pagp_members = dev.VA("interfaces", parIfName, "pagp_members").([]string)
          } else {
            pagp_members = []string{}
          }
          pagp_members = append(pagp_members, memIfName)
          dev.VM("interfaces", parIfName)["pagp_members"] = pagp_members
        }
      }
    }
  }

  return nil
}
