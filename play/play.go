package main

import (
  _ "fmt"
  "flag"
  . "github.com/ShyLionTjmn/mapper/mapaux"
  "github.com/davecgh/go-spew/spew"
)

var config Config

func init() {
  var opt_c *string = flag.String("c", DEFAULT_CONFIG_FILE, "Config file")

  flag.Parse()

  config = LoadConfig(*opt_c, FlagPassed("c"))
}

func main() {
  spew.Dump(config)
}
