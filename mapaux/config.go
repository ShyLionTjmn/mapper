package mapaux

import (
  "encoding/json"
  "log"
  "flag"
)

type Config struct {
  Oids_file                     string `json:"oids_file"`
  Redis_socket                  string `json:"redis_socket"`
  Redis_db                      string `json:"redis_db"`
  Redis_err_sleep               uint `json:"redis_err_sleep"`

  Rrd_root                      string `json:"rrd_root"`
  Rrd_socket                    string `json:"rrd_socket"`
  Rrd_tool                      string `json:"rrd_tool"`
  Png_cache                     string `json:"png_cache"`

  Safe_int_regex                string `json:"safe_int_regex"`

  Broker_port                   uint `json:"broker_port"`
  Www_root                      string `json:"www_root"`
  Broker_unix_socket            string `json:"broker_unix_socket"`

  Ipdb_dsn                      string `json:"ipdb_dsn"`
  Ipdb_sites_root_api_name      string `json:"ipdb_sites_root_api_name"`
  Ipdb_projects_root_api_name   string `json:"ipdb_projects_root_api_name"`

  Devs_configs_dir              string `json:"Devs_configs_dir"`
}

const DEFAULT_CONFIG_FILE = "/etc/mapper/mapper.conf"

func LoadConfig(file string, fail_no_file bool) Config {
  ret := Config{
    Oids_file:                     DEFAULT_OIDS_FILE
    Redis_socket:                  DEFAULT_REDIS_SOCKET
    Redis_db:                      DEFAULT_REDIS_DB
    Redis_err_sleep:               DEFAULT_REDIS_ERR_SLEEP

    Rrd_root:                      DEFAULT_RRD_ROOT
    Rrd_socket:                    DEFAULT_RRD_SOCKET
    Rrd_tool:                      DEFAULT_RRD_TOOL
    Png_cache:                     DEFAULT_PNG_CACHE

    Safe_int_regex:                DEFAULT_SAFE_INT_REGEX

    Broker_port:                   DEFAULT_BROKER_PORT
    Www_root:                      DEFAULT_WWW_ROOT
    Broker_unix_socket:            DEFAULT_BROKER_UNIX_SOCKET

    Ipdb_dsn:                      DEFAULT_IPDB_DSN
    Ipdb_sites_root_api_name:      DEFAULT_IPDB_SITES_ROOT_API_NAME
    Ipdb_projects_root_api_name:   DEFAULT_IPDB_PROJECTS_ROOT_API_NAME

    Devs_configs_dir:              DEFAULT_DEVS_CONFIGS_DIR
  }

  if fi, fe := os.Stat(file); fe == nil && fi.Mode().IsRegular() {
    var err error
    var conf_json []byte
    if conf_json, err = os.ReadFile(file); err != nil { log.Fatal(err.Error()) }

    if err = json.Unmarshal(conf_json, &ret); err != nil { log.Fatal(err.Error()) }

  } else if fail_no_file {
    log.Fatal("Cannot read config file " + file
  }

  return ret
}
