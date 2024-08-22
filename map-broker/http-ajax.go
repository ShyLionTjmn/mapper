package main

import (
  "fmt"
  "sync"
  "time"
  "regexp"
  "errors"
  "strings"
  "strconv"
  "os"
  "io/ioutil"
  "reflect"
  "context"
  "encoding/json"
  "net"
  "net/http"
  "golang.org/x/net/netutil"
  "runtime/debug"
  "encoding/gob"
  "bytes"

  "github.com/gomodule/redigo/redis"

  //w "github.com/jimlawless/whereami"
  // "github.com/davecgh/go-spew/spew"
  "github.com/fatih/color"

  . "github.com/ShyLionTjmn/mapper/mapaux"

)

// from ipdb.go
const (
  F_ALLOW_LEAFS uint64 = 1 << iota // allow to create leafs off non-root tag
  F_DENY_SELECT // deny selection as value
  F_DISPLAY // display in root-> ... -> final_tag chain
  F_IN_LABEL // display in tag label, before tag name, root-> ... -> final_tag chain
)


const PE = "Backend Program error"

var g_num_reg *regexp.Regexp
var g_num_list_reg *regexp.Regexp
var g_site_reg *regexp.Regexp
var g_proj_reg *regexp.Regexp
var g_l2_sysloc_reg *regexp.Regexp
var g_dev_id_reg *regexp.Regexp
var g_vdev_id_reg *regexp.Regexp
var g_map_key_reg *regexp.Regexp
var g_file_key_reg *regexp.Regexp
var g_shared_key_reg *regexp.Regexp

var g_mac_oui_reg *regexp.Regexp

var g_file_list_reg *regexp.Regexp

func init() {
  g_num_reg = regexp.MustCompile(`^\d+$`)
  g_num_list_reg = regexp.MustCompile(`^\d+(?:,\d+)*$`)
  g_site_reg = regexp.MustCompile(`^(?:l3|all|nodata|\d+)$`)
  g_proj_reg = regexp.MustCompile(`^(?:all|nodata|\d+(?:,\d+)*)$`)
  g_l2_sysloc_reg = regexp.MustCompile(`(?:^|\W)l2(?:\W|$)`)
  g_dev_id_reg = regexp.MustCompile(`^(?:serial|name|lldp):[a-zA-Z0-9_\-\.]+$`)
  g_vdev_id_reg = regexp.MustCompile(`^vdev:[a-zA-Z0-9_\-\.]+$`)
  g_map_key_reg = regexp.MustCompile(`^(?:loc|tps|colors|options)$`)
  g_file_key_reg = regexp.MustCompile(`^(?:|[0-9a-zA-Z]{10})$`)
  g_shared_key_reg = regexp.MustCompile(`^[0-9a-zA-Z]{10}$`)

  g_graph_start_reg = regexp.MustCompile(`^[0-9+\-a-zA-Z \:\.\/]+$`)
  g_graph_integer_reg = regexp.MustCompile(`^-?\d+$`)
  g_graph_dev_id_reg = regexp.MustCompile(`^[a-zA-Z0-9\.\-_]+$`)
  g_graph_if_name_reg = regexp.MustCompile(`^[a-zA-Z0-9\.\-_]+$`)
  g_graph_cpu_name_reg = regexp.MustCompile(`^[a-z0-9 \/.,;:\-]+$`)

  g_mac_oui_reg = regexp.MustCompile(`^([a-fA-F0-9])([a-fA-F0-9])[\-:\.]?([a-fA-F0-9])([a-fA-F0-9])[\-:\.]?([a-fA-F0-9])([a-fA-F0-9])(?:[\-:\.]?(?:[a-fA-F0-9][a-fA-F0-9])){3}$`)

  g_file_list_reg = regexp.MustCompile(`.*_(\d+|all|nodata|l3)_(\d+|all|nodata)\.([a-zA-Z0-9]*)\.(name|data)$`)

  gob.Register(M{})
  gob.Register(map[string]interface{}{})
  gob.Register([]interface{}{})
}

func containsDotFile(name string) bool {
    parts := strings.Split(name, "/")
    for _, part := range parts {
        if strings.HasPrefix(part, ".") {
            return true
        }
    }
    return false
}

type dotFileHidingFile struct {
    http.File
}
func (f dotFileHidingFile) Readdir(n int) (fis []os.FileInfo, err error) {
    files, err := f.File.Readdir(n)
    for _, file := range files { // Filters out the dot files
        if !strings.HasPrefix(file.Name(), ".") {
            fis = append(fis, file)
        }
    }
    return
}

type dotFileHidingFileSystem struct {
    http.FileSystem
}

func (fsys dotFileHidingFileSystem) Open(name string) (http.File, error) {
    if containsDotFile(name) { // If dot file, return 403 response
        return nil, errors.New("No permission")
    }

    file, err := fsys.FileSystem.Open(name)
    if err != nil {
        return nil, err
    }
    return dotFileHidingFile{file}, err
}

func get_p_string(q M, name string, check interface{}, options ... interface{}) (string,error) { // options: (error on empty(true by default)), (default value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return "", errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].(string), nil
    } else {
      return "", nil
    }
  }

  _val := fmt.Sprint(val)

  switch c := check.(type) {
  case nil:
    return _val, nil
  case string:
    reg, err := regexp.Compile(c)
    if err != nil {
      return "", err
    }
    if !reg.MatchString(_val) {
      return "",errors.New("Bad parameter value: "+name+": "+_val)
    }
  case *regexp.Regexp:
    if !c.MatchString(_val) {
      return "", errors.New("Bad parameter value: "+name+": "+_val)
    }
  case []string:
    found := false
    for _, v := range c {
      if _val == v {
        found = true
        break
      }
    }
    if !found {
      return "", errors.New("Bad parameter value: "+name+": "+_val)
    }
  default:
    return "", errors.New("Unknown param type")
  }

  return _val, nil
}
func get_p_uint64(q M, name string, options ... interface{}) (uint64,error) { // options: (error on empty(true by default)), (default value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return 0, errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].(uint64), nil
    } else {
      return 0, nil
    }
  }

  _val := fmt.Sprint(val)

  if !g_num_reg.MatchString(_val) { return 0, errors.New("Bad number for parameter: "+name+": "+_val) }
  ret, err := strconv.ParseUint(_val, 10, 64)
  if err != nil { return 0, err }
  return uint64(ret), nil
}

func get_p_uint32(q M, name string, options ... interface{}) (uint32,error) { // options: (error on empty(true by default)), (default value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return 0, errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].(uint32), nil
    } else {
      return 0, nil
    }
  }

  _val := fmt.Sprint(val)

  if !g_num_reg.MatchString(_val) { return 0, errors.New("Bad number for parameter: "+name+": "+_val) }
  ret, err := strconv.ParseUint(_val, 10, 32)
  if err != nil { return 0, err }
  return uint32(ret), nil
}

func get_p_map(q M, name string, check interface{}, options ... interface{}) (map[string]string, error) { // options: (error on empty(true by default)), (dafault value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return nil, errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].(map[string]string), nil
    } else {
      return make(map[string]string), nil
    }
  }

  switch val.(type) {
  case M:
  default:
    return nil, errors.New("Bad parameter type: "+name+": "+reflect.TypeOf(val).String())
  }

  _val := make(map[string]string)

  for k, vv := range val.(M) {
    switch typeval := vv.(type) {
    case string:
      _val[k] = typeval
    default:
      return nil, errors.New("Bad map value type: "+name+": key: "+k+": "+reflect.TypeOf(vv).String())
    }
  }

  switch c := check.(type) {
  case nil:
    return _val, nil
  case string:
    reg, err := regexp.Compile(c)
    if err != nil {
      return nil, err
    }
    for k, vv := range _val {
      if !reg.MatchString(vv) {
        return nil, errors.New("Bad parameter value: "+name+": key: "+k+": "+vv)
      }
    }
  case *regexp.Regexp:
    for k, vv := range _val {
      if !c.MatchString(vv) {
        return nil, errors.New("Bad parameter value: "+name+": key: "+k+": "+vv)
      }
    }
  case []string:
    for k, vv := range _val {
      found := false
      for _, v := range c {
        if vv == v {
          found = true
          break
        }
      }
      if !found {
        return nil, errors.New("Bad parameter value: "+name+": key: "+k+": "+vv)
      }
    }
  default:
    return nil, errors.New("Unknown param check type")
  }

  return _val, nil
}

