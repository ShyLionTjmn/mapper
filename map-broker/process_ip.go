package main

import (
  "fmt"
  "sync"
  "time"
  "regexp"
  "errors"
  "strings"
  "strconv"
  "sort"
  "reflect"
  "runtime"
  dbg "runtime/debug"
  "path"
  "encoding/json"

  "github.com/gomodule/redigo/redis"

  w "github.com/jimlawless/whereami"
  // "github.com/davecgh/go-spew/spew"
  "github.com/fatih/color"

  . "github.com/ShyLionTjmn/mapper/mapaux"
  . "github.com/ShyLionTjmn/mapper/decode_dev"

)

var safeInt_regex *regexp.Regexp

func init() {
  w.WhereAmI()
  regexp.MustCompile("")
  safeInt_regex = regexp.MustCompile(SAFE_INT_REGEX)
}

var legNeiErrNoDev = errors.New("nd")
var legNeiErrNoIfName = errors.New("nin")
var legNeiErrNoPi = errors.New("npi")

var devWatchKeys = []string{"sysName", "locChassisSysName", "snmpEngineId", "sysLocation", "locChassisIdSubtype", "sysDescr",
                               "locChassisId", "sysObjectID", "sysContact", "CiscoConfSave", "data_ip", "short_name",
                               "powerState",
                              }

var devAlertKeys = []string{"powerState"}

var intWatchKeys = []string{"ifOperStatus", "portId", "ifAdminStatus", "ifIndex", "ifAlias", "ifType",
                            "portMode", "portTrunkVlans", "portHybridTag", "portHybridUntag", "portPvid",
                            "monitorDstSession",
                           }

var intGraphKeys = []string{"ifHCInOctets", "ifHCOutOctets", "ifInUnicastPkts", "ifOutUnicastPkts", "ifInMulticastPkts", "ifOutMulticastPkts",
                            "ifInBroadcastPkts", "ifOutBroadcastPkts", "ifOperStatus", "ifInErrors", "ifInCRCErrors",
                            "oltRxPower", "onuRxPower", "onuDistance",
                           }

var lldpKeySet = []string{"RemSysName", "RemChassisId", "RemChassisIdSubtype", "RemPortDescr", "RemPortId", "RemPortIdSubtype"}
var cdpKeySet = []string{"cdpRemAddrDecoded", "cdpRemAddr", "cdpRemAddrType", "cdpRemCaps", "cdpRemCapsDecoded", "cdpRemDevId", "cdpRemIfName", "cdpRemPlatform"}

var intCounterResetWatchKeys = []string{"ifInUnicastPkts", "ifOutUnicastPkts", "ifInMulticastPkts", "ifOutMulticastPkts",
                                        "ifInBroadcastPkts", "ifOutBroadcastPkts", "ifInErrors", "ifInCRCErrors",
                                       }

type ByInt64 []int64

func (a ByInt64) Len() int		{ return len(a) }
func (a ByInt64) Swap(i, j int)		{ a[i], a[j] = a[j], a[i] }
func (a ByInt64) Less(i, j int) bool	{ return a[i] < a[j] }

const NL = "\n"

const LOG_MAX_EVENTS = 1000
const ALERT_MAX_EVENTS = 10000

type Logger struct {
  Conn		redis.Conn
  Dev		string
  Count		int
}

func (l *Logger) Event(f ... string) { // "event", key|"", "attr", value, "attr", value, ...
  if len(f) < 2 { return } //wtf?
  m := make(M)
  m["event"] = f[0]
  m["key"] = f[1]
  m["time"] = time.Now().Unix()

  if len(f) > 3 {
    m["fields"] = make(M)
    for i := 2; i < (len(f) - 1); i += 2 {
      m["fields"].(M)[f[i]] = f[i+1]
    }
  }

  j, err := json.Marshal(m)
  if err == nil {
    if l.Conn != nil && l.Conn.Err() == nil {
      l.Conn.Do("LPUSH", "log."+l.Dev, j)
      l.Count++
      if opt_v > 1 {
        color.Magenta("Log: %s, %s", l.Dev, j)
      }
    }
  }
}

func (l *Logger) Save() {
  if l.Conn != nil && l.Conn.Err() == nil && l.Count > 0 {
    l.Count = 0
    l.Conn.Do("LTRIM", "log."+l.Dev, 0, LOG_MAX_EVENTS)
    l.Conn.Do("PUBLISH", "log.poke", l.Dev+"\t"+time.Now().String())
  }
}

type Alerter struct {
  Conn          redis.Conn
  Count		int
}

func (a *Alerter) Alert(new M, old interface{}, ifName string, key string) (success bool) {
  success = false
  m := make(M)

  // WRITE STRINGS ONLY!
  m["id"] = new.Vs("id")
  m["data_ip"] = new.Vs("data_ip")
  m["short_name"] = new.Vs("short_name")
  m["model_short"] = new.Vs("model_short")
  m["sysObjectID"] = new.Vs("sysObjectID")
  m["sysLocation"] = new.Vs("sysLocation")
  m["last_seen"] = new.Vs("last_seen")
  m["overall_status"] = new.Vs("overall_status")
  m["alert_key"] = key
  m["time"] = strconv.FormatInt(time.Now().Unix(), 10)
  m["old"] = fmt.Sprint(old)

  for _, field := range alert_fields {
    if new.EvA(field) && !m.EvA(field) {
      m[field] = AlertRuleFieldValue(new.VA(field))
    }
  }

  if ifName == "" {
    m["alert_type"] = "dev"
    m["new"] = fmt.Sprint(new.VA(key))
  } else {
    m["alert_type"] = "int"
    for _, attr := range []string{"ifAlias", "ifType", "portMode", "ifIndex"} {
      if val, ok := new.VAe("interfaces", ifName, attr); ok {
        m[attr] = fmt.Sprint(val)
      }
    }
    m["ifName"] = ifName
    m["new"] = fmt.Sprint(new.VA("interfaces", ifName, key))
    for _, field := range alert_fields {
      if new.EvA("interfaces", ifName, field) && !m.EvA(field) {
        m[field] = AlertRuleFieldValue(new.VA("interfaces", ifName, field))
      }
    }
  }

  j, err := json.Marshal(m)
  if err == nil {
    if a.Conn != nil && a.Conn.Err() == nil {
      if _, err = a.Conn.Do("RPUSH", "alert", j); err == nil {
        a.Count++
        success = true
      }

      if opt_v > 1 {
        color.Magenta("Alert: %s", j)
      }

      if key == "overall_status" && success {
        if _, err = a.Conn.Do("SET", "status_alert."+new.Vs("id"), strconv.FormatInt(time.Now().Unix(), 10)+";"+
                              new.Vs("data_ip")+";"+new.Vs("overall_status"));
        err != nil {
          success = false
        }
      }

      if a.Conn.Err() == nil {
        if key == "overall_status" {
          a.Conn.Do("RPUSH", "alert.overall_status", j)
        }
        a.Conn.Do("PUBLISH", "alert.debug", time.Now().String()+" "+string(j))
      }
    }
  }
  return
}

func (a *Alerter) Save() {
  if a.Conn != nil && a.Conn.Err() == nil && a.Count > 0 {
    a.Count = 0
    a.Conn.Do("LTRIM", "alert", -ALERT_MAX_EVENTS, -1)
    a.Conn.Do("LTRIM", "alert.overall_status", -ALERT_MAX_EVENTS, -1)
    a.Conn.Do("PUBLISH", "alert.poke", time.Now().String())
  }
}

