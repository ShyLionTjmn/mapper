package main

import (
  "fmt"
  "time"
  "net"
  "os"
  "strings"
  "strconv"
  "os/signal"
  "bufio"
  "syscall"
  "sync"
  "regexp"
  "flag"
  "runtime/debug"
  "encoding/gob"
  "encoding/json"
  "golang.org/x/term"
  . "github.com/ShyLionTjmn/mapper/mapaux"
)

type StatusMsg struct {
  id string
  msg string
}

type ScriptArgs []string

func (a ScriptArgs) String() string {
  return strings.Join(a, ", ")
}

func (a *ScriptArgs) Set(val string) error {
  *a = append(*a, val)
  return nil
}

var devs M
var now time.Time

var dev_logs map[string]string
var global_mutex sync.Mutex

var default_pager_reg *regexp.Regexp
var default_pager_cmd string

var default_splitter *regexp.Regexp
var default_ranger *regexp.Regexp

func init() {
  gob.Register(M{})
  gob.Register(map[string]interface{}{})

  default_pager_reg = regexp.MustCompile(`--[Mm]ore--`)
  default_pager_cmd = " "

  default_splitter = regexp.MustCompile(`(\d+-\d+)|(\d+)`)
  default_ranger = regexp.MustCompile(`-`)
}

var script_args ScriptArgs

var username string
var password string

var opt_r bool // log input from devices
var opt_w bool // log sent commands
var opt_v bool // log execution steps
var opt_q bool // no summary, no periodic updates
var opt_l bool // live log to stdout

var opt_j bool // dump JSON data from broker

var regs map[string]*regexp.Regexp

func init() {
  regs = map[string]*regexp.Regexp {
    "comment": regexp.MustCompile(`^\s*(?:#|$)`),
    "start": regexp.MustCompile(`^\s*start\s*$`),
    "match": regexp.MustCompile(`^\s*((?:!)?match)\s+([\S]+)\s(.*)$`),
    "capres": regexp.MustCompile(`^\s*capres\s+(\S+)\s(.*)$`),
    "e": regexp.MustCompile(`^\s*e\s+(\d+)\s(.*)$`),
    "ef": regexp.MustCompile(`^\s*ef\s+(\d+)\s(.*)\sFAILON\s(.*)$`),
    "p": regexp.MustCompile(`^\s*p\s(.*)$`),
    "eol": regexp.MustCompile(`^\s*eol\s(.*)$`),
    "pager_reg": regexp.MustCompile(`^\s*pager_reg\s(.*)$`),
    "pager_cmd": regexp.MustCompile(`^\s*pager_cmd\s(.*)$`),
    "user": regexp.MustCompile(`^\s*user\s+([^\s]+)$`),
    "pass": regexp.MustCompile(`^\s*pass\s(.*)$`),
    "vars": regexp.MustCompile(`(?:[^\\]|^)%\{(?:[^\}]+)\}`),
    "backslash%": regexp.MustCompile(`\\%`),
    "2backslash": regexp.MustCompile(`\\\\`),
    "per_int": regexp.MustCompile(`^\s*per_int\s*$`),
    "end_int": regexp.MustCompile(`^\s*end_int\s*$`),
    "sect": regexp.MustCompile(`^\s*sect\s*$`),
    "else": regexp.MustCompile(`^\s*else\s*$`),
    "end_sect": regexp.MustCompile(`^\s*end_sect\s*$`),
    "log": regexp.MustCompile(`^\s*log\s?(.*)$`),
    "nums_cross": regexp.MustCompile(`^\s*((?:!)?nums_cross)\s+("[^"]+"|\S+)\s+("[^"]+"|\S+)\s*$`),
    "list_splitter": regexp.MustCompile(`^\s*list_splitter\s(.*)$`),
    "list_ranger": regexp.MustCompile(`^\s*list_ranger\s(.*)$`),
    "setvar": regexp.MustCompile(`^\s*setvar\s+(\S+)\s(.*)$`),
    "port": regexp.MustCompile(`^\s*port\s+(\d+)\s*$`),
    "end": regexp.MustCompile(`^\s*end\s*$`),
    "is_num": regexp.MustCompile(`^\d+$`),
    "fail": regexp.MustCompile(`^\s*fail(?:\s(.*))?$`),
  }

}

