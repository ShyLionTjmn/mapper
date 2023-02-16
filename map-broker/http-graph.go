package main

import (
  "fmt"
  "time"
  "regexp"
  "strings"
  "os"
  "os/exec"
  "io"
  "net/http"
  "runtime/debug"
  "sort"
  "encoding/json"

  . "github.com/ShyLionTjmn/mapper/mapaux"

)

//graph
const RRD_ROOT="/var/lib/rrdcached/db/mapper"
const RRD_SOCKET = "/var/run/rrdcached.sock"
const RRD_TOOL = "/usr/bin/rrdtool"
const PNG_CACHE = "/var/mapper/png_cache"

var cpu_colors = [...]string{"#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#888888"}

var g_graph_start_reg *regexp.Regexp
var g_graph_integer_reg *regexp.Regexp
var g_graph_dev_id_reg *regexp.Regexp
var g_graph_if_name_reg *regexp.Regexp
var g_graph_cpu_name_reg *regexp.Regexp
var g_graph_file_reg *regexp.Regexp

var g_graph_json_graph_left_reg *regexp.Regexp
var g_graph_json_graph_top_reg *regexp.Regexp
var g_graph_json_graph_width_reg *regexp.Regexp
var g_graph_json_graph_height_reg *regexp.Regexp
var g_graph_json_image_width_reg *regexp.Regexp
var g_graph_json_image_height_reg *regexp.Regexp
var g_graph_json_start_reg *regexp.Regexp
var g_graph_json_end_reg *regexp.Regexp

func init() {
  g_graph_start_reg = regexp.MustCompile(`^[0-9+\-a-zA-Z \:\.\/]+$`)
  g_graph_integer_reg = regexp.MustCompile(`^-?\d+$`)
  g_graph_dev_id_reg = regexp.MustCompile(`^[a-zA-Z0-9\.\-_]+$`)
  g_graph_if_name_reg = regexp.MustCompile(`^[a-zA-Z0-9\.\-_]+$`)
  g_graph_cpu_name_reg = regexp.MustCompile(`^[a-z0-9 \/.,;:\-]+$`)
  g_graph_file_reg = regexp.MustCompile(`^[a-zA-Z0-9 .,:\-_]+\.png$`)

  g_graph_json_graph_left_reg = regexp.MustCompile(`^graph_left = (\d+)$`)
  g_graph_json_graph_top_reg = regexp.MustCompile(`^graph_top = (\d+)$`)
  g_graph_json_graph_width_reg = regexp.MustCompile(`^graph_width = (\d+)$`)
  g_graph_json_graph_height_reg = regexp.MustCompile(`^graph_height = (\d+)$`)
  g_graph_json_image_width_reg = regexp.MustCompile(`^image_width = (\d+)$`)
  g_graph_json_image_height_reg = regexp.MustCompile(`^image_height = (\d+)$`)
  g_graph_json_start_reg = regexp.MustCompile(`^graph_start = (\d+)$`)
  g_graph_json_end_reg = regexp.MustCompile(`^graph_end = (\d+)$`)
}

