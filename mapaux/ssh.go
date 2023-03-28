package mapaux

import (
  "fmt"
  "time"
  "strings"
  "io"
  "errors"
  "regexp"
  "golang.org/x/crypto/ssh"
)

var ErrTimeOut = errors.New("Expect Timed out")
var ErrBadMatched = errors.New("Expect bad condition matched")

func init() {
  _ = fmt.Sprint()
}

type SshConn struct {
  Lines int
  Cols int
  Term string
  CmdNewline string
  ReplyNewline string
  Config ssh.ClientConfig
  Conn *ssh.Client
  Sess *ssh.Session
  W io.WriteCloser
  R io.Reader
  //Cmd chan string
  ReaderClosedChan StopCloseChan
  ReaderErr error //read after IsStopped(ReaderClosedChan)
  Reply chan string
  stop_ch StopCloseChan
  PagerReg *regexp.Regexp
  PagerSend string
}

func NewSshConn() *SshConn {
  return &SshConn{
    Lines: 50,
    Cols: 80,
    Term: "xterm",
    CmdNewline: "\n",
    ReplyNewline: "\n",
  }
}

func (s *SshConn) Connect(host, user, pass string, stop_ch StopCloseChan) error {
  var err error

  s.stop_ch = stop_ch

  s.Config.User = user
  s.Config.Auth = []ssh.AuthMethod{ ssh.Password(pass) }
  s.Config.HostKeyCallback = ssh.InsecureIgnoreHostKey()
  s.Config.Timeout = 10 * time.Second
  s.Config.Config = ssh.Config{
		Ciphers: []string {
      "aes128-gcm@openssh.com", "chacha20-poly1305@openssh.com", "aes128-ctr", "aes192-ctr", "aes256-ctr",
      "aes128-cbc", "3des-cbc", "aes192-cbc", "aes256-cbc",
    },
    KeyExchanges: []string {
      "curve25519-sha256", "curve25519-sha256@libssh.org", "ecdh-sha2-nistp256", "ecdh-sha2-nistp384",
      "ecdh-sha2-nistp521", "diffie-hellman-group14-sha256", "diffie-hellman-group14-sha1", "ext-info-c",
      "diffie-hellman-group1-sha1",
    },
  }
  /*
  s.Config.Config = ssh.Config{
			Ciphers: []string{"aes128-ctr", "aes192-ctr", "aes256-ctr", "aes128-gcm@openssh.com",
				"arcfour256", "arcfour128", "aes128-cbc", "aes256-cbc", "3des-cbc", "des-cbc",
			},
		},
  */

  var dial_host_port string
  if strings.Index(host, ":") >= 0 {
    dial_host_port = host
  } else {
    dial_host_port = host + ":22"
  }

  s.Conn, err = ssh.Dial("tcp", dial_host_port, &s.Config)

  if err != nil { return err }

  s.Sess, err = s.Conn.NewSession()
  if err != nil {
    s.Conn.Close()
    return err
  }

  s.W, err = s.Sess.StdinPipe()
  if err != nil {
    s.Conn.Close()
    return err
  }

  s.R, err = s.Sess.StdoutPipe()
  if err != nil {
    s.Conn.Close()
    return err
  }

  s.Reply = make(chan string, 1024)

  s.ReaderClosedChan = make(StopCloseChan)
  s.ReaderErr = nil

  modes := ssh.TerminalModes{
    ssh.ECHO:          0,     // supress echo
  }

  err = s.Sess.RequestPty(s.Term, s.Lines, s.Cols, modes)
  if err != nil {
    s.Sess.Close()
    s.Conn.Close()
    return err
  }

  err = s.Sess.Shell()
  if err != nil {
    s.Sess.Close()
    s.Conn.Close()
    return err
  }

  go func() {
    defer close(s.ReaderClosedChan)
    defer close(s.Reply)

    for {

      if IsStopped(s.stop_ch) { return }

      var buff []byte
      buff = make([]byte, 1024)
      read, rerr := s.R.Read(buff)

      if rerr != nil {
        s.ReaderErr = rerr
        if rerr != io.EOF {
          fmt.Println(rerr)
        }
        return
      }

      if read > 0 {
        s.Reply <- string(buff[:read])
      }
    }
  } ()


  return nil
}

func (s *SshConn) Close() {
  s.W.Close()
  s.Sess.Close()
  s.Conn.Close()
}

func (s *SshConn) Cmd(cmd string) {
  send_data := []byte(cmd + s.CmdNewline)
  //fmt.Println()
  //fmt.Println(send_data)
  //fmt.Println()
  s.W.Write(send_data)
}

func (s *SshConn) Expect(d time.Duration, good, bad string) (string, error) {
  good_reg, err := regexp.Compile(good)
  if err != nil {
    return "", err
  }

  var bad_reg *regexp.Regexp = nil
  if bad != "" {
    bad_reg, err = regexp.Compile(bad)
    if err != nil {
      return "", err
    }
  }

  return s.ExpectReg(d, good_reg, bad_reg)
}

func (s *SshConn) ExpectReg(d time.Duration, good_reg, bad_reg *regexp.Regexp) (string, error) {

  expect_timer := time.NewTimer(d)

  var ret string
  var line string
  var rd_err error

L:for {
    select {
    case reply := <-s.Reply:
      expect_timer.Stop()
      line += strings.ReplaceAll(reply, "\r", "")
      lines := strings.Split(line, s.ReplyNewline)

      bad_matched := false
      good_matched := false
      pager_matched := false

      for li, l := range lines {
        good_matched = good_reg.MatchString(l)
        if bad_reg != nil {
          bad_matched = bad_reg.MatchString(l)
        }

        if s.PagerReg != nil {
          pager_matched = s.PagerReg.MatchString(l)
        }

        if li < (len(lines) - 1) {
          ret += l + s.ReplyNewline
        }
      }

      line = lines[len(lines) - 1]

      if good_matched || bad_matched {
        if bad_matched {
          rd_err = ErrBadMatched
        } else {
          rd_err = nil
        }
        break L
      }

      if pager_matched {
        s.W.Write([]byte(s.PagerSend))
      }

      expect_timer = time.NewTimer(d)
    case <-s.stop_ch:
      // app termination
      rd_err = ErrStopped
      break L
    case <-expect_timer.C:
      // Expect tired of waiting
      rd_err = ErrTimeOut
      break L
    case <-s.ReaderClosedChan:
      rd_err = s.ReaderErr
      break L
    }
  }

  ret += line

  expect_timer.Stop()
  return ret, rd_err
}
