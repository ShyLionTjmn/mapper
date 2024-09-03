package main

import (
  "fmt"
  . "github.com/ShyLionTjmn/mapper/mapaux"
  "github.com/davecgh/go-spew/spew"
)

var config Config

func isFlagPassed(name string) bool {
  found := false
  flag.Visit(func(f *flag.Flag) {
    if f.Name == name {
      found = true
    }
  })
  return found
}

func init() {
  var opt_c *string = flag.String("c", DEFAULT_CONFIG_FILE, "Config file")

  flag.Parse()

  config = LoadConfig(opt_c, isFlagPassed("c"))
}

func main() {
  spew.Dump(config)
}