func get_p_array(q M, name string, check interface{}, options ... interface{}) ([]string,error) { // options: (error on empty(true by default)), (dafault value) 
  val, exists := q[name]
  if !exists {
    if len(options) == 0 || options[0].(bool) {
      return nil, errors.New("Missing parameter: "+name)
    }
    if len(options) > 1 {
      return options[1].([]string), nil
    } else {
      return make([]string,0), nil
    }
  }

  if reflect.TypeOf(val).String() != "[]interface {}" {
    return nil, errors.New("Bad parameter type: "+name+": "+reflect.TypeOf(val).String())
  }

  for _, vv := range val.([]interface{}) {
    if reflect.TypeOf(vv).String() != "string" {
      return nil, errors.New("Bad parameter type: "+name+": "+reflect.TypeOf(vv).String())
    }
  }

  _val := make([]string, len(val.([]interface{})))
  for i, vv := range val.([]interface{}) {
    _val[i] = vv.(string)
  }

  switch c := check.(type) {
  case nil:
    return _val, nil
  case string:
    reg, err := regexp.Compile(c)
    if err != nil {
      return nil, err
    }
    for _, vv := range _val {
      if !reg.MatchString(vv) {
        return nil, errors.New("Bad parameter value: "+name+": "+vv)
      }
    }
  case *regexp.Regexp:
    for _, vv := range _val {
      if !c.MatchString(vv) {
        return nil, errors.New("Bad parameter value: "+name+": "+vv)
      }
    }
  case []string:
    for _, vv := range _val {
      found := false
      for _, v := range c {
        if vv == v {
          found = true
          break
        }
      }
      if !found {
        return nil, errors.New("Bad parameter value: "+name+": "+vv)
      }
    }
  default:
    return nil, errors.New("Unknown param type")
  }

  return _val, nil
}

var epoch = time.Unix(0, 0).Format(time.RFC1123)

// Taken from https://github.com/mytrile/nocache
var noCacheHeaders = map[string]string{
  "Expires":         epoch,
  "Cache-Control":   "no-cache, private, max-age=0",
  "Pragma":          "no-cache",
  "X-Accel-Expires": "0",
}

var etagHeaders = []string{
  "ETag",
  "If-Modified-Since",
  "If-Match",
  "If-None-Match",
  "If-Range",
  "If-Unmodified-Since",
}
func NoCache(h http.Handler) http.Handler {
  fn := func(w http.ResponseWriter, r *http.Request) {

    if r.RequestURI == "/" {
      // Delete any ETag headers that may have been set
      for _, v := range etagHeaders {
        if r.Header.Get(v) != "" {
          r.Header.Del(v)
        }
      }

      // Set our NoCache headers
      for k, v := range noCacheHeaders {
        w.Header().Set(k, v)
      }

      //w.Header().Add("X-Debug-RequestURI", r.RequestURI)
    }

    h.ServeHTTP(w, r)
  }

  return http.HandlerFunc(fn)
}

func http_server(stop chan string, wg *sync.WaitGroup) {
  defer wg.Done()
  s := &http.Server{}

  server_shut := make(chan struct{})

  go func() {
    <-stop
    if opt_v > 0 {
      fmt.Println("Shutting down HTTP server")
    }
    ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(500 * time.Millisecond))
    defer cancel()

    shut_err := s.Shutdown(ctx)
    if shut_err != nil {
      if opt_v > 0 {
        color.Red("HTTP server Shutdown error: %v\n", shut_err)
      }
    }
    close(server_shut)
  }()

  fsys := dotFileHidingFileSystem{http.Dir(opt_w)}

  http.Handle("/", NoCache(http.FileServer(fsys)))
  http.HandleFunc("/consts.js", handleConsts)
  http.HandleFunc("/offline.js", handleOffline)
  http.HandleFunc("/ajax", handleAjax)
  http.HandleFunc("/graph", handleGraph)

  listener, listen_err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", BROKER_PORT))
  if listen_err != nil {
    panic("Listening error: "+listen_err.Error())
  }

  defer listener.Close()
  listener = netutil.LimitListener(listener, 100)
  http_err := s.Serve(listener)
  if http_err != http.ErrServerClosed {
    if opt_v > 0 {
      color.Red("HTTP server shot down with error: %s", http_err)
    }
  }
  select {
  case <-server_shut:
  }
}

func handleConsts(w http.ResponseWriter, req *http.Request) {

  if req.Method == "OPTIONS" {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "*")
    w.Header().Set("Access-Control-Allow-Headers", "*")
    w.WriteHeader(http.StatusOK)
    return
  }

  w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
  w.Header().Set("Cache-Control", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")
  w.WriteHeader(http.StatusOK)

  w.Write([]byte(fmt.Sprintf("const EXAMPLE = %d;\n", 1)))

  w.Write([]byte(fmt.Sprintf("const F_ALLOW_LEAFS = %d;\n", F_ALLOW_LEAFS)))
  w.Write([]byte(fmt.Sprintf("const F_DENY_SELECT = %d;\n", F_DENY_SELECT)))
  w.Write([]byte(fmt.Sprintf("const F_DISPLAY = %d;\n", F_DISPLAY)))
  w.Write([]byte(fmt.Sprintf("const F_IN_LABEL = %d;\n", F_IN_LABEL)))

  jstr, jerr := json.MarshalIndent(M{"boo": "moo"}, "", "  ")
  if jerr != nil {
    panic(jerr)
  }

  w.Write([]byte("const EXAMPLE_OBJ = "))
  w.Write(jstr)
  w.Write([]byte(";\n"))

  w.Write([]byte("\n"))
}

func handleOffline(w http.ResponseWriter, req *http.Request) {

  if req.Method == "OPTIONS" {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "*")
    w.Header().Set("Access-Control-Allow-Headers", "*")
    w.WriteHeader(http.StatusOK)
    return
  }

  w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
  w.Header().Set("Cache-Control", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")
  w.WriteHeader(http.StatusOK)

  w.Write([]byte("const OFFLINE_DATA = "))
  jstr, jerr := json.MarshalIndent(M{"boo": "moo"}, "", "  ")
  if jerr != nil {
    panic(jerr)
  }

  w.Write(jstr)
  w.Write([]byte(";\n"))

}

