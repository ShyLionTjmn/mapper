//package main
package mapaux

import (
  "fmt"
  "strings"
  "strconv"
)

func V4masklen2mask(masklen uint32) uint32 {
  return uint32(0xFFFFFFFF << (32 - masklen))
}

func Ip4net(ip uint32, masklen uint32) uint32 {
  return ip & uint32(0xFFFFFFFF << (32 - masklen))
}

func V4long2ip(ip uint32) string {
  o1 := (ip & uint32(0xFF000000)) >> 24
  o2 := (ip & uint32(0xFF0000)) >> 16
  o3 := (ip & uint32(0xFF00)) >> 8
  o4 := ip & uint32(0xFF)

  return fmt.Sprintf("%d.%d.%d.%d", o1, o2, o3, o4)
}

func V4ip2long(str string) (uint32, bool) {
  parts := strings.Split(str,".")
  if len(parts) != 4 { return 0, false }
  o1, err := strconv.ParseUint(parts[0], 10, 8)
  if err != nil { return 0, false }
  o2, err := strconv.ParseUint(parts[1], 10, 8)
  if err != nil { return 0, false }
  o3, err := strconv.ParseUint(parts[2], 10, 8)
  if err != nil { return 0, false }
  o4, err := strconv.ParseUint(parts[3], 10, 8)
  if err != nil { return 0, false }

  return uint32(o1) << 24 | uint32(o2) << 16 | uint32(o3) << 8 | uint32(o4), true
}