func main() {

  defer func() {
    if rec := recover(); rec != nil {
      switch v := rec.(type) {
      case string:
        fmt.Fprintln(os.Stderr, v)
      case error:
        fmt.Fprintln(os.Stderr, v.Error() + "\n\n" + string(debug.Stack()))
      default:
        fmt.Fprintln(os.Stderr, rec)
      }
      os.Exit(1)
    }
  } ()

  var script_filename string

  var exclude_list_filename string

  var opt_P bool // skip periodic updates
  var opt_s bool

  var opt_c string

  flag.BoolVar(&opt_r, "r", false, "Log input from device")
  flag.BoolVar(&opt_w, "w", false, "Log sent commands to device")
  flag.BoolVar(&opt_v, "v", false, "Log execution")
  flag.BoolVar(&opt_j, "j", false, "Dump JSON data from broker and quit")
  flag.BoolVar(&opt_P, "P", false, "No periodic status updates")
  flag.BoolVar(&opt_q, "q", false,
    "No dev start and stop messages, no summary results, no periodic updates (implies -P)",
  )
  flag.BoolVar(&opt_s, "s", false, "Print summary results for all worked and skipped devs")

  flag.BoolVar(&opt_l, "l", false,
    "Live log instead of full log afer all finished. May get messy, use for single dev with -q, -P options",
  )

  flag.StringVar(&script_filename, "f", "", "Script file name (required)")

  flag.StringVar(&exclude_list_filename, "e", "",
    "Exclude list, will be filled with dev_id's of successfull devices, so they won't be walked again next run",
  )

  flag.Var(&script_args, "a", "Script arguments accessed with %{0}, %{1}, ..." +
                              "Escape % with \\ if needed",
  )

  flag.StringVar(&opt_c, "c", DEFAULT_CONFIG_FILE, "mapper.conf location")

  flag.Parse()

  config := LoadConfig(opt_c, FlagPassed("c"))

  if opt_j {

    conn, err := net.DialTimeout("unix", config.Broker_unix_socket, time.Second)
    if err != nil {
      panic(err)
    }

    _, err = conn.Write([]byte("global-config\n"))
    if err != nil {
      conn.Close()
      panic(err)
    }

    dec := gob.NewDecoder(conn)

    err = dec.Decode(&devs)

    conn.Close()

    if err != nil {
      panic(err)
    }

    out_j, j_err := json.MarshalIndent(devs, "", "  ")
    if j_err != nil {
      panic(j_err)
    }
    fmt.Println(string(out_j))
    return
  }

  if script_filename == "" {
    panic("No script filename given, use -f flag")
  }

  var err error
  var file_bytes []byte

  if file_bytes, err = os.ReadFile(script_filename);
  err != nil { panic("Cannot read \"" + script_filename + "\"\n" + err.Error()) }

  script := string(file_bytes)

  sect_depth := 0
  per_int := 0

  now = time.Now()

  sect_stack := []string{}

  int_i := -1

  for l, line := range strings.Split(script, "\n") {
    ls := strconv.FormatInt(int64(l) + 1, 10)
    if regs["comment"].MatchString(line) {
      // # comment or empty string
      // do nothing
      continue
    }

    if m := regs["user"].FindStringSubmatch(line); m != nil {
      username = m[1]
      continue
    } else if m := regs["pass"].FindStringSubmatch(line); m != nil {
      password = m[1]
      continue
    }

    if m := regs["match"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[3], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }

      _ = subst(m[2], M{}, int_i, map[string]string{}, ls, true)

    } else if m := regs["capres"].FindStringSubmatch(line); m != nil {
      // capture e or ef result into variable
      rstr := subst(m[2], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }

      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)

    } else if m := regs["e"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[2], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }

    } else if m := regs["ef"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[2], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }
      rstr = subst(m[3], M{}, int_i, map[string]string{}, ls, true)
      _, err = regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }
    } else if m := regs["pager_reg"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[1], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }

    } else if m := regs["p"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
    } else if m := regs["eol"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
    } else if m := regs["pager_cmd"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
    } else if regs["per_int"].MatchString(line) {
      if int_i != -1 {
        panic("Cannot nest per_int, at line " + ls)
      }
      int_i = 0
      per_int++
      sect_stack = append(sect_stack, "per_int")

    } else if regs["end_int"].MatchString(line) {
      if int_i != 0 {
        panic("Unmatched end_int, at line " + ls)
      }
      if per_int != 1 {
        panic("Unmatched end_int at line " + ls)
      }
      if len(sect_stack) == 0 {
        panic("Sect stack is empty. At line " + ls)
      }
      if sect_stack[len(sect_stack) - 1] != "per_int" {
        panic("Sect overlap with per_int. At line " + ls)
      }
      per_int = 0
      int_i = -1
      sect_stack = sect_stack[:len(sect_stack) - 1]
    } else if regs["sect"].MatchString(line) {
      sect_depth++
      sect_stack = append(sect_stack, "sect")
    } else if regs["else"].MatchString(line) {
      if len(sect_stack) == 0 {
        panic("Unmatched else. At line " + ls)
      }
      if sect_stack[len(sect_stack) - 1] != "sect" {
        panic("else overlap with per_int. At line " + ls)
      }
    } else if regs["end_sect"].MatchString(line) {
      sect_depth--
      if sect_depth < 0 {
        panic("Unmatched end_sect at line " + ls)
      }
      if len(sect_stack) == 0 {
        panic("Sect stack is empty. At line " + ls)
      }
      if sect_stack[len(sect_stack) - 1] != "sect" {
        panic("Sect overlap with per_int. At line " + ls)
      }
      sect_stack = sect_stack[:len(sect_stack) - 1]
    } else if m := regs["log"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
    } else if m := regs["nums_cross"].FindStringSubmatch(line); m != nil {
      _ = subst(m[2], M{}, int_i, map[string]string{}, ls, true)
      _ = subst(m[3], M{}, int_i, map[string]string{}, ls, true)
    } else if m := regs["list_splitter"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[1], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)

      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }
    } else if m := regs["list_ranger"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[1], M{}, int_i, map[string]string{}, ls, true)
      _, err := regexp.Compile(rstr)

      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }
    } else if m := regs["setvar"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
      _ = subst(m[2], M{}, int_i, map[string]string{}, ls, true)

    } else if m := regs["port"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
    } else if regs["end"].MatchString(line) {
      // want to stop
      // break
    } else if regs["start"].MatchString(line) {
    } else if m := regs["fail"].FindStringSubmatch(line); m != nil {
      _ = subst(m[1], M{}, int_i, map[string]string{}, ls, true)
    } else {
      panic("Unknown command at line " + ls +":\n" + line)
    }
  }

  if per_int != 0 {
    panic("per_int and end_int number does not match")
  }

  if sect_depth != 0 {
    panic("sect and end_sect number does not match")
  }

  if len(sect_stack) != 0 {
    panic("Sect stack is not empty")
  }

  var conn net.Conn

  conn, err = net.DialTimeout("unix", config.Broker_unix_socket, time.Second)
  if err != nil {
    panic(err)
  }

  _, err = conn.Write([]byte("global-config\n"))
  if err != nil {
    conn.Close()
    panic(err)
  }

  dec := gob.NewDecoder(conn)

  err = dec.Decode(&devs)

  conn.Close()

  if err != nil {
    panic(err)
  }

  var exclude_list M

  if exclude_list_filename != "" {
    ex_json, err := os.ReadFile(exclude_list_filename)
    if err != nil && !os.IsNotExist(err) {
      panic(err)
    }

    if err == nil {
      err = json.Unmarshal(ex_json, &exclude_list)
      if err != nil {
        panic(err)
      }
    } else {
      exclude_list = M{}
    }

    write_back, err := json.Marshal(exclude_list)
    if err != nil { panic(err) }

    err = os.WriteFile(exclude_list_filename, write_back, 0664)
    if err != nil { panic(err) }

  } else {
    exclude_list = M{}
  }

  devs_list := []string{}
  devs_status := M{}

  for id, _ := range devs {
    var presel bool
    in_args := false

    if len(flag.Args()) > 0 {
      presel = IndexOf(flag.Args(), devs.Vs(id, "short_name")) >= 0 ||
        IndexOf(flag.Args(), id) >= 0 ||
        ArraysIntersect(flag.Args(), devs.VA(id, "ips").([]string)) ||
        false
      in_args = presel
    } else {
      presel = work_router(id, nil, nil, nil, script, true) && exclude_list[id] == nil
    }

    if presel {
      if devs.Vs(id, "overall_status") == "ok" || in_args {
        devs_list = append(devs_list, id)
      } else {
        devs_status[id] = "skip because of bad overall_status"
      }
    }
  }


  if len(devs_list) == 0 {
    fmt.Println("No suitable device found")
    return
  }

  if username == "" {
    password = "_ASK_"
    fmt.Print("Enter username: ")

	  reader := bufio.NewReader(os.Stdin)

	  input, err := reader.ReadString('\n')
	  if err != nil { panic(err) }

	  username = strings.TrimSuffix(input, "\n")
  }

  if password == "_ASK_" {
    fmt.Print("Enter password for user \"", username, "\": ")

    pass, err := term.ReadPassword(int(syscall.Stdin))
    if err != nil { panic(err) }
    password = string(pass)
    fmt.Println()
  }

  var wg sync.WaitGroup
  stop_ch := make(StopCloseChan)

  sig_ch := make(chan os.Signal, 1)
  signal.Notify(sig_ch, syscall.SIGHUP)
  signal.Notify(sig_ch, syscall.SIGINT)
  signal.Notify(sig_ch, syscall.SIGTERM)
  signal.Notify(sig_ch, syscall.SIGQUIT)

  status_ch := make(chan StatusMsg, 10)

  for _, id := range devs_list {
    wg.Add(1)
    go work_router(id, stop_ch, &wg, status_ch, script, false)
  }

  wait_ch := make(chan struct{})

  go func() {
    wg.Wait()
    close(wait_ch)
    if !opt_q {
      fmt.Println("main: Wait finished")
    }
  } ()

  ticker := time.NewTicker(5 * time.Second)

  MAIN_LOOP:  for {
    select {
    case <-wait_ch:
      //all goroutines finished normally
      if !opt_q {
        fmt.Println("main: Normal finish")
      }
      break MAIN_LOOP
    case s := <-sig_ch:
      if s != syscall.SIGHUP && s != syscall.SIGUSR1 {
        if !opt_q {
          fmt.Println("main: User exit signalled, terminating workers")
        }
        close(stop_ch)
        break MAIN_LOOP
      }
    case status := <-status_ch:
      if strings.HasPrefix(status.msg, "exit") {
        devs_list = StrExclude(devs_list, status.id)
      }
      devs_status[status.id] = status.msg
    case <-ticker.C:
      if !opt_P && !opt_q {
        fmt.Println("main: still working on:")
        for _, id := range devs_list {
          fmt.Printf("\t% -20s  %s", devs.Vs(id, "short_name"), devs.Vs(id, "data_ip"))
          if devs_status.Evs(id) {
            fmt.Print("  " + devs_status.Vs(id))
          }
          fmt.Println()
        }
        fmt.Println()
      }
    }
  }

  if WaitTimeout(&wg, 5 * time.Second) {
    fmt.Println("main: Tired of wating. Just quitting")
  }

  if !opt_l {
    for dev_id, devlog := range dev_logs {
      if devlog != "" {
        fmt.Println(devs.Vs(dev_id, "short_name") + ":\n", devlog)
      }
    }
  }

  if !opt_q || opt_s {
    fmt.Println("Summary")
    good := 0
    for id, _ := range devs_status {
      is_good := false
      if devs_status[id] == "exit done" {
        is_good = true
        good++
      }
      if !is_good || opt_s {
        fmt.Printf("\t% -20s  % -15s  %s\n", devs.Vs(id, "short_name"), devs.Vs(id, "data_ip"), devs_status[id])
      }
    }
    if !opt_s {
      fmt.Printf("\t%d devices done successfully, not printed\n", good)
    }
  }

  if exclude_list_filename != "" {
    for id, _ := range devs_status {
      if devs_status[id] == "exit done" {
        exclude_list[id] = time.Now().Format("2006.01.02 15:04:05")
      }
    }

    write_back, err := json.Marshal(exclude_list)
    if err != nil { panic(err) }

    err = os.WriteFile(exclude_list_filename, write_back, 0664)
    if err != nil { panic(err) }
  }
}