func handle_error(r interface{}, w http.ResponseWriter, req *http.Request) {
  if r == nil {
    return
  }

  w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
  w.Header().Set("Cache-Control", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")
  w.WriteHeader(http.StatusOK)

  var out M

  switch v := r.(type) {
  case string:
    out = make(M)
    out["error"] = "Server message:\n"+v;
    if v == PE {
      out["error"] = out["error"].(string) + "\n\n" + string(debug.Stack())
    }
  case error:
    out = make(M)
    out["error"] = v.Error() + "\n\n" + string(debug.Stack())
  case M:
    out = v
  default:
    out = make(M)
    out["error"] = "Unknown error\n\n" + string(debug.Stack())
  }

  if opt_d {
    fmt.Println("out")
    dj, _ := json.MarshalIndent(out, "", "  ")
    fmt.Println(string(dj))
  }
  json, jerr := json.MarshalIndent(out, "", "  ")
  if jerr != nil {
    panic(jerr)
  }

  w.Write(json)
  w.Write([]byte("\n"))
  return
}

func front_dev(dev M, fields M) (M) {

  var go_deep func(M, M, int) (M)
  go_deep = func(data M, fields_map M, count int) (M) {
    ret := make(M)

    for field, f_type := range fields_map {
      val, ex := data[field]
      if !ex && field != "*" { continue }

      switch f_val := f_type.(type) {
      case M:
        if IsM(val) || field == "*" {
          if field == "*" {
            for key, k_val := range data {
              switch k_val.(type) {
              case M:
                ret[key] = go_deep(k_val.(M), f_val, count + 1)
              default:
                ret[key] = k_val
              }
            }
          } else {
            ret[field] = go_deep(val.(M), f_val, count + 1)
          }
        } else if field != "*" {
          ret[field] = val
        }
      default:
        if field != "*" {
          ret[field] = val
        }
      }
    }
    return ret
  }

  return go_deep(dev, fields, 0)
}

func handleAjax(w http.ResponseWriter, req *http.Request) {

  if req.Method == "OPTIONS" {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "*")
    w.Header().Set("Access-Control-Allow-Headers", "*")
    w.WriteHeader(http.StatusOK)
    return
  }

  pre_proc_time := time.Now()
  //fmt.Println(whereami.WhereAmI())

  defer func() { handle_error(recover(), w, req); } ()
  //mutex_locked := false
  //defer func() { if mutex_locked { globalMutex.Unlock(); mutex_locked = false; }; } ()

  var body []byte
  var err error

  if body, err = ioutil.ReadAll(req.Body); err != nil {
    panic(err)
  }

  ts := time.Now().Unix()

  var u64 uint64 //general use var for typecasting
  _ = u64

  var user_sub string
  var user_name string
  var user_login string
  var user_groups_string string

  for header, header_values := range req.Header {
    if strings.ToLower(header) == "x-idp-sub" && len(header_values) > 0 {
      user_sub = strings.TrimSpace(header_values[0])
    } else if strings.ToLower(header) == "x-idp-name" && len(header_values) > 0 {
      user_name = strings.TrimSpace(header_values[0])
    } else if strings.ToLower(header) == "x-idp-username" && len(header_values) > 0 {
      user_login = strings.TrimSpace(header_values[0])
    } else if strings.ToLower(header) == "x-idp-groups" && len(header_values) > 0 {
      user_groups_string = strings.TrimSpace(header_values[0])
    }
  }

  user_is_admin := false

  if user_sub == "" {
    // TODO turn back on
    panic("No authentication headers present")
  }

  user_is_admin = true

  out := make(M)

  user_groups := make([]string, 0)
  user_groups_a := strings.Split(user_groups_string, ",")
  for _,v := range user_groups_a {
    if len(v) > 3 && v[0:2] == `"/` && v[len(v)-1:] == `"` {
      user_groups = append(user_groups, strings.ToLower(v[2:len(v)-1]) )
    }
  }


  for _, g := range user_groups {
    if g == "netapp_mapper_appadmin" {
      user_is_admin = true
    }
  }

  NoAccess := func() (M) {
    out_userinfo := make(M);
    out_userinfo["name"] = user_name
    out_userinfo["login"] = user_login
    out_userinfo["groups"] = user_groups

    na_out := make(M)
    na_out["fail"] = "noaccess"
    na_out["userinfo"] = out_userinfo

    ok_out := make(M)
    ok_out["ok"] = na_out
    return ok_out
  }

  _ = NoAccess

  //if !user_is_admin { //TODO implement group features
  //  panic(NoAccess())
  //}

  var q M

  if req.Method == "GET" {
    q = make(M)
    values := req.URL.Query()
    for k, v := range values {
      if len(v) == 0 {
          q[k] = ""
      } else if len(v) == 1 {
          q[k] = v[0]
      } else {
        q[k] = v
      }
    }
  } else {
    if err = json.Unmarshal(body, &q); err != nil {
      panic(err)
    }
  }

  if _, action_ex := q["action"]; !action_ex {
    panic("no action in query")
  }

  action := q["action"].(string)
  _ = action

  var var_ok bool
  _ = var_ok

  var red redis.Conn

  if red, err = RedisCheck(red, "unix", REDIS_SOCKET, red_db); err != nil { panic(err) }
  defer red.Close()

  if action == "get_front" {

    var req_site string
    var req_proj string
    var req_file_key string
    var shared_key string
    var shared_file string

    if q["shared"] != nil {
      if shared_key, err = get_p_string(q, "shared", g_shared_key_reg); err != nil { panic(err) }
    }

    if shared_key == "" {

      if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
      if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
      if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }

    } else {
      var share_json []byte
      if share_json, err = redis.Bytes(red.Do("HGET", "maps", "shared."+shared_key)); err != nil && err != redis.ErrNil { panic(err) }
      if err != nil { panic("Ссылка не найдена. Возможно пользователь уже удалил раскладку или закрыл доступ.") }

      var share_data M
      if err = json.Unmarshal(share_json, &share_data); err != nil { panic(err) }

      if !share_data.Evs("site") ||
         !share_data.Evs("proj") ||
         !share_data.Evs("file") ||
      false {
        panic("Неверные данные в ссылке")
      }

      req_site = share_data.Vs("site")
      req_proj = share_data.Vs("proj")
      out["site"] = req_site
      out["proj"] = req_proj
      shared_file = share_data.Vs("file")
    }


    out_userinfo := M{
      "sub": user_sub,
      "name": user_name,
      "login": user_login,
      "groups": user_groups,
      "is_admin": user_is_admin,
    }

    out["userinfo"] = out_userinfo

    vdevs := M{}
    vlinks := M{}

    var vdevs_map map[string]string

    vdevs_map, err = redis.StringMap(red.Do("HGETALL", "vdevs"))
    if err == redis.ErrNil {
      //ignore
    } else if err != nil {
      panic(err)
    } else {
      for vdev_id, vdev_data := range vdevs_map {
        var vdev M
        if err = json.Unmarshal([]byte(vdev_data), &vdev); err != nil { panic(err) }
        vdev["last_seen"] = time.Now().Unix()
        vdevs[vdev_id] = vdev
      }
    }

    var vlinks_map map[string]string

    vlinks_map, err = redis.StringMap(red.Do("HGETALL", "vlinks"))
    if err == redis.ErrNil {
      //ignore
    } else if err != nil {
      panic(err)
    } else {
      for vlink_id, vlink_data := range vlinks_map {
        var vlink M
        if err = json.Unmarshal([]byte(vlink_data), &vlink); err != nil { panic(err) }
        vlinks[vlink_id] = vlink
      }
    }

    var fields M
    var fields_json []byte

    if req_site == "l3" {
      fields_json, err = redis.Bytes(red.Do("GET", "broker.l3_fields"))
    } else {
      fields_json, err = redis.Bytes(red.Do("GET", "broker.l2_fields"))
    }

    if err == redis.ErrNil {
      panic("broker fields not set in redis db")
    } else if err != nil {
      panic(err)
    }

    if err = json.Unmarshal(fields_json, &fields); err != nil { panic(err) }

    globalMutex.RLock()
    defer globalMutex.RUnlock()

    var tag_has_root func(string, string, int) (bool)
    tag_has_root = func(tag_id, root_id string, counter int) (bool) {
      var tag_index int
      var b bool
      if counter > 100 { return false }
      tag_index, b = tags_indexes[tag_id]
      if !b { return false }
      if tag_id == root_id { return true }
      if tags[tag_index]["data"].(M)["has_root_"+root_id] != nil { return true }
      if tags[tag_index]["data"].(M)["no_root_"+root_id] != nil { return false }
      if tags[tag_index]["data"].(M)["parent_id"] == nil { return false }

      if tags[tag_index]["data"].(M)["parent_id"].(string) == root_id {
        tags[tag_index]["data"].(M)["has_root_"+root_id] = struct{}{}
        return true
      }
      b = tag_has_root(tags[tag_index]["data"].(M)["parent_id"].(string), root_id, counter + 1)
      if b {
        tags[tag_index]["data"].(M)["has_root_"+root_id] = struct{}{}
      } else {
        tags[tag_index]["data"].(M)["no_root_"+root_id] = struct{}{}
      }
      return b
    }

    if g_num_reg.MatchString(req_site) {
      if sites_root_tag != "" {
        if !tag_has_root(req_site, sites_root_tag, 0) {
          req_site = "error"
          out["error_nosite"] = "site tag not in root tag"
        }
      } else {
        req_site = "error"
        out["error_nosite"] = "no root tag"
      }
    }

    if g_num_list_reg.MatchString(req_proj) {
      if projects_root_tag != "" {
        for _, proj_id := range strings.Split(req_proj, ",") {
          if !tag_has_root(proj_id, projects_root_tag, 0) {
            req_proj = "error"
            out["error_noproj"] = "proj tag not in root tag"
            break
          }
        }
      } else {
        req_proj = "error"
        out["error_noproj"] = "no root tag"
      }
    }

    sites := []M{
      M{
        "id": "l3",
        "children": []M{},
        "text": "L3",
        "data": M{"descr": "Routers"},
      },
      M{
        "id": "nodata",
        "children": []M{},
        "text": "Без локации",
        "data": M{"descr": "Без локации"},
      },
      M{
        "id": "all",
        "children": []M{},
        "text": "Все устройства",
        "data": M{"descr": "Все устройства"},
      },
    }
    projects := []M{
      M{
        "id": "nodata",
        "children": []M{},
        "text": "Без тега",
        "data": M{"descr": "Без тега"},
      },
      M{
        "id": "all",
        "children": []M{},
        "text": "Все",
        "data": M{"descr": "Все"},
      },
    }

    var traverse_tree func(string, *[]M, int) (error)
    traverse_tree = func(tag_id string, add_to *[]M, counter int) (error) {
      if counter > 100 { return errors.New("Tags loop detected") }
      tag_index, ex := tags_indexes[tag_id]
      if !ex { return errors.New("no tag") }
      add_tag := M{
        "id": tag_id,
        "text": tags[tag_index]["text"],
        "data": M{
          "descr": tags[tag_index]["data"].(M)["descr"],
          "flags": tags[tag_index]["data"].(M)["flags"],
        },
      }
      children := make([]M, 0)
      for _, child_id := range tags[tag_index]["children"].([]string) {
        if err := traverse_tree(child_id, &children, counter + 1); err != nil { return err }
      }
      add_tag["children"] = children
      *add_to = append(*add_to, add_tag)
      return nil
    }

    if sites_root_index, ex := tags_indexes[sites_root_tag]; sites_root_tag != "" && ex {
      for _, tag_id := range tags[sites_root_index]["children"].([]string) {
        if err = traverse_tree(tag_id, &sites, 0); err != nil { panic(err) }
      }
    }

    if projects_root_index, ex := tags_indexes[projects_root_tag]; projects_root_tag != "" && ex {
      for _, tag_id := range tags[projects_root_index]["children"].([]string) {
        if err = traverse_tree(tag_id, &projects, 0); err != nil { panic(err) }
      }
    }

    out["sites"] = sites
    out["projects"] = projects


    out_devs := make(M)

GFDEV: for dev_id, dev_m := range devs {
      dev := dev_m.(M)
      site_match := false
      proj_match := false

      var site_match_by string
      var proj_match_by string

      if req_site == "all" { site_match = true; site_match_by = "all" }
      if req_proj == "all" { proj_match = true; proj_match_by = "all" }

      dev_ips := make([]string, 0)
      dev_nets := make([]string, 0)

      for ifName, _ := range dev.VM("interfaces") {
        if ifas, var_ok := dev.Vie("interfaces", ifName, "ifAdminStatus"); var_ok && ifas == 1 {
          for ip, ipdata_h := range dev.VM("interfaces", ifName, "ips") {
            if !strings.HasPrefix(ip, "127.") {
              dev_ips = append(dev_ips, ip)
              dev_nets = append(dev_nets, ipdata_h.(M)["net"].(string))
              masklen := ipdata_h.(M).Vu("masklen")
              if masklen == 32 {
                if ip_long, var_ok := V4ip2long(ip); !var_ok {
                  panic("bad ip: " + ip)
                } else {
                  for m := uint32(31); m > 0; m -- {
                    net := fmt.Sprintf("%s/%d", V4long2ip(Ip4net(ip_long, m)), m)
                    dev_nets = append(dev_nets, net)
                  }
                }
              }
            }
          }
        }
      }

      if !site_match && req_site != "nodata" {
        if req_site == "l3" {
          sysLocation := dev.Vs("sysLocation")
          if len(dev_ips) > 1 && !g_l2_sysloc_reg.MatchString(sysLocation) {
            site_match = true
            site_match_by = "l3"
          }
        } else {
          //check site by ip's
          for _, ip := range dev_ips {
            if tag_id, ex := ip2site[ip]; ex && tag_has_root(tag_id, req_site, 0) {
              site_match = true
              site_match_by = ip
              break
            }
          }
          //check site by data_ip net
          if !site_match {
            for _, net := range dev_nets {
              if net2site.EvM(net) && tag_has_root(net2site.Vs(net, "tag_id"), req_site, 0) {
                site_match = true
                site_match_by = net
                break
              }
            }
          }

          if !site_match {
SIN:        for _, ip := range dev_ips {
              ip_long, _ := V4ip2long(ip)
              for net, _ := range net2site {
                first := net2site.Vu(net, "first")
                last := net2site.Vu(net, "last")

                if first != UINT64_ERR && last != UINT64_ERR &&
                   uint64(ip_long) >= first && uint64(ip_long) <= last &&
                   tag_has_root( net2site.Vs(net, "tag_id"), req_site, 0) &&
                true {
                  site_match = true
                  site_match_by = net
                  break SIN
                }
              }
            }
          }

        }
      }

      if !site_match && req_site == "nodata" {
        for _, ip := range dev_ips {
          if _, ex := ip2site[ip]; ex {
            continue GFDEV
          }
          ip_long, _ := V4ip2long(ip)
          for net, _ := range net2site {
            first := net2site.Vu(net, "first")
            last := net2site.Vu(net, "last")

            if first != UINT64_ERR && last != UINT64_ERR &&
               uint64(ip_long) >= first && uint64(ip_long) <= last &&
            true {
              continue GFDEV
            }
          }
        }
        //check site by data_ip net
        if !site_match {
          for _, net := range dev_nets {
            if _, ex := net2site[net]; ex {
              continue GFDEV
            }
          }
        }
        site_match = true
        site_match_by = "nodata"
      }

      if !proj_match && req_proj != "nodata" {
LPROJ:  for _, proj_id := range strings.Split(req_proj,",") {
          for _, ip := range dev_ips {
            if tag_ids, ex := ip2projects[ip]; ex {
              for _, tag_id := range tag_ids {
                if tag_has_root(tag_id, proj_id, 0) {
                  proj_match = true
                  proj_match_by = ip
                  break LPROJ
                }
              }
            }
          }
          for _, net := range dev_nets {
            if tag_ids, ex := net2projects[net]; ex {
              for _, tag_id := range tag_ids {
                if tag_has_root(tag_id, proj_id, 0) {
                  proj_match = true
                  proj_match_by = net
                  break LPROJ
                }
              }
            }
          }
          for _, ip := range dev_ips {
            ip_long, _ := V4ip2long(ip)
            for net, _ := range net2site {
              first := net2site.Vu(net, "first")
              last := net2site.Vu(net, "last")

              if first != UINT64_ERR && last != UINT64_ERR &&
                 uint64(ip_long) >= first && uint64(ip_long) <= last &&
                 tag_has_root( net2site.Vs(net, "tag_id"), proj_id, 0) &&
              true {
                proj_match = true
                proj_match_by = net
                break LPROJ
              }
            }
          }
        }
      }

      if !proj_match && req_proj == "nodata" {
        for _, ip := range dev_ips {
          if _, ex := ip2projects[ip]; ex {
            continue GFDEV
          }
        }
        for _, net := range dev_nets {
          if _, ex := net2projects[net]; ex {
            continue GFDEV
          }
        }
        proj_match = true
        proj_match_by = "nodata"
      }

      if site_match && proj_match {
        if q["full"] == nil {
          out_devs[dev_id] = front_dev(dev, fields)
        } else {
          out_devs[dev_id] = dev
        }
        out_devs[dev_id].(M)["_site_match_by"] = site_match_by
        out_devs[dev_id].(M)["_proj_match_by"] = proj_match_by
      }

      dev_sites := []M{}

      for _, ip := range dev_ips {
        if tag_id, ex := ip2site[ip]; ex {
          dev_sites = append(dev_sites, M{ "site": tag_id, "by": ip })
        }
        ip_long, _ := V4ip2long(ip)
        for net, _ := range net2site {
          first := net2site.Vu(net, "first")
          last := net2site.Vu(net, "last")
          if first != UINT64_ERR && last != UINT64_ERR &&
             uint64(ip_long) >= first && uint64(ip_long) <= last &&
          true {
            dev_sites = append(dev_sites, M{ "site": net2site.Vs(net, "tag_id"), "by": net })
          }
        }
      }

      for _, net := range dev_nets {
        if net2site.EvM(net) {
          dev_sites = append(dev_sites, M{ "site": net2site.Vs(net, "tag_id"), "by": net })
        }
      }

      if len(dev_sites) > 0 && out_devs.EvM(dev_id) {
        out_devs.VM(dev_id)["sites"] = dev_sites
      }

      dev_projects := []M{}

      for _, ip := range dev_ips {
        if tag_ids, ex := ip2projects[ip]; ex {
          for _, tag_id := range tag_ids {
            dev_projects = append(dev_projects, M{ "proj": tag_id, "by": ip })
          }
        }
      }

      for _, net := range dev_nets {
        if tag_ids, ex := net2projects[net]; ex {
          for _, tag_id := range tag_ids {
            dev_projects = append(dev_projects, M{ "proj": tag_id, "by": net })
          }
        }
      }

      if len(dev_projects) > 0 && out_devs.EvM(dev_id) {
        out_devs.VM(dev_id)["projects"] = dev_projects
      }
    } //devs

    if req_site != "l3" {
      out_links := make(M)
      if data["l2_links"] != nil {
        for link_id, link := range data["l2_links"].(M) {
          if link.(M)["0"] != nil && link.(M)["1"] != nil &&
             out_devs[ link.(M)["0"].(M)["DevId"].(string) ] != nil &&
             out_devs[ link.(M)["1"].(M)["DevId"].(string) ] != nil &&
          true {
            out_links[link_id] = link
          }
        }
      }
      out["l2_links"] = out_links.Copy()
    } else {
      out["l3_links"] = data["l3_links"]
    }

    out["devs"] = out_devs.Copy()

    if g_num_reg.MatchString(req_site) {
      for vdev_id, _ := range vdevs {
        if g_num_reg.MatchString(vdevs.Vs(vdev_id, "site")) {
          vdev_site := vdevs.Vs(vdev_id, "site")
          if tag_has_root(vdev_site, req_site, 0) {
            out.VM("devs")[vdev_id] = vdevs.VM(vdev_id)
          }
        }
      }
      for vlink_id, _ := range vlinks {
        dev0 := vlinks.Vs(vlink_id, "0", "DevId")
        if0 := vlinks.Vs(vlink_id, "0", "ifName")

        dev1 := vlinks.Vs(vlink_id, "1", "DevId")
        if1 := vlinks.Vs(vlink_id, "1", "ifName")

        if out.EvM("devs", dev0, "interfaces", if0) && out.EvM("devs", dev1, "interfaces", if1) {
          if out.Vi("devs", dev0, "interfaces", if0, "ifOperStatus") == int64(1) &&
             out.Vi("devs", dev0, "interfaces", if0, "ifOperStatus") == int64(1) &&
          true {
            vlinks.VM(vlink_id)["status"] = 1
          } else {
            vlinks.VM(vlink_id)["status"] = 2
          }

          out.VM("l2_links")[vlink_id] = vlinks.VM(vlink_id)

          list0 := []string{}
          if out.EvA("devs", dev0, "interfaces", if0, "l2_links") {
            list0 = out.VA("devs", dev0, "interfaces", if0, "l2_links").([]string)
          }
          list0 = StrAppendOnce(list0, vlink_id)
          out.VM("devs", dev0, "interfaces", if0)["l2_links"] = list0

          list1 := []string{}
          if out.EvA("devs", dev1, "interfaces", if1, "l2_links") {
            list1 = out.VA("devs", dev1, "interfaces", if1, "l2_links").([]string)
          }
          list1 = StrAppendOnce(list1, vlink_id)
          out.VM("devs", dev1, "interfaces", if1)["l2_links"] = list1
        }
      }
    }

    var map_hash_key_data string
    var map_hash_key_time string

    if shared_key == "" {
      out["file_key"] = req_file_key
      map_hash_key_data = user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
      map_hash_key_time = user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".time"
    } else {
      out["file_key"] = "I n v @ l 1 d"
      map_hash_key_data = shared_file + ".data"
      map_hash_key_time = shared_file + ".time"
    }

    _ = map_hash_key_time

    var default_owner string
    default_owner, err = redis.String(red.Do("HGET", "maps", "default_"+req_site+"_"+req_proj+".owner"))

    if err == nil {
      if default_owner == user_sub {
        out["is_default_map_owner"] = 1
      } else {
        out["has_default_map"] = 1
      }
    } else if err != redis.ErrNil {
      panic(err)
    }


    var map_data []byte
    if map_data, err = redis.Bytes(red.Do("HGET", "maps", map_hash_key_data)); err != nil && err != redis.ErrNil {
      panic(err)
    }

    if (err != nil || q["load_default"] != nil) &&
       req_file_key == "" && shared_key == "" &&
    true {
      //try default map
      if map_data, err = redis.Bytes(red.Do("HGET", "maps", "default_"+req_site+"_"+req_proj+".data"));
      err != nil && err != redis.ErrNil {
        panic(err)
      }
      if err == nil {
        out["default_map"] = 1
      } else if q["load_default"] != nil {
        panic("No default layout")
      }
    }

    empty_map := M{
      "tps": M{},
      "loc": M{},
      "colors": M{},
      "options": M{},
    }

    if err != nil {
      out["map"] = empty_map
    } else {
      buf := bytes.NewBuffer(map_data)
      dec := gob.NewDecoder(buf)

      var out_map M
      if err = dec.Decode(&out_map); err != nil {
        out["map"] = empty_map
      } else {

        // cleanup map
/*
        save_back := false

        for dev_id, _ := range out_map.VM("loc") {
          if _, ex := out_devs[dev_id]; !ex {
            delete(out_map.VM("loc"), dev_id)
            save_back = true
          }
        }

        for dev_id, _ := range out_map.VM("colors") {
          if _, ex := out_devs[dev_id]; !ex {
            delete(out_map.VM("colors"), dev_id)
            save_back = true
          }
        }

        for tp, _ := range out_map.VM("tps") {
          for tpi, _ := range out_map.VM("tps", tp) {
            if ( ( out_map.Vs("tps", tp, tpi, "type") == "devdev" ||
                   out_map.Vs("tps", tp, tpi, "type") == "devtp") &&
                 !out_devs.EvM( out_map.Vs("tps", tp, tpi, "from_dev"), "interfaces", out_map.Vs("tps", tp, tpi, "from_int") ) ) ||
               ( out_map.Vs("tps", tp, tpi, "type") == "devdev" &&
                 !out_devs.EvM( out_map.Vs("tps", tp, tpi, "to_dev"), "interfaces", out_map.Vs("tps", tp, tpi, "to_int") ) ) ||
            false {
              delete(out_map.VM("tps"), tp)
              save_back = true
            }
          }
        }

        if save_back && shared_key == "" {
          var out_buff bytes.Buffer
          enc := gob.NewEncoder(&out_buff)
          if err = enc.Encode(out_map); err != nil { panic(err) }
          if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
          if _, err = red.Do("HSET", "maps", map_hash_key_time, ts); err != nil { panic(err) }
        }
*/
        out["map"] = out_map
      }
    }

    maps_prefix := user_sub+"_"+req_site+"_"+req_proj+"."

    var map_keys []string
    if map_keys, err = RedHKeys(red, "maps", maps_prefix); err != nil { panic(err) }

// FILEKEY - empty for main map, random for others
// maps maps_prefix.FILEKEY.shared = SHAREKEY
// maps maps_prefix.FILEKEY.data = MAPDATA
// maps maps_prefix.FILEKEY.name = human_name
// maps maps_prefix.FILEKEY.time = time()
// maps shared.SHAREKEY = { "site": site, "proj": proj, "file": maps_prefix.FILEKEY }
//
//
//

    pref_len := len(maps_prefix)

    temp_files_list := M{}

    for _, key := range map_keys {
      file_key_suffix := key[pref_len:] // FILEKEY.suffix
      var suffix string
      var file_key string
      last_dot := strings.LastIndex(file_key_suffix, ".")

      if last_dot >= 0 {
        file_key = file_key_suffix[:last_dot]
        suffix = file_key_suffix[last_dot + 1:]

        if _, ex := temp_files_list[file_key]; !ex {
          temp_files_list[file_key] = M{}
        }

        var redstr string
        var redint int64

        if suffix == "shared" {
          if redstr, err = redis.String(red.Do("HGET", "maps", key));
          err != nil && err != redis.ErrNil { panic(err) }

          if err != redis.ErrNil {
            temp_files_list[file_key].(M)["shared"] = redstr
          }
        } else if suffix == "time" {
          if redint, err = redis.Int64(red.Do("HGET", "maps", key));
          err != nil && err != redis.ErrNil { panic(err) }

          if err != redis.ErrNil {
            temp_files_list[file_key].(M)["time"] = redint
          }
        } else if suffix == "name" {
          if redstr, err = redis.String(red.Do("HGET", "maps", key));
          err != nil && err != redis.ErrNil { panic(err) }

          if err != redis.ErrNil && file_key != "" {
            temp_files_list[file_key].(M)["name"] = redstr
          }
        } else if suffix == "data" {
          temp_files_list[file_key].(M)["has_data"] = true
        }
      }
    }

    out_files_list := M{}
    for file_key, _ := range temp_files_list {
      if temp_files_list.EvA(file_key, "has_data") {
        out_files_list[file_key] = temp_files_list.VM(file_key)
      }
    }

    if out_files_list[""] == nil {
      out_files_list[""] = M{}
    }
    out_files_list[""].(M)["name"] = ""

    out["files_list"] = out_files_list
  } else if action == "set_default_map" {
    //TODO rights check
    var req_site string
    var req_proj string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }

    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"..data"
    map_hash_key_time := user_sub+"_"+req_site+"_"+req_proj+"..time"

    _, err = red.Do("HGET", "maps", map_hash_key_time)
    if err == redis.ErrNil { panic("Исходной раскладки нет в БД") }
    if err != nil { panic(err) }

    var map_data []byte
    map_data, err = redis.Bytes(red.Do("HGET", "maps", map_hash_key_data))
    if err == redis.ErrNil { panic("Исходной раскладки нет в БД") }
    if err != nil { panic(err) }

    default_key := "default_" + req_site + "_" + req_proj

    if _, err = red.Do("HSET", "maps", default_key + ".owner", user_sub); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", default_key + ".data", map_data); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", default_key + ".time", ts); err != nil { panic(err) }

    out["done"] = 1

  } else if action == "save_map_key_id" {
    var map_key string
    var id string
    var req_site string
    var req_proj string
    var req_file_key string
    var save_json string

    if map_key, err = get_p_string(q, "key", g_map_key_reg); err != nil { panic(err) }
    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if id, err = get_p_string(q, "id", ".+"); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }
    if save_json, err = get_p_string(q, "save_data", ".+"); err != nil { panic(err) }

    var save_data M
    if err = json.Unmarshal([]byte(save_json), &save_data); err != nil { panic(err) }

    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
    map_hash_key_time := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".time"

    var map_data []byte
    if map_data, err = redis.Bytes(red.Do("HGET", "maps", map_hash_key_data));
    err != nil && err != redis.ErrNil {
      panic(err)
    }

    var map_m M

    if err == redis.ErrNil {
      map_m = M{
        "tps": M{},
        "loc": M{},
        "colors": M{},
        "options": M{},
      }
    } else {
      buf := bytes.NewBuffer(map_data)
      dec := gob.NewDecoder(buf)

      if err = dec.Decode(&map_m); err != nil { panic(err) }
    }

    switch map_m[map_key].(type) {
    case nil:
      map_m[map_key] = M{}
      map_m[map_key].(M)[id] = save_data
    case map[string]interface{}:
      map_m[map_key].(map[string]interface{})[id] = save_data
    case M:
      map_m[map_key].(M)[id] = save_data
    default:
      panic("bad map_m[map_key] type")
    }

    var out_buff bytes.Buffer
    enc := gob.NewEncoder(&out_buff)
    if err = enc.Encode(map_m); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_time, ts); err != nil { panic(err) }

    if req_file_key == "" {
      def_owner, err := redis.String(red.Do("HGET", "maps", "default_" + req_site+"_"+req_proj+".owner"))
      if err == redis.ErrNil || (err == nil && def_owner == user_sub) {
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".owner", user_sub)
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".data", out_buff.Bytes())
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".time", ts)
      }
    }

    out["done"] = 1

  } else if action == "del_map_key_id" {
    var map_key string
    var id string
    var req_site string
    var req_proj string
    var req_file_key string

    if map_key, err = get_p_string(q, "key", g_map_key_reg); err != nil { panic(err) }
    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if id, err = get_p_string(q, "id", ".+"); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }

    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
    map_hash_key_time := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".time"

    var map_data []byte
    if map_data, err = redis.Bytes(red.Do("HGET", "maps", map_hash_key_data));
    err != nil && err != redis.ErrNil {
      panic(err)
    }

    var map_m M

    if err == redis.ErrNil {
      map_m = M{
        "tps": M{},
        "loc": M{},
        "colors": M{},
        "options": M{},
      }
    } else {
      buf := bytes.NewBuffer(map_data)
      dec := gob.NewDecoder(buf)

      if err = dec.Decode(&map_m); err != nil { panic(err) }
    }

    switch map_m[map_key].(type) {
    case nil:
    case map[string]interface{}:
      delete(map_m[map_key].(map[string]interface{}), id)
    case M:
      delete(map_m[map_key].(M), id)
    default:
      panic("bad map_m[map_key] type")
    }

    var out_buff bytes.Buffer
    enc := gob.NewEncoder(&out_buff)
    if err = enc.Encode(map_m); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_time, ts); err != nil { panic(err) }

    if req_file_key == "" {
      def_owner, err := redis.String(red.Do("HGET", "maps", "default_" + req_site+"_"+req_proj+".owner"))
      if err == redis.ErrNil || (err == nil && def_owner == user_sub) {
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".owner", user_sub)
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".data", out_buff.Bytes())
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".time", ts)
      }
    }

    out["done"] = 1

  } else if action == "save_map_key" {
    var map_key string
    var req_site string
    var req_proj string
    var req_file_key string
    var save_json string

    if map_key, err = get_p_string(q, "key", g_map_key_reg); err != nil { panic(err) }
    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }
    if save_json, err = get_p_string(q, "save_data", ".+"); err != nil { panic(err) }

    var save_data M
    if err = json.Unmarshal([]byte(save_json), &save_data); err != nil { panic(err) }

    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
    map_hash_key_time := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".time"

    var map_data []byte
    if map_data, err = redis.Bytes(red.Do("HGET", "maps", map_hash_key_data)); err != nil && err != redis.ErrNil {
      panic(err)
    }

    var map_m M

    if err == redis.ErrNil {
      map_m = M{
        "tps": M{},
        "loc": M{},
        "colors": M{},
        "options": M{},
      }
    } else {
      buf := bytes.NewBuffer(map_data)
      dec := gob.NewDecoder(buf)

      if err = dec.Decode(&map_m); err != nil { panic(err) }
    }

    map_m[map_key] = save_data

    var out_buff bytes.Buffer
    enc := gob.NewEncoder(&out_buff)
    if err = enc.Encode(map_m); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_time, ts); err != nil { panic(err) }

    if req_file_key == "" {
      def_owner, err := redis.String(red.Do("HGET", "maps", "default_" + req_site+"_"+req_proj+".owner"))
      if err == redis.ErrNil || (err == nil && def_owner == user_sub) {
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".owner", user_sub)
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".data", out_buff.Bytes())
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".time", ts)
      }
    }

    out["done"] = 1

  } else if action == "del_map_key" {
    var map_key string
    var req_site string
    var req_proj string
    var req_file_key string

    if map_key, err = get_p_string(q, "key", g_map_key_reg); err != nil { panic(err) }
    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }

    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
    map_hash_key_time := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".time"

    var map_data []byte
    if map_data, err = redis.Bytes(red.Do("HGET", "maps", map_hash_key_data));
    err != nil && err != redis.ErrNil {
      panic(err)
    }

    var map_m M

    if err == redis.ErrNil {
      map_m = M{
        "tps": M{},
        "loc": M{},
        "colors": M{},
        "options": M{},
      }
    } else {
      buf := bytes.NewBuffer(map_data)
      dec := gob.NewDecoder(buf)

      if err = dec.Decode(&map_m); err != nil { panic(err) }
    }

    map_m[map_key] = M{}

    var out_buff bytes.Buffer
    enc := gob.NewEncoder(&out_buff)
    if err = enc.Encode(map_m); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_time, ts); err != nil { panic(err) }

    if req_file_key == "" {
      def_owner, err := redis.String(red.Do("HGET", "maps", "default_" + req_site+"_"+req_proj+".owner"))
      if err == redis.ErrNil || (err == nil && def_owner == user_sub) {
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".owner", user_sub)
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".data", out_buff.Bytes())
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".time", ts)
      }
    }

    out["done"] = 1

  } else if action == "save_map" {
    var req_site string
    var req_proj string
    var save_json string
    var req_file_key string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if save_json, err = get_p_string(q, "save_data", ".+"); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }

    var save_data M
    if err = json.Unmarshal([]byte(save_json), &save_data); err != nil { panic(err) }

    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
    map_hash_key_time := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".time"

    var map_m M

    map_m = M{
      "tps": M{},
      "loc": M{},
      "colors": M{},
      "options": M{},
    }

    for map_key, _ := range map_m {
      if save_data[map_key] != nil {
        map_m[map_key] = save_data[map_key]
      }
    }

    var out_buff bytes.Buffer
    enc := gob.NewEncoder(&out_buff)
    if err = enc.Encode(map_m); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_time, ts); err != nil { panic(err) }

    if req_file_key == "" {
      def_owner, err := redis.String(red.Do("HGET", "maps", "default_" + req_site+"_"+req_proj+".owner"))
      if err == redis.ErrNil || (err == nil && def_owner == user_sub) {
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".owner", user_sub)
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".data", out_buff.Bytes())
        red.Do("HSET", "maps", "default_" + req_site+"_"+req_proj+".time", ts)
      }
    }

    out["done"] = 1

  } else if action == "del_map" {
    var req_site string
    var req_proj string
    var req_file_key string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }


    map_hash_key_prefix := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+"."
    map_hash_key_shared := map_hash_key_prefix+"shared"

    var map_keys []string
    if map_keys, err = RedHKeys(red, "maps", map_hash_key_prefix); err != nil { panic(err) }

    var shared_key string
    if shared_key, err = redis.String(red.Do("HGET", "maps", map_hash_key_shared));
    err != nil && err != redis.ErrNil {
      panic(err)
    }

    if err == nil {
      map_keys = append(map_keys, "shared." + shared_key)
    }

    for _, key := range map_keys {
      if _, err = red.Do("HDEL", "maps", key); err != nil { panic(err) }
    }

    if req_file_key == "" {
      def_owner, err := redis.String(red.Do("HGET", "maps", "default_" + req_site+"_"+req_proj+".owner"))
      if err == nil && def_owner == user_sub {
        red.Do("HDEL", "maps", "default_" + req_site+"_"+req_proj+".owner")
        red.Do("HDEL", "maps", "default_" + req_site+"_"+req_proj+".data")
        red.Do("HDEL", "maps", "default_" + req_site+"_"+req_proj+".time")
      }
    }

    out["done"] = 1

  } else if action == "new_map" {
    var req_site string
    var req_proj string
    var save_json string
    var map_name string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if save_json, err = get_p_string(q, "map_data", ".+"); err != nil { panic(err) }
    if map_name, err = get_p_string(q, "map_name", nil); err != nil { panic(err) }

    var save_data M
    if err = json.Unmarshal([]byte(save_json), &save_data); err != nil { panic(err) }

    var req_file_key = KeyGen(10)
    map_hash_key_data := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"

    safeguard := 0

    for {
      var redint int
      if redint, err = redis.Int(red.Do("HSETNX", "maps", map_hash_key_data, "")); err != nil { panic(err) }
      if redint == 0 {
        req_file_key = KeyGen(10)
        map_hash_key_data = user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+".data"
      } else {
        break
      }
      safeguard++
      if safeguard > 100 {
        panic("new_map key safeguard!")
      }
    }

    map_hash_key_prefix := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+"."

    var map_m M

    map_m = M{
      "tps": M{},
      "loc": M{},
      "colors": M{},
      "options": M{},
    }

    for map_key, _ := range map_m {
      if save_data[map_key] != nil {
        map_m[map_key] = save_data[map_key]
      }
    }

    var out_buff bytes.Buffer
    enc := gob.NewEncoder(&out_buff)
    if err = enc.Encode(map_m); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_data, out_buff.Bytes()); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_prefix+"time", ts); err != nil { panic(err) }
    if _, err = red.Do("HSET", "maps", map_hash_key_prefix+"name", map_name); err != nil { panic(err) }

    out_file := M{
      "file_key": req_file_key,
      "name": map_name,
      "time": ts,
    }
    out["file"] = out_file
    out["done"] = 1

  } else if action == "rename_map" {
    var req_site string
    var req_proj string
    var req_file_key string
    var new_name string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }
    if new_name, err = get_p_string(q, "name", "\\w"); err != nil { panic(err) }

    map_hash_key_prefix := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+"."

    _, err = red.Do("HGET", "maps", map_hash_key_prefix+"name")
    if err == nil {
      if _, err = red.Do("HSET", "maps", map_hash_key_prefix+"name", new_name); err != nil { panic(err) }
    }

  } else if action == "share_map" {
    var req_site string
    var req_proj string
    var req_file_key string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }

    shared_file := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key
    share_data := M{
      "site": req_site,
      "proj": req_proj,
      "file": shared_file,
    }

    var share_json []byte
    if share_json, err = json.Marshal(share_data); err != nil { panic(err) }


    var share_key = KeyGen(10)
    shared_map_key := "shared."+share_key

    safeguard := 0

    for {
      var redint int
      if redint, err = redis.Int(red.Do("HSETNX", "maps", shared_map_key, share_json));
      err != nil { panic(err) }

      if redint == 0 {
        share_key = KeyGen(10)
        shared_map_key = "shared."+share_key
      } else {
        break
      }
      safeguard++
      if safeguard > 100 {
        panic("shared_map key key safeguard!")
      }
    }

    red.Do("HSET", "maps", shared_file+".shared", share_key)

    out["key"] = share_key

  } else if action == "unshare_map" {
    var req_site string
    var req_proj string
    var req_file_key string

    if req_site, err = get_p_string(q, "site", g_site_reg); err != nil { panic(err) }
    if req_proj, err = get_p_string(q, "proj", g_proj_reg); err != nil { panic(err) }
    if req_file_key, err = get_p_string(q, "file_key", g_file_key_reg); err != nil { panic(err) }


    map_hash_key_prefix := user_sub+"_"+req_site+"_"+req_proj+"."+req_file_key+"."
    map_hash_key_shared := map_hash_key_prefix+"shared"

    var shared_key string
    if shared_key, err = redis.String(red.Do("HGET", "maps", map_hash_key_shared)); err != nil {
      panic(err)
    }

    if _, err = red.Do("HDEL", "maps", map_hash_key_shared); err != nil { panic(err) }
    if _, err = red.Do("HDEL", "maps", "shared."+shared_key); err != nil { panic(err) }

    out["done"] = 1

  } else if action == "list_maps" {
    var keys []string
    ret := []M{}

    if keys, err = redis.Strings(red.Do("HKEYS", "maps")); err != nil && err != redis.ErrNil { panic(err) }
    if err == nil {
      for _, key := range keys {
        if strings.HasPrefix(key, user_sub + "_") &&
           (strings.HasSuffix(key, ".name") || strings.HasSuffix(key, "..data")) &&
        true {
          a := g_file_list_reg.FindStringSubmatch(key)
          if a != nil {
            file_site := a[1]
            file_proj := a[2]
            file_key := a[3]
            ext := a[4]
            var file_name string
            if file_key != "" && ext == "name" {
              file_name, err = redis.String(red.Do("HGET", "maps", key))
              if err != nil { panic(err) }
            }
            ret = append(ret, M{
              "site": file_site,
              "proj": file_proj,
              "file_name": file_name,
              "file_key": file_key,
            })
          }
        }
      }
    }

    out["list"] = ret

  } else if action == "data" {
    globalMutex.RLock()
    defer globalMutex.RUnlock()

    out["data"] = data
    out["refs"] = dev_refs
    out["macs"]=devs_macs
    out["arp"]=devs_arp
    out["net2site"] = net2site
    out["pref_ips"] = g_pref_ips

  } else if action == "get_device" {
    var dev_id string

    if dev_id, err = get_p_string(q, "dev_id", nil); err != nil { panic(err) }

    if g_vdev_id_reg.MatchString(dev_id) {
      var vdev_json string
      if vdev_json, err = redis.String(red.Do("HGET", "vdevs", dev_id)); err == redis.ErrNil {
        out["fail"] = "no_data"
      } else if err == nil {
        var vdev M
        if err = json.Unmarshal([]byte(vdev_json), &vdev); err != nil { panic(err) }
        vdev["last_seen"] = time.Now().Unix()
        out["dev"] = vdev
      } else {
        panic(err)
      }
    } else {

      globalMutex.RLock()

      if !devs.EvM(dev_id) {
        out["fail"] = "no_data"
      } else {
        out["dev"] = devs.VM(dev_id).Copy()

        for ifName, _ := range devs_macs.VM(dev_id) {
          if out.EvM("dev", "interfaces", ifName) {
            out.VM("dev", "interfaces", ifName)["macs"] = devs_macs.VM(dev_id, ifName).Copy()
          }
        }
        for ifName, _ := range devs_arp.VM(dev_id) {
          if out.EvM("dev", "interfaces", ifName) {
            out.VM("dev", "interfaces", ifName)["arp"] = devs_arp.VM(dev_id, ifName).Copy()
          }
        }

        dev := out.VM("dev")

        dev_ips := make([]string, 0)
        dev_nets := make([]string, 0)

        for ifName, _ := range dev.VM("interfaces") {
          if ifas, var_ok := dev.Vie("interfaces", ifName, "ifAdminStatus"); var_ok && ifas == 1 {
            for ip, ipdata_h := range dev.VM("interfaces", ifName, "ips") {
              if !strings.HasPrefix(ip, "127.") {
                dev_ips = append(dev_ips, ip)
                dev_nets = append(dev_nets, ipdata_h.(M)["net"].(string))
                masklen := ipdata_h.(M).Vu("masklen")
                if masklen == 32 {
                  if ip_long, var_ok := V4ip2long(ip); !var_ok {
                    panic("bad ip: " + ip)
                  } else {
                    for m := uint32(31); m > 0; m -- {
                      net := fmt.Sprintf("%s/%d", V4long2ip(Ip4net(ip_long, m)), m)
                      dev_nets = append(dev_nets, net)
                    }
                  }
                }
              }
            }
          }
        }

        dev_sites := []M{}

        for _, ip := range dev_ips {
          if tag_id, ex := ip2site[ip]; ex {
            dev_sites = append(dev_sites, M{ "site": tag_id, "by": ip })
          }
          ip_long, _ := V4ip2long(ip)
          for net, _ := range net2site {
            first := net2site.Vu(net, "first")
            last := net2site.Vu(net, "last")
            if first != UINT64_ERR && last != UINT64_ERR &&
               uint64(ip_long) >= first && uint64(ip_long) <= last &&
            true {
              dev_sites = append(dev_sites, M{ "site": net2site.Vs(net, "tag_id"), "by": net })
            }
          }
        }

        for _, net := range dev_nets {
          if net2site.EvM(net) {
            dev_sites = append(dev_sites, M{ "site": net2site.Vs(net, "tag_id"), "by": net })
          }
        }

        if len(dev_sites) > 0 {
          out.VM("dev")["sites"] = dev_sites
        }

        dev_projects := []M{}

        for _, ip := range dev_ips {
          if tag_ids, ex := ip2projects[ip]; ex {
            for _, tag_id := range tag_ids {
              dev_projects = append(dev_projects, M{ "proj": tag_id, "by": ip })
            }
          }
        }

        for _, net := range dev_nets {
          if tag_ids, ex := net2projects[net]; ex {
            for _, tag_id := range tag_ids {
              dev_projects = append(dev_projects, M{ "proj": tag_id, "by": net })
            }
          }
        }

        if len(dev_projects) > 0 {
          out.VM("dev")["projects"] = dev_projects
        }

      }
      globalMutex.RUnlock()
    }

    var vlinks_map map[string]string

    vlinks_map, err = redis.StringMap(red.Do("HGETALL", "vlinks"))
    if err == redis.ErrNil {
      //ignore
    } else if err != nil {
      panic(err)
    } else {
      for vlink_id, vlink_data := range vlinks_map {
        var vlink M
        if err = json.Unmarshal([]byte(vlink_data), &vlink); err != nil { panic(err) }
        if vlink.Vs("0", "DevId") == dev_id && out.EvM("dev", "interfaces", vlink.Vs("0", "ifName")) {
          list := []string{}
          if out.EvA("dev", "interfaces", vlink.Vs("0", "ifName"), "l2_links") {
            list = out.VA("dev", "interfaces", vlink.Vs("0", "ifName"), "l2_links").([]string)
          }
          list = StrAppendOnce(list, vlink_id)
          out.VM("dev", "interfaces", vlink.Vs("0", "ifName"))["l2_links"] = list
        }
        if vlink.Vs("1", "DevId") == dev_id && out.EvM("dev", "interfaces", vlink.Vs("1", "ifName")) {
          list := []string{}
          if out.EvA("dev", "interfaces", vlink.Vs("1", "ifName"), "l2_links") {
            list = out.VA("dev", "interfaces", vlink.Vs("1", "ifName"), "l2_links").([]string)
          }
          list = StrAppendOnce(list, vlink_id)
          out.VM("dev", "interfaces", vlink.Vs("1", "ifName"))["l2_links"] = list
        }
      }
    }

    config_filename := opt_C + "/" + out.Vs("dev", "short_name") + ".config"

    if stat, err := os.Stat(config_filename); err == nil && !stat.IsDir() {
      if file_data, err := os.ReadFile(config_filename); err == nil {
        out.VM("dev")["config"] = strings.ReplaceAll(string(file_data), "\r", "")
      }
    }

  } else if action == "mac_vendor" {
    var mac_str string
    if mac_str, err = get_p_string(q, "mac", nil); err != nil { panic(err) }
    a := g_mac_oui_reg.FindStringSubmatch(mac_str)
    if a == nil { panic("Bad mac") }
    oui := strings.ToLower(a[1]+a[2]+a[3]+a[4]+a[5]+a[6])

    corp, err := redis.String(red.Do("HGET", "oui", oui))

    if err == redis.ErrNil {
      out["not_found"] = 1
    } else if err != nil {
      panic(err)
    } else {
      out["corp"] = corp
    }
  } else if action == "ip_info" {
    var ip string
    if ip, err = get_p_string(q, "ip", nil); err != nil { panic(err) }

    if out, err = ip_info(ip, red, 500*time.Millisecond, false); err != nil { panic(err) }

  } else if action == "mac_info" {
    var mac string
    if mac, err = get_p_string(q, "mac", nil); err != nil { panic(err) }

    if out, err = mac_info(mac, red); err != nil { panic(err) }

  } else if action == "search" {
    var search_for string
    if search_for, err = get_p_string(q, "for", nil); err != nil { panic(err) }

    if out, err = search(search_for, q, red, 2*time.Second); err != nil { panic(err) }

  } else if action == "save_vdev" {
    var vdev_id string
    if vdev_id, err = get_p_string(q, "vdev_id", g_vdev_id_reg); err != nil { panic(err) }

    var vdev_json string
    if vdev_json, err = get_p_string(q, "vdev_json", nil); err != nil { panic(err) }
    if !strings.HasPrefix(vdev_json, "{") { panic("Not JSON") }

    var vdev M
    if err = json.Unmarshal([]byte(vdev_json), &vdev); err != nil { panic(err) }
    if !g_num_reg.MatchString(vdev.Vs("site")) { panic("Bad vdev site") }

    if _, err = red.Do("HSET", "vdevs", vdev_id, vdev_json); err != nil { panic(err) }

    var vlinks_map map[string]string
    vlinks_map, err = redis.StringMap(red.Do("HGETALL", "vlinks"))
    if err == nil {
      for vlink_id, vlink_data := range vlinks_map {
        var vlink M
        if err = json.Unmarshal([]byte(vlink_data), &vlink); err != nil { panic(err) }

        if (vlink.Vs("0", "DevId") == vdev_id &&
            !vdev.EvM("interfaces", vlink.Vs("0", "ifName") )) ||
           (vlink.Vs("1", "DevId") == vdev_id &&
            !vdev.EvM("interfaces", vlink.Vs("1", "ifName") )) ||
        false {
          if _, err = red.Do("HDEL", "vlinks", vlink_id); err != nil { panic(err) }
        }
      }
    } else if err != redis.ErrNil {
      panic(err)
    }

    out["done"] = 1

  } else if action == "del_vdev" {
    var vdev_id string
    if vdev_id, err = get_p_string(q, "vdev_id", g_vdev_id_reg); err != nil { panic(err) }

    if _, err = red.Do("HDEL", "vdevs", vdev_id); err != nil { panic(err) }

    var vlinks_map map[string]string
    vlinks_map, err = redis.StringMap(red.Do("HGETALL", "vlinks"))
    if err == nil {
      for vlink_id, vlink_data := range vlinks_map {
        var vlink M
        if err = json.Unmarshal([]byte(vlink_data), &vlink); err != nil { panic(err) }

        if vlink.Vs("0", "DevId") == vdev_id ||
           vlink.Vs("1", "DevId") == vdev_id ||
        false {
          if _, err = red.Do("HDEL", "vlinks", vlink_id); err != nil { panic(err) }
        }
      }
    } else if err != redis.ErrNil {
      panic(err)
    }

    out["done"] = 1

  } else if action == "save_vlink" {
    var vlink_id string
    if vlink_id, err = get_p_string(q, "vlink_id", nil); err != nil { panic(err) }

    var vlink_json string
    if vlink_json, err = get_p_string(q, "vlink_json", nil); err != nil { panic(err) }
    if !strings.HasPrefix(vlink_json, "{") { panic("Not JSON") }

    if !json.Valid([]byte(vlink_json)) { panic("Bad JSON") }

    if _, err = red.Do("HSET", "vlinks", vlink_id, vlink_json); err != nil { panic(err) }


  } else if action == "del_vlink" {
    var vlink_id string
    if vlink_id, err = get_p_string(q, "vlink_id", nil); err != nil { panic(err) }

    if _, err = red.Do("HDEL", "vlinks", vlink_id); err != nil { panic(err) }

    out["done"] = 1

  } else if action == "wipe_dev" {
    //TODO add access check
    var dev_id string

    if dev_id, err = get_p_string(q, "dev_id", g_dev_id_reg); err != nil { panic(err) }
    globalMutex.Lock()
    defer globalMutex.Unlock()

    var data_ip string
    if data_ip, var_ok = devs.Vse(dev_id, "data_ip"); var_ok {
      red.Do("HDEL", "devs_list", data_ip)
    }

    wipe_dev(dev_id)

    out["done"] = 1

  } else if action == "dev_events" {
    var dev_id string
    if dev_id, err = get_p_string(q, "dev_id", nil); err != nil { panic(err) }

    if out["events"], err = redis.Strings(red.Do("LRANGE", "log." + dev_id, "0", "-1")); err != nil { panic(err) }

  } else if action == "query" {
    out["_query"] = q
    goto OUT
  } else {
    panic("unknown action: "+action)
  }

OUT:

pre_marshal := time.Now()

  ok_out := make(M)
  ok_out["ok"] = out

  w.Header().Set("X-Debug-Proc-Duration", fmt.Sprint(time.Now().Sub(pre_proc_time).Abs()) )

  jenc := json.NewEncoder(w)

  w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
  w.Header().Set("Cache-Control", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")

  w.Header().Set("X-Debug-Marshal-Duration", fmt.Sprint(time.Now().Sub(pre_marshal).Abs()) )
  w.WriteHeader(http.StatusOK)

  err = jenc.Encode(ok_out)
  if err != nil {
    panic(err)
  }
}