func find_lldp_nei(leg M) (dev_id string, if_name string, err error) {
  chid := leg.Vs("RemChassisId")
  chidst := leg.Vi("RemChassisIdSubtype")
  pid := leg.Vs("RemPortId")
  pidst := leg.Vi("RemPortIdSubtype")

  dev_id = "lldp:"+strings.ToLower(chid)
  dev_h := devs.VM(dev_id)

  if dev_h == nil {
    err = legNeiErrNoDev
    return
  } else if dev_h.EvA("locChassisIdSubtype") && dev_h.Vi("locChassisIdSubtype") == chidst &&
     dev_h.Evs("lldp_id2port_index", pid) &&
     dev_h.Vi("lldp_ports", dev_h.Vs("lldp_id2port_index", pid), "subtype") == pidst &&
     pidst == 7 {
    //if
    port_index := dev_h.Vs("lldp_id2port_index", pid)
    if !dev_h.Evs("lldp_ports", port_index, "ifName") {
      err = legNeiErrNoIfName
      return
    } else {
      if_name = dev_h.Vs("lldp_ports", port_index, "ifName")
    }
  } else if dev_h.EvA("locChassisIdSubtype") && dev_h.Vi("locChassisIdSubtype") == chidst &&
            pidst == 5 && dev_h.Evs("interfaces", pid, "lldp_portIndex") {
    //else if
    if_name = pid
  } else {
    err = legNeiErrNoPi
    return
  }
  err = nil
  return
}

func find_cdp_nei(leg M) (dev_id string, if_name string, err error) {
  chid := leg.Vs("cdpRemDevId")
  pid := leg.Vs("cdpRemIfName")

  dev_id = data.Vs("cdp2dev", chid)
  if dev_id == STRING_ERROR { err = legNeiErrNoDev; return }
  dev_h := devs.VM(dev_id)

  if dev_h == nil {
    err = legNeiErrNoDev
    return
  } else if port_index, ex := dev_h.Vse("cdp_ifname2cdp_port", pid); ex && dev_h.Evs("cdp_ports", port_index, "ifName") {
      if_name = dev_h.Vs("cdp_ports", port_index, "ifName")
  } else {
    err = legNeiErrNoPi
    return
  }
  err = nil
  return
}

func l2l_key(cid1, pid1, cid2, pid2 string) string {
  cid1_gt := cid1 > cid2
  cid_eq := cid1 == cid2
  pid1_gt := pid1 > pid2

  if cid1_gt || (cid_eq && pid1_gt) {
    return cid1+"@"+pid1+"#"+cid2+"@"+pid2
  } else {
    return cid2+"@"+pid2+"#"+cid1+"@"+pid1
  }
}

func wipe_dev(dev_id string) {

  delete(devs, dev_id)
  delete(devs_macs, dev_id)
  delete(devs_arp, dev_id)

  if dev_refs.EvM(dev_id, "l2_links") {
    for link_id, _ := range dev_refs.VM(dev_id, "l2_links") {
      if link_h, ok := data.VMe("l2_links", link_id); ok {
        var nei_leg M
        if link_h.Vs("_creator") == dev_id {
          nei_leg = link_h.VM("1")
        } else {
          nei_leg = link_h.VM("0")
        }
        if nei_dev_id := nei_leg.Vs("DevId"); nei_dev_id != dev_id {
          nei_if := nei_leg.Vs("ifName")
          if nei_if_a, ok := devs.VAe(nei_dev_id, "interfaces", nei_if, "l2_links"); ok {
            new_links := StrExclude(nei_if_a.([]string), link_id)
            if len(new_links) == 0 {
              delete(devs.VM(nei_dev_id, "interfaces", nei_if), "l2_links")
            } else {
              devs.VM(nei_dev_id, "interfaces", nei_if)["l2_links"] = new_links
            }
          }
          if dev_refs.EvM(nei_dev_id, "l2_links") {
            delete(dev_refs.VM(nei_dev_id, "l2_links"), link_id)
          }
        }
      }
      delete(data.VM("l2_links"), link_id)
    }
  }

  if dev_refs.EvM(dev_id, "l3_links") {
    for net, net_m := range dev_refs.VM(dev_id, "l3_links") {
      for if_ip, _ := range net_m.(M) {
        if l3link_ip_h, ok := data.VMe("l3_links", net, if_ip); ok {
          if l3link_ip_h.Vs("dev_id") == dev_id {
            delete(data.VM("l3_links", net), if_ip)
            if len(data.VM("l3_links", net)) == 0 {
              delete(data.VM("l3_links"), net)
            }
          }
        }
      }
    }
  }
  delete(dev_refs, dev_id)
}

func debugPub(red redis.Conn, dev_ip string, debug string, key string, message string) {
  if red == nil || red.Err() != nil { return }
  if debug == "" { return }
  if key != "" && strings.Index(debug, key) >= 0 {
    _, fileName, fileLine, ok := runtime.Caller(1)
    var file_line string
    if ok {
      file_line = fmt.Sprintf("%s:%d", path.Base(fileName), fileLine)
    }
    //if
    red.Do("PUBLISH", "debug", fmt.Sprint(time.Now().Format("2006.01.02 15:04:05.000 "), file_line, " ", dev_ip, " ", key, " ", message))
    red.Do("PUBLISH", "debug_map_broker", fmt.Sprint(time.Now().Format("2006.01.02 15:04:05.000 "), file_line, " ", dev_ip, " ", key, " ", message))
  }
}

