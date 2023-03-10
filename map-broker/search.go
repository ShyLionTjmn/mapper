package main

import (
  "fmt"
  "errors"
  "time"
  "strings"
  "strconv"
  "regexp"
  "net"
  "github.com/gomodule/redigo/redis"
  "github.com/likexian/whois"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

var g_mac_reg *regexp.Regexp
var skip_whois_reg *regexp.Regexp

const MAX_WHOIS_AGE = 24*time.Hour
const MAX_DNS_AGE = 24*time.Hour

const REFRESH_WHOIS_AGE = time.Hour
const REFRESH_DNS_AGE = time.Hour

const RETRY_WHOIS_AGE = 5*time.Minute
const RETRY_DNS_AGE = 5*time.Minute

type CacheEntry struct {
  time time.Time
  value string
  is_error bool
}

var whois_cache  = make(map[string]CacheEntry)
var dns_cache  = make(map[string]CacheEntry)

func init() {
  g_mac_reg = regexp.MustCompile(`^([\da-fA-F]{2})[:\-\._]?([\da-fA-F]{2})[:\-\._]?([\da-fA-F]{2})[:\-\._]?`+
                                  `([\da-fA-F]{2})[:\-\._]?([\da-fA-F]{2})[:\-\._]?([\da-fA-F]{2})$`,
  )
  skip_whois_reg = regexp.MustCompile(`^(?:10\.|127\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|`+
                                         `22[4-9]\.|2[3-5]\d\.)`)
  _ = fmt.Sprint()
}

func search(search_for string, q M, red redis.Conn, timeout time.Duration) (M, error) {
  var var_ok bool

  res := M{}

  macs_list := []string{}
  ips_list := []string{}

  var origin string
  var origin_type string

  ips := M{}
  macs := M{}
  _devs := []M{}
  ints := []M{}
  neigs := []M{}

  reg_search := q.Vi("reg")

  if _, var_ok = V4ip2long(search_for); var_ok && reg_search != 1 {
    ips_list = append(ips_list, search_for)
    origin = search_for
    origin_type = "ip"
  } else if m := g_mac_reg.FindStringSubmatch(search_for); m != nil && reg_search != 1 {
    mac := strings.ToLower(m[1]+m[2]+m[3]+m[4]+m[5]+m[6])
    macs_list = append(macs_list, mac)
    origin = mac
    origin_type = "mac"
  } else {
    origin = search_for
    origin_type = "free"
  }

  if origin_type == "ip" {
    ip_inf, err := ip_info(ips_list[0], red, timeout, false)


    if err != nil { return nil, err }
    ips[ips_list[0]] = ip_inf
    for _, mac := range ip_inf.VA("ip_macs").([]string) {
      macs_list = StrAppendOnce(macs_list, mac)
    }
  } else if origin_type == "mac" {
    mac_inf, err := mac_info(macs_list[0], red)
    if err != nil { return nil, err }
    macs[macs_list[0]] = mac_inf
    for _, ip := range mac_inf.VA("mac_ips").([]string) {
      ips_list = StrAppendOnce(ips_list, ip)
    }
  } else {
    //free search, look for devs/ints/neigs names, descriptions, etc...
    var reg *regexp.Regexp
    var err error
    if reg_search != 1 {
      reg, _ = regexp.Compile(`(?i:` + regexp.QuoteMeta(search_for) + `)`)
    } else {
      reg, err = regexp.Compile(`(?i:` + search_for + `)`)
      if err != nil { return nil, err }
    }
    globalMutex.RLock()

    //search devices
    for dev_id, _ := range devs {
      dev_match := false
DEV:  for _, key := range []string{ "short_name", "id", "model_short", "model_long", "sysDescr", "sysLocation",
                                    "sysObjectID",
                                  } {
        if reg.MatchString(devs.Vs(dev_id, key)) {
          dev_match = true
          break DEV
        }
      }

      if !dev_match {
INV:    for _, key := range []string{ "invEntModel", "invEntSerial" } {
          if devs.EvM(dev_id, key) {
            for idx, _ := range devs.VM(dev_id, key) {
              if reg.MatchString(devs.Vs(dev_id, key, idx)) {
                dev_match = true
                break INV
              }
            }
          }
        }
      }

      if dev_match {
        dev := M{
          "dev_id": dev_id,
          "short_name": devs.Vs(dev_id, "short_name"),
          "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
          "overall_status": devs.Vs(dev_id, "overall_status"),
        }
        _devs = append(_devs, dev)
      }

      for ifName, _ := range devs.VM(dev_id, "interfaces") {
        int_match := false
        for _, key := range []string { "ifDescr", "ifAlias", "ifName" } {
          if reg.MatchString(devs.Vs(dev_id, "interfaces", ifName, key)) {
            int_match = true
            break
          }
        }

        if int_match {
          _int := M{
            "dev_id": dev_id,
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
            "interface": devs.VM(dev_id, "interfaces", ifName).Copy(),
            "ifName": ifName,
          }
          ints = append(ints, _int)
        }
      }

      for lldp_port, _ := range devs.VM(dev_id, "lldp_ports") {
        for nei_idx, _ := range devs.VM(dev_id, "lldp_ports", lldp_port, "neighbours") {
          if reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemChassisId")) ||
             reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemPortId")) ||
             reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemPortDescr")) ||
             reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemSysDescr")) ||
             reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemSysName")) ||
          false {
            neig := M{
              "dev_id": dev_id,
              "source": "LLDP",
              "neighbour": devs.VM(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx).Copy(),
              "port": devs.VM(dev_id, "lldp_ports", lldp_port).Copy(),
              "nei_index": nei_idx,
              "port_index": lldp_port,
              "short_name": devs.Vs(dev_id, "short_name"),
              "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
              "overall_status": devs.Vs(dev_id, "overall_status"),
            }

            if ifName, ok := devs.Vse(dev_id, "lldp_ports", lldp_port, "ifName");
            ok && devs.EvM(dev_id, "interfaces", ifName) {
              neig["interface"] = devs.VM(dev_id, "interfaces", ifName).Copy();
              neig["ifName"] = ifName
            }

            neigs = append(neigs, neig)
          }
        }
      }

      for cdp_port, _ := range devs.VM(dev_id, "cdp_ports") {
        for nei_idx, _ := range devs.VM(dev_id, "cdp_ports", cdp_port, "neighbours") {
          if reg.MatchString(devs.Vs(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx, "cdpRemDevId")) ||
             reg.MatchString(devs.Vs(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx, "cdpRemIfName")) ||
             reg.MatchString(devs.Vs(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx, "cdpRemPlatform")) ||
             reg.MatchString(devs.Vs(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx, "cdpRemSoftware")) ||
          false {
            neig := M{
              "dev_id": dev_id,
              "source": "CDP",
              "neighbour": devs.VM(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx).Copy(),
              "port": devs.VM(dev_id, "cdp_ports", cdp_port).Copy(),
              "nei_index": nei_idx,
              "port_index": cdp_port,
              "short_name": devs.Vs(dev_id, "short_name"),
              "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
              "overall_status": devs.Vs(dev_id, "overall_status"),
            }

            if ifName, ok := devs.Vse(dev_id, "cdp_ports", cdp_port, "ifName");
            ok && devs.EvM(dev_id, "interfaces", ifName) {
              neig["interface"] = devs.VM(dev_id, "interfaces", ifName).Copy();
              neig["ifName"] = ifName
            }

            neigs = append(neigs, neig)
          }
        }
      }

    }
    //search ip hostnames

    for ip, name := range ip2name {
      if reg.MatchString(name) {
        ips_list = StrAppendOnce(ips_list, ip)
      }
    }
    for net, _ := range net2name {
      if reg.MatchString(net2name.Vs(net, "name")) {
        if slash_pos := strings.Index(net, "/"); slash_pos > 0 {
          ips_list = StrAppendOnce(ips_list, net[:slash_pos])
        }
      }
    }
    globalMutex.RUnlock()
  }

  var err error
  for _, ip := range ips_list {
    if ips[ip] == nil {
      ips[ip], err = ip_info(ip, red, timeout, origin_type == "free")
      if err != nil { return nil, err }
    }
  }

  for _, mac := range macs_list {
    if macs[mac] == nil {
      macs[mac], err = mac_info(mac, red)
      if err != nil { return nil, err }
    }
  }

  res["origin"] = origin
  res["origin_type"] = origin_type

  if len(ips) > 0 {
    res["ips"] = ips
  }
  if len(macs) > 0 {
    res["macs"] = macs
  }
  if len(_devs) > 0 {
    res["devs"] = _devs
  }
  if len(ints) > 0 {
    res["ints"] = ints
  }
  if len(neigs) > 0 {
    res["neigs"] = neigs
  }

  return res, nil
}

func mac_info(mac string, red redis.Conn) (M, error) {
  if len(mac) != 12 { return nil, errors.New("mac_info: Bad mac") }
  oui := strings.ToLower(mac[:6])

  var err error

  ret := M{}

  first_octet, err := strconv.ParseUint(mac[1:2], 16, 4)
  if err != nil { return nil, err }

  if (first_octet & 0x01) > 0 {
    ret["corp"] = "MULTICAST"
  } else if (first_octet & 0x02) > 0 {
    ret["corp"] = "RANDOM"
  } else {
    if ret["corp"], err = redis.String(red.Do("HGET", "oui", oui)); err != nil && err != redis.ErrNil { return nil, err }
    if err == redis.ErrNil {
      ret["corp"] = "n/d"
      err = nil
    }
  }

  globalMutex.RLock()
  defer globalMutex.RUnlock()

  ports := []M{}

  for dev_id, _ := range devs_macs {
    for ifName, _ := range devs_macs.VM(dev_id) {
      if_total := 0
      for _, mlist := range devs_macs.VM(dev_id, ifName) {
        if_total += len(mlist.([]string))
      }
      for vlan, mlist := range devs_macs.VM(dev_id, ifName) {
        if IndexOf(mlist.([]string), mac) >= 0 &&
           devs.EvM(dev_id, "interfaces", ifName) &&
        true{
          port := M{
            "dev_id": dev_id,
            "ifName": ifName,
            "interface": devs.VM(dev_id, "interfaces", ifName).Copy(),
            "vlan": vlan,
            "vlan_total": uint64(len(mlist.([]string))),
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
          }
          ports = append(ports, port)
        }
      }
    }
  }

  if len(ports) > 0 {
    ret["ports"] = ports
  }

  mac_arps := []M{}
  mac_ips := []string{}

  for dev_id, _ := range devs_arp {
    for ifName, _ := range devs_arp.VM(dev_id) {
      for ip, _ := range devs_arp.VM(dev_id, ifName) {
        if devs_arp.Vs(dev_id, ifName, ip) == mac {
          arp := M{
            "dev_id": dev_id,
            "ifName": ifName,
            "interface": devs.VM(dev_id, "interfaces", ifName).Copy(),
            "ip": ip,
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
          }
          mac_arps = append(mac_arps, arp)
          mac_ips = StrAppendOnce(mac_ips, ip)
        }
      }
    }
  }

  if len(mac_arps) > 0 {
    ret["mac_arps"] = mac_arps
  }
  ret["mac_ips"] = mac_ips

  mac_ifs := []M{}
  mac_neigs := []M{}

  mac_reg, _ := regexp.Compile(`(?i:` + regexp.QuoteMeta(mac) + `)`)

  for dev_id, _ := range devs {
    for ifName, _ := range devs.VM(dev_id, "interfaces") {
      if devs.Vs(dev_id, "interfaces", ifName, "ifPhysAddr") == mac {
        mac_if := M{
          "dev_id": dev_id,
          "ifName": ifName,
          "interface": devs.VM(dev_id, "interfaces", ifName).Copy(),
          "short_name": devs.Vs(dev_id, "short_name"),
          "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
          "overall_status": devs.Vs(dev_id, "overall_status"),
        }
        mac_ifs = append(mac_ifs, mac_if)
      }
    }
    for lldp_port, _ := range devs.VM(dev_id, "lldp_ports") {
      for nei_idx, _ := range devs.VM(dev_id, "lldp_ports", lldp_port, "neighbours") {
        if mac_reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemChassisId")) ||
           mac_reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemPortId")) ||
           mac_reg.MatchString(devs.Vs(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx, "RemSysName")) ||
        false {
          mac_neig := M{
            "dev_id": dev_id,
            "source": "LLDP",
            "neighbour": devs.VM(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx).Copy(),
            "port": devs.VM(dev_id, "lldp_ports", lldp_port).Copy(),
            "nei_index": nei_idx,
            "port_index": lldp_port,
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
          }

          if ifName, ok := devs.Vse(dev_id, "lldp_ports", lldp_port, "ifName");
          ok && devs.EvM(dev_id, "interfaces", ifName) {
            mac_neig["interface"] = devs.VM(dev_id, "interfaces", ifName).Copy();
            mac_neig["ifName"] = ifName
          }

          mac_neigs = append(mac_neigs, mac_neig)
        }
      }
    }
    for cdp_port, _ := range devs.VM(dev_id, "cdp_ports") {
      for nei_idx, _ := range devs.VM(dev_id, "cdp_ports", cdp_port, "neighbours") {
        if mac_reg.MatchString(devs.Vs(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx, "cdpRemDevId")) ||
        false {
          mac_neig := M{
            "dev_id": dev_id,
            "source": "CDP",
            "neighbour": devs.VM(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx).Copy(),
            "port": devs.VM(dev_id, "cdp_ports", cdp_port).Copy(),
            "nei_index": nei_idx,
            "port_index": cdp_port,
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
          }

          if ifName, ok := devs.Vse(dev_id, "cdp_ports", cdp_port, "ifName");
          ok && devs.EvM(dev_id, "interfaces", ifName) {
            mac_neig["interface"] = devs.VM(dev_id, "interfaces", ifName).Copy();
            mac_neig["ifName"] = ifName
          }

          mac_neigs = append(mac_neigs, mac_neig)
        }
      }
    }
  }

  if len(mac_ifs) > 0 {
    ret["mac_ifs"] = mac_ifs
  }

  if len(mac_neigs) > 0 {
    ret["mac_neigs"] = mac_neigs
  }

  return ret, nil
}

func ip_info(ip string, red redis.Conn, timeout time.Duration, skip_lookups bool) (M, error) {
  var var_ok bool
  var v4ip uint32

  now := time.Now()

  res := M{}

  if v4ip, var_ok = V4ip2long(ip); var_ok {
  } else {
    return nil, errors.New("Unknown IP format")
  }

  update_whois := false
  update_dns := false

  globalMutex.Lock()

  if hostname, ok := ip2name[ip]; ok {
    res["hostname"] = hostname
  }

  if !skip_whois_reg.MatchString(ip) {
    if entry, ok := whois_cache[ip]; ok {
      if !entry.is_error {
        res["whois"] = entry.value
        res["whois_source"] = "cache"
      }
      if now.Sub(entry.time) > REFRESH_WHOIS_AGE || (entry.is_error && now.Sub(entry.time) > RETRY_WHOIS_AGE) {
        update_whois = true
      }
    } else {
      update_whois = true
    }
  }

  for i, entry := range whois_cache {
    if now.Sub(entry.time) > MAX_WHOIS_AGE {
      delete(whois_cache, i)
    }
  }

  if entry, ok := dns_cache[ip]; ok {
    if !entry.is_error {
      res["dns"] = entry.value
      res["dns_source"] = "cache"
    }

    if now.Sub(entry.time) > REFRESH_DNS_AGE || (entry.is_error && now.Sub(entry.time) > RETRY_DNS_AGE) {
      update_dns = true
    }
  } else {
    update_dns = true
  }

  for i, entry := range dns_cache {
    if now.Sub(entry.time) > MAX_DNS_AGE {
      delete(dns_cache, i)
    }
  }

  arp_debug := []string{}

  ip_macs := []string{}

  for id, _ := range devs_arp {
    for ifName, _ := range devs_arp.VM(id) {
      if mac_addr, ok := devs_arp.Vse(id, ifName, ip); ok && devs.EvM(id, "interfaces", ifName, "ips") {
        arp_debug = append(arp_debug, "Found at "+devs.Vs(id, "short_name")+" "+ifName)
        for dev_ip, _ := range devs.VM(id, "interfaces", ifName, "ips") {
          mask64 := devs.Vu(id, "interfaces", ifName, "ips", dev_ip, "masklen")
          arp_debug = append(arp_debug,
            fmt.Sprintf("\tchecking %s/%d", dev_ip, mask64),
          )
          dev_ip_u, var_ok := V4ip2long(dev_ip)
          if mask64 > 32 || !var_ok { continue }
          mask := uint32(mask64)
          arp_debug = append(arp_debug,
            fmt.Sprintf("\t%d vs %d", Ip4net(dev_ip_u, mask), Ip4net(v4ip, mask)),
          )
          if Ip4net(dev_ip_u, mask) != Ip4net(v4ip, mask) { continue }
          if res["arp"] == nil {
            res["arp"] = M{
              "mac_addr": mac_addr,
              "dev_id": id,
              "ifName": ifName,
            }
            if len(mac_addr) > 6 {
              oui := strings.ToLower(mac_addr[:6])
              corp, err := redis.String(red.Do("HGET", "oui", oui))
              if err == nil {
                res.VM("arp")["mac_vendor"] = corp
              }
            }
          }
          ip_macs = StrAppendOnce(ip_macs, mac_addr)
        }
      }
    }
  }

  res["ip_macs"] = ip_macs

  if res["arp"] == nil {
    res["arp_debug"] = strings.Join(arp_debug, "\n")
  }

  if site_tag, ok := ip2site[ip]; ok {
    res["site"] = site_tag
  } else {
    for net, _ := range net2site {
      if net2site.Vu(net, "first") <= uint64(v4ip) && net2site.Vu(net, "last") >= uint64(v4ip) {
        res["site"] = net2site.Vs(net, "tag_id")
        break
      }
    }
  }

  for net, _ := range net2name {
    if net2name.Vu(net, "first") <= uint64(v4ip) && net2name.Vu(net, "last") >= uint64(v4ip) {
      res["net"] = net2name.Vs(net, "name")
    }
  }

  ip_ifs := []M{}
  ip_net_ifs := []M{}
  ip_neigs := []M{}

  for dev_id, _ := range devs {
    for ifName, _ := range devs.VM(dev_id, "interfaces") {
      ip_matched := false
      if devs.EvM(dev_id, "interfaces", ifName, "ips", ip) {
        ip_if := M{
          "dev_id": dev_id,
          "ifName": ifName,
          "interface": devs.VM(dev_id, "interfaces", ifName).Copy(),
          "short_name": devs.Vs(dev_id, "short_name"),
          "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
          "overall_status": devs.Vs(dev_id, "overall_status"),
        }
        ip_ifs = append(ip_ifs, ip_if)
        ip_matched = true
      }
      if !ip_matched {
        for if_ip, _ := range devs.VM(dev_id, "interfaces", ifName, "ips") {
          if masklen, ok := devs.Vue(dev_id, "interfaces", ifName, "ips", if_ip, "masklen");
          ok && !strings.HasPrefix(if_ip, "127.") {
            if_ip_u, var_ok := V4ip2long(if_ip)
            if masklen > 32 || !var_ok { continue }
            if Ip4net(if_ip_u, uint32(masklen)) == Ip4net(v4ip, uint32(masklen)) {
              ip_net_if := M{
                "dev_id": dev_id,
                "ifName": ifName,
                "ip": if_ip,
                "masklen": masklen,
                "interface": devs.VM(dev_id, "interfaces", ifName).Copy(),
                "short_name": devs.Vs(dev_id, "short_name"),
                "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
                "overall_status": devs.Vs(dev_id, "overall_status"),
              }
              ip_net_ifs = append(ip_net_ifs, ip_net_if)
            }
          }
        }
      }
    }
    for lldp_port, _ := range devs.VM(dev_id, "lldp_ports") {
      for nei_idx, _ := range devs.VM(dev_id, "lldp_ports", lldp_port, "neighbours") {
        if rem_addr, ok := devs.Vse(dev_id, "lldp_ports", lldp_port, "neighbours",
                                    nei_idx, "RemMgmtAddr", "1",
        ); ok && rem_addr == ip {
          ip_neig := M{
            "dev_id": dev_id,
            "source": "LLDP",
            "neighbour": devs.VM(dev_id, "lldp_ports", lldp_port, "neighbours", nei_idx).Copy(),
            "port": devs.VM(dev_id, "lldp_ports", lldp_port).Copy(),
            "nei_index": nei_idx,
            "port_index": lldp_port,
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
          }

          if ifName, ok := devs.Vse(dev_id, "lldp_ports", lldp_port, "ifName");
          ok && devs.EvM(dev_id, "interfaces", ifName) {
            ip_neig["interface"] = devs.VM(dev_id, "interfaces", ifName).Copy();
            ip_neig["ifName"] = ifName
          }

          ip_neigs = append(ip_neigs, ip_neig)
        }
      }
    }
    for cdp_port, _ := range devs.VM(dev_id, "cdp_ports") {
      for nei_idx, _ := range devs.VM(dev_id, "cdp_ports", cdp_port, "neighbours") {
        if rem_addr, ok := devs.Vse(dev_id, "cdp_ports", cdp_port, "neighbours",
                                    nei_idx, "cdpRemAddrDecoded",
        ); ok && rem_addr == ip {
          ip_neig := M{
            "dev_id": dev_id,
            "source": "CDP",
            "neighbour": devs.VM(dev_id, "cdp_ports", cdp_port, "neighbours", nei_idx).Copy(),
            "port": devs.VM(dev_id, "cdp_ports", cdp_port).Copy(),
            "nei_index": nei_idx,
            "port_index": cdp_port,
            "short_name": devs.Vs(dev_id, "short_name"),
            "safe_dev_id": devs.Vs(dev_id, "safe_dev_id"),
            "overall_status": devs.Vs(dev_id, "overall_status"),
          }

          if ifName, ok := devs.Vse(dev_id, "cdp_ports", cdp_port, "ifName");
          ok && devs.EvM(dev_id, "interfaces", ifName) {
            ip_neig["interface"] = devs.VM(dev_id, "interfaces", ifName).Copy();
            ip_neig["ifName"] = ifName
          }

          ip_neigs = append(ip_neigs, ip_neig)
        }
      }
    }
  }

  if len(ip_net_ifs) > 0 {
    res["ip_net_ifs"] = ip_net_ifs
  }

  if len(ip_ifs) > 0 {
    res["ip_ifs"] = ip_ifs
  }

  if len(ip_neigs) > 0 {
    res["ip_neigs"] = ip_neigs
  }

  globalMutex.Unlock()

  if (update_whois || update_dns) && !skip_lookups {
    whois_ch := make(chan string, 1)
    dns_ch := make(chan string, 1)

    all_timer := time.NewTimer(timeout)

    if update_whois {
      go func() {
        var to_ch string
        cl := whois.NewClient()
        response, err := cl.Whois(ip)

        globalMutex.Lock()

        if err == nil {
          whois_cache[ip] = CacheEntry{ time: time.Now(), value: response, is_error: false }
          to_ch = response
        } else {
          whois_cache[ip] = CacheEntry{ time: time.Now(), value: "error: " + err.Error(), is_error: true }
        }
        globalMutex.Unlock()

        whois_ch <- to_ch
      } ()
    }

    if update_dns {
      go func() {
        var to_ch string
        response, err := net.LookupAddr(ip)

        globalMutex.Lock()

        if err == nil {
          dns_cache[ip] = CacheEntry{ time: time.Now(), value: strings.Join(response, "\n"), is_error: false }
          to_ch = strings.Join(response, "\n")
        } else {
          dns_cache[ip] = CacheEntry{ time: time.Now(), value: "error: " + err.Error(), is_error: true }
        }
        globalMutex.Unlock()

        dns_ch <- to_ch
      } ()
    }

UP: for {
      select {
      case ws := <-whois_ch:
        if ws != "" {
          res["whois"] = ws
          res["whois_source"] = "lookup"
        }
        if update_dns { continue UP }
        all_timer.Stop()
        break UP
      case ds := <-dns_ch:
        if ds != "" {
          res["dns"] = ds
          res["dns_source"] = "lookup"
        }
        if update_whois { continue UP }
        all_timer.Stop()
        break UP
      case <-all_timer.C:
        break UP
      }
    }
  }

  return res, nil
}
