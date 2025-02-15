package main

import (
  "fmt"
  "os"
  . "github.com/ShyLionTjmn/m"
  "regexp"
)

func main() {

  _reg := regexp.MustCompile(`^Fortinet`)

  if len(os.Args) != 2 {
    panic("No file argument")
  }

  _json, err := os.ReadFile(os.Args[1])
  if err != nil { panic(err) }

  data := M{}

  err = data.UnmarshalJSON(_json)

  if err != nil { panic(err) }

  for dev_id, _ := range data {
    if data.Evs(dev_id, "invEntDescr", "1") &&
      _reg.MatchString(data.Vs(dev_id, "invEntDescr", "1")) &&
    true {
      fmt.Println(data.Vs(dev_id, "short_name"), ", ", data.Vs(dev_id, "invEntDescr", "1"))
    }
  }
}