func processLinks(red redis.Conn, dev M, startup bool, debug string) {

  dev_id := dev.Vs("id")
  ip := dev.Vs("data_ip")

  seen_links := make(map[string]struct{})

  // build l2 LLDP neighbours
  if dev.EvM("lldp_ports") && dev.Evs("locChassisId") {

    debugPub(red, ip, debug, "l2_links", "LLDP begin")

    for port_index, port_h := range dev.VM("lldp_ports") {
      if port_h.(M).EvM("neighbours") && port_h.(M).Evs("ifName") {
        ifName := port_h.(M).Vs("ifName")
        debugPub(red, ip, debug, "l2_links", fmt.Sprint("port: ", port_index, " ifName: ", ifName))
        for _, nei_h := range port_h.(M).VM("neighbours") {

          nei_dev_id, nei_if_name, nei_err := find_lldp_nei(nei_h.(M))

          if nei_err == nil && (nei_dev_id != dev_id || nei_if_name != ifName) {
            link_id := l2l_key(dev_id, ifName, nei_dev_id, nei_if_name)

            seen_links[link_id] = struct{}{}

            link_h := make(M)

            link_h["_proto"] = "lldp"
            link_h["_creator"] = dev_id
            leg0_h := link_h.MkM("0")
            leg0_h["DevId"] = dev_id
            leg0_h["ifName"] = ifName

            leg1_h := link_h.MkM("1")
            leg1_h["DevId"] = nei_dev_id
            leg1_h["ifName"] = nei_if_name

            if !dev.EvA("interfaces", ifName, "l2_links") {
              dev.VM("interfaces", ifName)["l2_links"] = make([]string, 0)
            }
            dev.VM("interfaces", ifName)["l2_links"] = StrAppendOnce(dev.VM("interfaces", ifName)["l2_links"].([]string), link_id)

            if !devs.EvA(nei_dev_id, "interfaces", nei_if_name, "l2_links") {
              devs.VM(nei_dev_id, "interfaces", nei_if_name)["l2_links"] = make([]string, 0)
            }
            devs.VM(nei_dev_id, "interfaces", nei_if_name)["l2_links"] = StrAppendOnce( devs.VM(nei_dev_id, "interfaces", nei_if_name)["l2_links"].([]string), link_id )

            dev_refs.MkM(dev_id, "l2_links", link_id)
            dev_refs.MkM(nei_dev_id, "l2_links", link_id)

            link_h["_time"] = dev.Vi("last_seen")

            link_h["status"] = int64(2)
            if dev.Vi("interfaces", ifName, "ifOperStatus") == 1 && dev.Vs("overall_status") == "ok" &&
               devs.Vi(nei_dev_id, "interfaces", nei_if_name, "ifOperStatus") == 1 && devs.Vs(nei_dev_id, "overall_status") == "ok" &&
            true {
              link_h["status"] = int64(1)
              debugPub(red, ip, debug, "l2_links", fmt.Sprint("status set to 1"))
            }
/*
if(!data.EvM("l2_links", link_id)) {
  fmt.Println("adding link: ", link_h)
}
*/
            data.VM("l2_links")[link_id] = link_h
          }
        }
      }
    }
  }

  // build l2 CDP neighbours
  if dev.EvM("cdp_ports") && dev.Evs("locCdpDevId") {

    debugPub(red, ip, debug, "l2_links", "CDP begin")

    for port_index, port_h := range dev.VM("cdp_ports") {
      if port_h.(M).EvM("neighbours") && port_h.(M).Evs("ifName") {
        ifName := port_h.(M).Vs("ifName")
        debugPub(red, ip, debug, "l2_links", fmt.Sprint("cdp port: ", port_index, " ifName: ", ifName))
        for _, nei_h := range port_h.(M).VM("neighbours") {

          nei_dev_id, nei_if_name, nei_err := find_cdp_nei(nei_h.(M))

          if nei_err == nil && (nei_dev_id != dev_id || nei_if_name != ifName) {
            link_id := l2l_key(dev_id, ifName, nei_dev_id, nei_if_name)

            seen_links[link_id] = struct{}{}

            link_h := make(M)

            link_h["_proto"] = "cdp"
            link_h["_creator"] = dev_id
            leg0_h := link_h.MkM("0")
            leg0_h["DevId"] = dev_id
            leg0_h["ifName"] = ifName

            leg1_h := link_h.MkM("1")
            leg1_h["DevId"] = nei_dev_id
            leg1_h["ifName"] = nei_if_name

            if !dev.EvA("interfaces", ifName, "l2_links") {
              dev.VM("interfaces", ifName)["l2_links"] = make([]string, 0)
            }
            dev.VM("interfaces", ifName)["l2_links"] = StrAppendOnce(dev.VM("interfaces", ifName)["l2_links"].([]string), link_id)

            if !devs.EvA(nei_dev_id, "interfaces", nei_if_name, "l2_links") {
              devs.VM(nei_dev_id, "interfaces", nei_if_name)["l2_links"] = make([]string, 0)
            }
            devs.VM(nei_dev_id, "interfaces", nei_if_name)["l2_links"] =
              StrAppendOnce( devs.VM(nei_dev_id, "interfaces", nei_if_name)["l2_links"].([]string), link_id )

            dev_refs.MkM(dev_id, "l2_links", link_id)
            dev_refs.MkM(nei_dev_id, "l2_links", link_id)

            link_h["_time"] = dev.Vi("last_seen")

            link_h["status"] = int64(2)
            if dev.Vi("interfaces", ifName, "ifOperStatus") == 1 && dev.Vs("overall_status") == "ok" &&
               devs.Vi(nei_dev_id, "interfaces", nei_if_name, "ifOperStatus") == 1 && devs.Vs(nei_dev_id, "overall_status") == "ok" &&
            true {
              link_h["status"] = int64(1)
              debugPub(red, ip, debug, "l2_links", fmt.Sprint("status set to 1"))
            }
/*
if(!data.EvM("l2_links", link_id)) {
  fmt.Println("adding link: ", link_h)
}
*/
            data.VM("l2_links")[link_id] = link_h
          }
        }
      }
    }
  }

  //copy links from previous run and cleanup outdated
  //if !startup && devs.EvM(dev_id, "interfaces") 
  if !startup && devs.EvM(dev_id) {
    for _, if_h := range devs.VM(dev_id, "interfaces") {
      if if_h.(M).EvA("l2_links") {
        for _, link_id := range if_h.(M).VA("l2_links").([]string) {
          if _, ex := seen_links[link_id]; !ex {
            if link_h, ex := data.VMe("l2_links", link_id); !ex {
              //panic("Should not get here!")
            } else {
              l0_dev := link_h.Vs("0", "DevId")
              l0_if := link_h.Vs("0", "ifName")
              l1_dev := link_h.Vs("1", "DevId")
              l1_if := link_h.Vs("1", "ifName")

              var l0M M
              var l1M M

              if l0_dev == dev_id {
                l0M = dev
              } else {
                l0M = devs.VM(l0_dev)
              }

              if l1_dev == dev_id {
                l1M = dev
              } else {
                l1M = devs.VM(l1_dev)
              }

              if (l0_dev == dev_id || l1_dev == dev_id) &&
                 (l0_dev != l1_dev || l0_if != l1_if) &&
                 l0M != nil && l1M != nil &&
                 l0M.EvM("interfaces", l0_if) &&
                 l1M.EvM("interfaces", l1_if) &&
                 ((l0M.Vs("overall_status") == "ok" && l1M.Vs("overall_status") == "ok" &&
                   l0M.Vi("interfaces", l0_if, "ifOperStatus") != 1 && l1M.Vi("interfaces", l1_if, "ifOperStatus") != 1 &&
                  true) ||
                  (l0M.Vs("overall_status") == "ok" && l1M.Vs("overall_status") == "ok" &&
                   l0M.Vi("interfaces", l0_if, "ifOperStatus") == 1 && l1M.Vi("interfaces", l1_if, "ifOperStatus") == 1 &&
                   link_h.Vs("_creator") != dev_id && // link created by live divice, which seen us recently
                   link_h.Vi("_time") == l0M.Vi("last_seen") &&
                  true) ||
                  l0M.Vs("overall_status") != "ok" ||
                  l1M.Vs("overall_status") != "ok" ||
                 false) &&
              true {
                // keep link
                if l0M.Vs("overall_status") == "ok" && l1M.Vs("overall_status") == "ok" &&
                   l0M.Vi("interfaces", l0_if, "ifOperStatus") == 1 && l1M.Vi("interfaces", l1_if, "ifOperStatus") == 1 &&
                true {
                  link_h["status"] = int64(1)
                } else {
                  link_h["status"] = int64(2)
                }

                if !l0M.EvA("interfaces", l0_if, "l2_links") {
                  l0M.VM("interfaces", l0_if)["l2_links"] = make([]string, 0)
                }
                l0M.VM("interfaces", l0_if)["l2_links"] = StrAppendOnce(l0M.VM("interfaces", l0_if)["l2_links"].([]string), link_id)

                if !l1M.EvA("interfaces", l1_if, "l2_links") {
                  l1M.VM("interfaces", l1_if)["l2_links"] = make([]string, 0)
                }
                l1M.VM("interfaces", l1_if)["l2_links"] = StrAppendOnce(l1M.VM("interfaces", l1_if)["l2_links"].([]string), link_id)

                dev_refs.MkM(l0_dev, "l2_links", link_id)
                dev_refs.MkM(l1_dev, "l2_links", link_id)
              } else {
/*
  fmt.Println("wiping link: ", link_h)
  fmt.Println("wiper: ", dev_id)
  fmt.Println("\tl0_status: ", l0M.Vs("overall_status"), "l0_if_opStatus:", l0M.Vi("interfaces", l0_if, "ifOperStatus"))
  fmt.Println("\tl1_status: ", l1M.Vs("overall_status"), "l1_if_opStatus:", l1M.Vi("interfaces", l1_if, "ifOperStatus"))
  if lldp_port_index, ex := l0M.Vse("interfaces", l0_if, "lldp_portIndex"); ex {
    if l0M.EvM("lldp_ports", lldp_port_index, "neighbours") {
      fmt.Println("\t\tl0_neighbours:")
      for _, hei_h := range l0M.VM("lldp_ports", lldp_port_index, "neighbours") {
        fmt.Println("\t\t\tChassisId: ", hei_h.(M).Vs("RemChassisId"))
        fmt.Println("\t\t\tPortId: ", hei_h.(M).Vs("RemPortId"))
      }
    } else {
      fmt.Println("\t\tl0_neighbours: none")
    }
  }
  if lldp_port_index, ex := l1M.Vse("interfaces", l1_if, "lldp_portIndex"); ex {
    if l1M.EvM("lldp_ports", lldp_port_index, "neighbours") {
      fmt.Println("\t\tl1_neighbours:")
      for _, hei_h := range l1M.VM("lldp_ports", lldp_port_index, "neighbours") {
        fmt.Println("\t\t\tChassisId: ", hei_h.(M).Vs("RemChassisId"))
        fmt.Println("\t\t\tPortId: ", hei_h.(M).Vs("RemPortId"))
      }
    } else {
      fmt.Println("\t\tl1_neighbours: none")
    }
  }
*/
                //wipe link
                if l0M != nil && l0M.EvA("interfaces", l0_if, "l2_links") {
                  new_list := StrExclude(l0M.VM("interfaces", l0_if)["l2_links"].([]string), link_id)
                  if len(new_list) > 0 {
                    l0M.VM("interfaces", l0_if)["l2_links"] = new_list
                  } else {
                    delete(l0M.VM("interfaces", l0_if), "l2_links")
                  }
                }
                if l1M != nil && l1M.EvA("interfaces", l1_if, "l2_links") {
                  new_list := StrExclude(l1M.VM("interfaces", l1_if)["l2_links"].([]string), link_id)
                  if len(new_list) > 0 {
                    l1M.VM("interfaces", l1_if)["l2_links"] = new_list
                  } else {
                    delete(l1M.VM("interfaces", l1_if), "l2_links")
                  }
                }

                if dev_refs.EvM(l0_dev, "l2_links", link_id) {
                  delete(dev_refs.VM(l0_dev, "l2_links"), link_id)
                }
                if dev_refs.EvM(l1_dev, "l2_links", link_id) {
                  delete(dev_refs.VM(l1_dev, "l2_links"), link_id)
                }

                delete(data.VM("l2_links"), link_id)
              }
            }
          }
        }
      }
    }
  }


}