func handle_graph_error(dbg bool, r interface{}, w http.ResponseWriter, req *http.Request) {
  if r == nil {
    return
  }

  w.Header().Set("Cache-Control", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")

  var err_text string
  var err_image string = "error"

  switch v := r.(type) {
  case string:
    err_text = v + "\n\n" + string(debug.Stack())
    err_image = v
  case error:
    err_text = v.Error() + "\n\n" + string(debug.Stack())
  default:
    err_text = "Unknown error\n\n" + string(debug.Stack())
  }

  if dbg {
    w.WriteHeader(http.StatusOK)
    w.Header().Set("Content-Type", "text/plain; charset=UTF-8")
    w.Write([]byte(err_text + "\n"))
  } else {
    for _, errstr := range strings.Split(err_text, "\n") {
      w.Header().Add("X-Debug", errstr)
    }
    var err error
    var f *os.File

    if f, err = os.Open(opt_w + "/error_pngs/"+err_image+".png"); err != nil {
      if f, err = os.Open(opt_w + "/error_pngs/error.png"); err != nil {
        w.Header().Set("X-Error", "Can not open "+opt_w + "/error_pngs/error.png file")
        w.WriteHeader(http.StatusInternalServerError)
        return
      }
    }
    defer f.Close()

    w.WriteHeader(http.StatusOK)
    w.Header().Set("Content-Type", "image/png")

    io.Copy(w, f)
  }
  return
}
func handleGraph(w http.ResponseWriter, req *http.Request) {

  if req.Method == "OPTIONS" {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "*")
    w.Header().Set("Access-Control-Allow-Headers", "*")
    w.WriteHeader(http.StatusOK)
    return
  }

  w.Header().Set("Cache-Control", "no-cache, must-revalidate")
  w.Header().Set("Pragma", "no-cache")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.Header().Set("Access-Control-Allow-Methods", "*")
  w.Header().Set("Access-Control-Allow-Headers", "*")


  pre_proc_time := time.Now()
  //fmt.Println(whereami.WhereAmI())

  var dbg bool = false

  defer func() { handle_graph_error(dbg, recover(), w, req); } ()

  var err error
  _ = err

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
  } else if req.Method == "POST" {
    jdec := json.NewDecoder( req.Body )
    err = jdec.Decode(&q)
    if err != nil { panic(err) }
  } else {
    panic("Unsupported method: " + req.Method)
  }

  if q["debug"] != nil {
    dbg = true
  }

  //ts := time.Now().Unix()

  var u64 uint64 //general use var for typecasting
  _ = u64

  var user_sub string
  var user_groups_string string

  for header, header_values := range req.Header {
    if strings.ToLower(header) == "x-idp-sub" && len(header_values) > 0 {
      user_sub = strings.TrimSpace(header_values[0])
    } else if strings.ToLower(header) == "x-idp-groups" && len(header_values) > 0 {
      user_groups_string = strings.TrimSpace(header_values[0])
    }
  }

  user_is_admin := false

  if user_sub == "" {
    // TODO turn back on
    panic("no_auth")
  }

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
  _ = user_is_admin

  //if !user_is_admin { //TODO implement group features
  //  panic("no_access")
  //}

  var var_ok bool
  _ = var_ok

  if q["file"] != nil {
    var filename string
    if filename, err = get_p_string(q, "file", g_graph_file_reg); err != nil { panic(err) }

    var f *os.File
    if f, err = os.Open(PNG_CACHE + "/" + filename); err != nil { panic(err) }
    defer f.Close()

    w.WriteHeader(http.StatusOK)
    w.Header().Set("Content-Type", "image/png")
    io.Copy(w, f)

    return
  }

  var cache_off bool
  if q["no_cache"] != nil {
    cache_off = true
  }

  comp := false
  width := "400"
  height := "100"

  cmd := []string{"graphv", "PNG_PLACE_HOLDER", "--daemon", RRD_SOCKET, "--slope-mode"}


  png_end := ""

  if val, var_ok := q.Vse("start"); var_ok && g_graph_start_reg.MatchString(val) {
    cmd = append(cmd, "--start", val)
    png_end += "_start_" + val
  } else {
    cmd = append(cmd, "--start", "end-1h")
  }

  if val, var_ok := q.Vse("end"); var_ok && g_graph_start_reg.MatchString(val) {
    cmd = append(cmd, "--end", val)
    png_end += "_end_" + val
  } else {
    cmd = append(cmd, "--end", "now-1min")
  }

  if val, var_ok := q.Vse("max"); var_ok && g_graph_integer_reg.MatchString(val) {
    cmd = append(cmd, "--upper-limit", val)
    png_end += "_max_" + val
  }

  if val, var_ok := q.Vse("min"); var_ok && g_graph_integer_reg.MatchString(val) {
    cmd = append(cmd, "--lower-limit", val)
    png_end += "_min_" + val
  }

  if q["compact"] != nil && q["small"] == nil {
    comp = true
    png_end += "_compact"
  }

  if q["small"]  != nil {
    width = "60"
    height = "30"

    cmd = append(cmd, "--only-graph")
    png_end += "_small"
  }

  exact := "%s"

  if q["exact"] != nil  {
    exact = ""
    png_end += "_exact"
  }

  if val, var_ok := q.Vse("width"); var_ok && g_num_reg.MatchString(val) {
    width = val
  }

  if val, var_ok := q.Vse("height"); var_ok && g_num_reg.MatchString(val) {
    height = val
  }

  cmd = append(cmd, "-w", width)
  cmd = append(cmd, "-h", height)

  png_end += "_"+ width + "x" + height

  var dev_id string
  var gtype string

  if val, var_ok := q.Vse("type"); !var_ok {
    panic("no_type")
  } else {
    gtype = val
  }

  if val, var_ok := q.Vse("dev_id"); !var_ok || !g_graph_dev_id_reg.MatchString(val) {
    panic("bad_dev_id")
  } else {
    dev_id = val
  }

  var safe_int string

  if gtype == "int_io" || gtype == "int_pkts" || gtype == "opt_power" {
    if val, var_ok := q.Vse("int"); !var_ok || !g_graph_if_name_reg.MatchString(val) {
      panic("bad_if_name")
    } else {
      safe_int = val
    }
  }

  var cpu_list []string

  if gtype == "cpu" {
    if val, var_ok := q.Vse("cpu_list"); !var_ok || !g_num_list_reg.MatchString(val) {
      panic("bad_cpu_list")
    } else {
      cpu_list = strings.Split(val, ",")
      sort.Sort(StrByNum(cpu_list))
    }
    for _, cpu_index := range cpu_list {
      if val, var_ok := q.Vse("cpu_name"+cpu_index); !var_ok || !g_graph_cpu_name_reg.MatchString(val) {
        panic("bad_cpu"+cpu_index+"_name")
      }

    }
    cmd = append(cmd, "-c", "CANVAS#88FF88")
  }

  total := 0

  time_src := ""

  rrd_root := RRD_ROOT + "/"
  png_cache := PNG_CACHE + "/"

  png := ""
  json_png := ""

  if gtype == "int_io" {
    json_png = dev_id + "." + safe_int + "." + gtype + png_end + ".png"
    png = png_cache + dev_id + "." + safe_int + "." + gtype + png_end + ".png"
    rrds := rrd_root + dev_id + "/" + safe_int + "."

    rrd := rrds + "ifOperStatus.rrd"

    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      cmd = append(cmd, "DEF:os=" + rrd + ":os:MAX")
      cmd = append(cmd, "CDEF:opers=os,1,EQ,INF,0,IF")
      cmd = append(cmd, "CDEF:downs=os,1,GT,INF,0,IF")
      cmd = append(cmd, "CDEF:unkns=os,UN,INF,0,IF")
      if !comp {
        cmd = append(cmd, "AREA:opers#CCFFCC:Up ")
        cmd = append(cmd, "AREA:downs#EFBBBB:Down\\n")
        cmd = append(cmd, "AREA:unkns#BBBBBB:")
      } else {
        cmd = append(cmd, "AREA:opers#CCFFCC:")
        cmd = append(cmd, "AREA:downs#EFBBBB:")
        cmd = append(cmd, "AREA:unkns#BBBBBB:")
      }
      if time_src == "" {
        time_src = "os"
      }
    }

    table := []string{}

    rrd = rrds + "ifHCInOctets.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:in=" + rrd + ":in:AVERAGE")
      table = append(table, "CDEF:inBits=in,8,*")
      if !comp {
        table = append(table, "AREA:inBits#33FF33:In\\t")
        table = append(table, "LINE:inBits#009900:")
        table = append(table, "VDEF:inmin=inBits,MINIMUM")
        table = append(table, "VDEF:inavg=inBits,AVERAGE")
        table = append(table, "VDEF:inmax=inBits,MAXIMUM")
        table = append(table, "VDEF:inlast=inBits,LAST")
        table = append(table, "GPRINT:inmin:%.1lf" + exact + "\\t")
        table = append(table, "GPRINT:inavg:%.1lf" + exact + "\\t")
        table = append(table, "GPRINT:inmax:%.1lf" + exact + "\\t")
        table = append(table, "GPRINT:inlast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "AREA:inBits#33FF33:In")
        table = append(table, "LINE:inBits#009900:")
      }

      if time_src == "" {
        time_src = "in"
      }
    }

    rrd = rrds + "ifHCOutOctets.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      table = append(table, "DEF:out=" + rrd + ":out:AVERAGE")
      table = append(table, "CDEF:outBits=out,8,*")
      if !comp {
        table = append(table, "LINE:outBits#0000FF:Out\\t")
        table = append(table, "VDEF:outmin=outBits,MINIMUM")
        table = append(table, "GPRINT:outmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outavg=outBits,AVERAGE")
        table = append(table, "GPRINT:outavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outmax=outBits,MAXIMUM")
        table = append(table, "GPRINT:outmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outlast=outBits,LAST")
        table = append(table, "GPRINT:outlast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:outBits#0000FF:Out")
      }

      if time_src == "" {
        time_src = "out"
      }
    }

    if len(table) > 0 {
      if !comp {
        cmd = append(cmd, "COMMENT:Bit/s      Min       Avg        Max       Last\\n")
      } else {
        cmd = append(cmd, "COMMENT:Bit/s")
      }
      cmd = append(cmd, table...)
    }

    rrd = rrds + "ifInErrors.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      cmd = append(cmd, "DEF:inerr=" + rrd + ":inerr:AVERAGE")
      cmd = append(cmd, "CDEF:ie=inerr,UN,0,inerr,IF,0,GT,INF,0,IF")
      if !comp {
        cmd = append(cmd, "AREA:ie#FF000080:In err\\n")
          //$cmd = append(cmd, "VDEF:iefirst=inerr,FIRST")
          //$cmd = append(cmd, "VDEF:ielast=inerr,LAST")
          //$cmd = append(cmd, "GPRINT:iefirst:First\\:%.0lf\\t")
          //$cmd = append(cmd, "GPRINT:ielast:Last\\:%.0lf\\n")
      } else {
        cmd = append(cmd, "AREA:ie#FF000080:In err")
      }

      if time_src == "" {
        time_src = "inerr"
      }
    }

    rrd = rrds + "ifInCRCErrors.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      cmd = append(cmd, "DEF:incrc=" + rrd + ":incrc:AVERAGE")
      cmd = append(cmd, "CDEF:ic=incrc,UN,0,incrc,IF,0,GT,INF,0,IF")
      if !comp {
        cmd = append(cmd, "AREA:ic#EEEE0080:In CRC err\\n")
      } else {
        cmd = append(cmd, "AREA:ic#EEEE0080:In CRC err")
      }

      if time_src == "" {
        time_src = "incrc"
      }
    }

  } else if gtype == "int_pkts" {
    json_png = dev_id + "." + safe_int + "." + gtype + png_end + ".png"
    png = png_cache + dev_id + "." + safe_int + "." + gtype + png_end + ".png"
    rrds := rrd_root + dev_id + "/" + safe_int + "."

    rrd := rrds + "ifOperStatus.rrd"

    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      cmd = append(cmd, "DEF:os=" + rrd + ":os:MAX")
      cmd = append(cmd, "CDEF:opers=os,1,EQ,INF,0,IF")
      cmd = append(cmd, "CDEF:downs=os,1,GT,INF,0,IF")
      cmd = append(cmd, "CDEF:unkns=os,UN,INF,0,IF")
      if !comp {
        cmd = append(cmd, "AREA:opers#CCFFCC:Up ")
        cmd = append(cmd, "AREA:downs#EFBBBB:Down\\n")
        cmd = append(cmd, "AREA:unkns#BBBBBB:")
      } else {
        cmd = append(cmd, "AREA:opers#CCFFCC:")
        cmd = append(cmd, "AREA:downs#EFBBBB:")
        cmd = append(cmd, "AREA:unkns#BBBBBB:")
      }

      if time_src == "" {
        time_src = "os"
      }
    }

    table := []string{}
    // unicast
    rrd = rrds + "ifInUnicastPkts.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      table = append(table, "DEF:inucst=" + rrd + ":inucst:AVERAGE")

      if !comp {
        table = append(table, "AREA:inucst#33FF33:In Ucast\\t")
        table = append(table, "LINE:inucst#009900:")
        table = append(table, "VDEF:inumin=inucst,MINIMUM")
        table = append(table, "GPRINT:inumin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inuavg=inucst,AVERAGE")
        table = append(table, "GPRINT:inuavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inumax=inucst,MAXIMUM")
        table = append(table, "GPRINT:inumax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inulast=inucst,LAST")
        table = append(table, "GPRINT:inulast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "AREA:inucst#33FF33:InU")
        table = append(table, "LINE:inucst#009900:")
      }

      if time_src == "" {
        time_src = "inucst"
      }
    }

    rrd = rrds + "ifOutUnicastPkts.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:outucst=" + rrd + ":outucst:AVERAGE")
      if !comp {
        table = append(table, "LINE:outucst#0000FF:Out Ucast\\t")
        table = append(table, "VDEF:outumin=outucst,MINIMUM")
        table = append(table, "GPRINT:outumin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outuavg=outucst,AVERAGE")
        table = append(table, "GPRINT:outuavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outumax=outucst,MAXIMUM")
        table = append(table, "GPRINT:outumax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outulast=outucst,LAST")
        table = append(table, "GPRINT:outulast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:outucst#0000FF:OutU")
      }

      if time_src == "" {
        time_src = "outucst"
      }
    }

    // multicast
    rrd = rrds + "ifInMulticastPkts.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:inmcst=" + rrd + ":inmcst:AVERAGE")
      if !comp {
        table = append(table, "LINE:inmcst#CC33FF:In Mcast\\t")
        table = append(table, "VDEF:inmmin=inmcst,MINIMUM")
        table = append(table, "GPRINT:inmmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inmavg=inmcst,AVERAGE")
        table = append(table, "GPRINT:inmavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inmmax=inmcst,MAXIMUM")
        table = append(table, "GPRINT:inmmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inmlast=inmcst,LAST")
        table = append(table, "GPRINT:inmlast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:inmcst#CC33FF:InM")
      }


      if time_src == "" {
        time_src = "inmcst"
      }
    }

    rrd = rrds + "ifOutMulticastPkts.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:outmcst=" + rrd + ":outmcst:AVERAGE")
      if !comp {
        table = append(table, "LINE:outmcst#B88A00:Out Mcast\\t")
        table = append(table, "VDEF:outmmin=outmcst,MINIMUM")
        table = append(table, "GPRINT:outmmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outmavg=outmcst,AVERAGE")
        table = append(table, "GPRINT:outmavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outmmax=outmcst,MAXIMUM")
        table = append(table, "GPRINT:outmmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outmlast=outmcst,LAST")
        table = append(table, "GPRINT:outmlast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:outmcst#B88A00:OutM")
      }

      if time_src == "" {
        time_src = "outmcst"
      }
    }

    // broadcast
    rrd = rrds + "ifInBroadcastPkts.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:inbcst=" + rrd + ":inbcst:AVERAGE")
      if !comp {
        table = append(table, "LINE:inbcst#FF0000:In Bcast\\t")
        table = append(table, "VDEF:inbmin=inbcst,MINIMUM")
        table = append(table, "GPRINT:inbmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inbavg=inbcst,AVERAGE")
        table = append(table, "GPRINT:inbavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inbmax=inbcst,MAXIMUM")
        table = append(table, "GPRINT:inbmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:inblast=inbcst,LAST")
        table = append(table, "GPRINT:inblast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:inbcst#FF0000:InB")
      }

      if time_src == "" {
        time_src = "inbcst"
      }
    }

    rrd = rrds + "ifOutBroadcastPkts.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:outbcst=" + rrd + ":outbcst:AVERAGE")
      if !comp {
        table = append(table, "LINE:outbcst#FFFF00:Out Bcast\\t")
        table = append(table, "VDEF:outbmin=outbcst,MINIMUM")
        table = append(table, "GPRINT:outbmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outbavg=outbcst,AVERAGE")
        table = append(table, "GPRINT:outbavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outbmax=outbcst,MAXIMUM")
        table = append(table, "GPRINT:outbmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:outblast=outbcst,LAST")
        table = append(table, "GPRINT:outblast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:outbcst#FF8800:OutB")
      }

      if time_src == "" {
        time_src = "outbcst"
      }
    }

    if len(table) > 0 {
      if !comp {
        cmd = append(cmd, "COMMENT:Pkts/s             Min       Avg        Max       Last\\n")
      } else {
        cmd = append(cmd, "COMMENT:Pkts/s")
      }
      cmd = append(cmd, table...)
    }


  } else if gtype == "opt_power" {
    json_png = dev_id + "." + safe_int + "." + gtype + png_end + ".png"
    png = png_cache + dev_id + "." + safe_int + "." + gtype + png_end + ".png"
    rrds := rrd_root + dev_id + "/" + safe_int + "."


    rrd := rrds + "ifOperStatus.rrd"


    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      cmd = append(cmd, "DEF:os=" + rrd + ":os:MAX")
      cmd = append(cmd, "CDEF:opers=os,1,EQ,NEGINF,0,IF")
      cmd = append(cmd, "CDEF:downs=os,1,GT,NEGINF,0,IF")
      cmd = append(cmd, "CDEF:unkns=os,UN,NEGINF,0,IF")
      if !comp {
        cmd = append(cmd, "AREA:opers#CCFFCC:Up ")
        cmd = append(cmd, "AREA:downs#EFBBBB:Down")
        cmd = append(cmd, "AREA:unkns#BBBBBB:Unknown\\n")
      } else {
        cmd = append(cmd, "AREA:opers#CCFFCC:")
        cmd = append(cmd, "AREA:downs#EFBBBB:")
        cmd = append(cmd, "AREA:unkns#BBBBBB:")
      }

      if time_src == "" {
        time_src = "os"
      }
    }

    table := []string{}

    rrd = rrds + "oltRxPower.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:oltrx=" + rrd + ":oltrx:AVERAGE")
      table = append(table, "CDEF:oltrxdbabs=oltrx,10,/")
      table = append(table, "CDEF:oltrxdb=oltrxdbabs,-100,LE,INF,oltrxdbabs,IF")

      if !comp {
        table = append(table, "LINE:oltrxdb#009900:OLT Rx")
        table = append(table, "VDEF:oltrxmin=oltrxdb,MINIMUM")
        table = append(table, "GPRINT:oltrxmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:oltrxavg=oltrxdb,AVERAGE")
        table = append(table, "GPRINT:oltrxavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:oltrxmax=oltrxdb,MAXIMUM")
        table = append(table, "GPRINT:oltrxmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:oltrxlast=oltrxdb,LAST")
        table = append(table, "GPRINT:oltrxlast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:oltrxdb#009900:OLT Rx")
      }

      if time_src == "" {
        time_src = "oltrx"
      }
    }

    rrd = rrds + "onuRxPower.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++
      table = append(table, "DEF:onurx=" + rrd + ":onurx:AVERAGE")
      table = append(table, "CDEF:onurxdbabs=onurx,10,/")
      table = append(table, "CDEF:onurxdb=onurxdbabs,-100,LE,INF,onurxdbabs,IF")
      if !comp {
        table = append(table, "LINE:onurxdb#0000FF:ONU Rx")
        table = append(table, "VDEF:onurxmin=onurxdb,MINIMUM")
        table = append(table, "GPRINT:onurxmin:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:onurxavg=onurxdb,AVERAGE")
        table = append(table, "GPRINT:onurxavg:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:onurxmax=onurxdb,MAXIMUM")
        table = append(table, "GPRINT:onurxmax:%.1lf" + exact + "\\t")
        table = append(table, "VDEF:onurxlast=onurxdb,LAST")
        table = append(table, "GPRINT:onurxlast:%.1lf" + exact + "\\n")
      } else {
        table = append(table, "LINE:onurxdb#0000FF:ONU Rx")
      }

      if time_src == "" {
        time_src = "onurx"
      }
    }

    if len(table) > 0 {
      if !comp {
        cmd = append(cmd, "COMMENT:dBm        Min       Avg        Max       Last\\n")
      } else {
        cmd = append(cmd, "COMMENT:dBm")
      }
      cmd = append(cmd, table...)
    }

  } else if gtype == "cpu" {
    json_png = dev_id + ".CPU" + png_end + ".png"
    png = png_cache + dev_id + ".CPU" + png_end + ".png"
    rrds := rrd_root + dev_id + "/CPU."

    cpu_color_i := 0

    for _, cpu_index := range cpu_list {
      if cpu_key, var_ok := q.Vse("cpu_key" + cpu_index); var_ok {
        rrd := rrds + cpu_key +".rrd"
        if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
          total++

          cmd = append(cmd, "DEF:cpu" + cpu_index + "_1min=" + rrd + ":cpu1min:AVERAGE")
          cpu_color := cpu_colors[cpu_color_i]
          cpu_color_i++
          if cpu_color_i == len(cpu_colors) {
            cpu_color_i = 0
          }
          cpu_name := q.Vs("cpu_name" + cpu_index)
          cmd = append(cmd, "LINE:cpu" + cpu_index + "_1min" + cpu_color + ":" + cpu_name + "")
          cmd = append(cmd, "CDEF:unkns" + cpu_index + "=cpu" + cpu_index + "_1min,UN,INF,0,IF")
          cmd = append(cmd, "AREA:unkns" + cpu_index + "#BBBBBB:")
          if !comp {
            cmd = append(cmd, "VDEF:cpu" + cpu_index + "_1min_min=cpu" + cpu_index + "_1min,MINIMUM")
            cmd = append(cmd, "VDEF:cpu" + cpu_index + "_1min_avg=cpu" + cpu_index + "_1min,AVERAGE")
            cmd = append(cmd, "VDEF:cpu" + cpu_index + "_1min_max=cpu" + cpu_index + "_1min,MAXIMUM")
            cmd = append(cmd, "VDEF:cpu" + cpu_index + "_1min_lst=cpu" + cpu_index + "_1min,LAST")
            cmd = append(cmd, "GPRINT:cpu" + cpu_index + "_1min_min:Min\\: %4.0lf")
            cmd = append(cmd, "GPRINT:cpu" + cpu_index + "_1min_avg:Avg\\: %4.0lf")
            cmd = append(cmd, "GPRINT:cpu" + cpu_index + "_1min_max:Max\\: %4.0lf")
            cmd = append(cmd, "GPRINT:cpu" + cpu_index + "_1min_lst:Last\\: %4.0lf\\n")
          } else {
            cmd = append(cmd, "VDEF:cpu" + cpu_index + "_1min_avg=cpu" + cpu_index + "_1min,AVERAGE")
            cmd = append(cmd, "VDEF:cpu" + cpu_index + "_1min_lst=cpu" + cpu_index + "_1min,LAST")
            cmd = append(cmd, "GPRINT:cpu" + cpu_index + "_1min_avg:Avg\\: %4.0lf")
            cmd = append(cmd, "GPRINT:cpu" + cpu_index + "_1min_lst:Last\\: %4.0lf")
          }

          if time_src == "" {
            time_src = "cpu" + cpu_index + "_1min"
          }
        }
      }
    }

  } else if gtype == "mem" {
    json_png = dev_id + ".memoryUsed" + png_end + ".png"
    png = png_cache + dev_id + ".memoryUsed" + png_end + ".png"
    rrd := rrd_root + dev_id + "/memoryUsed.rrd"
    if fi, serr := os.Stat(rrd); serr == nil && !fi.IsDir() {
      total++

      cmd = append(cmd, "DEF:memUse=" + rrd + ":memUse:MAX")
      cmd = append(cmd, "CDEF:unknsMemUse=memUse,UN,INF,0,IF")
      cmd = append(cmd, "AREA:unknsMemUse#BBBBBB:")
      cmd = append(cmd, "CDEF:areaMemUse=memUse,UN,0,memUse,IF")
      cmd = append(cmd, "AREA:areaMemUse#88FF88:")
      cmd = append(cmd, "LINE:memUse#008800:Memory usage")
      if !comp {
        cmd = append(cmd, "VDEF:memUseFirst=memUse,FIRST")
        cmd = append(cmd, "VDEF:memUseMax=memUse,MAXIMUM")
        cmd = append(cmd, "VDEF:memUseLast=memUse,LAST")
        cmd = append(cmd, "GPRINT:memUseFirst:First\\: %.0lf" + exact + "")
        cmd = append(cmd, "GPRINT:memUseMax:Max\\: %.0lf" + exact + "")
        cmd = append(cmd, "GPRINT:memUseLast:Last\\: %4.0lf" + exact + "\\n")
      } else {
        cmd = append(cmd, "VDEF:memUseFirst=memUse,FIRST")
        cmd = append(cmd, "VDEF:memUseLast=memUse,LAST")
        cmd = append(cmd, "GPRINT:memUseFirst:First\\: %4.0lf" + exact + "")
        cmd = append(cmd, "GPRINT:memUseLast:Last\\: %4.0lf" + exact + "")
      }

      if time_src == "" {
        time_src = "memUse"
      }
    }

  } else {
    panic("unknown_type")
  }

  if total == 0 {
    if q["json"] == nil {
      panic("wait")
    } else {
      w.WriteHeader(http.StatusOK)
      w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
      w.Write([]byte( M{"ok": "no_data" }.ToJsonStr(true) ))
      return
    }
  }

  if time_src != "" {
    cmd = append(cmd, "VDEF:gStart=" + time_src + ",FIRST")
    cmd = append(cmd, "VDEF:gEnd=" + time_src + ",LAST")
    if comp {
      cmd = append(cmd, "COMMENT:\\n")
    }
    cmd = append(cmd, "GPRINT:gStart:Start\\: %H\\:%M\\:%S %d/%m/%Y\\t:strftime")
    cmd = append(cmd, "GPRINT:gEnd:End\\: %H\\:%M\\:%S %d/%m/%Y:strftime")
  }
  cmd[1]=png

  use_cache := true
  png_stat, stat_err := os.Stat(png)

  if stat_err != nil || cache_off || time.Now().Sub(png_stat.ModTime()) >= PNG_MAX_AGE ||
     q["json"] != nil ||
  false {
    use_cache = false
  }

  if dbg {
    w.WriteHeader(http.StatusOK)
    w.Header().Set("Content-Type", "text/plain; charset=UTF-8")

    w.Write([]byte(strings.Join(cmd, " ") + "\n"))
    w.Write([]byte("cache_off: "))
    if cache_off {
      w.Write([]byte("true"))
    } else {
      w.Write([]byte("false"))
    }
    w.Write([]byte("\nmtime: "))
    if stat_err == nil {
      w.Write([]byte(png_stat.ModTime().String()))
    } else {
      w.Write([]byte("no data"))
    }
    w.Write([]byte("\nuse cache: "))
    if use_cache {
      w.Write([]byte("yes"))
    } else {
      w.Write([]byte("no"))
    }
    w.Write([]byte("\n"))
    return
  }

  if !use_cache {

    os_cmd := exec.Command(RRD_TOOL, cmd...)
    var stdout strings.Builder
    var stderr strings.Builder
	  os_cmd.Stdout = &stdout
	  os_cmd.Stderr = &stderr

    err = os_cmd.Run()

    if q["debug_exec"] != nil {

      w.WriteHeader(http.StatusOK)
      w.Header().Set("Content-Type", "text/plain; charset=UTF-8")

      w.Write([]byte(strings.Join(cmd, " ") + "\n"))

      if err == nil {
        w.Write([]byte("\nno error\n"))
      } else {
        w.Write([]byte("\nerror: " + err.Error() + "\n"))
      }

      w.Write([]byte("stdout:\n"))
      w.Write([]byte(stdout.String()))

      w.Write([]byte("\nstderr:\n"))
      w.Write([]byte(stderr.String()))

      w.Write([]byte("\n"))
      return
    }
    if err != nil {
      panic("exec_error")
    }

    if q["json"] != nil {
      out := M{
        "file": json_png,
      }
      for _, str := range strings.Split(stdout.String(), "\n") {
        if a := g_graph_json_graph_left_reg.FindStringSubmatch(str); a != nil {
          out["graph_left"] = a[1]
        } else if a := g_graph_json_graph_top_reg.FindStringSubmatch(str); a != nil {
          out["graph_top"] = a[1]
        } else if a := g_graph_json_graph_width_reg.FindStringSubmatch(str); a != nil {
          out["graph_width"] = a[1]
        } else if a := g_graph_json_graph_height_reg.FindStringSubmatch(str); a != nil {
          out["graph_height"] = a[1]
        } else if a := g_graph_json_image_width_reg.FindStringSubmatch(str); a != nil {
          out["image_width"] = a[1]
        } else if a := g_graph_json_image_height_reg.FindStringSubmatch(str); a != nil {
          out["image_height"] = a[1]
        } else if a := g_graph_json_start_reg.FindStringSubmatch(str); a != nil {
          out["start"] = a[1]
        } else if a := g_graph_json_end_reg.FindStringSubmatch(str); a != nil {
          out["end"] = a[1]
        }
      }
      if len(out) != 9 {
        panic("bad graphv output:\n"+stdout.String())
      }
      w.WriteHeader(http.StatusOK)
      w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
      w.Write([]byte( M{"ok": out }.ToJsonStr(true) ))
      return
    }
  }

  png_stat, stat_err = os.Stat(png)

  if stat_err != nil {
    panic(stat_err)
  }

  var f *os.File
  f, err = os.Open(png)
  if err != nil {
    panic(err)
  }
  defer f.Close()

  w.WriteHeader(http.StatusOK)
  w.Header().Set("X-Debug-Proc-Duration", fmt.Sprint(time.Now().Sub(pre_proc_time).Abs()) )
  w.Header().Set("Content-Type", "image/png")
  io.Copy(w, f)
}