func subst(src string, dev M, int_i int, captures map[string]string, ls string, dry_run bool) string {
  var ret string

  var ifName string
  if int_i != -1 && dev.EvA("interfaces_sorted") {
    ifName = dev.VA("interfaces_sorted").([]string)[int_i]
  }

  ret = regs["vars"].ReplaceAllStringFunc(src, func(str string) string {
    prefix := ""
    idx := strings.Index(str, "%")
    if idx < 0 {
      panic("no % in str")
    }
    prefix += str[:idx] //add anything before %
    key := str[idx + 2: len(str) - 1] //extract between %{ and }

    if key[0:1] == "T" {
      return prefix + now.Format(key[1:])
    } else if key == "Y" {
      return prefix + now.Format("2006")
    } else if key == "m" {
      return prefix + now.Format("01")
    } else if key == "d" {
      return prefix + now.Format("02")
    } else if key == "H" {
      return prefix + now.Format("15")
    } else if key == "M" {
      return prefix + now.Format("04")
    } else if key == "S" {
      return prefix + now.Format("05")
    } else if key == "t" {
      return prefix + strconv.FormatInt(now.Unix(), 10)
    } else if key[0:1] == "n" {
      hostname := dev.Vs("short_name")
      if len(key) > 1 {
        cut, err := strconv.ParseUint(key[1:], 10, 31)
        if err != nil {
          panic("Bad number for %{nXX} var, at line " +ls)
        }
        if len(hostname) > int(cut) {
          hostname = hostname[:int(cut)]
        }
      }
      if dry_run { return prefix + "DRY_RUN" }
      return prefix + hostname
    } else if key[0:1] == "N" {
      hostname := dev.Vs("short_name")
      if len(key) > 1 {
        cut, err := strconv.ParseUint(key[1:], 10, 31)
        if err != nil {
          panic("Bad number for %{nXX} var, at line " +ls)
        }
        if len(hostname) > int(cut) {
          hostname = hostname[:int(cut)]
        }
      }
      if dry_run { return prefix + "DRY_RUN" }
      return prefix + regexp.QuoteMeta(hostname)
    } else if strings.HasPrefix(key, "int.") {
      if int_i == -1 {
        panic("int.Attr var out of per_int, at line " + ls)
      }
      if dry_run { return prefix + "DRY_RUN" }
      attr := strings.TrimPrefix(key, "int.")
      val, _ := dev.Vse("interfaces", ifName, attr)
      return prefix + val
    } else if strings.HasPrefix(key, "dev.") {
      if dry_run { return prefix + "DRY_RUN" }
      attr := strings.TrimPrefix(key, "dev.")
      val, _ := dev.Vse(attr)
      return prefix + val
    } else if strings.HasPrefix(key, "var.") {
      if dry_run { return prefix + "DRY_RUN" }
      attr := strings.TrimPrefix(key, "var.")
      val, _ := captures[attr]
      return prefix + val
    } else if strings.HasPrefix(key, "INT.") {
      if int_i == -1 {
        panic("int.Attr var out of per_int, at line " + ls)
      }
      if dry_run { return prefix + "DRY_RUN" }
      attr := strings.TrimPrefix(key, "INT.")
      val, _ := dev.Vse("interfaces", ifName, attr)
      return prefix + regexp.QuoteMeta(val)
    } else if strings.HasPrefix(key, "DEV.") {
      if dry_run { return prefix + "DRY_RUN" }
      attr := strings.TrimPrefix(key, "DEV.")
      val, _ := dev.Vse(attr)
      return prefix + regexp.QuoteMeta(val)
    } else if strings.HasPrefix(key, "VAR.") {
      if dry_run { return prefix + "DRY_RUN" }
      attr := strings.TrimPrefix(key, "VAR.")
      val, _ := captures[attr]
      return prefix + regexp.QuoteMeta(val)
    } else if strings.HasPrefix(key, "res") {
      if dry_run { return prefix + "DRY_RUN" }
      val, _ := captures[""]
      return prefix + val
    } else if regs["is_num"].MatchString(key) {
      num, err := strconv.ParseUint(key, 10, 31)
      if err != nil {
        panic("Bad number var at " + ls)
      }
      if int(num) >= len(script_args) {
        panic("At line " + ls + ": no arg for %{" + key + "}" + " is supplied. Use -a option")
      }
      return prefix + script_args[int(num)]
    }

    panic("Unkown var key: " + key + " at line " + ls)
  })

  ret = regs["backslash%"].ReplaceAllString(ret, "%")
  ret = regs["2backslash"].ReplaceAllString(ret, `\`)

  return ret
}

func nums_cross(list1, list2 string, splitter, ranger *regexp.Regexp) (bool, bool) {
  //fmt.Println("nums_cross, list1: " + list1)
  //fmt.Println("nums_cross, list2: " + list2)

  for _, r1 := range splitter.FindAllString(list1, -1) {
    ra1 := ranger.Split(r1, -1)
    if len(ra1) == 0 || len(ra1) > 2 { return false, false }
    start1, err := strconv.ParseUint(ra1[0], 10, 64)
    if err != nil { return false, false }
    var end1 uint64
    if len(ra1) == 2 {
      end1, err = strconv.ParseUint(ra1[1], 10, 64)
      if err != nil { return false, false }
      if end1 < start1 { return false, false }
    } else {
      end1 = start1
    }

    for _, r2 := range splitter.FindAllString(list2, -1) {
      ra2 := ranger.Split(r2, -1)
      if len(ra2) == 0 || len(ra2) > 2 { return false, false }
      start2, err := strconv.ParseUint(ra2[0], 10, 64)
      if err != nil { return false, false }
      var end2 uint64
      if len(ra2) == 2 {
        end2, err = strconv.ParseUint(ra2[1], 10, 64)
        if err != nil { return false, false }
        if end2 < start2 { return false, false }
      } else {
        end2 = start2
      }

      //           s1--------e1
      //       s2-----e2
      //                 s2-----e2
      //            s2-----e2
      //         s2-------------e2
      //
      //
      // s2--e2                   s2--e2

      if start1 <= end2 && end1 >= start2 {
        return true, true
      }
    }
  }
  return false, true
}

func work_router(id string, stop_ch StopCloseChan, wg *sync.WaitGroup, status_ch chan StatusMsg, script string, presel bool) bool {
  if !presel {
    defer wg.Done()
  }

  devlog := []string{}

  now_str := time.Now().Format("2006.01.02 15:04:05 ")

  if !presel {
    defer func() {
      if rec := recover(); rec != nil {
        switch v := rec.(type) {
        case string:
          status_ch <- StatusMsg{id: id, msg: "exit panicked: " + v}
          if opt_l {
            fmt.Fprintln(os.Stderr, now_str, devs.Vs(id, "short_name") + " ", devs.Vs(id, "data_ip") + " ", v)
          }
        case error:
          status_ch <- StatusMsg{id: id, msg: "exit panicked: " + v.Error() }
          if opt_l {
            fmt.Fprintln(os.Stderr, now_str, devs.Vs(id, "short_name") + " ", devs.Vs(id, "data_ip") + " ", v.Error())
          }
        default:
          status_ch <- StatusMsg{id: id, msg: "exit panicked: unknown panick attack"}
          if opt_l {
            fmt.Fprintln(os.Stderr, now_str, devs.Vs(id, "short_name") + " ", devs.Vs(id, "data_ip") + " ",
              "unknown panick attack", rec,
            )
          }
        }
      }
    } ()
  }

  var interfaces []string

  if devs.EvA(id, "interfaces_sorted") {
    interfaces = devs.VA(id, "interfaces_sorted").([]string)
  } else {
    if opt_v {
      devlog = append(devlog, "NO interfaces_sorted FOUND")
    }
    interfaces = []string{}
  }

  int_i := -1 //current interfaces_sorted index, -1 if not in per_int block
  var ifName string //current ifName

  var err error
  _ = err
  ssh_connected := false

  port := "22"

  con := NewSshConn()
  con.Lines = 0
  con.Cols = 0
  con.Term = "xterm"
  con.PagerReg = default_pager_reg
  con.PagerSend = " "

  lines := strings.Split(script, "\n")

  var l int

  sect_depth := 0
  per_int := 0

  sect_stack := []string{}

  captures := make(map[string]string)

  captures[""] = ""

  step := 0

  list_splitter := default_splitter
  list_ranger := default_ranger

  expected := false // control capres usage

  if !presel {
    status_ch <- StatusMsg{id: id, msg: "startup"}

    if !opt_q {
      fmt.Printf("% -20s  % -15s  % -20s: work\n",
        devs.Vs(id, "short_name"),
        devs.Vs(id, "data_ip"),
        devs.Vs(id, "model_short"),
      )
    }
  }

  var once_status sync.Once

  for l = 0; l < len(lines); l++ {
    ls := strconv.FormatInt(int64(l) + 1, 10)
    line := lines[l]

    now_str = time.Now().Format("2006.01.02 15:04:05 ")

    if regs["comment"].MatchString(line) {
      // # comment or empty string
      // do nothing
      continue
    }

    if m := regs["user"].FindStringSubmatch(line); m != nil {
      continue
    } else if m := regs["pass"].FindStringSubmatch(line); m != nil {
      continue
    }

    step ++
    if !presel {
      status_ch <- StatusMsg{
        id: id,
        msg: "Executing line " + ls + ", step " + strconv.FormatInt(int64(step), 10) + ": " + line,
      }

      if opt_v {
        devlog = append(devlog, "Executing line " + ls + ": " + line)
        if opt_l {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }
    }

    go_on := true

    if m := regs["match"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[3], devs.VM(id), int_i, captures, ls, false)
      r, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }
      op := m[1]
      value := subst(m[2], devs.VM(id), int_i, captures, ls, false)

      if opt_v {
        devlog = append(devlog, "match against: \"" + value + "\"")
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }

      go_on = false

      if r.MatchString(value) {
        if op == "match" {
          go_on = true
        }
      } else {
        if op == "!match" {
          go_on = true
        }
      }

      if opt_v && go_on {
        devlog = append(devlog, "match successfull, continue")
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }

      goto GO_ON

    } else if m := regs["capres"].FindStringSubmatch(line); m != nil {
      if !expected {
        panic("capres before e or ef")
      }
      // capture e or ef result into variable
      rstr := subst(m[2], devs.VM(id), int_i, captures, ls, false)
      r, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }

      varname := subst(m[1], devs.VM(id), int_i, captures, ls, false)

      if capres := r.FindStringSubmatch(captures[""]); capres != nil {
        if len(capres) == 1 {
          captures[ varname ] = capres[0]
        } else {
          captures[ varname ] = capres[1]
        }
      } else {
        delete(captures, varname)
      }

    } else if m := regs["e"].FindStringSubmatch(line); m != nil {
      if presel {
        break
      }

      expected = true

      rstr := subst(m[2], devs.VM(id), int_i, captures, ls, false)
      r, _ := regexp.Compile(rstr)

      timeout, _ := strconv.ParseUint(m[1], 10, 31)

      if !ssh_connected {
        status_ch <- StatusMsg{id: id, msg: "connecting"}
        err = con.Connect(devs.Vs(id, "data_ip") + ":" + port, username, password, stop_ch)
        if err != nil {
          panic("ssh connect error: " + err.Error())
        }
        defer con.Close()
        ssh_connected = true

        status_ch <- StatusMsg{
          id: id,
          msg: "Executing line " + ls + ", step " + strconv.FormatInt(int64(step), 10) + ": " + line,
        }

      }

      if opt_v {
        devlog = append(devlog, "Expecting: " + r.String())
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }

      res, err := con.ExpectReg(time.Duration(timeout) * time.Second, r, nil)

      if opt_v || opt_r {
        for _, rline := range strings.Split(res, "\n") {
          devlog = append(devlog, "< \"" + rline + "\"")
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
      }

      if err != nil {
        if opt_v {
          devlog = append(devlog, "expect failed, finish script" )
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        once_status.Do(func() {
          status_ch <- StatusMsg{id: id, msg: "exit expect error: " + err.Error() + "\nResponse: " + res }
        })
        if opt_q && opt_l {
          now_str = time.Now().Format("2006.01.02 15:04:05 ")
          fmt.Fprintln(os.Stderr, now_str, devs.Vs(id, "short_name") + " ",
            devs.Vs(id, "data_ip") + " at line " + ls + " ", err.Error(),
          )
        }
        break
      }

      captures[""] = res

    } else if m := regs["ef"].FindStringSubmatch(line); m != nil {
      if presel {
        break
      }

      expected = true
      rstr := subst(m[2], devs.VM(id), int_i, captures, ls, false)
      good_reg, _ := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }
      rstr = subst(m[3], devs.VM(id), int_i, captures, ls, false)
      bad_reg, err := regexp.Compile(rstr)
      if err != nil {
        panic("Error regexp compiling rule at line " + ls + " \"" + m[0] + "\":\n\t" + err.Error())
      }

      if !ssh_connected {
        status_ch <- StatusMsg{id: id, msg: "connecting"}
        err = con.Connect(devs.Vs(id, "data_ip") + ":" + port, username, password, stop_ch)
        if err != nil {
          panic("ssh connect error: " + err.Error())
        }
        defer con.Close()
        ssh_connected = true

        status_ch <- StatusMsg{
          id: id,
          msg: "Executing line " + ls + ", step " + strconv.FormatInt(int64(step), 10) + ": " + line,
        }

      }

      timeout, _ := strconv.ParseUint(m[1], 10, 31)

      if opt_v {
        devlog = append(devlog, "Expecting: " + good_reg.String())
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
        devlog = append(devlog, "FAILON: " + bad_reg.String())
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }

      res, err := con.ExpectReg(time.Duration(timeout) * time.Second, good_reg, bad_reg)

      if opt_v || opt_r {
        for _, rline := range strings.Split(res, "\n") {
          devlog = append(devlog, "< \"" + rline + "\"")
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
      }

      if err != nil {
        if opt_v {
          devlog = append(devlog, "expect failed, finish script" )
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        once_status.Do(func() {
          status_ch <- StatusMsg{id: id, msg: "exit expect error: " + err.Error() + "\nResponse: " + res }
        })
        if opt_q && opt_l {
          now_str = time.Now().Format("2006.01.02 15:04:05 ")
          fmt.Fprintln(os.Stderr, now_str, devs.Vs(id, "short_name") + " ",
            devs.Vs(id, "data_ip") + " at line " + ls + " ", err.Error(),
          )
        }
        break
      }

      captures[""] = res

    } else if m := regs["pager_reg"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      r, _ := regexp.Compile(rstr)
      con.PagerReg = r

    } else if m := regs["p"].FindStringSubmatch(line); m != nil {
      if presel {
        break
      }

      cmd := subst(m[1], devs.VM(id), int_i, captures, ls, false)

      if !ssh_connected {
        status_ch <- StatusMsg{id: id, msg: "connecting"}
        err = con.Connect(devs.Vs(id, "data_ip") + ":" + port, username, password, stop_ch)
        if err != nil {
          panic("ssh connect error: " + err.Error())
        }
        defer con.Close()
        ssh_connected = true

        status_ch <- StatusMsg{
          id: id,
          msg: "Executing line " + ls + ", step " + strconv.FormatInt(int64(step), 10) + ": " + line,
        }

      }

      if opt_v || opt_w {
        devlog = append(devlog, "> \"" + cmd + "\"")
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }
      con.Cmd(cmd)

    } else if m := regs["eol"].FindStringSubmatch(line); m != nil {
      str := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      str = strings.ReplaceAll(str, "\\n", "\n")
      str = strings.ReplaceAll(str, "\\r", "\r")
      str = strings.ReplaceAll(str, "\\t", "\t")
      str = strings.ReplaceAll(str, "\\a", "\a")
      str = strings.ReplaceAll(str, "\\b", "\b")
      str = strings.ReplaceAll(str, "\\f", "\f")
      str = strings.ReplaceAll(str, "\\v", "\v")
      con.CmdNewline = str

    } else if m := regs["pager_cmd"].FindStringSubmatch(line); m != nil {
      str := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      str = strings.ReplaceAll(str, "\\n", "\n")
      str = strings.ReplaceAll(str, "\\r", "\r")
      str = strings.ReplaceAll(str, "\\t", "\t")
      str = strings.ReplaceAll(str, "\\a", "\a")
      str = strings.ReplaceAll(str, "\\b", "\b")
      str = strings.ReplaceAll(str, "\\f", "\f")
      str = strings.ReplaceAll(str, "\\v", "\v")
      con.PagerSend = str

    } else if regs["per_int"].MatchString(line) {
      if len(interfaces) == 0 {
        if opt_v {
          devlog = append(devlog, "per_int - no interfaces")
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        // no interfaces ?? bah...
        l ++
        for l < len(lines) && !regs["end_int"].MatchString(lines[l]) {
          l++
        }
        if l == len(lines) { panic("Could not skip to end_int") }
        continue // for loop will l++, pointint PAST end_int
      }
      int_i = 0
      ifName = interfaces[int_i]
      per_int++
      sect_stack = append(sect_stack, "per_int")

      if opt_v {
        devlog = append(devlog, "per_int: " + ifName)
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }
    } else if regs["end_int"].MatchString(line) {
      int_i++
      if int_i < len(interfaces) {
        //there is more interfaces, roll back
        ifName = interfaces[int_i]

        for l >= 0 && !regs["per_int"].MatchString(lines[l]) {
          l--
        }
        if l < 0 { panic("Couldn't roll back to per_int") }

        if opt_v {
          devlog = append(devlog, "per_int: " + ifName)
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        continue //for will l++ to next line after per_int
      }
      if opt_v {
        devlog = append(devlog, "per_int done")
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }
      int_i = -1
      ifName = "NO_NAME"
      per_int--
      if per_int < 0 {
        panic("Unmatched end_int at line " + ls)
      }
      if len(sect_stack) == 0 {
        panic("Sect stack is empty. At line " + ls)
      }
      if sect_stack[len(sect_stack) - 1] != "per_int" {
        panic("Sect overlap with per_int. At line " + ls)
      }
      sect_stack = sect_stack[:len(sect_stack) - 1]
    } else if regs["sect"].MatchString(line) {
      sect_depth++
      sect_stack = append(sect_stack, "sect")
    } else if regs["else"].MatchString(line) {
      if len(sect_stack) == 0 {
        panic("Unmatched else. At line " + ls)
      }
      if sect_stack[len(sect_stack) - 1] != "sect" {
        panic("else overlap with per_int. At line " + ls)
      }
      // prev section finished, skip to end of section
      // skip to end_sect
      subsects := 0
      for (l + 1) < len(lines) &&
        (( !regs["end_sect"].MatchString(lines[l + 1]) &&
           true) ||
         subsects > 0) &&
      true {
        if regs["sect"].MatchString(lines[l + 1]) {
          subsects++
        } else if regs["end_sect"].MatchString(lines[l + 1]) {
          subsects--
        }
        l++
      }
      if (l + 1) == len(lines) { panic("Could not skip to end of current section") }
      continue //for loop will l++, pointing to end_sect

    } else if regs["end_sect"].MatchString(line) {
      sect_depth--
      if sect_depth < 0 {
        panic("Unmatched end_sect at line " + ls)
      }
      if len(sect_stack) == 0 {
        panic("Sect stack is empty. At line " + ls)
      }
      if sect_stack[len(sect_stack) - 1] != "sect" {
        panic("Sect overlap with per_int. At line " + ls)
      }
      sect_stack = sect_stack[:len(sect_stack) - 1]
    } else if m := regs["log"].FindStringSubmatch(line); m != nil {
      if presel {
        continue
      }
      log := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      devlog = append(devlog, log)
      if opt_l && !presel {
        fmt.Println(devlog[ len(devlog) - 1])
      }
    } else if m := regs["nums_cross"].FindStringSubmatch(line); m != nil {
      op := m[1]
      list1 := subst(m[2], devs.VM(id), int_i, captures, ls, false)
      list2 := subst(m[3], devs.VM(id), int_i, captures, ls, false)

      if strings.HasPrefix(list1, "\"") && strings.HasSuffix(list1, "\"") {
        list1 = list1[1:len(list1) - 1]
      }

      if strings.HasPrefix(list2, "\"") && strings.HasSuffix(list2, "\"") {
        list2 = list2[1:len(list2) - 1]
      }

      if opt_v {
        devlog = append(devlog, "list1: " + list1)
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
        devlog = append(devlog, "list2: " + list2)
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }

      cross, ok := nums_cross(list1, list2, list_splitter, list_ranger)
      if !ok {
        panic("Bad num list at line " + ls +": list1: " + list1 + ", list2: " + list2)
      }

      go_on = false

      if cross {
        if op == "nums_cross" {
          go_on = true
        }
      } else {
        if op == "!nums_cross" {
          go_on = true
        }
      }

      if opt_v && go_on {
        devlog = append(devlog, "match successfull, continue")
        if opt_l && !presel {
          fmt.Println(devlog[ len(devlog) - 1])
        }
      }

      goto GO_ON

    } else if m := regs["list_splitter"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      r, _ := regexp.Compile(rstr)

      list_splitter = r

    } else if m := regs["list_ranger"].FindStringSubmatch(line); m != nil {
      rstr := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      r, _ := regexp.Compile(rstr)

      list_ranger = r

    } else if m := regs["setvar"].FindStringSubmatch(line); m != nil {
      varname := subst(m[1], devs.VM(id), int_i, captures, ls, false)
      val := subst(m[2], devs.VM(id), int_i, captures, ls, false)

      captures[varname] = val
    } else if m := regs["port"].FindStringSubmatch(line); m != nil {
      port = subst(m[1], devs.VM(id), int_i, captures, ls, false)
    } else if regs["start"].MatchString(line) {
      if presel {
        break
      }

    } else if regs["end"].MatchString(line) {
      // want to stop
      break
    } else if m := regs["fail"].FindStringSubmatch(line); m != nil {
      // want to stop with error status and message
      msg := subst(m[1], devs.VM(id), int_i, captures, ls, false)

      once_status.Do(func() {
        status_ch <- StatusMsg{id: id, msg: "exit fail: " + msg }
      })
      break
    } else {
      panic("Unknown command at line " + ls +":\n" + line)
    }

GO_ON:
    if !go_on {
      //got to skip to end of script, end_int, end_sect or else
      if len(sect_stack) == 0 {
        if presel {
          return false
        }
        if opt_v {
          devlog = append(devlog, "match failed, finish script" )
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        l = len(lines)
        break
      }

      if sect_stack[ len(sect_stack) - 1] == "per_int" {
        if opt_v {
          devlog = append(devlog, "match failed, skip per_int section" )
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        // skip to end_int
        for (l + 1) < len(lines) && !regs["end_int"].MatchString(lines[l + 1]) {
          l++
        }
        if (l + 1) == len(lines) { panic("Could not skip to end of current per_int") }
        continue //for loop will l++, pointing to end_int
      } else { //sect
        if opt_v {
          devlog = append(devlog, "match failed, skip sect section" )
          if opt_l && !presel {
            fmt.Println(devlog[ len(devlog) - 1])
          }
        }
        // skip to end_sect or else
        subsects := 0
        for (l + 1) < len(lines) &&
          (( !regs["end_sect"].MatchString(lines[l + 1]) &&
             !regs["else"].MatchString(lines[l + 1]) &&
             true) ||
           subsects > 0) &&
        true {
          if regs["sect"].MatchString(lines[l + 1]) {
            subsects++
          } else if regs["end_sect"].MatchString(lines[l + 1]) {
            subsects--
          }
          l++
        }
        if (l + 1) >= len(lines) { panic("Could not skip to end of current section") }
        if regs["else"].MatchString(lines[l + 1]) {
          // shoud move past else line to start it execution
          l++
        }
        if (l + 1) >= len(lines) { panic("Could not skip to end of current section") }
        continue //for loop will l++, pointing to end_sect or else
      }
    }
  }

  if !presel {
    if !opt_q {
      fmt.Println(devs.Vs(id, "short_name") + ": Done")
    }
    once_status.Do(func() {
      status_ch <- StatusMsg{id: id, msg: "exit done"}
    })
  } else {
    return true
  }

  if !opt_l && len(devlog) != 0 && !presel {
    global_mutex.Lock()

    if dev_logs == nil {
      dev_logs = make(map[string]string)
    }
    dev_logs[id] = strings.Join(devlog, "\n")

    global_mutex.Unlock()
  }

  return true
}