func process_ip_data(wg *sync.WaitGroup, ip string, startup bool) {
  if wg != nil {
    defer wg.Done()
  }
  var err error
  var raw M

  ip_neighbours := 0

  var red redis.Conn

  red, err = RedisCheck(red, "unix", REDIS_SOCKET, red_db)

  if red == nil {
    if opt_v > 1 { color.Red("%s", err.Error()) }
    return
  }

  debug, _ := redis.String(red.Do("GET", "ip_debug."+ip))

  defer func() { if red != nil { red.Close() } }()

  defer func() {
    if err != nil {
      if red != nil && red.Err() == nil {
        ip_err := fmt.Sprintf("%d:%s ! %s\n%s", time.Now().Unix(), time.Now().Format("2006 Jan 2 15:04:05"), err.Error(), string(dbg.Stack()))
        red.Do("SET", "ip_proc_error."+ip, ip_err)
      }

      globalMutex.Lock()
      if data.EvM("dev_list", ip) {
        data.VM("dev_list", ip)["proc_error"] = err.Error()
        data.VM("dev_list", ip)["proc_result"] = "error"
        data.VM("dev_list", ip)["time"] = time.Now().Unix()
      }
      globalMutex.Unlock()
      if opt_v > 1 { color.Red("%s", err.Error()) }
    }
  }()


  var dev_list_state string
  var dev_list_state_str string
  dev_list_state_str, err = redis.String(red.Do("HGET", "dev_list", ip))
  if err == nil {
    err = redis.ErrNil
    a := strings.Split(dev_list_state_str, ":")
    if len(a) == 2 && a[1] != "ignore" {
      t, _err := strconv.ParseInt(a[0], 10, 64)
      if _err == nil && t <= time.Now().Unix() {
        dev_list_state = a[1]
        err = nil
      }
    }
  }
  if err != nil {
    if err == redis.ErrNil && !startup {
      //device removed from dev_list, just cleanup and return
      err = nil

      globalMutex.Lock()
      defer globalMutex.Unlock()

      //remove from dev_list
      delete(data.VM("dev_list"), ip)

      //find dev id by data_ip

      log := &Logger{Conn: red, Dev: "nodev"}

      for dev_id, dev_m := range devs {
        if dev_m.(M).Vs("data_ip") == ip {
          log.Event("dev_purged", "", "ip", ip)
          wipe_dev(dev_id)
          if opt_v > 0 {
            color.Yellow("Dev purged: %s, %s", dev_id, ip)
          }
        }
      }

      log.Save()

      if opt_v > 1 {
        color.Yellow("Dev gone: %s", ip)
      }
    }
    return
  }

  if dev_list_state == "conflict" {
    if !startup {
      //dying gasp from gomapper
      //all states should have been set before
    } else {
      //get proc error from redis
      errstr, _err := redis.String(red.Do("GET", "ip_proc_error."+ip))
      if _err != nil {
        errstr = "Unknown proc error"
      }
      globalMutex.Lock()
      dl_h := data.MkM("dev_list", ip)
      dl_h["proc_result"] = "error"
      dl_h["proc_error"] = errstr
      dl_h["state"] = dev_list_state
      dl_h["time"] = time.Now().Unix()
      globalMutex.Unlock()
    }
    return
  }

  globalMutex.Lock()
  dl_h := data.MkM("dev_list", ip)
  dl_h["proc_result"] = "in-progress"
  dl_h["proc_error"] = ""

  prev_dev_list_state := dl_h.Vs("state")

  dl_h["state"] = dev_list_state
  dl_h["time"] = time.Now().Unix()
  globalMutex.Unlock()

  raw, err = GetRawRed(red, ip)
  if err != nil {
    if !startup && prev_dev_list_state != "run" && dev_list_state == "run" && err == ErrorQueuesMismatch {
      //ignore freshly started device with many queues - not all of them saved yet
      err = nil
      globalMutex.Lock()
      defer globalMutex.Unlock()
      data.VM("dev_list", ip)["proc_result"] = "postproned"
      if opt_v > 1 {
        fmt.Println("Postprone:", ip)
      }
    }

    if startup && err == redis.ErrNil {
      err = nil
    }

    return
  }

  device := Dev{ Opt_m: true, Opt_a: true, Dev_ip: ip }

  process_start := time.Now()

  err = device.Decode(raw)
  if err != nil {
    if startup && err == redis.ErrNil {
      err = nil
    }
    return
  }

  now_unix := time.Now().Unix()
  now_unix_str := strconv.FormatInt(now_unix, 10)

  dev := device.Dev

  if !dev.Evs("id") {
    err = errors.New("No id key")
    return
  }

  queue_list := dev.VA("_queues")
  if queue_list == nil || len(queue_list.([]string)) == 0 {
    err = errors.New("No _queues key")
    return
  }

  if opt_v > 1 {
    fmt.Println("Process:", ip)
  }

  save_time := int64(0)
  last_error := ""
  overall_status := "ok"

  if dev_list_state != "run" {
    overall_status = "paused"
  }

  has_errors := false

  duration_h := dev.MkM("_queue_duration")

  for _, q := range queue_list.([]string) {
    if !dev.Evs("_last_result", q) {
      err = errors.New("No _last_result for queue "+q)
      return
    }

    lr := dev.Vs("_last_result", q)

    var res string
    var queue_start int64
    var queue_save_time int64
    var queue_error string

    res, queue_start, queue_save_time, queue_error, err = LastResultDecode(lr)
    if err != nil { return }

    duration_h[q] = queue_save_time - queue_start

    if res != "ok" {
      has_errors = true
      if overall_status == "ok" {
        overall_status = "error"
      }
      if last_error == "" {
        last_error = queue_error
      } else if strings.Index(last_error, queue_error) < 0 {
        last_error += ", "+queue_error
      }
    } else {
      if queue_save_time > save_time {
        save_time = queue_save_time
      }
    }
  }

  if has_errors {
    save_time = 0
  }

//  if (time.Now().Unix() - last_seen) > WARN_AGE && overall_status == "ok" {
//    overall_status = "warn"
//  }

  dev["overall_status"] = overall_status
  dev["last_error"] = last_error
  dev["save_time"] = save_time

  dev_id := dev.Vs("id")

  var redstr string
  redstr, err = redis.String(red.Do("GET", "status_alert."+dev_id))

  if err != nil && err != redis.ErrNil {
    return
  }

  status_alerted_value := ""
  status_alerted_time := int64(0)

  if err == nil {
    a := strings.Split(redstr, ";")
    if len(a) == 3 && a[1] == ip {
      status_alerted_time, err = strconv.ParseInt(a[0], 10, 64)
      if err != nil { return }
      status_alerted_value = a[2]
    }
  }

  err = nil

  globalMutex.Lock()
  defer globalMutex.Unlock()

  if devs.EvM(dev_id) && devs.Vs(dev_id, "data_ip") != ip {
    logger := &Logger{Conn: red, Dev: "nodev"}
    if opt_v > 0 {
      color.Red("CONFLICT: %s vs %s", devs.Vs(dev_id, "data_ip"), ip)
    }
    conflict_ip := devs.Vs(dev_id, "data_ip")
    //there is duplicate device id
    if overall_status == "ok" && devs.Vs(dev_id, "overall_status") != "ok" {
      // duplicate device is old, overwrite it
      wipe_dev(dev_id)
      ip_err := fmt.Sprintf("%d:%s ! %s\n%s", time.Now().Unix(), time.Now().Format("2006 Jan 2 15:04:05"), "Pausing due to conflict with running device "+ip, string(dbg.Stack()))
      red.Do("SET", "ip_proc_error."+conflict_ip, ip_err)
      red.Do("HSET", "dev_list", conflict_ip, now_unix_str+":conflict")

      logger.Event("conflict", "", "conflict_id", dev_id, "paused_ip", conflict_ip, "working_ip", ip)
      logger.Save()

    } else if devs.Vs(dev_id, "overall_status") == "ok" && overall_status != "ok" {
      // this device is old or paused, ignore data
      red.Do("HSET", "dev_list", ip, now_unix_str+":conflict")
      err = errors.New("Conflict with running dev "+conflict_ip+". Pausing. Prev status was: "+overall_status)
      data.VM("dev_list", ip)["state"] = "conflict"
      logger.Event("conflict", "", "conflict_id", dev_id, "paused_ip", ip, "working_ip", conflict_ip)
      logger.Save()
      return
    } else {
      //both good or both bad. compare save_time
      if save_time > devs.Vi(dev_id, "save_time") {
        //this dev is more recent
        wipe_dev(dev_id)
        ip_err := fmt.Sprintf("%d:%s ! %s\n%s", time.Now().Unix(), time.Now().Format("2006 Jan 2 15:04:05"), "Pausing due to conflict with more recent device "+ip, string(dbg.Stack()))
        red.Do("SET", "ip_proc_error."+conflict_ip, ip_err)
        red.Do("HSET", "dev_list", conflict_ip, now_unix_str+":conflict")
        logger.Event("conflict", "", "conflict_id", dev_id, "paused_ip", conflict_ip, "working_ip", ip)
        logger.Save()
      } else {
        //this dev data is older
        red.Do("HSET", "dev_list", ip, now_unix_str+":conflict")
        err = errors.New("Conflict with more recent dev "+conflict_ip+". Pausing. Prev status was: "+overall_status)
        data.VM("dev_list", ip)["state"] = "conflict"
        logger.Event("conflict", "", "conflict_id", dev_id, "paused_ip", ip, "working_ip", conflict_ip)
        logger.Save()
        return
      }
    }
  }

  var last_seen int64

  //check for id change
  if prev_id, ok := data.Vse("dev_list", ip , "id"); ok && prev_id != dev_id {
    wipe_dev(prev_id)
    logger := &Logger{Conn: red, Dev: "nodev"}
    logger.Event("dev_id_change", "", "prev_id", prev_id, "new_id", dev_id, "ip", ip)
    logger.Save()
    if opt_v > 0 {
      color.Yellow("Dev id changed. Previous data purged: %s, %s", prev_id, ip)
    }
    data.VM("dev_list", ip)["id"] = dev_id
  } else {
    data.VM("dev_list", ip)["id"] = dev_id

    var redstr string
    redstr, err = redis.String(red.Do("GET", "dev_last_seen."+dev_id))
    if err != nil && err != redis.ErrNil { return }
    if err == nil {
      i, s, _err := IntSepStrErr(redstr, ":")
      if _err == nil && s == ip {
        last_seen = i
      }
    }
  }

  if last_seen < save_time {
    last_seen = save_time
  }

//  if overall_status == "error" && (now_unix - last_seen) < DEAD_AGE {
//    overall_status = "warn"
//    dev["overall_status"] = overall_status
//  }

  dev["last_seen"] = last_seen

  if sysoids_h, ok := data.VMe("sysoids", dev.Vs("sysObjectID")); ok {
    dev["model_short"] = sysoids_h.Vs("short")
    dev["model_long"] = sysoids_h.Vs("long")
  } else {
    dev["model_short"] = "Unknown"
    dev["model_long"] = "Unknown"
  }

  if dev.Vs("model_short") == "MIKROTIK" && dev.Evs("sysDescr") && strings.HasPrefix(dev.Vs("sysDescr"), "RouterOS ") &&
     len(dev.Vs("sysDescr")) > len("RouterOS ") {
    dev["model_short"] = dev.Vs("sysDescr")[len("RouterOS "):]
    dev["model_long"] = "Mikrotik "+dev.Vs("sysDescr")[len("RouterOS "):]
  }

  if !data.EvM("cdp2dev") {
    data["cdp2dev"] = make(M)
  }

  if cdp_dev_id, ex := dev.Vse("locCdpDevId"); ex {
    if check_cdp_dev, ex := data.Vse("cdp2dev", cdp_dev_id); ex && check_cdp_dev != dev_id &&
       devs.EvM(check_cdp_dev) && devs.Vs(check_cdp_dev, "overall_status") == "ok" &&
    true {
      //cdpDevId conflict
      delete(dev, "locCdpDevId")
    } else {
      data.VM("cdp2dev")[cdp_dev_id] = dev_id
    }
  }

  //dumb fortigate missing locChassisId

  if !dev.Evs("locChassisId") && dev.Evs("interfaces", "ha1", "ifPhysAddr") &&
     strings.HasPrefix(dev.Vs("model_short"), "FG ") {
    dev["locChassisId"] = dev.Vs("interfaces", "ha1", "ifPhysAddr")
    dev["locChassisIdSubtype"] = int64(4)
  }

  if startup {
    dev["run"] = uint64(0)
  } else {
    if devs.Evu(dev_id, "run") {
      dev["run"] = devs.Vu(dev_id, "run") + 1
    } else {
      dev["run"] = uint64(0)
    }
  }

  current_run := dev.Vu("run")

  // process links
  processLinks(red, dev, startup, debug)

  if dev.EvM("interfaces") {
    for ifName, if_m := range dev.VM("interfaces") {
      dev.VM("interfaces", ifName)["safe_if_name"] = SafeIntId(ifName)
      if astatus, ok := if_m.(M).Vse("ifAdminStatus"); ok && astatus == "1" {
        if ips, ok := if_m.(M).VMe("ips"); ok {
          for if_ip, if_ip_m := range ips {
            if net, ok := if_ip_m.(M).Vse("net"); ok && !strings.HasPrefix(if_ip,"127.") {
              register := false
              if l3link_ip_h, ok := data.VMe("l3_links", net, if_ip); ok {
                link_dev_id := l3link_ip_h.Vs("dev_id")
                if link_dev_id != dev_id || l3link_ip_h.Vs("ifName") != ifName {
                  if startup {
                    color.Red("IP conflict: %s, %s @ %s vs %s @ %s", if_ip, dev_id, ifName, link_dev_id, l3link_ip_h.Vs("ifName"))
                  } else {
                    if devs.EvM(link_dev_id) && devs.Vs(link_dev_id, "overall_status") == "ok" &&
                       (link_dev_id != dev_id || l3link_ip_h.Vi("time") == now_unix) {
                      //if
                      if opt_v > 1 {
                        color.Red("IP conflict: %s, %s @ %s vs %s @ %s", if_ip, dev_id, ifName, link_dev_id, l3link_ip_h.Vs("ifName"))
                      }
                    } else {
                      //overwrite data
                      if dev_refs.EvM(link_dev_id, "l3_links", net) {
                        delete(dev_refs.VM(link_dev_id, "l3_links", net), if_ip)
                        if len(dev_refs.VM(link_dev_id, "l3_links", net)) == 0 {
                          delete(dev_refs.VM(link_dev_id, "l3_links"), net)
                        }
                        if len(dev_refs.VM(link_dev_id, "l3_links")) == 0 {
                          delete(dev_refs.VM(link_dev_id), "l3_links")
                        }
                      }
                      register = true
                    }
                  }
                } else {
                  register = true
                }
              } else {
                register = true
              }
              if register {
                l3link_ip_h := data.MkM("l3_links", net, if_ip)
                l3link_ip_h["dev_id"] = dev_id
                l3link_ip_h["ifName"] = ifName
                l3link_ip_h["time"] = now_unix
                dev_refs.MkM(dev_id, "l3_links", net, if_ip)
                dev_refs.VM(dev_id, "l3_links", net)[if_ip] = now_unix
              }
            }
          }
        }
      }
    }
  }

  all_ips := make(map[string]struct{})

  for net, _ := range data.VM("l3_links") {
    for ip, ip_m := range data.VM("l3_links", net) {
      add := true
      if ip_m.(M).Vs("dev_id") == dev_id && ip_m.(M).Vi("time") != now_unix {
        //ip or interface moved or deleted
        delete(data.VM("l3_links", net), ip)
        delete(dev_refs.VM(dev_id, "l3_links", net), ip)
        add = false
      }
      if add { all_ips[ip] = struct{}{} }
    }
    if len(data.VM("l3_links", net)) == 0 { delete(data.VM("l3_links"), net) }
    if len(dev_refs.VM(dev_id, "l3_links", net)) == 0 { delete(dev_refs.VM(dev_id, "l3_links"), net) }
  }

  if device.Opt_m && device.Dev_macs != nil && len(device.Dev_macs) > 0 {
    devs_macs[dev_id] = device.Dev_macs
  } else {
    delete(devs_macs, dev_id)
  }

  if device.Opt_a && device.Dev_arp != nil && len(device.Dev_arp) > 0 {
    devs_arp[dev_id] = device.Dev_arp
  } else {
    delete(devs_arp, dev_id)
  }

  dev["_startup"] = startup

  esc_dev_id := SafeDevId(dev_id)
  dev["safe_dev_id"] = esc_dev_id

  if current_run > 1 && red != nil && red.Err() == nil && graph_int_rules_time > 0 {
    //create graph items

    graph_items := M{}

    red_args := redis.Args{}.Add("ip_graphs."+ip)
    red_args = red_args.Add("time", time.Now().Unix())

    if dev.EvM("CPUs") {
      for cpu_id, _ := range dev.VM("CPUs") {
        if gk, ok := dev.Vse("CPUs", cpu_id, "_graph_key"); ok {
          gf := esc_dev_id+"/CPU."+gk+".rrd"
          red_args = red_args.Add(gk, gf)
          dev.VM("CPUs", cpu_id)["_graph_file"] = gf

          graph_items["CPUs" + cpu_id] = 1
        }
      }
    }

    if dev.EvA("memoryUsed") {
      gf := esc_dev_id+"/memoryUsed.rrd"
      red_args = red_args.Add("memoryUsed.0", gf)
      dev["memoryUsed_graph_file"] = gf
      dev["memoryUsed_graph_key"] = "memoryUsed.0"
      graph_items["memoryUsed"] = 1
    }

    if dev.EvM("interfaces") {
      for ifName, int_m := range dev.VM("interfaces") {
        int_h := int_m.(M)
        ifIndex := int_h.Vs("ifIndex")
        esc_if_name := dev.Vs("interfaces", ifName, "safe_if_name")
        is_safe := safeInt_regex.MatchString(esc_if_name)
        red.Do("PUBLISH", "graph_calc." + ip, fmt.Sprintf("%s:\n%s\n", ifName, int_h.ToJsonStr(true)))
        if ok, _ := MatchGraphIntRules(graph_int_rules, dev, ifName); ok && is_safe {
          gf_prefix := esc_dev_id+"/"+esc_if_name
          int_h["_graph_prefix"] = gf_prefix
          for _, key := range intGraphKeys {
            if int_h.EvA(key) {
              gf := gf_prefix+"."+key+".rrd"
              red_args = red_args.Add(key+"."+ifIndex, gf)
            } else if key == "ifHCOutOctets" && int_h.EvA("ifOutOctets") {
              gf := gf_prefix+"."+key+".rrd"
              red_args = red_args.Add("ifOutOctets."+ifIndex, gf)
            } else if key == "ifHCInOctets" && int_h.EvA("ifInOctets") {
              gf := gf_prefix+"."+key+".rrd"
              red_args = red_args.Add("ifInOctets."+ifIndex, gf)
            }
          }
          red.Do("PUBLISH", "graph_calc." + ip, fmt.Sprintf("%s is matched", ifName))
          graph_items["interface_" + ifName] = 1
        } else {
          red.Do("PUBLISH", "graph_calc." + ip, fmt.Sprintf("%s not matched, rule_res: %v, safe: %v", ifName, ok, is_safe))
        }
      }
    }

    graph_save := false

    if(!devs.EvM(dev_id, "_graph_items")) {
      graph_save = true
    } else {
      for gi, _ := range graph_items {
        if !devs.EvA(dev_id, "_graph_items", gi) {
          graph_save = true
          break
        }
      }
      if !graph_save {
        for gi, _ := range devs.VM(dev_id, "_graph_items") {
          if !graph_items.EvA(gi) {
            graph_save = true
            break
          }
        }
      }
    }

    if graph_save {

      red.Send("MULTI")
      red.Send("DEL", "ip_graphs."+ip)
      red.Send("HSET", red_args...)
      _, err = red.Do("EXEC")

      if err == nil {
        dev["_graph_items"] = graph_items
        dev["_graph_int_rules_time"] = graph_int_rules_time
      }
    }
  }

  if graph_int_rules_time == 0 {
    dev["_graph_int_rules_time"] =  int64(0)
  }

  reg_ip_dev_id := false

  if startup {
    dev["_status_alerted_value"] = status_alerted_value
    dev["_status_alerted_time"] = status_alerted_time
    devs[dev_id] = dev
    reg_ip_dev_id = true
  } else {
    if old, ok := devs.VMe(dev_id); !ok {
      logger := &Logger{Conn: red, Dev: "nodev"}
      devs[dev_id] = dev
      location, _ := dev.Vse("sysLocation")
      logger.Event("dev_new", "", "ip", ip, "dev_id", dev_id, "short_name", dev.Vs("short_name"), "loc", location)
      logger.Save()
      reg_ip_dev_id = true
    } else {

      logger := &Logger{Conn: red, Dev: dev_id}
      alerter := &Alerter{Conn: red}

      // check what's changed
//fmt.Println(w.WhereAmI(), dev.Vs("overall_status"))
      if status_alerted_value != dev.Vs("overall_status") {
        if alerter.Alert(dev, status_alerted_value, "", "overall_status") {
          status_alerted_value = dev.Vs("overall_status")
          status_alerted_time = time.Now().Unix()
        }
      }

      if old.Vs("overall_status") != dev.Vs("overall_status") {
        logger.Event("key_change", "overall_status", "old_value", old.Vs("overall_status"), "new_value", dev.Vs("overall_status"))
      }

      for _, key := range devWatchKeys {
        if old.EvA(key) && !dev.EvA(key) {
          logger.Event("key_gone", key, "old_value", old.Vs(key))
        } else if !old.EvA(key) && dev.EvA(key) {
          logger.Event("key_new", key, "new_value", dev.Vs(key))
        } else if old.EvA(key) && dev.EvA(key) && reflect.TypeOf(old.VA(key)) != reflect.TypeOf(dev.VA(key)) {
          logger.Event("key_type_change", key, "old_type", reflect.TypeOf(old.VA(key)).String(), "new_type", reflect.TypeOf(dev.VA(key)).String())
          logger.Event("key_change", key, "old_value", old.Vs(key), "new_value", dev.Vs(key))
        } else if old.EvA(key) && dev.EvA(key) && old.VA(key) != dev.VA(key) {
          logger.Event("key_change", key, "old_value", old.Vs(key), "new_value", dev.Vs(key))

          if IndexOf(devAlertKeys, key) >= 0 {
            //alert if changes
            alerter.Alert(dev, old.VA(key), "", key)
          }
        }
      }

      for ifName, _ := range dev.VM("interfaces") {
        if !old.EvM("interfaces", ifName) {
          logger.Event("if_new", ifName)
        } else {
          if ifName != "CPU port" {
            for _, key := range intCounterResetWatchKeys {
              new_c, new_ex := dev.Vie("interfaces", ifName, key);
              old_c, old_ex := old.Vie("interfaces", ifName, key);
              old_key_stop := old.Vs("_key_stop", key)
              new_key_stop := dev.Vs("_key_stop", key)
              if new_ex && old_ex && new_c < old_c {
                logger.Event("if_key_reset", ifName, "key", key, "old_value", old.Vs("interfaces", ifName, key),
                             "new_value", dev.Vs("interfaces", ifName, key),
                             "old_key_stop", old_key_stop,
                             "new_key_stop", new_key_stop,
                )
              } else {

                new_cu, new_exu := dev.Vue("interfaces", ifName, key);
                old_cu, old_exu := old.Vue("interfaces", ifName, key);
                if new_exu && old_exu && new_cu < old_cu {
                  logger.Event("if_key_reset", ifName, "key", key, "old_value", old.Vs("interfaces", ifName, key),
                               "new_value", dev.Vs("interfaces", ifName, key),
                             "old_key_stop", old_key_stop,
                             "new_key_stop", new_key_stop,
                  )
                }
              }
            }

            for _, key := range intWatchKeys {
              if !old.EvA("interfaces", ifName, key) && dev.EvA("interfaces", ifName, key) {
                logger.Event("if_key_new", ifName, "key", key)
              } else if old.EvA("interfaces", ifName, key) && !dev.EvA("interfaces", ifName, key) {
                logger.Event("if_key_gone", ifName, "key", key)
              } else if reflect.TypeOf(old.VA("interfaces", ifName, key)) != reflect.TypeOf(dev.VA("interfaces", ifName, key)) {
                logger.Event("if_key_type_change", ifName, "key", key,
                             "old_type", reflect.TypeOf(old.VA("interfaces", ifName, key)).String(),
                             "new_type", reflect.TypeOf(dev.VA("interfaces", ifName, key)).String())
                logger.Event("if_key_change", ifName, "key", key, "old_value", old.Vs("interfaces", ifName, key),
                                                                          "new_value", dev.Vs("interfaces", ifName, key))
              } else if old.VA("interfaces", ifName, key) != dev.VA("interfaces", ifName, key) {
                logger.Event("if_key_change", ifName, "key", key, "old_value", old.Vs("interfaces", ifName, key),
                                                                          "new_value", dev.Vs("interfaces", ifName, key))

                if key == "ifOperStatus" && old.Vi("interfaces", ifName, "ifAdminStatus") == dev.Vi("interfaces", ifName, "ifAdminStatus") {
                  alerter.Alert(dev, old.VA("interfaces", ifName, key), ifName, key)
                }
              }
            }
          }

          // check ips change
          if dev.EvM("interfaces", ifName, "ips") {
            for if_ip, _ := range dev.VM("interfaces", ifName, "ips") {
              if !old.EvM("interfaces", ifName, "ips", if_ip) {
                logger.Event("if_ip_new", ifName, "ip", if_ip, "mask", dev.Vs("interfaces", ifName, "ips", if_ip, "mask"))
              } else if dev.Vs("interfaces", ifName, "ips", if_ip, "mask") != old.Vs("interfaces", ifName, "ips", if_ip, "mask") {
                logger.Event("if_ip_mask_change", ifName, "ip", if_ip, "old_mask", old.Vs("interfaces", ifName, "ips", if_ip, "mask"),
                                                                               "new_mask", dev.Vs("interfaces", ifName, "ips", if_ip, "mask"))
              }
            }
          }
          if old.EvM("interfaces", ifName, "ips") {
            for if_ip, _ := range old.VM("interfaces", ifName, "ips") {
              if !dev.EvM("interfaces", ifName, "ips", if_ip) {
                logger.Event("if_ip_gone", ifName, "ip", if_ip, "mask", old.Vs("interfaces", ifName, "ips", if_ip, "mask"))
              }
            }
          }

          //check STP states

          var new_stp_blocked_inst = ""
          var old_stp_blocked_inst = ""

          if dev.EvA("interfaces", ifName, "stpBlockInstances") {
            inst_i64 := dev.VA("interfaces", ifName, "stpBlockInstances").([]int64)
            sort.Sort(ByInt64(inst_i64))
            s := make([]string, 0)
            for i := 0; i < len(inst_i64); i++ {
              s = append(s, strconv.FormatInt(inst_i64[i], 10))
            }
            new_stp_blocked_inst = strings.Join(s, ",")
          }

          if old.EvA("interfaces", ifName, "stpBlockInstances") {
            inst_i64 := old.VA("interfaces", ifName, "stpBlockInstances").([]int64)
            sort.Sort(ByInt64(inst_i64))
            s := make([]string, 0)
            for i := 0; i < len(inst_i64); i++ {
              s = append(s, strconv.FormatInt(inst_i64[i], 10))
            }
            old_stp_blocked_inst = strings.Join(s, ",")
          }

          if new_stp_blocked_inst != old_stp_blocked_inst {
            logger.Event("if_stp_block_change", ifName, "old_blocked_inst", old_stp_blocked_inst, "new_blocked_inst", new_stp_blocked_inst)
          }


        }
      } //dev.interfaces

      for ifName, _ := range old.VM("interfaces") {
        if !dev.EvM("interfaces", ifName) {
          logger.Event("if_gone", ifName)
        }
      }

      if dev.EvM("lldp_ports") {
        for port_index, _ := range dev.VM("lldp_ports") {
          if !old.EvM("lldp_ports", port_index) {
            //would spam from mikrotiks, say nothing
          } else {
            new_pn := make(M)
            old_pn := make(M)

            if dev.EvM("lldp_ports", port_index, "neighbours") {
              for nei, _ := range dev.VM("lldp_ports", port_index, "neighbours") {
                var key = ""
                for _, subkey := range lldpKeySet {
                  if dev.EvA("lldp_ports", port_index, "neighbours", nei, subkey) {
                    key += ":"+dev.Vs("lldp_ports", port_index, "neighbours", nei, subkey)
                  }
                }
                new_pn[key] = nei
              }
            }

            if old.EvM("lldp_ports", port_index, "neighbours") {
              for nei, _ := range old.VM("lldp_ports", port_index, "neighbours") {
                var key = ""
                for _, subkey := range lldpKeySet {
                  if old.EvA("lldp_ports", port_index, "neighbours", nei, subkey) {
                    key += ":"+old.Vs("lldp_ports", port_index, "neighbours", nei, subkey)
                  }
                }
                old_pn[key] = nei
              }
            }

            for key, nei_i := range new_pn {
              nei := nei_i.(string)
              if !old_pn.EvA(key) {
                attrs := make([]string, 0)
                attrs = append(attrs, "lldp_port_nei_new", port_index)
                for _, subkey := range lldpKeySet {
                  if dev.EvA("lldp_ports", port_index, "neighbours", nei, subkey) {
                    attrs = append(attrs, subkey, dev.Vs("lldp_ports", port_index, "neighbours", nei, subkey))
                  }
                }
                logger.Event(attrs...)
              }
            }
            for key, nei_i := range old_pn {
              nei := nei_i.(string)
              if !new_pn.EvA(key) {
                attrs := make([]string, 0)
                attrs = append(attrs, "lldp_port_nei_gone", port_index)
                for _, subkey := range lldpKeySet {
                  if old.EvA("lldp_ports", port_index, "neighbours", nei, subkey) {
                    attrs = append(attrs, subkey, old.Vs("lldp_ports", port_index, "neighbours", nei, subkey))
                  }
                }
                logger.Event(attrs...)
              }
            }
          }
        }
      }

      if dev.EvM("cdp_ports") {
        for port_index, _ := range dev.VM("cdp_ports") {
          if !old.EvM("cdp_ports", port_index) {
            //would spam from mikrotiks, say nothing
          } else {
            new_pn := make(M)
            old_pn := make(M)

            if dev.EvM("cdp_ports", port_index, "neighbours") {
              for nei, _ := range dev.VM("cdp_ports", port_index, "neighbours") {
                var key = ""
                for _, subkey := range cdpKeySet {
                  if dev.EvA("cdp_ports", port_index, "neighbours", nei, subkey) {
                    key += ":"+dev.Vs("cdp_ports", port_index, "neighbours", nei, subkey)
                  }
                }
                new_pn[key] = nei
              }
            }

            if old.EvM("cdp_ports", port_index, "neighbours") {
              for nei, _ := range old.VM("cdp_ports", port_index, "neighbours") {
                var key = ""
                for _, subkey := range cdpKeySet {
                  if old.EvA("cdp_ports", port_index, "neighbours", nei, subkey) {
                    key += ":"+old.Vs("cdp_ports", port_index, "neighbours", nei, subkey)
                  }
                }
                old_pn[key] = nei
              }
            }

            for key, nei_i := range new_pn {
              nei := nei_i.(string)
              if !old_pn.EvA(key) {
                attrs := make([]string, 0)
                attrs = append(attrs, "cdp_port_nei_new", port_index)
                for _, subkey := range cdpKeySet {
                  if dev.EvA("cdp_ports", port_index, "neighbours", nei, subkey) {
                    attrs = append(attrs, subkey, dev.Vs("cdp_ports", port_index, "neighbours", nei, subkey))
                  }
                }
                logger.Event(attrs...)
              }
            }
            for key, nei_i := range old_pn {
              nei := nei_i.(string)
              if !new_pn.EvA(key) {
                attrs := make([]string, 0)
                attrs = append(attrs, "cdp_port_nei_gone", port_index)
                for _, subkey := range cdpKeySet {
                  if old.EvA("cdp_ports", port_index, "neighbours", nei, subkey) {
                    attrs = append(attrs, subkey, old.Vs("cdp_ports", port_index, "neighbours", nei, subkey))
                  }
                }
                logger.Event(attrs...)
              }
            }
          }
        }
      }

      dev["_status_alerted_value"] = status_alerted_value
      dev["_status_alerted_time"] = status_alerted_time

      devs[dev_id] = dev
      logger.Save()
      alerter.Save()
    }
  }

  if dev.EvM("lldp_ports") && dev.Evs("locChassisId") {
    for _, port_h := range dev.VM("lldp_ports") {
      if port_h.(M).EvM("neighbours") {
        for _, nei_h := range port_h.(M).VM("neighbours") {
          if rem_ip, ok := nei_h.(M).Vse("RemMgmtAddr", "1"); ok {
            if ifName, ok := port_h.(M).Vse("ifName"); ok && dev.EvM("interfaces", ifName) {
              if !dev.EvM("interfaces", ifName, "ip_neighbours") {
                dev.MkM("interfaces", ifName, "ip_neighbours")
              }
              dev.VM("interfaces", ifName, "ip_neighbours")[rem_ip] = nei_h.(M)
              ip_neighbours++
            }
          }
        }
      }
    }
  }

  if dev.EvM("cdp_ports") && dev.Evs("locCdpDevId") {
    for _, port_h := range dev.VM("cdp_ports") {
      if port_h.(M).EvM("neighbours") {
        for _, nei_h := range port_h.(M).VM("neighbours") {
          if rem_ip, ok := nei_h.(M).Vse("cdpRemAddrDecoded"); ok {
            if ifName, ok := port_h.(M).Vse("ifName"); ok && dev.EvM("interfaces", ifName) {
              if !dev.EvM("interfaces", ifName, "ip_neighbours") {
                dev.MkM("interfaces", ifName, "ip_neighbours")
              }
              dev.VM("interfaces", ifName, "ip_neighbours")[rem_ip] = nei_h.(M)
              ip_neighbours++
            }
          }
        }
      }
    }
  }

  for ifName, _ := range dev.VM("interfaces") {
    // add p2p neighbours
    if dev.EvM("interfaces", ifName, "ips") {
      for if_ip, ip_m := range dev.VM("interfaces", ifName, "ips") {
        if !strings.HasPrefix(if_ip,"127.") {
          if ip_u, ip_ok := V4ip2long(if_ip); ip_ok {
            ml := ip_m.(M).Vi("masklen")
            if ml == 30 || ml == 31 {
              if ml == 31 { ip_u ^= 0x01 }
              if ml == 30 { ip_u ^= 0x03 }
              nei_ip := V4long2ip(ip_u)
              if !dev.EvM("interfaces", ifName, "ip_neighbours", nei_ip) {
                if !dev.EvM("interfaces", ifName, "ip_neighbours") {
                  dev.MkM("interfaces", ifName, "ip_neighbours")
                }
                dev.VM("interfaces", ifName, "ip_neighbours")[nei_ip] = M{"nei_source": "p2p"}
                ip_neighbours++
              }
            }
          }
        }
      }
    }
    // add eigrp neighbours
    if dev.EvM("interfaces", ifName, "eigrp_peers", "1") {
      for nei_ip, _ := range dev.VM("interfaces", ifName, "eigrp_peers", "1") {
        if !dev.EvM("interfaces", ifName, "ip_neighbours", nei_ip) {
          if !dev.EvM("interfaces", ifName, "ip_neighbours") {
            dev.MkM("interfaces", ifName, "ip_neighbours")
          }
          dev.VM("interfaces", ifName, "ip_neighbours")[nei_ip] = M{"nei_source": "eigrp"}
          ip_neighbours++
        }
      }
    }
  }



  if ip_neighbours > 0 {
    for ifName, int_m := range dev.VM("interfaces") {
      int_h := int_m.(M)
      if nei_m, ok := int_h.VMe("ip_neighbours"); ok {
        if !startup && ip_neighbours_rule != "" {
          //red.Do("PUBLISH", "ip_nei_debug."+ip, "Checking interface " + ifName + "\n" + int_h.ToJsonStr(true))
          m := make(map[string]string)
          for _, field := range ip_neighbours_fields {
            if _, found := m[field]; !found && dev.EvA(field) {
              m[field] = AlertRuleFieldValue(dev.VA(field))
            } else if _, found := m[field]; !found && dev.EvA("interfaces", ifName, field) {
              m[field] = AlertRuleFieldValue(dev.VA("interfaces", ifName, field))
            }
          }

          for nei_ip, _ := range nei_m {
            //red.Do("PUBLISH", "ip_nei_debug."+ip, "Checking neighbour "+nei_ip)
            _, used := all_ips[nei_ip]
            _, ignore := ip_neighbours_ignored[nei_ip]
            if !used && !ignore && !data.EvM("dev_list", nei_ip) {
              m["neighbour_ip"] = nei_ip
              for _, field := range ip_neighbours_fields {
                if _, found := m[field]; !found && dev.EvA("interfaces", ifName, "ip_neighbours", nei_ip, field) {
                  m[field] = AlertRuleFieldValue(dev.VA("interfaces", ifName, "ip_neighbours", nei_ip, field))
                }
              }

              match, err := MatchAlertRule(ip_neighbours_rule, m)
              if err == nil {
                if match {
                  all_ips[nei_ip] = struct{}{}
                  if opt_v > 1 {
                    fmt.Println("IP neighbour:", ifName, nei_ip, "ADD")
                  }
                  if opt_n {
                    red.Do("HSETNX", "dev_list", nei_ip, now_unix_str+":run")
                  }
                } else {
                  if opt_v > 2 {
                    fmt.Println("IP neighbour:", ifName, nei_ip, "NO MATCH")
                  }
                }
              } else {
                if opt_v > 0 {
                  fmt.Println(err)
                }
              }
            } else {
              if opt_v > 2 {
                fmt.Println("IP neighbour:", ifName, nei_ip, "SKIP")
              }
            }
          }
        }
        //delete(int_h, "ip_neighbours")
      }
    }
  }

  if !startup && dev.Vs("overall_status") == "ok" && dev.EvM("proc_graph") {
    for key, _ := range dev.VM("proc_graph") {
      if dev.Evs(key + "_graph_file") && dev.Evs(key + "_graph_key") && dev.EvA(key) {
        red.Do("PUBLISH", "graph", ip + " " + dev.Vs("sysUpTime") + " " + dev.Vs(key + "_graph_key") + " " + dev.Vs(key))
      }
    }
  }

  proc_time := time.Now().Sub(process_start)

  if reg_ip_dev_id && red != nil && red.Err() == nil {
    red.Do("SET", "dev_ip."+dev_id, ip)
    red.Do("SET", "ip_dev_id."+ip, dev_id)
  }

  red.Do("DEL", "ip_proc_error."+ip)

  data.VM("dev_list", ip)["proc_result"] = "done in "+strconv.FormatInt(int64(proc_time/time.Millisecond), 10)+" ms"
  data.VM("dev_list", ip)["time"] = time.Now().Unix()

  red.Do("SET", "dev_last_seen."+dev_id, strconv.FormatInt(last_seen, 10)+":"+ip)
}
