package main

import (
  "fmt"
  "errors"
  "time"
  "net"
  "strings"
  "regexp"
  "github.com/likexian/whois"
  "github.com/gomodule/redigo/redis"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

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
  skip_whois_reg = regexp.MustCompile(`^(?:10\.|127\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|`+
                                         `22[4-9]\.|2[3-5]\d\.)`)
}

func ip_info(ip string, red redis.Conn) (M, error) {
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

ARP: for id, _ := range devs_arp {
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
          break ARP
        }
      }
    }
  }

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

  globalMutex.Unlock()

  if update_whois || update_dns {
    whois_ch := make(chan string, 1)
    dns_ch := make(chan string, 1)

    all_timer := time.NewTimer(500*time.Millisecond)

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
        continue UP
      case ds := <-dns_ch:
        if ds != "" {
          res["dns"] = ds
          res["dns_source"] = "lookup"
        }
        continue UP
      case <-all_timer.C:
        break UP
      }
    }
  }

  return res, nil
}
