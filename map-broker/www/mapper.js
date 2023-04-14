'use strict';

var fixed_div;
var user_self_sub = "none";
var user_self_id;

var g_show_tooltips = true;
var data = {};
var map_data = { "loc": {}, "tps": {}, "colors": {}, "options": {} };
var temp_data = { "devs": {}, "p2p_links": {} };

var protocols = {
  "1": "ICMP",
  "2": "IGMP",
  "6": "TCP",
  "8": "EGP",
  "9": "IGP",
  "17": "UDP",
  "47": "GRE",
  "50": "ESP",
  "51": "AH",
  "88": "EIGRP",
  "89": "OSPF",
  "94": "IPIP",
  "115": "L2TP",
};

var ports = {
  "0": "None",
  "20": "FTPd",
  "21": "FTPc",
  "22": "SSH",
  "23": "Telnet",
  "25": "SMTP",
  "53": "DNS",
  "67": "BOOTPs",
  "68": "BOOTPc",
  "69": "TFTP",
  "80": "HTTP",
  "88": "KRBRS",
  "110": "POP3",
  "123": "NTP",
  "137": "NetBIOS-ns",
  "138": "NetBIOS-dt",
  "139": "NetBIOS-ss",
  "143": "IMAP",
  "161": "SNMP",
  "162": "SNMPtr",
  "389": "LDAP",
  "443": "HTTPS",
  "445": "MS-DS",
  "500": "ISAKMP",
  "514": "Syslog",
  "515": "PRN",
  "554": "RTSP",
  "636": "LDAPS",
  "873": "RSYNC",
  "993": "IMAPS",
  "995": "POP3S",
  "1352": "Lotus",
  "1433": "MSSQLs",
  "1434": "MSSQLm",
  "1560": "1C",
  "1701": "L2TP",
  "1812": "RADAUTH",
  "1813": "RADACCT",
  "2049": "NFS",
  "3306": "MySQL",
  "3128": "Squid",
  "3389": "MSRDP",
  "4500": "Ipsec",
  "5650": "RMS",
  "6568": "Anydesk",
};

var site;
var proj;
var file_key = "";
var file_saved = 0;
var shared;
var enable_save = true;
var g_unsaved = false;

var workspace;

var allow_select = false;
var dev_selected = [];


var sel_border_width=5;
var sel_border_spacing=1;

var sel_border_line_color="dotted red";

var sel_border_offset=(-1-sel_border_width-sel_border_spacing)+"px";

var movementLock = false;

var def_int_size = 16;
var int_size; //set in data_loaded()
var int_half; // int_size / 2
var grid; //set in data_loaded()
var tp_grid; //set in data_loaded()
var tp_btn_size; //set in data_loaded()
var tp_grid_offset; //set in data_loaded()

var def_dev_name_size = (def_int_size - 1) +"px";
var dev_name_size; //set in data_loaded()

var windows = {};
var windows_z = 100000;
var g_win_stack_xy = 40;

var win_parts = {};

var connections = {};

var dev_border="1px lightgray dotted";
var group_border="1px gray dashed";

var devices_arranged = {};
var connections_rearranged = {};

var min_line_length=10; //for new turnpoint button

var tp_show = false;

var userinfo = {};

var default_graph_size = "500x70";
var graph_sizes_list = ["500x70", "500x150", "800x100", "800x200", "1000x150", "1000x300", "1600x180", "1600x350"];

var g_short_name_reg = /^[0-9a-z_A-Z][0-9a-z_A-Z\-]*$/;
var g_ifName_reg = /^[0-9a-z_A-Z][0-9a-z_A-Z\-\/# ]*$/;
var g_num_reg = /^\d+$/;

function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
};

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

function unwind_list(list) {
  let ret = [];

  let parts = String(list).split(",");
  for(let p in parts) {
    let part = parts[p];
    let range = part.split("-");
    if(range.length == 1) {
      ret.push(range);
    } else {
      for(let i = Number(range[0]); i <= Number(range[1]); i++) {
        ret.push(String(i));
      };
    };
  };
  return ret;
};

function gen_code() {
  let code_chars="qwertyuiopasdfghjkzxcvbnmQWERTYUPASDFGHJKLZXCVBNM23456789";
  let code = "";

  for(let i=0; i < 32; i++) {
    let idx = Math.floor(Math.random() * code_chars.length);
    code += code_chars.charAt(idx);
  };

  return code;
};

function format_mac(mac, view="canonic") {
  let m = String(mac).match(/^([0-9a-fA-F]{2})[:\.\-]?([0-9a-fA-F]{2})[:\.\-]?([0-9a-fA-F]{2})[:\.\-]?([0-9a-fA-F]{2})[:\.\-]?([0-9a-fA-F]{2})[:\.\-]?([0-9a-fA-F]{2})$/);
  if(m === null) return mac;

  switch(view) {
  case "canonic":
  case "u6c":
      return(m[1].toUpperCase()+":"+m[2].toUpperCase()+":"+m[3].toUpperCase()+":"+m[4].toUpperCase()+":"+m[5].toUpperCase()+":"+m[6].toUpperCase());
  case "snr":
  case "l6h":
      return(m[1].toLowerCase()+"-"+m[2].toLowerCase()+"-"+m[3].toLowerCase()+"-"+m[4].toLowerCase()+"-"+m[5].toLowerCase()+"-"+m[6].toLowerCase());
  case "cisco":
  case "l3d":
      return(m[1].toLowerCase()+m[2].toLowerCase()+"."+m[3].toLowerCase()+m[4].toLowerCase()+"."+m[5].toLowerCase()+m[6].toLowerCase());
  case "huawei":
  case "l3h":
      return(m[1].toLowerCase()+m[2].toLowerCase()+"-"+m[3].toLowerCase()+m[4].toLowerCase()+"-"+m[5].toLowerCase()+m[6].toLowerCase());
  };
  return mac;
};

$.fn.mac_info = function(mac) {
  $(this).data("mac_info.mac", mac);
  $(this).tooltip({
    classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
    items: $(this),
    content: function() {
      let mac = $(this).data("mac_info.mac");

      run_query({"action": "mac_info", "mac": mac}, function(res) {
        let elm = $("." + $.escapeSelector("mac_tooltip_"+mac));
        if(elm.length == 0) return;

        elm.empty();

        if(keys(res["ok"]).length == 0) {
          elm.text("Ничего не найдено");
          return;
        };

        let table = $(TABLE);

        table
         .append( $(TR)
           .append( $(TD).text("MAC:") )
           .append( $(TD).text(format_mac(mac)) )
         )
        ;

        if(res["ok"]["corp"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("Вендор:") )
             .append( $(TD).text(res["ok"]["corp"]) )
           )
          ;
        };

        if(res["ok"]["ports"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("Портов:") )
             .append( $(TD).text(res["ok"]["ports"].length) )
           )
          ;
        };

        if(res["ok"]["mac_ips"] !== undefined) {
          res["ok"]["mac_ips"].sort(num_compare);
          table
           .append( $(TR)
             .append( $(TD).text("IP:") )
             .append( $(TD).text(res["ok"]["mac_ips"].join(", ")) )
           )
          ;
        };


        elm.append(table);

         let a = 1;

      })

      return $(DIV).addClass("mac_tooltip_"+mac).text("Загрузка...")
       //.css({"background-color": "white"})
      ;
    }
  });

  return this;
};

$.fn.ip_info = function(ip) {
  if(ip == undefined || ip == "") return this;
  $(this).data("ip_info.ip", ip);
  $(this).tooltip({
    classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
    items: $(this),
    content: function() {
      let ip = $(this).data("ip_info.ip");

      run_query({"action": "ip_info", "ip": ip}, function(res) {
        let elm = $("." + $.escapeSelector("ip_tooltip_"+ip));
        if(elm.length == 0) return;

        elm.empty();

        if(keys(res["ok"]).length == 0) {
          elm.text("Ничего не найдено");
          return;
        };

        let table = $(TABLE);

        table
         .append( $(TR)
           .append( $(TD).text("IP:") )
           .append( $(TD).text(ip) )
         )
        ;

        if(res["ok"]["hostname"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("IPDB:") )
             .append( $(TD).text(res["ok"]["hostname"]) )
           )
          ;
        };

        if(res["ok"]["site"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("Локация:") )
             .append( $(TD)
               .append( get_tag({"id": "root", "children": data["sites"], "data": {}}, res["ok"]["site"])
               )
             )
           )
          ;
        };

        if(res["ok"]["net"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("IPDB NET:") )
             .append( $(TD).text(res["ok"]["net"]) )
           )
          ;
        };

        if(res["ok"]["dns"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("DNS:") )
             .append( $(TD).text(res["ok"]["dns"]) )
           )
          ;
        };

        if(res["ok"]["arp"] !== undefined) {
          let vendor = if_undef(res["ok"]["arp"]["mac_vendor"], "");
          table
           .append( $(TR)
             .append( $(TD).text("MAC:") )
             .append( $(TD)
               .text(format_mac(res["ok"]["arp"]["mac_addr"]) + "  " + vendor)
             )
           )
          ;
        };


        if(res["ok"]["whois"] !== undefined) {
          table
           .append( $(TR)
             .append( $(TD).text("WHOIS:") )
             .append( $(TD).text("Нажмите для информации...") )
           )
           .append( $(TR)
             .append( $(TD, {"colspan": 2}).text(whois(res["ok"]["whois"]))
               .css({"white-space": "pre", "font-family": "monospace"})
             )
           )
          ;
        };

        elm.append(table);

         let a = 1;

      })

      return $(DIV).addClass("ip_tooltip_"+ip).text("Загрузка...")
       //.css({"background-color": "white"})
      ;
    }
  });

  return this;
};

function whois(src) {
  let lines = String(src).split("\n");
  let out = [];

  let block = false;

  for(let l in lines) {
    let line = lines[l];
    let matches = [];
    if(matches = line.match(/(?:inetnum|netrange):\s*(\d+\.\d+\.\d+\.\d+)\s*-\s*(\d+\.\d+\.\d+\.\d+)/i)) {
      out.push(line);
      block = true;
    } else if(line.match(/(?:netname|country|org|organization):/i) && block) {
      out.push(line);
    } else if(line.match(/^\s*$/)) {
      block = false
    };
  };

  return out.join("\n");
};

function hex2ip(hex) {
  return v4long2ip(Number("0x"+hex));
};

function get_win_part(win_id, key, def) {
  if(win_parts[win_id] !== undefined && win_parts[win_id][key] !== undefined) {
    return win_parts[win_id][key];
  };
  return def;
};

function set_win_part(win_id, key, value) {
  if(win_parts[win_id] == undefined) win_parts[win_id] = {};
  win_parts[win_id][key] = value;
};

function shift_stack_xy() {
  g_win_stack_xy += 20;
  if(g_win_stack_xy > 400) {
    g_win_stack_xy=40;
  };
};

function hash_length(obj) {
    let size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function time() {
  return Math.floor( new Date().getTime() / 1000 );
};

function time_diff(seconds) {
  if(seconds < 2*60) {
    return seconds+" secs";
  } else if(seconds < 2*60*60) {
    return Math.floor( seconds/60 )+" mins";
  } else if(seconds < 2*60*60*24) {
    return Math.floor( seconds/(60*60) )+" hours";
  } else {
    return Math.floor( seconds/(60*60*24) )+" days";
  };
};

function lz(a) {
  return ('0'+a).slice(-2);
};

function DateTime(date) {
  return lz(date.getDate())+"."+lz(date.getMonth()+1)+"."+date.getFullYear()+" "+lz(date.getHours())+":"+lz(date.getMinutes());
};

function debugLog(text) {
  if(!DEBUG) return;

  $("#debug_win").text( $("#debug_win").text() + "\n" + text);
  $("#debug_win").scrollTop($("#debug_win").prop("scrollHeight"));
};

function save_local(key, value) {
  localStorage.setItem(key+"_"+user_self_sub, JSON.stringify(value));
};

function del_local(key) {
  if(typeof(key) === 'string') {
    localStorage.removeItem(key+"_"+user_self_sub);
  } else if(key instanceof RegExp) {
    let keys=[];
    for(let i=0; i < localStorage.length; i++) {
      if(localStorage.key(i).match(key)) {
        keys.push(localStorage.key(i));
      };
    };
    for(let i in keys) {
      localStorage.removeItem(keys[i]);
    };
  };
};

function get_local(key, on_error=undefined) {
  let js=localStorage.getItem(key+"_"+user_self_sub);
  if(js == undefined || js == "null") return on_error;
  try {
    return JSON.parse(localStorage.getItem(key+"_"+user_self_sub));
  } catch(e) {
    return on_error;
  };
};

function ip_link_id(dev1, if1, dev2, if2) {
  let dc = String(dev1).localeCompare(dev2);
  if(dc < 0) {
    return "ip_"+String(dev1)+"@"+String(if1)+"#"+String(dev2)+"@"+String(if2);
  } else if(dc > 0) {
    return "ip_"+String(dev2)+"@"+String(if2)+"#"+String(dev1)+"@"+String(if1);
  } else {
    error_at(); // should not ip link to itself!
    let ic = String(if1).localeCompare(if2);
    if(ic < 0) {
      return "ip_"+String(dev1)+"@"+String(if1)+"#"+String(dev2)+"@"+String(if2);
    } else {
      return "ip_"+String(dev2)+"@"+String(if2)+"#"+String(dev1)+"@"+String(if1);
    };
  };
};

function sort_by_string_key(arr, obj, key, asc=true) {
  if(asc) {
    arr.sort(function(a, b) {
      return String(obj[a][key]).toLowerCase().localeCompare( String(obj[b][key]).toLowerCase() );
    });
  } else {
    arr.sort(function(b, a) {
      return String(obj[a][key]).toLowerCase().localeCompare( String(obj[b][key]).toLowerCase() );
    });
  };
};

function sort_by_number_key(arr, obj, key, asc=true) {
  if(asc) {
    arr.sort(function(a, b) {
      return num_compare(String(obj[a][key]).toLowerCase(), String(obj[b][key]).toLowerCase());
    });
  } else {
    arr.sort(function(b, a) {
      return num_compare(String(obj[a][key]).toLowerCase(), String(obj[b][key]).toLowerCase());
    });
  };
};

function num_compare(a, b) {
  let aa=a.split(/(\d+)/);
  let ba=b.split(/(\d+)/);

  while(aa.length > 0 && ba.length > 0) {
    let av=aa.shift();
    let bv=ba.shift();
    if(isNaN(av) && !isNaN(bv)) {
      return 1;
    } else if(isNaN(bv) && !isNaN(av)) {
      return -1;
    } else if(isNaN(av) && isNaN(bv)) {
      let cres=av.localeCompare(bv);
      if(cres != 0) return cres;
    } else {
      if(Number(av) > Number(bv)) {
        return 1;
      } else if(Number(av) < Number(bv)) {
        return -1;
      };
    };
  };

  if(aa.length == ba.length) {
    return 0;
  } else if(aa.length > ba.length) {
    return 1;
  } else {
    return -1;
  };
};

function wdhm(time) {
  time=Math.floor(time);
  let w=Math.floor(time / (7*24*60*60));
  time = time - w*(7*24*60*60);

  let d=Math.floor(time / (24*60*60));
  time = time - d*(24*60*60);

  let h=Math.floor(time / (60*60));
  time = time - h*(60*60);

  let m=Math.floor(time / 60);
  let s=time - m*60;

  let ret="";
  if(w > 0) {
    ret = String(w)+" н. ";
  };
  if(d > 0 || w > 0) {
    ret += String(d)+" д. ";
  };
  if(h > 0 || d > 0 || w > 0) {
    ret += String(h)+" ч. ";
  };
  if(m > 0 || h > 0 || d > 0 || w > 0) {
    ret += String(m)+" м. ";
  };

  ret += String(s)+" с.";

  return ret;
};

const v4len2mask=[
  0, //0.0.0.0
  2147483648, //128.0.0.0
  3221225472, //192.0.0.0
  3758096384, //224.0.0.0
  4026531840, //240.0.0.0
  4160749568, //248.0.0.0
  4227858432, //252.0.0.0
  4261412864, //254.0.0.0
  4278190080, //255.0.0.0
  4286578688, //255.128.0.0
  4290772992, //255.192.0.0
  4292870144, //255.224.0.0
  4293918720, //255.240.0.0
  4294443008, //255.248.0.0
  4294705152, //255.252.0.0
  4294836224, //255.254.0.0
  4294901760, //255.255.0.0
  4294934528, //255.255.128.0
  4294950912, //255.255.192.0
  4294959104, //255.255.224.0
  4294963200, //255.255.240.0
  4294965248, //255.255.248.0
  4294966272, //255.255.252.0
  4294966784, //255.255.254.0
  4294967040, //255.255.255.0
  4294967168, //255.255.255.128
  4294967232, //255.255.255.192
  4294967264, //255.255.255.224
  4294967280, //255.255.255.240
  4294967288, //255.255.255.248
  4294967292, //255.255.255.252
  4294967294, //255.255.255.254
  4294967295 //255.255.255.255
];
const v4len2maskN=[
  0n, //0.0.0.0
  2147483648n, //128.0.0.0
  3221225472n, //192.0.0.0
  3758096384n, //224.0.0.0
  4026531840n, //240.0.0.0
  4160749568n, //248.0.0.0
  4227858432n, //252.0.0.0
  4261412864n, //254.0.0.0
  4278190080n, //255.0.0.0
  4286578688n, //255.128.0.0
  4290772992n, //255.192.0.0
  4292870144n, //255.224.0.0
  4293918720n, //255.240.0.0
  4294443008n, //255.248.0.0
  4294705152n, //255.252.0.0
  4294836224n, //255.254.0.0
  4294901760n, //255.255.0.0
  4294934528n, //255.255.128.0
  4294950912n, //255.255.192.0
  4294959104n, //255.255.224.0
  4294963200n, //255.255.240.0
  4294965248n, //255.255.248.0
  4294966272n, //255.255.252.0
  4294966784n, //255.255.254.0
  4294967040n, //255.255.255.0
  4294967168n, //255.255.255.128
  4294967232n, //255.255.255.192
  4294967264n, //255.255.255.224
  4294967280n, //255.255.255.240
  4294967288n, //255.255.255.248
  4294967292n, //255.255.255.252
  4294967294n, //255.255.255.254
  4294967295n //255.255.255.255
];
function cidr_valid(cidr) {
  let m=String(cidr).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if(m === null) return false;
  if(m[1] > 255 || m[2] > 255 || m[3] > 255 || m[4] > 255 || m[5] > 32) return false;

  let ip=v4oct2long(m[1], m[2], m[3], m[4]);
  let net = (ip & v4len2mask[ Number(m[5]) ]) >>> 0;
  if(ip != net) return false;

  return true;
};

function v4oct2long(i3, i2, i1, i0) {
  let ret = Number(i3) * 16777216;
  ret += Number(i2) * 65536;
  ret += Number(i1) * 256;
  ret += Number(i0);
  return ret >>> 0;
};

function v4ip2long(ip) {
  let m=String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(m == null || m.length != 5 || Number(m[1]) > 255 || Number(m[2]) > 255 ||
     Number(m[3]) > 255 || Number(m[4]) > 255
  ) {
    return false;
  } else {
    return(v4oct2long(m[1], m[2], m[3], m[4]));
  };
};
function v4long2ip(net) {
  let o=ip4octets(net);
  return o[0]+"."+o[1]+"."+o[2]+"."+o[3];
};

function ip4octets(net) {
  net = Number(net);
  let ret=[];
  ret[0] = Math.floor( net / 16777216);
  ret[1] = Math.floor( (net & 0xFFFFFF) / 65536);
  ret[2] = Math.floor( (net & 0xFFFF) / 256);
  ret[3] = net & 0xFF;
  return ret;
};

function ip4net(ip, masklen) {
  return Number(BigInt(ip) & v4len2maskN[masklen]);
};

function net_mask_wc(net, masklen) {
  return v4long2ip(net)+"/"+masklen+" ("+v4long2ip(v4len2mask[masklen])+" "+v4long2ip((~v4len2mask[masklen]) >>> 0) + ")";
};

function ellipsed(text, chars) {
  let ret = String(text);
  if(ret.length > (chars-3)) {
    ret = ret.substring(0, chars-3);
    ret += "...";
  };
  return ret;
};

function createWindow(win_id, title, options) {

  let elm=document.getElementById(win_id);

  let position = {"my": "center top", "at": "center top", "of": $(window)};
  if(elm != null) {
    position = $(elm).dialog("option", "position");
    $(elm).dialog("close");
  };

  let content = $(DIV).addClass("content");

  let dlg = $(DIV, {id: win_id}).addClass("dialog_start")
   .css({"z-index": windows_z})
   .title(title)
   .append( content )
   .appendTo( $("BODY") )
  ;

  let buttons = [];

  let dialog_options = {
    modal: false,
    maxHeight: $(window).height() - 10,
    maxWidth:1800,
    width: "auto",
    height: "auto",
    buttons: buttons,
    position: position,
    close: function() {
      $(this).dialog("destroy");
      $(this).remove();
    },
    open: function (event, ui) {
      $('.ui-dialog').css('z-index', windows_z+1);
      $('.ui-widget-overlay').css('z-index', windows_z);
    },
    resize: function() {
      let heightPadding = parseInt($(this).css('padding-top'), 10) + parseInt($(this).css('padding-bottom'), 10),
          widthPadding = parseInt($(this).css('padding-left'), 10) + parseInt($(this).css('padding-right'), 10),
          titlebarMargin = parseInt($(this).prev('.ui-dialog-titlebar').css('margin-bottom'), 10)
      ;
      $(this).height($(this).parent().height() -
        $(this).prev('.ui-dialog-titlebar').outerHeight(true) -
        heightPadding - titlebarMargin
      );

      $(this).width($(this).prev('.ui-dialog-titlebar').outerWidth(true) - widthPadding);
    },
  };

  if(options !== undefined) {
    for(let opt in options) {
      if(!/^_/.test(opt)) {
        dialog_options[opt] = options[opt];
      };
    };
  };

  dlg.dialog(dialog_options);
  let widget = dlg.dialog("widget");

  widget.find(".ui-dialog-titlebar-close").css({"font-size": "6pt", "font-weight": "normal"});
  widget.find(".ui-button-icon.ui-icon.ui-icon-closethick").removeClass("ui-icon-closethick").addClass("ui-icon-close");
  widget.find(".ui-dialog-title").css({"font-size": "10", "font-weight": "normal"});
  widget.find(".ui-dialog-titlebar").css({"padding": "0.1em 0.3em"});
  widget.find(".ui-dialog-content").css({"padding": "0.2em 0.3em"});
  widget.css({"border": "2px solid navy"});

  widget.find(":focus").blur();

  if(options !== undefined && options["_close"] !== undefined) {
    widget.find("BUTTON.ui-dialog-titlebar-close").off().click(options["_close"]);
  };

  dlg.on("recenter", function() {
    $(this).dialog("option", "position", $(this).dialog("option", "position"));
  });
  
  return dlg;
};

function save_windows() {
};


function dev_select_border(dev_elm, selected, color="#FF4444") {
  if(dev_elm === undefined || dev_elm.length == 0) return;
  dev_elm.find(".select_border").toggle(selected).css("border-color", color);
};  

function dev_list_stop(e, ui) {
  if(e.pageX > $(e.target).width()) {
    let id=ui.item.data('id');
    ui.item.remove();
    //let X=ui.position.left-workspace.offset().left;
    //let Y=ui.position.top-workspace.offset().top;

    let X=ui.position.left-workspace.offset().left + workspace.scrollLeft();
    let Y=ui.position.top-workspace.offset().top + workspace.scrollTop();

    if(X < 0) X = 0;
    if(Y < 0) Y = 0;

    X=Math.floor(X/grid)*grid;
    Y=Math.floor(Y/grid)*grid;

    map_data["loc"][id]={"x": X, "y": Y};
    save_map("loc", id);

    data_loaded(data, false);
    return;
  };
};

function get_tag_path(tag_data, tag_id, counter) {
  if(counter > 100) { error_at(); return; };

  if(String(tag_data["id"]) === String(tag_id)) {
    return [{"id": tag_data["id"], "text": tag_data["text"],
             "descr": tag_data["data"]["descr"], "flags": tag_data["data"]["flags"]
    }];
  };

  for(let i in tag_data["children"]) {
    let rec_res = get_tag_path(tag_data["children"][i], tag_id, counter + 1);
    if(rec_res !== null) {
      let ret = rec_res.slice();
      ret.unshift({"id": tag_data["id"], "text": tag_data["text"],
                                      "descr": tag_data["data"]["descr"],
                                      "flags": tag_data["data"]["flags"]
      });
      return ret;
    };
  };
  return null;
};

function get_tag_name(tag_data, tag_id) {
  let path = get_tag_path(tag_data, tag_id, 0);
  if(path === null || path.length == 0) return "";
  return(if_undef(path[path.length - 1]["text"], ""));
};

function get_tag(tag_data, tag_id) {
  let ret = $(LABEL).addClass("tag")
   .css({"white-space": "pre", "z-index": windows_z - 1})
  ;
  let text_words = [];
  let title_words = [];
  let path = get_tag_path(tag_data, tag_id, 0);
  if(path === null) {
    text_words.push("NULL");
    title_words.push("Тег не найден!");
  } else {
    for(let i in path) {
      if((path[i]["flags"] & F_DISPLAY) > 0 || String(path[i]["id"]) === String(tag_id)) {
        title_words.push(path[i]["text"]);
      }; 
      if((path[i]["flags"] & F_IN_LABEL) > 0 || String(path[i]["id"]) === String(tag_id)) {
        text_words.push(path[i]["text"]);
      }; 
    };
  };
  ret.data("title_words", title_words).text(text_words.join(":"));
  ret.tooltip({
    classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
    items: "LABEL",
    content: function() {
      let ret = $(DIV);
      let words = $(this).data("title_words");
      for(let i in words) { ret.append( $(LABEL).addClass("tag").text(words[i]) ); };
      return ret;
    }
  });
  return ret;
};

$( document ).ready(function() {
 
  //BEGIN begin
  window.onerror=function(errorMsg, url, lineNumber) {
    alert("Error occured: " + errorMsg + ", at line: " + lineNumber);//or any message
    return false;
  };

/*
  $(window).on('beforeunload', function() {
    if(g_autosave_changes > 0) {
      return "На странице есть несохраненные поля. Подтвердите уход.";
    } else {
      return undefined;
    };
  });
*/

  $(document).click(function() { $("UL.popupmenu").remove(); });
  $(document).keyup(function(e) {
    if (e.key === "Escape") { // escape key maps to keycode `27`
      $("UL.popupmenu").remove();
      $(".tooltip").remove();
    };
  });

  $(document).on("mouseup", function(e) {
    $(".graph").find(".time")
     .data("md", false)
     .removeData("range-start")
     .removeData("range-end")
     .find(".rangecursor").remove()
    ;
  });

  $("BODY").append (
    $(DIV).css({"position": "fixed", "right": "0.5em", "top": "0.5em", "min-width": "2em",
                "border": "1px solid black", "background-color": "lightgrey"
    }).prop("id", "indicator").text("Запуск интерфейса...")
  );

  $(document).ajaxComplete(function() {
    $("#indicator").text("Запрос завершен").css("background-color", "lightgreen");
  });

  $(document).ajaxStart(function() {
    $("#indicator").text("Запрос ...").css("background-color", "yellow");
  });

  $("BODY")
   .append( $(SPAN)
     .css({"position": "fixed", "top": "0.5em", "left": "0.5em", "background-color": "white",
           "z-index": windows_z - 1
     })
     .append( $(SPAN)
       .css({"border": "1px black solid", "padding": "0.4em 0.2em"})
       .append( $(SPAN, {"id": "site"})
       )
       .append( $(SPAN, {"id": "proj"})
       )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-globe"])
         .css({"margin-left": "0.5em"})
         .title("Выбрать локацию и проект")
         .click(selectLocation)
       )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-list"])
         .css({"margin-left": "0.5em"})
         .title("Список имеющихся раскладок")
         .click(selectLayout)
       )
     )
     .append( $(SPAN, {"id": "filename"})
       .css({"border": "1px black solid", "padding": "0.4em 0.2em", "margin-left": "1em"})
     )
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-menu"])
     .css({"position": "fixed", "top": "3.5em", "left": "0.5em"})
     .click(function(e) {
       e.stopPropagation();
       $("#menu").toggle();
       let show_menu = $("#menu").is(":visible");
       save_local("show_menu", show_menu);
     })
   )
   .append( $(LABEL, { id: "dev_list_btn" })
     .addClass("ns")
     .css({"position": "fixed", "top": "4.8em", "left": "0.5em",
           "border": "1px black solid", "background-color": "wheat",
           "padding-left": "0.2em", "padding-right": "0.2em"
     })
     .text("Загрузка")
     .click(function(e) { e.stopPropagation(); $("#dev_list").toggle(); })
   )
   .append( $(LABEL, { id: "dev_list" })
     .addClass("ns")
     .css({"position": "fixed", "top": "6.5em", "left": "0.5em", "bottom": "1em", "overflow-y": "scroll",
           "border": "1px black solid", "background-color": "wheat", "min-width": "100px"
     })
     .sortable({
       scroll: false,
       zIndex: 99999,
       helper: "clone",
       appendTo: $("BODY"),
       stop: dev_list_stop
     })
     .hide()
   )
  ;

  $(DIV, {"id": "menu"})
   .hide()
   .css({"position": "fixed", "top": "3.5em", "left": "3em"})
   .append( $(LABEL, {"id": "TP_btn"}).addClass(["button", "ui-icon", "ui-icon-vcs-branch"])
     //.css({"position": "absolute", "top": "0px", "left": "0px"})
     .title("Показать повортные точки")
     .click(function(e) {
       e.stopPropagation();
       tp_show = !tp_show;
       $(".new_tp").toggle(tp_show);
       $(".tp").toggle(tp_show);
       $("#delAllTPsBtn").toggle(tp_show);
       if(site == "l3") {
         for(let lid in connections) {
           draw_connection(lid);
         };
       };
     })
   )
   .append( $(LABEL, {"id": "delAllTPsBtn"}).addClass(["button", "ui-icon", "ui-icon-trash"])
     .hide()
     //.css({"position": "absolute", "top": "2em", "left": "0px"})
     .title("Удалить все повортные точки")
     .click(function(e) {
       e.stopPropagation();
     })
   )
   //.append( $(SPAN, {"id": "devSelBtn"})
     //.css({"position": "absolute", "top": "0px", "left": "2em", "white-space": "pre"})
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-select", "devSelBtn"])
       .title("Разрешить выбор устройств")
       .click(function(e) {
         e.stopPropagation();
         allow_select = !allow_select;
         save_local("allow_select", allow_select);
         if(!allow_select) {
           dev_select_border($(".device"), false);
           dev_selected=[];
         };
         $("#allow_select").trigger("recalc");
       })
     )
     .append( $(LABEL, {"id": "allow_select"}).addClass(["ui-icon", "ui-icon-lock", "devSelBtn"])
       .title("Выбор запрещен")
       .on("recalc", function() {
         if(allow_select) {
           $(this).removeClass("ui-icon-lock").addClass("ui-icon-unlocked")
            .title("Выбор разрешен")
            .css({"color": "darkgreen"})
           ;
           $(".vlink_btn").css({"color": "black"});
         } else {
           $(this).removeClass("ui-icon-unlocked").addClass("ui-icon-lock")
            .title("Выбор запрещен")
            .css({"color": "darkred"})
           ;
           $(".vlink_btn").css({"color": "gray"});
           
           let w = $("#vlink_win");
           if(w.length > 0 && w.find("TABLE").length == 0) {
             $("#vlink_win").dialog("close");
           };
         };
       })
     )
   //)
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-archive"])
     //.css({"position": "absolute", "top": "0px", "left": "6em"})
     .title("Управление раскладками")
     .click(function(e) {
       e.stopPropagation();
       showFileWindow();
     })
   )
   .append( $(LABEL).addClass(["button"])
     .text("MAC")
     //.css({"position": "absolute", "top": "0px", "left": "6em"})
     .title("MAC Vendor lookup")
     .click(function(e) {
       e.stopPropagation();
       macVendorWindow();
     })
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
     //.css({"position": "absolute", "top": "0px", "left": "6em"})
     .title("Поиск")
     .click(function(e) {
       e.stopPropagation();
       showSearchWindow();
     })
   )
   .append( $(LABEL).addClass(["button", "vdev_btn"])
     .text("vDev")
     .title("Виртуальные устройства")
     .click(function(e) {
       e.stopPropagation();
       vDevsWindow();
     })
   )
   .append( $(LABEL).addClass(["button", "vlink_btn"])
     .text("vLink")
     .title("Виртуальные связи")
     .click(function(e) {
       e.stopPropagation();
       vLinksWindow();
     })
   )
   .append( $(LABEL).addClass(["button", "vlans_btn"])
     .text("VLAN")
     .title("Показать VLAN и перечень портов в них")
     .click(function(e) {
       e.stopPropagation();
       VLANsWindow();
     })
   )
   .appendTo( $("BODY") )
  ;

  $("#menu").find("LABEL.button").css({"margin-left": "0.5em"});

  workspace = $(DIV)
   .css({"position": "absolute", "top": "0px", "left": "0px", "width": "100%", "height": "100%",
         "overflow": "auto", "z-index": "-10000001"
   })
   .click(function(e) {
     e.stopPropagation();
     dev_select_border($(".device"), false);
     dev_selected = [];
     vLinksWindow(true);
     $("#btnSetColor").prop("disabled", true);
     $("#btnGetColor").prop("disabled", true);
   })
   .appendTo( $("BODY") )
  ;


  if(DEBUG) {
    $("BODY")
     .append( $(DIV).prop("id", "debug_win")
       .addClass("wsp")
       .css({"position": "fixed", "bottom": "1em", "right": "1em", "width": "35em",
             "top": "15em", "overflow": "auto", "border": "1px black solid", "background-color": "white",
             "z-index": 100000}
       )
       .toggle(false)
     )
     .append( $(LABEL)
       .prop("id", "debug_clear_btn")
       .css({"position": "fixed", "bottom": "0em", "right": "3em",
             "z-index": 100001}
       )
       .append( $(LABEL)
         .addClass(["ui-icon", "ui-icon-delete", "button"])
         .click(function(e) {
           e.stopPropagation();
           $("#debug_win").contents().filter(function(){
              return (this.nodeType == 3);
           }).remove();
         })
       )
       .toggle(false)
     )
     .append( $(LABEL)
       .css({"position": "fixed", "bottom": "0em", "right": "1em",
             "z-index": 100001}
       )
       .append( $(LABEL)
         .addClass(["ui-icon", "ui-icon-arrowthick-2-n-s", "button"])
         .click(function(e) {
           e.stopPropagation();
           $("#debug_win,#debug_clear_btn").toggle();
         })
       )
     )
    ;
  };

  let query;

  shared = getUrlParameter("shared");
  if(shared === false) {
    shared = undefined;

    site = getUrlParameter("site", "l3");
    proj = getUrlParameter("proj", "all");
    file_key = getUrlParameter("file_key", "");
    query = {"action": "get_front", "site": site, "proj": proj, "file_key": file_key};

    let load_default = getUrlParameter("load_default", "");
    if(load_default != "" && file_key == "") {
      query["load_default"] = 1;
      window.history.pushState({}, window.title, String(window.location).replace("&load_default=1", ""));
    };
  } else {
    query = {"action": "get_front", "shared": shared};
  };

  run_query(query, function(res) {

    userinfo = res["ok"]["userinfo"];

    user_self_sub = userinfo["sub"];
    user_self_id = userinfo["id"];

    data["sites"] = res["ok"]["sites"];
    data["projects"] = res["ok"]["projects"];

    if(shared !== undefined) {
      site = res["ok"]["site"];
      proj = res["ok"]["proj"];
      enable_save = false;
      movementLock = true;
      $("#dev_list").sortable("disable");

      file_key = "I n v @ l ! d";

      $("#menu").find("#delAllTPsBtn,.devSelBtn").remove();

      let dlg = createWindow("shared", "Общий доступ");

      dlg.find(".content")
       .text("Вы загрузили раскладку, созданую другим пользователем.\n"+
         "Для внесения изменений сохранитие себе копию в меню управления раскладками."
       )
       .css({"white-space": "pre"})
       .trigger("recenter")
      ;

      $("#filename").text("Чужая раскладка").css({"color": "gray"})
        .title("Для внесения изменений сохранитие себе копию в меню управления раскладками.")
      ;
    } else {
      allow_select = get_local("allow_select", allow_select);
      $("#allow_select").trigger("recalc");

      if(file_key == "") {
        if(res["ok"]["default_map"] != undefined) {
          $("#filename").text("Раскладка по умолчанию").css({"color": "darkgreen"})
            .title("Раскладка создана другим пользователем и будет показываться до тех пор\n"+
              "пока вы не внесете изменение в расположение объектов."
            )
          ;
        } else if(res["ok"]["is_default_map_owner"] != undefined) {
          $("#filename").text("Для всех по умолчанию").css({"color": "darkgreen"})
            .title("Другие пользователи, которые впервые откроют текущую локацию, увидят вашу раскладку")
          ;
        } else {
          $("#filename").hide();
        };
      } else {
        $("#filename").text(res["ok"]["files_list"][file_key]["name"])
          .title("Дополнительная раскладка")
        ;
      };
      $("#filename").css({"color": "black"});
    };

    if(g_num_reg.test(site)) {
      $(".vdev_btn").show();
      $(".vlink_btn").show();
    } else {
      $(".vdev_btn").hide();
      $(".vlink_btn").hide();
    };

    let site_tag = get_tag({"id": "root", "children": data["sites"], "data": {}}, site);
    document.title = "MAP: " + site_tag.text();
    $("#site").empty().append(site_tag);
    $("#proj").empty();
    let proj_tags_list = String(proj).split(",");
    for(let i in proj_tags_list) {
      let proj_tag = get_tag({"id": "root", "children": data["projects"], "data": {}}, proj_tags_list[i]);
      $("#proj").append(proj_tag);
    };

    let show_menu = get_local("show_menu", false);
    $("#menu").toggle(show_menu)

    data_loaded(res["ok"]);

    let search_string = getUrlParameter("search", "");
    if(search_string != "") {
      let loc = window.location;
      let url = new URL(loc);
      let params = url.searchParams;
      params.delete("search");

      window.history.pushState({}, window.title, url);

      showSearchWindow(search_string);
    };
    //createWindow("test", "Test window", undefined);
  });
});

function data_loaded(new_data, really=true) {
  if(really) {
    map_data = new_data["map"]; //{loc, tps, colors, options}
    data["files_list"] = new_data["files_list"];

    let copy_keys = ["files_list", "is_default_map_owner", "default_map", "has_default_map"];
    for(let k in copy_keys) {
      if(new_data[ copy_keys[k] ] != undefined) {
        data[ copy_keys[k] ] = new_data[ copy_keys[k] ];
      };
    };
  };

  dev_selected = [];

  data["devs"] = new_data["devs"];
  data["l2_links"] = new_data["l2_links"];
  data["l3_links"] = new_data["l3_links"];


  temp_data["devs"] = {};
  temp_data["p2p_links"] = {};

  workspace.empty();
  $("#dev_list").empty();

  if(map_data["options"] !== undefined &&
     map_data["options"]["cell_size"] !== undefined
  ) {
    int_size = Number(map_data["options"]["cell_size"]);
  } else {
    int_size = def_int_size;
  };
  grid = int_size;
  int_half = Math.floor(int_size/2);

  tp_grid=int_size;
  tp_btn_size= Math.floor(int_size/3)*2;
  tp_grid_offset=Math.floor(int_size/2);

  if(map_data["options"] !== undefined &&
     map_data["options"]["name_size"] !== undefined
  ) {
    dev_name_size = map_data["options"]["name_size"];
  } else {
    dev_name_size = def_dev_name_size;
  };

  for(let dev_id in data["devs"]) {
    if(map_data["loc"][dev_id] === undefined) {
      device_to_list(dev_id);
    } else {
      add_device(dev_id);
    };
  };

  resort_dev_list();

  connections = {};

  build_connections();


  for(let dev_id in data["devs"]) {
    if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["_draw"] == 1) {
      arrange_interfaces_dev2tp(dev_id, false);
      arrange_interfaces_dev2dev(dev_id, false, false);
    };
  };

  for(let link_id in connections) {
    draw_connection(link_id);
  };
};

function resort_dev_list() {
  let count=$("#dev_list div").length;
  $("#dev_list_btn").text(count);
  if(count > 0) {
    $("#dev_list_btn").show();
  } else {
    $("#dev_list_btn").hide();
    $("#dev_list").hide();
  };

  $("#dev_list div").detach().sort(function(a,b) {
    return $(a).data('shortname').localeCompare($(b).data('shortname'));
  }).appendTo("#dev_list");
};


function device_in(dev) {
  let dev_id=dev["id"];

  if($(".ui-draggable-dragging").length > 0) return;

  let dev_elm = $(document.getElementById(dev_id));

  let info_pos = {"top": "1em", "left": "3em", "right": "1em", "height": "auto"};

  let dev_top = undefined;

  if(dev_elm.length > 0) {
    dev_top = dev_elm.position().top;
  };

  let dev_text="ID:&nbsp;"+dev_id+"&nbsp;&nbsp;";
  dev_text += "IP:&nbsp;"+dev["data_ip"];
  dev_text += "&nbsp;&nbsp;Type:&nbsp;";
  dev_text += dev["model_short"];
  dev_text += "<BR>";

  dev_text += "Uptime:&nbsp;"+dev["sysUpTimeStr"];

  if(dev["last_seen"] != undefined) {
    let last_seen=new Date(dev["last_seen"]*1000)
    let diff=time()-dev["last_seen"];
    dev_text += "&nbsp;Last seen:&nbsp;"+DateTime(last_seen)+"&nbsp;("+time_diff(diff)+" ago)";
  };

  dev_text += "<BR>";

  dev_text += "Location:&nbsp;"+dev["sysLocation"];

  let dev_info=$(DIV)
   .addClass("ns")
   .addClass("inpopup")
   .css("position", "fixed")
   .css("overflow", "auto")
   .css("border", "1px black solid")
   .css("z-index", windows_z-1)
   .css("background-color", "#FFFFAA")
   .css("font-size", dev_name_size)
   .css("white-space", "nowrap")
   .css("padding-left", "3px")
   .css(info_pos)
   .html(dev_text)
   .appendTo($("BODY"))
  ;

  if(dev_top !== undefined) {
    let info_bottom = dev_info.position().top + dev_info.height();
    if(info_bottom >= dev_top) {
      info_pos = {"bottom": "1em", "left": "3em", "right": "1em", "height": "auto", "top": "unset"};
      dev_info.css(info_pos);
    };

    let dev_x = dev_elm.position().left + workspace.scrollLeft();
    let dev_y = dev_elm.position().top + workspace.scrollTop();
    let dev_w = dev_elm.width();
    let dev_h = dev_elm.height();

    for(let int in dev["interfaces"]) {
      if(temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1) {
        let col = temp_data["devs"][dev_id]["interfaces"][int]["_col"];
        let row = temp_data["devs"][dev_id]["interfaces"][int]["_row"];

        let l = $(LABEL).addClass("inpopup")
         .css({"background-color": "#FFFFAA", "border": "1px solid black", "padding": "1px 1px", "position": "absolute", "z-index": windows_z - 1,
               "display": "inline-block", "font-size": "x-small"
         })
         .text(int)
        ;

        let l_css = {};

        if(row == 0) {
          //l_css = {"transform": "translateY(-100%)", "top": "unset", "margin-top": (dev_y - 1)+"px", "height": "auto", "left": (dev_x + col*int_size)+"px", "width": (int_size - 6)+"px", "writing-mode": "vertical-lr"};
          l_css = {"transform": "translateY(-100%)", "top": (dev_y - 2)+"px", "height": "auto", "left": (dev_x + col*int_size + 1)+"px", "width": (int_size - 6)+"px", "writing-mode": "vertical-lr"};
        } else if((row + 1) == temp_data["devs"][dev_id]["_rows"]) {
          l_css = {"top": (dev_y + dev_h + 4)+"px", "height": "auto", "left": (dev_x + col*int_size + 1)+"px", "width": (int_size - 6)+"px", "writing-mode": "vertical-lr"};
        } else if(col == 0) {
          l_css = {"top": (dev_y + row*int_size + 1)+"px", "height": (int_size - 6)+"px", "transform": "translateX(-100%)", "left": (dev_x - 2)+"px", "width": "auto"};
        } else {
          l_css = {"top": (dev_y + row*int_size + 1)+"px", "height": (int_size - 6)+"px", "left": (dev_x + dev_w + 4)+"px", "width": "auto"};
        };


        l.appendTo(workspace);
        l.css(l_css);
      };
    };
  };
};

function device_out() {
  $(".inpopup").remove();
};

function device_to_list(dev_id) {
  let name_color="darkorange";

  if(data["devs"][dev_id]["overall_status"] == "warn") {
    name_color="orange";
  } else if(data["devs"][dev_id]["overall_status"] == "error") {
    name_color="red";
  } else if(data["devs"][dev_id]["overall_status"] == "paused") {
    name_color="grey";
  } else if(data["devs"][dev_id]["overall_status"] == "ok") {
    name_color="black";
  };

  $("#dev_list").append(
    $(DIV)
     .data('id',dev_id)
     .data('shortname', data["devs"][dev_id]["short_name"] != undefined ? data["devs"][dev_id]["short_name"] : dev_id)
     .addClass("ns")
     .addClass("dev_in_list")
     .css("border", "1px black solid")
     .css("color", name_color)
     .css("background-color", "white")
     .css("margin-top", "3px")
     .css("margin-left", "3px")
     .css("padding-left", "0.3em")
     .css("padding-right", "0.3em")
     .hover(
       function (e) {
         e.stopPropagation();
         device_in(data["devs"][dev_id])
       },
       device_out
     )
     .append( $(LABEL).addClass("short_name")
       .css("white-space", "nowrap")
       .text(data["devs"][dev_id]["short_name"] != undefined ? data["devs"][dev_id]["short_name"] : dev_id)
     )
     .click(function() {
       device_win($(this).data("id"));
     })
  );
};

function device_dblclick(ui) {
  let id=ui.parent().prop('id');
  remove_from_map(id);
};

function remove_from_map(id, to_list=true) {
  delete map_data["loc"][id];
 
  save_map("loc", id);

  if(to_list) {
    device_to_list(id);
  };
  delete temp_data["devs"][id];

  $(document.getElementById(id)).remove();
  for(let link_id in connections) {
    if(connections[link_id]["to_dev"] == id || connections[link_id]["from_dev"] == id) {
      clear_link_objects(link_id);
      delete connections[link_id];
      delete map_data["tps"][link_id];
    };
  };
  save_map("tps");
  resort_dev_list();
  delete(map_data["tps"][id]);
  $(".inpopup").remove();
};

function device_win(dev_id) {
  run_query({"action": "get_device", "dev_id": dev_id}, function(res) {
    if(res["ok"]["fail"] !== undefined) {
      show_dialog("Устройство отсутствует в данных.");
      return; 
    };

    let dev = res["ok"]["dev"];

    let dlg_options = {
      _close: function() {
        let dlg = $(this).closest(".ui-dialog").find(".dialog_start");
        let win_id = dlg.data("win_id");

        delete(win_parts[win_id]);

        dlg.dialog("close");
      },
    };

    let win_id = "dev_win_" + dev_id;

    let dlg = createWindow(win_id, dev["short_name"], dlg_options);

    dlg.dialog("widget").find(".ui-dialog-titlebar")
     .append( $(BUTTON).addClass(["ui-button", "ui-corner-all", "ui-widget", "ui-button-icon-only", "ui-dialog-titlebar-close"])
       .css({"right": "4em", "height": "20px", "font-size": "x-small"})
       .append( $(SPAN).addClass(["ui-button-icon", "ui-icon", "ui-icon-reload"])
       )
       .append( $(SPAN).addClass(["ui-button-icon-space"]) )
       .click(function() {
         let dlg = $(this).closest(".ui-dialog").find(".dialog_start");
         let dev_id = dlg.data("dev_id");
         let win_id = dlg.data("win_id");
         set_win_part(win_id, "scroll", dlg.scrollTop());
         device_win(dev_id);
       })
     )
    ;
    let content = dlg.find(".content");
    dlg.data("dev_id", dev_id);
    dlg.data("win_id", win_id);
    data["devs"][dev_id] = dev;

    let last_seen=new Date(dev["last_seen"]*1000)
    let diff=time()-dev["last_seen"];

    let status_short = "Ok";
    let status_long = "В работе";
    let status_bg_color = "lightgreen";

    if(dev["overall_status"] == "ok") {
    } else if(dev["overall_status"] == "error") {
      status_short = "ERR";
      status_long = "Ошибка: "+dev["last_error"];
      status_bg_color = "red";
    } else if(dev["overall_status"] == "pause") {
      status_short = "PAU";
      status_long = "На паузе";
      status_bg_color = "gray";
    } else if(dev["overall_status"] == "warn") {
      status_short = "WRN";
      status_long = "Внимание: "+dev["last_error"];
      status_bg_color = "orange";
    } else {
      status_short = dev["overall_status"];
      status_long = dev["overall_status"] + ": "+dev["last_error"];
      status_bg_color = "purple";
    };

    content
     .css({"line-height": "150%"})
     .append( $(DIV)
       .append( $(LABEL).text(status_short).title(status_long)
         .css({"background-color": status_bg_color, "border": "1px solid black", "margin-right": "0.5em"})
       )
       .append( $(LABEL).text("Посл. данные: "+DateTime(last_seen)+" ("+time_diff(diff)+" назад)") )
       .append( !DEBUG ? $(LABEL) : $(LABEL).addClass(["button", "ui-icon", "ui-icon-copy"])
         .title("Скопировать ID в буфер")
         .data("to_copy", dev_id)
         .click(function() {
           let flash = $(this).closest("DIV");
           copy_to_clipboard( $(this).data("to_copy"),
             function() {
               flash.animateHighlight("lightgreen", 200);
             }
           );
         })
         .css({"float": "right", "margin-left": "1em"})
       )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-bullets"])
         .title("События")
         .css({"float": "right", "margin-left": "1em"})
         .data("dev_id", dev_id)
         .click(function() {
           let dev_id = $(this).data("dev_id");
           devEvents(dev_id);
         })
       )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
         .title("Удалить устройство из БД")
         .data("dev_id", dev_id)
         .click(function() {
           let dev_id = $(this).data("dev_id");
           show_confirm("Подтвердите удаление устройства из БД.\nВнимание! Отмена будет невозможна!\n"+
                        "Если устройство в сети, оно может быть обнаружено повторно.",
             function() {
               run_query({"action": "wipe_dev", "dev_id": dev_id}, function(res) {

                 if($(document.getElementById(dev_id)).length > 0) {
                   remove_from_map(dev_id, false);
                 } else {
                   $("#dev_list").find(".dev_in_list").each(function() {
                     if( $(this).data("id") == dev_id ) {
                       $(this).remove();
                       return false;
                     };
                   });
                   resort_dev_list();
                 };

                 delete(data["devs"][dev_id]);
 
                 for(let link_id in data["l2_links"]) {
                   if(data["l2_links"][link_id][0]["DevId"] == dev_id ||
                      data["l2_links"][link_id][1]["DevId"] == dev_id
                   ) {
                     wipe_l2_link(link_id);
                   };
                 };
               })
             },
           )
         })
         .css({"float": "right", "margin-left": "1em"})
       )
       .append( !DEBUG ? $(LABEL) : $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
         .css({"float": "right", "margin-left": "1em"})
         .data("data", jstr(dev))
         .click(function() {
           let dev_id = $(this).closest(".dialog_start").data("dev_id");
           createWindow("dev_json_"+dev_id, "JSON: "+data["devs"][dev_id]["short_name"], {
                        minWidth: 500,
                        maxWidth: 1500,
                        width: 500,
                        maxHeight:  $(window).height() - 10,
            })
            .find(".content").css({"white-space": "pre"}).text( $(this).data("data") )
            .parent().trigger("recenter")
           ;
         })
       )
     )
     .append( $(DIV)
       .append( $(SPAN).text("sysName: " + dev["sysName"]) )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-copy"])
         .title("Скопировать короткое имя в буфер")
         .data("to_copy", dev["short_name"])
         .click(function() {
           let flash = $(this).closest("DIV");
           copy_to_clipboard( $(this).data("to_copy"),
             function() {
               flash.animateHighlight("lightgreen", 200);
             }
           );
         })
         .css({"margin-left": "1em"})
       )
     )
     .append( $(DIV)
       .append( $(SPAN).text("sysLoc: " + dev["sysLocation"]) )
     )
     .append( $(DIV)
       .append( $(SPAN).text("Uptime: " + dev["sysUpTimeStr"]) )
     )
     .append( $(DIV)
       .append( $(SPAN).text(" IP: " + dev["data_ip"] + " ").ip_info(dev["data_ip"]) )
       .append( $(A, {"target": "blank", "href": "ssh://"+dev["data_ip"]}).text("SSH")
         .css({"margin-right": "0.5em"})
       )
       .append( $(A, {"target": "blank", "href": "telnet://"+dev["data_ip"]}).text("TELNET")
         .css({"margin-right": "0.5em"})
       )
       .append( $(A, {"target": "blank", "href": "/ipdb/?action=link&ip="+dev["data_ip"]}).text("IPDB")
       )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-copy"])
         .title("Скопировать IP в буфер")
         .data("to_copy", dev["data_ip"])
         .click(function() {
           let flash = $(this).closest("DIV");
           copy_to_clipboard( $(this).data("to_copy"),
             function() {
               flash.animateHighlight("lightgreen", 200);
             }
           );
         })
         .css({"margin-left": "1em"})
       )
     )
     .append( $(DIV)
       .append( $(LABEL).text("Тип: " + (dev["model_short"] != "Unknown" ? dev["model_short"] : dev["sysObjectID"]))
         .title(dev["model_long"])
       )
       .append( dev["model_short"] != "Unknown" ? $(LABEL) : $(A, {"target": "blank", "href": "https://oidref.com/"+String(dev["sysObjectID"]).replace(/^\./, "")})
         .css({"margin-left": "0.5em"})
         .text("?")
       )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-circle-b-info"])
         .css({"margin-left": "0.5em"})
         .click(function() { $(this).closest(".dialog_start").find(".sysdescr").toggle(); })
       )
     )
     .append( $(DIV).addClass("sysdescr")
       .hide()
       .css({"border-radius": "5px", "background-color": "lightgray", "border": "1px solid black", "white-space": "pre", "padding": "0.3em",
             "font-size": "smaller"
       })
       .text(dev["sysDescr"])
     )
    ;

    let cpu_mem_div;
    let cpu_mem_big_div;

    if(dev["CPUs"] !== undefined) {
      cpu_mem_div = $(DIV).css({"min-height": "34px", "height": "34px"});

      cpu_mem_big_div = $(DIV);

      let src = "graph?type=cpu&max=100&small&dev_id="+dev["safe_dev_id"]+"&cpu_list="+keys(dev["CPUs"]).join(",");
      src += "&" + unix_timestamp();

      let img_title_a = [];

      let gdata = {"type": "cpu", "max": 100, "dev_id": dev_id, "no_head": true, "cpu_list": keys(dev["CPUs"]).join(",")};

      for(let cpui in dev["CPUs"]) {
        src += "&cpu_name" + cpui + "=" + encodeURIComponent(dev["CPUs"][cpui]["name"]);
        src += "&cpu_key" + cpui + "=" + encodeURIComponent(dev["CPUs"][cpui]["_graph_key"]);
        img_title_a.push(dev["CPUs"][cpui]["name"]+": "+dev["CPUs"][cpui]["cpu1MinLoad"]+"%");

        gdata["cpu_name" + cpui] = dev["CPUs"][cpui]["name"];
        gdata["cpu_key" + cpui] = dev["CPUs"][cpui]["_graph_key"];
      };

      gdata["win_part_id"] = win_id;
      gdata["win_part_key"] = "cpu";

      cpu_mem_div
       .append( $(LABEL).text("CPUs: ") )
       .append( $(IMG, {"src": src}).title("1 Min Load:\n"+img_title_a.join("\n"))
         .css({"border": "1px solid gray"})
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let big = $(this).closest(".dialog_start").find(".cpu_big");
           if(big.hasClass("collapsed")) {
             big.removeClass("collapsed").css({"height": "auto"});
             set_win_part(win_id, "show_cpu_graph", true);
           } else {
             big.addClass("collapsed").css({"height": "0px"});
             set_win_part(win_id, "show_cpu_graph", false);
           };
         })
       )
      ;

      let show_cpu_graph = get_win_part(win_id, "show_cpu_graph", false);

      cpu_mem_big_div
       .append( $(DIV).addClass("cpu_big").css({"overflow": "hidden"})
         .addClass(show_cpu_graph ? [] : "collapsed")
         .graph(gdata)
       )
      ;
    };

    if(dev["memoryUsed"] !== undefined) {
      if(cpu_mem_div === undefined) {
        cpu_mem_div = $(DIV).css({"min-height": "34px", "height": "34px"});
        cpu_mem_big_div = $(DIV);
      };

      let src = "graph?type=mem&small&dev_id="+dev["safe_dev_id"];
      if(dev["memorySize"] !== undefined) {
        src += "&max=" + dev["memorySize"];
      };
      src += "&" + unix_timestamp();

      cpu_mem_div
       .append( $(LABEL).text(" Mem: ") )
       .append( $(IMG, {"src": src})
         .title("Занято "+GMK(dev["memoryUsed"]) + (dev["memorySize"] !== undefined ? " из " + GMK(dev["memorySize"]) : "" )) 
         .css({"border": "1px solid gray"})
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let big = $(this).closest(".dialog_start").find(".mem_big");
           if(big.hasClass("collapsed")) {
             big.removeClass("collapsed").css({"height": "auto"});
             set_win_part(win_id, "show_mem_graph", true);
           } else {
             big.addClass("collapsed").css({"height": "0px"});
             set_win_part(win_id, "show_mem_graph", false);
           };
         })
       )
      ;

      let gdata = {"type": "mem", "dev_id": dev_id, "no_head": true};
      if(dev["memorySize"] !== undefined) {
        gdata["max"] = dev["memorySize"];
      };

      gdata["win_part_id"] = win_id;
      gdata["win_part_key"] = "mem";

      let show_mem_graph = get_win_part(win_id, "show_mem_graph", false);

      cpu_mem_big_div
       .append( $(DIV).addClass("mem_big").css({"overflow": "hidden"})
         .addClass(show_mem_graph ? [] : "collapsed")
         .graph(gdata)
       )
      ;
    };

    if(cpu_mem_div !== undefined) {
      content.append( cpu_mem_div );
      content.append( cpu_mem_big_div );
    };

    let tabs_div = $(DIV);
    let tabs_content = $(DIV);

    tabs_div
     .append( $(LABEL).text("Interfaces").addClass(["button"])
       .click(function() {
         let win_id = $(this).closest(".dialog_start").data("win_id");
         let state = !get_win_part(win_id, "interfaces", false);
         $(this).closest(".dialog_start").find(".interfaces").toggle(state);
         set_win_part(win_id, "interfaces", state);
       })
     )
    ;

    let ifcs_div = $(DIV).addClass("interfaces").addClass("table")
     .toggle(get_win_part(win_id, "interfaces", false))
    ;

    for(let i in dev["interfaces_sorted"]) {
      let ifName = dev["interfaces_sorted"][i];
      let int_data = dev["interfaces"][ifName];

      let if_row = $(DIV).addClass("tr")
       .css({"min-height": "34px", "height": "34px"})
       .data("int", ifName)
       .data("dev_id", dev_id)
       .click(function() {
         interface_win($(this).data("dev_id"), $(this).data("int"));
       })
      ;

      if_row
       .append( $(SPAN).addClass("td").text(ifName)
         .css({"white-space": "nowrap"})
       )
      ;

      if(int_data["_graph_prefix"] !== undefined) {
        let gsrc = "graph?small&dev_id="+dev["safe_dev_id"]+"&int="+int_data["safe_if_name"];
        gsrc += "&" + unix_timestamp();

        let io_max = 10000000;
        if(int_data["ifSpeed"] != undefined && int_data["ifSpeed"] >= 10000000 && int_data["ifSpeed"] != "4294967295") {
          io_max = Number(int_data["ifSpeed"]);
        } else if(int_data["ifHighSpeed"] != undefined && int_data["ifHighSpeed"] >= 10) {
          io_max = Number(int_data["ifHighSpeed"]) * 1000000;
        };

        let pkts_max = Math.floor(io_max/15000);

        if_row
         .append( $(SPAN).addClass("td")
           .css({"white-space": "nowrap"})
           .append( $(IMG, {"src": gsrc+"&type=int_io&max="+io_max}).css({"border": "1px solid gray", "margin-right": "0.5em"}) )
           .append( $(IMG, {"src": gsrc+"&type=int_pkts&max="+pkts_max}).css({"border": "1px solid gray", "margin-right": "0.5em"}) )
         )
        ;
      } else {
        if_row.append( $(SPAN).addClass("td") );
      };

      if_row
       .append( $(SPAN).addClass("td")
         .css({"white-space": "nowrap"})
         .append( int_labels(ifName, dev) )
       )
      ;

      if_row
       .append( $(SPAN).addClass("td").text(int_data["ifAlias"])
         .css({"white-space": "nowrap"})
       )
      ;

      if_row.appendTo( ifcs_div );
    };

    ifcs_div.appendTo( tabs_content );

    if(dev["invEntParent"] !== undefined) {
      tabs_div
       .append( $(LABEL).text("Inventory").addClass(["button"])
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "inventory", false);
           $(this).closest(".dialog_start").find(".inventory").toggle(state);
           set_win_part(win_id, "inventory", state);
         })
       )
      ;

      let inventory = $(DIV).addClass("inventory")
       .toggle(get_win_part(win_id, "inventory", false))
      ;

      for(let key in dev["invEntParent"]) {
        if(dev["invEntParent"][key] == 0) {
          inventory.append( inv_ent(dev_id, key, 0) );
        };
      };

      inventory.appendTo( tabs_content );
    };

    if(dev["topTalkersUp"] !== undefined) {
      tabs_div
       .append( $(LABEL).text("TopTalkers").addClass(["button"])
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "toptalkers", false);
           $(this).closest(".dialog_start").find(".toptalkers").toggle(state);
           set_win_part(win_id, "toptalkers", state);
         })
       )
      ;

      let section = $(DIV).addClass("toptalkers")
       .toggle(get_win_part(win_id, "toptalkers", false))
      ;

      let dupes = {};
      let records = [];

      for(let key in dev["topTalkersInIf"]) {
        let full = true;
        let attrs = ["topTalkersBytes", "topTalkersDstIp", "topTalkersDstPort", "topTalkersFirst", "topTalkersLast",
                     "topTalkersOutIf", "topTalkersProto", "topTalkersSrcIp", "topTalkersSrcPort", "topTalkersPkts",
        ];
        for(let i in attrs) {
          if(dev[attrs[i]][key] === undefined) { full = false; break; };
        };
        if(!full) { continue };
        let rec_key = String(dev["topTalkersSrcIp"][key]) +
                      String(dev["topTalkersSrcPort"][key]) +
                      String(dev["topTalkersDstIp"][key]) +
                      String(dev["topTalkersDstPort"][key]) +
                      String(dev["topTalkersInIf"][key]) +
                      String(dev["topTalkersOutIf"][key]) +
                      String(dev["topTalkersProto"][key])
        ;

        if(dupes[rec_key] !== undefined) { continue; };

        dupes[rec_key] = 1;

        let duration = Math.round((Number(dev["topTalkersLast"][key]) - Number(dev["topTalkersFirst"][key]))/100);
        let divider = (duration <= 0)?1:duration;
        let speed_num = (Number(dev["topTalkersBytes"][key])*8)/divider;
        let speed = kmg(Math.round(speed_num)) + "bps";
        let pps_num = (Number(dev["topTalkersPkts"][key]))/divider;
        let pps = kmg(Math.round(pps_num)) + "pps";

        records.push(
          { "InIf": dev["topTalkersInIf"][key], "SrcIP": hex2ip(dev["topTalkersSrcIp"][key]), "SrcPort": dev["topTalkersSrcPort"][key],
            "OutIf": dev["topTalkersOutIf"][key], "DstIP": hex2ip(dev["topTalkersDstIp"][key]), "DstPort": dev["topTalkersDstPort"][key],
            "Proto": dev["topTalkersProto"][key], "Duration": duration, "Speed": speed, "SpeedNum": speed_num,
            "Bytes": dev["topTalkersBytes"][key], "divider": divider, "duration": duration, "rec_key": rec_key,
            "First": dev["topTalkersFirst"][key], "Last": dev["topTalkersLast"][key],
            "Pkts": dev["topTalkersPkts"][key], "Pps": pps, "PpsNum": pps_num,
          }
        );


      };

      let table = $(DIV).addClass("table").appendTo(section);

      table
       .data("sort", "Bytes")
       .append( $(DIV).addClass("thead")
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("InIf") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-s"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "InIf")
         )
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("SrcIP") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-s"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "SrcIP")
         )
         .append( $(SPAN).addClass("th")
           .text("SrcPrt")
         )
         .append( $(SPAN).addClass("th")
           .text("Proto")
         )
         .append( $(SPAN).addClass("th")
           .text("DstPrt")
         )
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("DstIP") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-n"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "DstIP")
         )
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("OutIf") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-n"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "OutIf")
         )
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("Bytes") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-s"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "Bytes")
         )
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("Speed") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-s"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "SpeedNum")
         )
         .append( $(SPAN).addClass("th")
           .append( $(SPAN).text("Pps") )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-triangle-1-s"])
             .css({"color": "gray"})
           )
           .data("sort", false)
           .data("sort_field", "PpsNum")
         )
       )
      ;

      table.find(".thead").find(".th")
       .click(function() {
         let field = $(this).data("sort_field");
         if(field === undefined) return;

         let state = $(this).data("sort");
         if(state) return;
         $(this).data("sort", !state);
         $(this).closest(".table").data("sort", field).trigger("resort");
       })
      ;

      table
       .on("resort", function() {
         let order = $(this).data("sort");
         let rows = $(this).find(".tbody").find(".tr").detach();
         rows.sort(function(a, b) {
            let a_data = $(a).data("data");
            let b_data = $(b).data("data");
            if(order == "Bytes" || order == "SpeedNum" || order == "PpsNum") {
              return Number(b_data[order]) - Number(a_data[order]);
            } else {
              let c = num_compare(String(a_data[order]), String(b_data[order]));
              if(c != 0) return c;
              return Number(b_data["Bytes"]) - Number(a_data["Bytes"]);
            };
          })
         ;
         rows.appendTo($(this).find(".tbody"));
         $(this).find(".thead").find(".th").each(function() {
           let this_field = $(this).data("sort_field");
           if(this_field !== undefined) {
             let lbl = $(this).find("LABEL");
             if(this_field == order) {
               lbl.css({"color": "blue"});
               $(this).data("sort", true);
             } else {
               lbl.css({"color": "gray"});
               $(this).data("sort", false);
             };
           };
         });
       })
      ;

      let tbody = $(DIV).addClass("tbody").appendTo(table);

      for(let i in records) {
        let rec = records[i];


        let proto_elm = $(SPAN).text( rec["Proto"] );
        if(protocols[String(rec["Proto"])] != undefined) {
          proto_elm.text(protocols[String(rec["Proto"])])
           .css({"border": "1px solid lightgray", "background-color": "#EEFFEE"})
           .title(String(rec["Proto"]))
          ;
        };

        let src_port_elm = $(SPAN).text( rec["SrcPort"] );
        if((rec["Proto"] == 6 || rec["Proto"] == 17) &&
           ports[String(rec["SrcPort"])] != undefined) {
          src_port_elm.text(ports[String(rec["SrcPort"])])
           .css({"border": "1px solid lightgray", "background-color": "#EEFFEE"})
           .title(String(rec["SrcPort"]))
          ;
        };

        let dst_port_elm = $(SPAN).text( rec["DstPort"] );
        if((rec["Proto"] == 6 || rec["Proto"] == 17) &&
           ports[String(rec["DstPort"])] != undefined) {
          dst_port_elm.text(ports[String(rec["DstPort"])])
           .css({"border": "1px solid lightgray", "background-color": "#EEFFEE"})
           .title(String(rec["DstPort"]))
          ;
        };

        if(rec["Proto"] != 6 && rec["Proto"] != 17) {
          src_port_elm.css({"color": "lightgray"});
          dst_port_elm.css({"color": "lightgray"});
        };

        let inif_elm = $(LABEL);
        let ifName = undefined;

        if(rec["InIf"] == 0) {
          for(let int in data["devs"][dev_id]["interfaces"]) {
            if(data["devs"][dev_id]["interfaces"][int]["ips"] != undefined &&
               data["devs"][dev_id]["interfaces"][int]["ips"][ rec["SrcIP"] ] !=  undefined
            ) {
              ifName = int;
              break;
            };
          };
        };
        
        if(ifName === undefined && rec["InIf"] == 0) {
          inif_elm.text("Local").css({"color": "lightgray"});
        } else {
          if(ifName === undefined) ifName = data["devs"][dev_id]["ifName"][String(rec["InIf"])];
          if(ifName === undefined) {
            inif_elm.text("Unkn: "+rec["InIf"]).css({"color": "orange"});
          } else if(data["devs"][dev_id]["interfaces"][ifName] === undefined) {
            inif_elm.text(ifName).css({"color": "orange"});
          } else {
            let title = "";
            if(data["devs"][dev_id]["interfaces"][ifName]["ifAlias"] !== undefined) {
              title = data["devs"][dev_id]["interfaces"][ifName]["ifAlias"];
            };

            inif_elm.text(ifName + (rec["InIf"] == 0?"*":""))
             .css({"border": "1px solid lightgray", "background-color": "#EEFFEE"})
             .title(title)
             .data("int", ifName)
             .click(function() {
               let int = $(this).data("int");
               let dev_id = $(this).closest(".dialog_start").data("dev_id");
               interface_win(dev_id, int);
             })
             .hover(
               function (e) {
                 e.stopPropagation();
                 let int = $(this).data("int");
                 let dev_id = $(this).closest(".dialog_start").data("dev_id");
                 interface_in(int, data["devs"][dev_id])
               },
               interface_out
             )
            ;
          };
        };

        let outif_elm = $(LABEL);
        ifName = undefined;
        if(rec["OutIf"] == 0) {
          for(let int in data["devs"][dev_id]["interfaces"]) {
            if(data["devs"][dev_id]["interfaces"][int]["ips"] != undefined &&
               data["devs"][dev_id]["interfaces"][int]["ips"][ rec["DstIP"] ] !=  undefined
            ) {
              ifName = int;
              break;
            };
          };
        };

        if(ifName === undefined && rec["OutIf"] == 0) {
          outif_elm.text("Local").css({"color": "lightgray"});
        } else {

          if(ifName === undefined) ifName = data["devs"][dev_id]["ifName"][String(rec["OutIf"])];
          if(ifName === undefined) {
            outif_elm.text("Unkn: "+rec["OutIf"]).css({"color": "orange"});
          } else if(data["devs"][dev_id]["interfaces"][ifName] === undefined) {
            outif_elm.text(ifName).css({"color": "orange"});
          } else {
            let title = "";
            if(data["devs"][dev_id]["interfaces"][ifName]["ifAlias"] !== undefined) {
              title = data["devs"][dev_id]["interfaces"][ifName]["ifAlias"];
            };

            outif_elm.text(ifName + (rec["OutIf"] == 0?"*":""))
             .css({"border": "1px solid lightgray", "background-color": "#EEFFEE"})
             .title(title)
             .data("int", ifName)
             .click(function() {
               let int = $(this).data("int");
               let dev_id = $(this).closest(".dialog_start").data("dev_id");
               interface_win(dev_id, int);
             })
             .hover(
               function (e) {
                 e.stopPropagation();
                 let int = $(this).data("int");
                 let dev_id = $(this).closest(".dialog_start").data("dev_id");
                 interface_in(int, data["devs"][dev_id])
               },
               interface_out
             )
            ;
          };
        };

        let tr = $(DIV).addClass("tr")
         .data("data", rec)
         .click(function(e) {
           if(!e.ctrlKey) return;
           let this_data = $(this).data("data");
           let dev_id = $(this).closest(".dialog_start").data("dev_id");
           createWindow("flow_json_"+this_data["rec_key"] + "@" + dev_id, "FLOW JSON: "+data["devs"][dev_id]["short_name"], {
                        minWidth: 500,
                        maxWidth: 1500,
                        width: 500,
                        maxHeight:  $(window).height() - 10,
            })
            .find(".content").css({"white-space": "pre"}).text( jstr(this_data))
            .parent().trigger("recenter")
           ;
         })
         .append( $(SPAN).addClass("td")
           .append( inif_elm )
         )
         .append( $(SPAN).addClass("td")
           .text( rec["SrcIP"] )
           .ip_info( rec["SrcIP"] )
         )
         .append( $(SPAN).addClass("td")
           .append( src_port_elm )
         )
         .append( $(SPAN).addClass("td")
           .append( proto_elm )
         )
         .append( $(SPAN).addClass("td")
           .append( dst_port_elm )
         )
         .append( $(SPAN).addClass("td")
           .text( rec["DstIP"] )
           .ip_info( rec["DstIP"] )
         )
         .append( $(SPAN).addClass("td")
           .append( outif_elm )
         )
         .append( $(SPAN).addClass("td")
           .text( kmg(rec["Bytes"]) )
         )
         .append( $(SPAN).addClass("td")
           .text( rec["Speed"] )
           .title( wdhm(rec["duration"]) )
         )
         .append( $(SPAN).addClass("td")
           .text( rec["Pps"] )
           .title( rec["Pkts"]+" pkts" )
         )
         .appendTo( tbody )
        ;
      };

      table.trigger("resort");

      section.appendTo( tabs_content );
    };

    if(dev["sites"] !== undefined) {
      tabs_div
       .append( $(LABEL).text("Локации").addClass(["button"])
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "sites", false);
           $(this).closest(".dialog_start").find(".sites").toggle(state);
           set_win_part(win_id, "sites", state);
         })
       )
      ;

      let section = $(DIV).addClass("sites")
        .addClass("table")
        .toggle(get_win_part(win_id, "sites", false))
        .append( $(DIV).addClass("thead")
          .append( $(SPAN).addClass("th").text("Локация") )
          .append( $(SPAN).addClass("th").text("На основании") )
        )
      ;

      dev["sites"].sort(function(a, b) {
        if(a["site"] != b["site"]) return num_compare(a["site"], b["site"]);
        return num_compare(a["by"], b["by"]);
      });

      for(let i in dev["sites"]) {
        let row_site = dev["sites"][i]["site"];

        section
          .append( $(DIV).addClass("tr")
            .append( $(SPAN).addClass("td")
              .append( get_tag({"id": "root", "data": {}, "children": data["sites"]}, row_site) )
              .append( row_site == site ? $(LABEL) : $(LABEL)
                .addClass(["button", "ui-icon", "ui-icon-linkext"])
                .title("Перейти")
                .css({"margin": "0 0.5em"})
                .data("site", row_site)
                .click(function() {
                  let row_site = $(this).data("site");
                  window.location = "?action=get_front&site="+row_site+"&proj="+proj+"&file_key="+(DEBUG?"&debug":"");
                })
              )
            )
            .append( $(SPAN).addClass("td")
              .append( $(SPAN).text(dev["sites"][i]["by"]) )
              .append( $(A, {"target": "blank",
                             "href": "/ipdb/?action=link&ip="+(String(dev["sites"][i]["by"]).split("/")[0]),
                })
                .text("IPDB")
                .css({"margin-left": "0.5em"})
              )
            )
          )
        ;
      };

      section.appendTo( tabs_content );
    };

    if(dev["projects"] !== undefined) {
      tabs_div
       .append( $(LABEL).text("Инф.системы").addClass(["button"])
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "projects", false);
           $(this).closest(".dialog_start").find(".projects").toggle(state);
           set_win_part(win_id, "projects", state);
         })
       )
      ;

      let section = $(DIV).addClass("projects")
        .addClass("table")
        .toggle(get_win_part(win_id, "projects", false))
        .append( $(DIV).addClass("thead")
          .append( $(SPAN).addClass("th").text("Инф. система") )
          .append( $(SPAN).addClass("th").text("На основании") )
        )
      ;

      dev["projects"].sort(function(a, b) {
        if(a["proj"] != b["proj"]) return num_compare(a["proj"], b["proj"]);
        return num_compare(a["by"], b["by"]);
      });

      for(let i in dev["projects"]) {
        let row_project = dev["projects"][i]["proj"];

        section
          .append( $(DIV).addClass("tr")
            .append( $(SPAN).addClass("td")
              .append( get_tag({"id": "root", "data": {}, "children": data["projects"]}, row_project) )
              .append( row_project == proj ? $(LABEL) : $(LABEL)
                .addClass(["button", "ui-icon", "ui-icon-linkext"])
                .title("Перейти")
                .css({"margin": "0 0.5em"})
                .data("proj", row_project)
                .click(function() {
                  let row_proj = $(this).data("proj");
                  window.location = "?action=get_front&site="+site+"&proj="+row_proj+"&file_key="+(DEBUG?"&debug":"");
                })
              )
            )
            .append( $(SPAN).addClass("td")
              .append( $(SPAN).text(dev["projects"][i]["by"]) )
              .append( $(A, {"target": "blank",
                             "href": "/ipdb/?action=link&ip="+(String(dev["projects"][i]["by"]).split("/")[0]),
                })
                .text("IPDB")
                .css({"margin-left": "0.5em"})
              )
            )
          )
        ;
      };

      section.appendTo( tabs_content );
    };

    if(dev["config"] !== undefined) {
      tabs_div
       .append( $(LABEL).text("Конфигурация").addClass(["button"])
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "config", false);
           $(this).closest(".dialog_start").find(".config").toggle(state);
           set_win_part(win_id, "config", state);
         })
       )
      ;

      let section = $(DIV).addClass("config")
        .addClass("wsp")
        .toggle(get_win_part(win_id, "config", false))
        .text(dev["config"])
      ;

      section.appendTo( tabs_content );
    };


    content.append( tabs_div );
    content.append( tabs_content );

    dlg.trigger("recenter");

    dlg.scrollTop(get_win_part(win_id, "scroll", 0));
  });
};

function inv_ent(dev_id, key, count) {
  let ret = $(DIV);
  if(count > 100) { error_at(); return ret; };

  ret.css({"padding-left": count+"em"});

  let self_div = $(DIV)
   .css({"background-color": "azure", "padding": "0.05em 0.5em",
         "border": "1px solid gray", "display": "inline-block",
   })
   .appendTo( ret )
  ;

  let name = data["devs"][dev_id]["invEntName"] !== undefined ?
    String(data["devs"][dev_id]["invEntName"][key]).trim() : ""
  ;
  let descr = data["devs"][dev_id]["invEntDescr"] !== undefined ?
    String(data["devs"][dev_id]["invEntDescr"][key]).trim() : ""
  ;
  let fru = data["devs"][dev_id]["invEntCRU"] !== undefined ?
    data["devs"][dev_id]["invEntCRU"][key] : undefined
  ;
  let fw_rev = data["devs"][dev_id]["invEntFwRev"] !== undefined ?
    String(data["devs"][dev_id]["invEntFwRev"][key]).trim() : ""
  ;
  let hw_rev = data["devs"][dev_id]["invEntHwRev"] !== undefined ?
    String(data["devs"][dev_id]["invEntHwRev"][key]).trim() : ""
  ;
  let sw_rev = data["devs"][dev_id]["invEntSwRev"] !== undefined ?
    String(data["devs"][dev_id]["invEntSwRev"][key]).trim() : ""
  ;
  let mfg = data["devs"][dev_id]["invEntMfg"] !== undefined ?
    String(data["devs"][dev_id]["invEntMfg"][key]).trim() : ""
  ;
  let model = data["devs"][dev_id]["invEntModel"] !== undefined ?
    String(data["devs"][dev_id]["invEntModel"][key]).trim() : ""
  ;
  let serial = data["devs"][dev_id]["invEntSerial"] !== undefined ?
    String(data["devs"][dev_id]["invEntSerial"][key]).trim() : ""
  ;
  let type = data["devs"][dev_id]["invEntType"] !== undefined ?
    data["devs"][dev_id]["invEntType"][key] : undefined
  ;

  let type_text = "Undef";

  switch(type) {
  case undefined:
    type_text = "Undef";
    break;
  case 1:
    type_text = "Other";
    break;
  case 2:
    type_text = "Unknown";
    break;
  case 3:
    type_text = "Chassis";
    break;
  case 4:
    type_text = "Backplane";
    break;
  case 5:
    type_text = "Container";
    break;
  case 6:
    type_text = "PSU";
    break;
  case 7:
    type_text = "FAN";
    break;
  case 8:
    type_text = "Sensor";
    break;
  case 9:
    type_text = "Module";
    break;
  case 10:
    type_text = "Port";
    break;
  case 11:
    type_text = "Stack";
    break;
  case 12:
    type_text = "CPU";
    break;
  default:
    type_text = type;
  };

  self_div
   .append( $(DIV).text(name).title(descr) )
  ;

  if(descr != "") {
    self_div
     .append( $(DIV).text(descr) )
    ;
  };
  self_div
   .append( $(DIV)
     .append( $(LABEL).text("Type: "+type_text) )
     .append( $(LABEL).text(serial != "" ? " Serial: "+serial : "") )
   )
  ;

  let revision_a = [];
  if(hw_rev != "") { revision_a.push("HW Rev: "+hw_rev); };
  if(fw_rev != "") { revision_a.push("FW Rev: "+fw_rev); };
  if(sw_rev != "") { revision_a.push("SW Rev: "+sw_rev); };

  if(revision_a.length > 0 ) {
    self_div.append( $(DIV).text(revision_a.join(", ")) );
  };

  let model_a = [];

  if(mfg != "") { model_a.push(mfg); };
  if(model != "") { model_a.push(model); };

  if(model_a.length > 0 ) {
    self_div.append( $(DIV).text(model_a.join(" ")) );
  };

  let children = [];

  for(let child_key in data["devs"][dev_id]["invEntParent"]) {
    if(Number(data["devs"][dev_id]["invEntParent"][child_key]) == Number(key)) {
      children.push(child_key);
    };
  };

  if(children.length > 0) {
    children.sort(function(a, b) { return data["devs"][dev_id]["invEntOrder"][a] - data["devs"][dev_id]["invEntOrder"][b]; });

    let children_div = $(DIV);

    for(let i in children) {
      children_div.append( inv_ent(dev_id, children[i], count+1) );
    };

    children_div.appendTo(ret);
  };

  return ret;
};

function device_click(ui, e) {
  let id=ui.parent().attr('id');

  if(!e.ctrlKey && !e.shiftKey) {
    device_win(id);
    return;
  };

  //device_clicked(data["devs"][id]);
  if(data["devs"][id] != undefined && allow_select) {
    if(e.ctrlKey) {
      let i=dev_selected.indexOf(id);
      if(i < 0) {
        dev_selected.push(id);
        dev_select_border($(document.getElementById(id)), true);
      } else {
        dev_selected.splice(i,1);
        dev_select_border($(document.getElementById(id)), false);
      };
    } else if(e.shiftKey) {
      dev_select_border($(".device"), false);
      dev_select_border($(document.getElementById(id)), true);
      dev_selected=[id];
    };

    if(dev_selected.length > 0) {
      $("#btnSetColor").prop("disabled", false);
    } else {
      $("#btnSetColor").prop("disabled", true);
    };
    if(dev_selected.length == 1) {
      $("#btnGetColor").prop("disabled", false);
    } else {
      $("#btnGetColor").prop("disabled", true);
    };
    vLinksWindow(true);
  };
};

function drag_start() {
  $(".inpopup").remove();
};

function device_drag(id, X,Y) {

  map_data["loc"][id]={"x": X, "y": Y};

  save_map("loc", id);

  devices_arranged = {};
  connections_rearranged = {};

/*
  arrange_interfaces_dev2tp(id, true);
  arrange_interfaces_dev2dev(id, true, true);
*/

  for(let dev_id in data["devs"]) {
    if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["_draw"] == 1) {
      arrange_interfaces_dev2tp(dev_id, false);
      arrange_interfaces_dev2dev(dev_id, false, false);
    };
  };

  for(let link_id in connections) {
    draw_connection(link_id);
  };
};

function device_drag_stop(e, ui) {
  let X=$(this).position().left+workspace.scrollLeft();
  let Y=$(this).position().top+workspace.scrollTop();
  let id=$(this).attr('id');

  if(X < 0) X = 0;
  if(Y < 0) Y = 0;

  X = Math.floor(X / int_size) * int_size;
  Y = Math.floor(Y / int_size) * int_size;

  $(this).css({"top": Y, "left": X});

  if(dev_selected.length < 2 || dev_selected.indexOf(id) < 0) {
    device_drag(id,X,Y);
  } else {
    let dX=X-map_data["loc"][id]["x"];
    let dY=Y-map_data["loc"][id]["y"];

    devices_arranged={};
    connections_rearranged={};

    let dev_links = [];
    let link_devs = {};

    for(let i in dev_selected) {
      let newX, newY;
      let dev_id=dev_selected[i];
      let dev_elm=$(document.getElementById(dev_id));
      if(dev_elm.length) {
        if(dev_id != id) {
          let curLeft=dev_elm.position().left;
          let curTop=dev_elm.position().top;
          newX=curLeft+workspace.scrollLeft()+dX;
          newY=curTop+workspace.scrollTop()+dY;
          dev_elm.css({"left": newX, "top": newY});
        } else {
          newX=X;
          newY=Y;
        };
        map_data["loc"][dev_id]={"x": newX, "y": newY};
        //device_drag(dev_id,newX,newY);
        for(let int in data["devs"][dev_id]["interfaces"]) {
          if(site == "l3") {
            if(temp_data["devs"][dev_id] !== undefined && temp_data["devs"][dev_id]["interfaces"] !== undefined &&
               temp_data["devs"][dev_id]["interfaces"][int] !== undefined &&
               temp_data["devs"][dev_id]["interfaces"][int]["l3_links"] !== undefined
            ) {
              for(let lid in temp_data["devs"][dev_id]["interfaces"][int]["l3_links"]) {
                let link_id = temp_data["devs"][dev_id]["interfaces"][int]["l3_links"][lid];
                if(temp_data["p2p_links"][link_id] !== undefined &&
                   connections[link_id] !== undefined &&
                   map_data["tps"][link_id] !== undefined &&
                   dev_links.indexOf(link_id) < 0
                ) {
                  dev_links.push(link_id);
                  link_devs[link_id] = { "dev1": temp_data["p2p_links"][link_id]["from_dev"],
                                         "dev2": temp_data["p2p_links"][link_id]["to_dev"]
                                       }
                  ;
                };
              };
            };
          } else {
            if(data["devs"][dev_id]["interfaces"][int]["l2_links"] !== undefined) {
              for(let lid in data["devs"][dev_id]["interfaces"][int]["l2_links"]) {
                let link_id=data["devs"][dev_id]["interfaces"][int]["l2_links"][lid];
                if(connections[link_id] !== undefined &&
                   map_data["tps"][link_id] !== undefined &&
                   data["l2_links"][link_id] !== undefined &&
                   dev_links.indexOf(link_id) < 0
                ) {
                  dev_links.push(link_id);
                  link_devs[link_id] = { "dev1": data["l2_links"][link_id][0]["DevId"],
                                         "dev2": data["l2_links"][link_id][1]["DevId"]
                                       }
                  ;
                };
              };
            };
          };
        };
      };
    };

    for(let l in dev_links) {
      let link_id=dev_links[l];
      if(dev_selected.indexOf( link_devs[link_id]["dev1"] ) >= 0 &&
         dev_selected.indexOf( link_devs[link_id]["dev2"] ) >= 0
      ) {
        for(let tpi in map_data["tps"][link_id]) {
          map_data["tps"][link_id][tpi]["x"] += dX;
          map_data["tps"][link_id][tpi]["y"] += dY;
        };
      };
    };

    for(let dev_id in data["devs"]) {
      if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["_draw"] == 1) {
        arrange_interfaces_dev2tp(dev_id, false);
        arrange_interfaces_dev2dev(dev_id, false, false);
      };
    };

    for(let lid in connections) {
      draw_connection(lid);
    };

    save_map();
  };
};

function int_popup_label(int, dev_id) {

  if(document.getElementById("inpopup_"+int+"@"+dev_id) !== null) return;

  let dev_elm=$(document.getElementById(dev_id));
  let dev_name=dev_elm.children(".devname");

  if(dev_name == undefined || dev_name.length == 0) {
    //error_at("Cannot get dev name handle");
    return;
  };

  let int_st=int_style(int,data["devs"][dev_id]);

  let name_width=dev_name.outerWidth();
  let name_height=dev_name.outerHeight();
  let name_top=dev_name.position().top;
  let name_left=dev_name.position().left;

  let src_int = data["devs"][dev_id]["interfaces"][int]["tunnelSrcIfName"];
  let over_name_text=int_st["short_name"];
  if(src_int !== undefined) {
    over_name_text += "\n"+src_int;
  };

  let col=temp_data["devs"][dev_id]["interfaces"][int]["_col"];
  let row=temp_data["devs"][dev_id]["interfaces"][int]["_row"];
  let cols=temp_data["devs"][dev_id]["_cols"];
  let rows=temp_data["devs"][dev_id]["_rows"];

  let to_left=false;

  if(col == cols-1 && (row > 0 && row < rows - 1)) {
    to_left=true;
  };


  let div=$(DIV, {"id": "inpopup_"+int+"@"+dev_id})
   .addClass("inpopup")
   .css("position", "absolute")
   .css("left", name_left+"px")
   .css("top", name_top+"px")
   .css("height", name_height-2+"px")
   .css("white-space", "pre")
   .css("line-height", src_int !== undefined ? "80%": "normal")
   .css("background-color", "#FFFFAA")
   .css("border", "1px solid black")
   .css("z-index", windows_z-1)
   .css({"padding": "1px"})
   .append( $(LABEL).html("&bull;").css({"font-size": src_int !== undefined ? "normal":"larger", "color": int_st["bullet_color"]}) )
   .append( $(LABEL).text(over_name_text)
     .css({"font-size": src_int !== undefined ? "smaller":"larger"})
   )
  ;

  div.appendTo(dev_elm);

  let int_label_width=div.outerWidth();

  if(int_label_width <= name_width-2) {
    div.css("width", name_width-2+"px");
  } else if(to_left) {
    div.css("left", (name_left - (int_label_width-name_width))+"px");
  };

  let draw_dash=false;
  let dash_left;
  let dash_top;
  let dash_width;
  let dash_height;

  if(row == 0 || row == rows-1) { //horizontal dash
    draw_dash=true;
    dash_width=int_size-2;
    dash_height=3;
    if(row == 0) {
      dash_top = -dash_height;
    } else {
      dash_top = int_size*rows-2;
    };
    dash_left=int_size*col;
  };

  if(draw_dash) {
    let dash=$(DIV)
     .addClass("inpopup")
     .css("position", "absolute")
     .css("left", dash_left+"px")
     .css("top", dash_top+"px")
     .css("width", dash_width+"px")
     .css("height", dash_height+"px")
     .css("background-color", "fuchsia")
     .css("z-index", windows_z-1)
     .appendTo(dev_elm);
  };

  draw_dash=false;

  if(col == 0 || col == cols-1) {
    draw_dash=true;
    dash_height=int_size-2;
    dash_width=3;
    if(col == 0) {
      dash_left = -dash_width;
    } else {
      dash_left = int_size*cols-2;
    };
    dash_top=int_size*row;
  };
  if(draw_dash) {
    let dash=$(DIV)
     .addClass("inpopup")
     .css("position", "absolute")
     .css("left", dash_left+"px")
     .css("top", dash_top+"px")
     .css("width", dash_width+"px")
     .css("height", dash_height+"px")
     .css("background-color", "fuchsia")
     .css("z-index", windows_z-1)
     .appendTo(dev_elm);
  };

  if(src_int !== undefined) {
    let src_elm = document.getElementById(src_int+"@"+dev_id);
    if(src_elm != null) {
      $(src_elm).addClass("outlined").css({"outline": "3px solid fuchsia"});
    };
  } else {
    for(let ifName in data["devs"][dev_id]["interfaces"]) {
      if(data["devs"][dev_id]["interfaces"][ifName]["tunnelSrcIfName"] == int) {
        let _elm = document.getElementById(ifName+"@"+dev_id);
        if(_elm != null) {
          $(_elm).addClass("outlined").css({"outline": "3px solid fuchsia"});
        };
      };
    };
  };
};

function kmg(speed,space) {
  if(! /^\d+$/.test(speed)) {
    return("error");
  };
  if(space == undefined) {
    space=" ";
  };
  let num_speed=Number(speed);
  if(num_speed < 1000) {
    return num_speed+space;
  } else if(num_speed < 1000000) {
    return Number(num_speed/1000).toFixed(1).toString().replace(/\.0$/,"")+space+"K";
  } else if(num_speed < 1000000000) {
    return Number(num_speed/1000000).toFixed(1).toString().replace(/\.0$/,"")+space+"M";
  } else {
    return Number(num_speed/1000000000).toFixed(1).toString().replace(/\.0$/,"")+space+"G";
  };
};


function int_metrics(int, dev) {
  let labels={};
  if(dev == undefined || dev["interfaces"] == undefined ||
     dev["interfaces"][int] == undefined) {
    labels["00_error"]["short_text"]="ERROR";
    labels["00_error"]["long_text"]="undefined data!!!";
    labels["00_error"]["bg_color"]="red";
  } else {
    labels["00_ifstatus"]={};
    if(dev["interfaces"][int]['ifAdminStatus'] == 2) {
      labels["00_ifstatus"]["short_text"]="Sh";
      labels["00_ifstatus"]["long_text"]="Shutdown";
      labels["00_ifstatus"]["bg_color"]="gray";
    } else {
      if(dev["interfaces"][int]['ifOperStatus'] == 2) {
        labels["00_ifstatus"]["short_text"]="Dn";
        labels["00_ifstatus"]["long_text"]="Down";
        labels["00_ifstatus"]["bg_color"]="red";
      } else if(dev["interfaces"][int]['ifOperStatus'] == 1) {
        if(dev["interfaces"][int]["stpBlockInstances"] == undefined) {
          labels["00_ifstatus"]["short_text"]="Up";
          labels["00_ifstatus"]["long_text"]="Up";
          labels["00_ifstatus"]["bg_color"]="lightgreen";
          //labels["00_ifstatus"]["bg_color"]="greenyellow";
        } else {
          labels["00_ifstatus"]["short_text"]="Bl";
          labels["00_ifstatus"]["long_text"]="STP Blocked";
          labels["00_ifstatus"]["bg_color"]="magenta";
        };
        if(dev["interfaces"][int]["eigrpIfPkts"] != undefined && dev["interfaces"][int]["eigrpIfPkts"] > 0 &&
           dev["interfaces"][int]["eigrpIfPeerCount"] == 0
        ) {
          labels["00_ifstatus"]["short_text"]="Ei";
          labels["00_ifstatus"]["long_text"]="No EIGRP neighbours";
          labels["00_ifstatus"]["bg_color"]="orange";
        };
      } else {
        labels["00_ifstatus"]["short_text"]="Un";
        labels["00_ifstatus"]["long_text"]="Unknown";
        labels["00_ifstatus"]["bg_color"]="orange";
      };
    };

    if(dev["interfaces"][int]['ips'] != undefined) {
      labels["01_0ips"]={};
      let ips_keys=keys(dev["interfaces"][int]['ips']).map(function(ip) {
        return ip+"/"+dev["interfaces"][int]['ips'][ip]['masklen'];
      });
      let count=hash_length(dev["interfaces"][int]['ips']);
      if(count == 0) {
        labels["01_0ips"]["short_text"]="ERROR";
        labels["01_0ips"]["long_text"]="IPs object error!";
        labels["01_0ips"]["bg_color"]="red";
      } else {
        labels["01_0ips"]["short_text"]=count+"&nbsp;IPs";
        labels["01_0ips"]["long_text"]=ips_keys.join(", ");
        labels["01_0ips"]["bg_color"]="lightgreen";
      };

      if(dev["interfaces"][int]['ifType'] != 24 &&
         dev["interfaces"][int]['ifType'] != 1 &&
         dev["interfaces"][int]['ifType'] != 131 &&
         dev["interfaces"][int]['ifOperStatus'] == 1
      ) {
        labels["01_1arp"]={};
        labels["01_1arp"]["short_text"]="ARP";
        if(dev["interfaces"][int]['arp_count'] != undefined) {
          labels["01_1arp"]["long_text"] = dev["interfaces"][int]['arp_count'] + " ARP records";
          labels["01_1arp"]["bg_color"]="white";
        } else {
          labels["01_1arp"]["long_text"] = "No ARP records";
          labels["01_1arp"]["bg_color"]="lightcoral";
        };
      };
    };

    if(dev["interfaces"][int]['ifSpeed'] != undefined && dev["interfaces"][int]['ifSpeed'] != "4294967295") {
      labels["02_speed"]={};
      labels["02_speed"]["short_text"]=kmg(dev["interfaces"][int]['ifSpeed'])+"bps";
      labels["02_speed"]["long_text"]="ifSpeed "+dev["interfaces"][int]['ifSpeed'];
      labels["02_speed"]["bg_color"]="white";
    } else if(dev["interfaces"][int]['ifHighSpeed'] != undefined) {
      labels["02_speed"]={};
      labels["02_speed"]["short_text"]=kmg(dev["interfaces"][int]['ifHighSpeed']*1000000)+"bps";
      labels["02_speed"]["long_text"]="ifSpeed "+dev["interfaces"][int]['ifHighSpeed']*1000000;
      labels["02_speed"]["bg_color"]="white";
    };

    if(dev["interfaces"][int]['portMode'] != undefined &&
       dev["interfaces"][int]['portPvid'] != undefined &&
       1
    ) {
      labels["03_switchport"]={};
      if(dev["interfaces"][int]['portMode'] == 1) { //access
        labels["03_switchport"]["short_text"]="A&nbsp;"+if_undef(dev["interfaces"][int]['portPvid'], "");
        labels["03_switchport"]["long_text"]="Access VLAN:&nbsp;"+if_undef(dev["interfaces"][int]['portPvid'], "");
        if(dev["interfaces"][int]['portVvid'] != undefined && dev["interfaces"][int]['portVvid'] != 4096) {
          labels["03_switchport"]["short_text"] += ", V "+if_undef(dev["interfaces"][int]['portVvid'], "");
          labels["03_switchport"]["long_text"] += "\nVoice VLAN: "+if_undef(dev["interfaces"][int]['portVvid'], "");
        };
        labels["03_switchport"]["bg_color"]="#AAAAFF";
      } else if(dev["interfaces"][int]['portMode'] == 2) { //trunk
        labels["03_switchport"]["short_text"]="T&nbsp;"+if_undef(dev["interfaces"][int]['portTrunkVlans'], "")+
          "/"+ if_undef(dev["interfaces"][int]['portPvid'], "")
        ;
        labels["03_switchport"]["long_text"]="Trunk PVID:&nbsp;"+if_undef(dev["interfaces"][int]['portPvid'], "")+
                                   ",&nbsp;Allowed:&nbsp;"+if_undef(dev["interfaces"][int]['portTrunkVlans'], "")
        ;
        labels["03_switchport"]["bg_color"]="#AAAAFF";
      } else if(dev["interfaces"][int]['portMode'] == 3) { //hybrid
        labels["03_switchport"]["short_text"]="H&nbsp;"+if_undef(dev["interfaces"][int]['portHybridUntag'], "")+
          "/"+if_undef(dev["interfaces"][int]['portHybridTag'], "")+
          "/"+if_undef(dev["interfaces"][int]['portPvid'], "")
        ;
        labels["03_switchport"]["long_text"]="Hybrid PVID:&nbsp;"+if_undef(dev["interfaces"][int]['portPvid'], "")+
                                   ",&nbsp;Untag:&nbsp;"+if_undef(dev["interfaces"][int]['portHybridUntag'], "")+
                                   ",&nbsp;Tag:&nbsp;"+if_undef(dev["interfaces"][int]['portHybridTag'], "")
        ;
        labels["03_switchport"]["bg_color"]="#AAAAFF";
      } else { //unknown
        labels["03_switchport"]["short_text"]="U&nbsp;"+dev["interfaces"][int]['portPvid'];
        labels["03_switchport"]["long_text"]="Unknown, PVID:&nbsp;"+if_undef(dev["interfaces"][int]['portPvid'], "");
        labels["03_switchport"]["bg_color"]="#FFAAFF";
      };
    } else if(dev["interfaces"][int]["routedVlan"] !== undefined) {
      labels["03_switchport"]={};
      labels["03_switchport"]["short_text"] = "R " + dev["interfaces"][int]["routedVlan"];
      labels["03_switchport"]["long_text"] = "Routed VLAN " + dev["interfaces"][int]["routedVlan"] +
        (dev["interfaces"][int]["routedVlanParent"] == undefined ? "" : ", Parent: " +
          dev["interfaces"][int]["routedVlanParent"]
        )
      ;
      labels["03_switchport"]["bg_color"]="#BABAFF";
    };

    if(dev["interfaces"][int]["lldp_count"] != undefined) {
      labels["04_0lldp"]={};
      labels["04_0lldp"]["short_text"]="LLDP&nbsp;"+dev["interfaces"][int]["lldp_count"];
      labels["04_0lldp"]["long_text"]=dev["interfaces"][int]["lldp_count"]+"&nbsp;LLDP Neighbours&nbsp;";
      labels["04_0lldp"]["bg_color"]="#FFCCFF";
      if(dev["lldp_ports"] != undefined &&
         dev["interfaces"][int]["lldp_portIndex"] != undefined &&
         dev["lldp_ports"][ dev["interfaces"][int]["lldp_portIndex"] ] != undefined &&
         dev["lldp_ports"][ dev["interfaces"][int]["lldp_portIndex"] ]["neighbours"] != undefined
      ) {
        let neigs_list = [];
        for(let i in dev["lldp_ports"][ dev["interfaces"][int]["lldp_portIndex"] ]["neighbours"]) {
          if(neigs_list.length == 10) {
            neigs_list.push("...");
            break;
          };
          let nei = dev["lldp_ports"][ dev["interfaces"][int]["lldp_portIndex"] ]["neighbours"][i];
          let nei_ip = "NO IP";
          if(nei["RemMgmtAddr"] != undefined && nei["RemMgmtAddr"]["1"] != undefined) {
            nei_ip = nei["RemMgmtAddr"]["1"];
          };
          neigs_list.push(nei_ip + " " + nei["RemSysName"] + " : " + nei["RemPortId"]);
        };
        labels["04_0lldp"]["long_text"]=dev["interfaces"][int]["lldp_count"]+"&nbsp;LLDP Neighbours\n"+
          neigs_list.join("\n")
        ;
      };
    };

    if(dev["interfaces"][int]["cdp_count"] != undefined) {
      labels["04_1cdp"]={};
      labels["04_1cdp"]["short_text"]="CDP&nbsp;"+dev["interfaces"][int]["cdp_count"];
      labels["04_1cdp"]["long_text"]=dev["interfaces"][int]["cdp_count"]+"&nbsp;CDP Neighbours&nbsp;";
      labels["04_1cdp"]["bg_color"]="#FFCCFF";
      if(dev["cdp_ports"] != undefined &&
         dev["interfaces"][int]["cdp_portIndex"] != undefined &&
         dev["cdp_ports"][ dev["interfaces"][int]["cdp_portIndex"] ] != undefined &&
         dev["cdp_ports"][ dev["interfaces"][int]["cdp_portIndex"] ]["neighbours"] != undefined
      ) {
        let neigs_list = [];
        for(let i in dev["cdp_ports"][ dev["interfaces"][int]["cdp_portIndex"] ]["neighbours"]) {
          if(neigs_list.length == 10) {
            neigs_list.push("...");
            break;
          };
          let nei = dev["cdp_ports"][ dev["interfaces"][int]["cdp_portIndex"] ]["neighbours"][i];
          neigs_list.push(nei["cdpRemAddrDecoded"] + " " + nei["cdpRemDevId"] + " : " + nei["cdpRemIfName"]);
        };
        labels["04_1cdp"]["long_text"]=dev["interfaces"][int]["cdp_count"]+"&nbsp;CDP Neighbours\n"+
          neigs_list.join("\n")
        ;
      };
    };

    if(dev["interfaces"][int]["macs_count"] != undefined) {
      labels["05_macs"]={};
      labels["05_macs"]["short_text"] = String(dev["interfaces"][int]["macs_count"])+"m";
      labels["05_macs"]["long_text"] = String(dev["interfaces"][int]["macs_count"])+" MACs";
      if((dev["interfaces"][int]['portMode'] === 1 && dev["interfaces"][int]["macs_count"] > 3) ||
         (dev["interfaces"][int]['ifOperStatus'] == 1 && dev["interfaces"][int]["macs_count"] == 0 &&
          dev["macs_time"] !== undefined) ||
        false
      ) {
        labels["05_macs"]["bg_color"]="#FF8888";
      } else {
        labels["05_macs"]["bg_color"]="#FFCCFF";
        labels["05_macs"]["bg_color"]="white";
      };
    } else if(dev["macs_time"] !== undefined && dev["interfaces"][int]['ifOperStatus'] == 1 &&
              dev["interfaces"][int]["lag_parent"] === undefined &&
              dev["interfaces"][int]["pagp_parent"] === undefined &&
              dev["interfaces"][int]["ifType"] == 6 &&
              true
    ) {
      labels["05_macs"]={};
      labels["05_macs"]["short_text"] = "0m";
      labels["05_macs"]["long_text"] = "No MACs";
      labels["05_macs"]["bg_color"]="#FF8888";
    };

    if(dev["interfaces"][int]["lag_parent"] != undefined) {
      labels["06_lag"]={};
      labels["06_lag"]["short_text"] = "LAG";
      labels["06_lag"]["long_text"] = "LAG member port of " + dev["interfaces"][int]["lag_parent"];
      labels["06_lag"]["bg_color"]="tan";
    } else if(dev["interfaces"][int]["lag_members"] != undefined) {
      labels["06_lag"]={};
      labels["06_lag"]["short_text"] = "LAG";
      labels["06_lag"]["long_text"] = "LAG parent for " + dev["interfaces"][int]["lag_members"].join(", ");
      labels["06_lag"]["bg_color"]="lime";
    } else if(dev["interfaces"][int]["pagp_parent"] != undefined) {
      labels["07_pagp"]={};
      labels["07_pagp"]["short_text"] = "PAGP";
      labels["07_pagp"]["long_text"] = "PAGP member port of " + dev["interfaces"][int]["pagp_parent"] +
        " Mode: " + dev["interfaces"][int]["pagp_mode"];
      labels["07_pagp"]["bg_color"]="tan";
    } else if(dev["interfaces"][int]["pagp_members"] != undefined) {
      labels["07_pagp"]={};
      labels["07_pagp"]["short_text"] = "PAGP";
      labels["07_pagp"]["long_text"] = "PAGP parent for " + dev["interfaces"][int]["pagp_members"].join(", ");
      labels["07_pagp"]["bg_color"]="lime";
    };
  };
  return labels;
};

function int_labels(int, dev) {
  let labels = int_metrics(int, dev);
  let ret="";

  let k=keys(labels).sort();
  for(let i in k) {
    let key=k[i];
    ret += "&nbsp;<LABEL style=\"padding: 0 0.2em; background-color: "+labels[key]["bg_color"]+"; border: 1px black solid\" title=\""+labels[key]["long_text"]+"\">"+labels[key]["short_text"]+"</LABEL>";
  };
  return ret;
};



function interface_in(int, dev) {
  let dev_id=dev["id"];
  let int_st=int_style(int,dev);

  int_popup_label(int, dev_id);

  let sec=new Date().getTime();

  let safe_dev_id = dev["safe_dev_id"];
  let safe_int = dev["interfaces"][int]["safe_if_name"];

  let int_info_text=dev["interfaces"][int]["ifName"]+"&nbsp;";
  if(dev["virtual"] == undefined) {
    let io_src="graph?type=int_io&dev_id="+safe_dev_id+"&int="+safe_int+"&small&"+sec;
    let pkt_src="graph?type=int_pkts&dev_id="+safe_dev_id+"&int="+safe_int+"&small&"+sec;
    let ifspeed=1000000000;
    if(dev["interfaces"][int]["ifSpeed"] != undefined && dev["interfaces"][int]["ifSpeed"] > 0) {
      ifspeed=dev["interfaces"][int]["ifSpeed"];
    };
    io_src += "&max="+ifspeed;
    pkt_src += "&max="+Math.floor(ifspeed/12000);
    int_info_text += "<IMG src=\""+io_src+"\"/>&nbsp;<IMG src=\""+pkt_src+"\"/>&nbsp;"
  };

  int_info_text += int_labels(int,dev);
  int_info_text += "&nbsp;";

  let int_descr = dev["interfaces"][int]["ifAlias"];

  let int_info=$(DIV)
   .addClass("ns")
   .addClass("inpopup")
   .css("position", "fixed")
   .css("overflow", "auto")
   .css("border", "1px black solid")
   .css("z-index", windows_z-1)
   .css("background-color", "#FFFFAA")
   .css("font-size", dev_name_size)
   .css("white-space", "nowrap")
   .css("padding", "0.5em")
   .css({"top": "1em", "left": "3em", /*"right": "1em",*/ "height": "auto"})
   .html(int_info_text)
   .append( $(LABEL).text(int_descr) )
  ;

  if(dev["interfaces"][int]["ips"] != undefined) {
    for(let ip in dev["interfaces"][int]["ips"]) {
      int_info.append( $(BR) )
       .append( $(LABEL).text(ip+"/"+dev["interfaces"][int]["ips"][ip]["masklen"]) );
    };
  };

  int_info.appendTo($("BODY"));

  let dev_elm = $(document.getElementById(dev_id));
  if(dev_elm.length > 0) {
    let info_bottom = int_info.position().top + int_info.height();
    if(info_bottom >= dev_elm.position().top) {
      //relocate
      let info_pos = {"bottom": "1em", "left": "3em", "right": "1em", "height": "auto", "top": "unset"};
      int_info.css(info_pos);
    };
  };

  let int_links = [];

  if(site != "l3" && dev["interfaces"][int]["l2_links"] != undefined) {
    int_links = dev["interfaces"][int]["l2_links"];
  } else if(site == "l3" && temp_data["devs"][dev_id] !== undefined &&
            temp_data["devs"][dev_id]["interfaces"][int] !== undefined &&
            temp_data["devs"][dev_id]["interfaces"][int]["l3_links"] !== undefined
  ) {
    int_links = temp_data["devs"][dev_id]["interfaces"][int]["l3_links"];
  };

  for(let i in int_links) {
    let lid=int_links[i];
    if(connections[lid] == undefined) {
      continue;
    };

    let nei_dev_id=undefined;
    let nei_int=undefined;

    if(connections[lid]["from_dev"] == dev_id && connections[lid]["from_int"] == int) {
       nei_dev_id=connections[lid]["to_dev"];
       nei_int=connections[lid]["to_int"];
    } else if(connections[lid]["to_dev"] == dev_id && connections[lid]["to_int"] == int) {
       nei_dev_id=connections[lid]["from_dev"];
       nei_int=connections[lid]["from_int"];
    } else {
      error_at("Connections error "+lid);
      return;
    };

    int_popup_label(nei_int, nei_dev_id);

    link_highlight(lid);
  };

  if(site == "l3" && int_links.length == 0 && dev["interfaces"][int]["ips"] !== undefined) {
    for(let ip in dev["interfaces"][int]["ips"]) {
      let net = dev["interfaces"][int]["ips"][ip]["net"];
      if(data["l3_links"][net] !== undefined) {
        for(let nei_ip in data["l3_links"][net]) {
          let nei_int = data["l3_links"][net][nei_ip]["ifName"];
          let nei_dev_id = data["l3_links"][net][nei_ip]["dev_id"];
          if(data["devs"][nei_dev_id] !== undefined && data["devs"][nei_dev_id]["interfaces"][nei_int] !== undefined &&
             temp_data["devs"][nei_dev_id] !== undefined && temp_data["devs"][nei_dev_id]["_draw"] == 1
          ) {
            int_popup_label(nei_int, nei_dev_id);
          };
        };
      };
    };
  };
};

function interface_out() {
  $(".inpopup").remove();
  $(".outlined").removeClass("outlined").css({"outline": "none"});
  $(".line_highlight").each(function() {
    let svg=$(this).find("svg");
    let line=svg.find("line");
    let orig_stroke_width = Number($(this).data("stroke_width"));

    let stroke_width = orig_stroke_width;
    if(site == "l3" && !tp_show) stroke_width = "0";

    line.attr("stroke-width", stroke_width);
    line.attr("x1", $(this).data("x1"));
    line.attr("x2", $(this).data("x2"));
    line.attr("y1", $(this).data("y1"));
    line.attr("y2", $(this).data("y2"));
    svg.attr("width", $(this).data("svg_width"));
    svg.attr("height", $(this).data("svg_height"));
    $(this).removeClass("line_highlight");
  });
};

function int_style(int,dev) {
  let ret={};
  //by default interface status is unknown
  ret["label_bg_color"]="red";
  ret["bullet_color"]="darkred";

  let short_name=dev["interfaces"][int]["ifName"];
  short_name=short_name.replace(/giga.*ethernet/i, "Gi");
  short_name=short_name.replace(/fastethernet/i, "Fa");
  short_name=short_name.replace(/ethernet/i, "Eth");
  short_name=short_name.replace(/vlan/i, "Vl");
  short_name=short_name.replace(/loopback/i, "Lo");
  short_name=short_name.replace(/Port\./i, "Port");
  short_name=short_name.replace(/ip interface/i, "Ip");

  ret["short_name"]=short_name;

  if(dev &&
     dev["interfaces"] && dev["interfaces"][int] &&
     dev["interfaces"][int]["ifOperStatus"] != undefined &&
     dev["interfaces"][int]["ifAdminStatus"] != undefined &&
     dev["interfaces"][int]["ifType"] != undefined
  ) {
//    let type=dev["interfaces"][int]["ifType"];
    let as=dev["interfaces"][int]["ifAdminStatus"];
    let os=dev["interfaces"][int]["ifOperStatus"];
    if(as == 2) {
      //interface is shot down
      ret["label_bg_color"]="gray";
      ret["bullet_color"]="darkgray";
    } else {
      if(os == 1) {
        ret["label_bg_color"]="lightgreen";
        //ret["label_bg_color"]="greenyellow";
        ret["bullet_color"]="darkgreen";
        if(dev["interfaces"][int]["stpBlockInstances"] != undefined) {
          ret["label_bg_color"]="magenta";
          ret["bullet_color"]="darkmagenta";
        };
      } else if(os == 2) {
        ret["label_bg_color"]="red";
        ret["bullet_color"]="darkred";
      } else {
        ret["label_bg_color"]="orange";
        ret["bullet_color"]="saddlebrown";
      };
      if(dev["interfaces"][int]["eigrpIfPkts"] != undefined && dev["interfaces"][int]["eigrpIfPkts"] > 0 &&
         dev["interfaces"][int]["eigrpIfPeerCount"] == 0
      ) {
        ret["label_bg_color"]="orange";
        ret["bullet_color"]="saddlebrown";
      };
    };
  };
  return ret;
};

function interface_click(int, dev, e) {
  e.stopPropagation();
  let dev_id=dev["id"];
  if(e.ctrlKey && allow_select && site != "l3") {

    select_down(dev_id, int, [dev_id], 0);

    if(dev_selected.length > 0) {
      $("#btnSetColor").prop("disabled", false);
    } else {
      $("#btnSetColor").prop("disabled", true);
    };
    if(dev_selected.length == 1) {
      $("#btnGetColor").prop("disabled", false);
    } else {
      $("#btnGetColor").prop("disabled", true);
    };
    vLinksWindow(true);
  } else {
    interface_win(dev_id, int);
  };
};

function select_down(dev_id, int, excl, counter) {
  if(counter > 64) return;
  if(site == "l3") {
  } else {
    if(data["devs"][dev_id]["interfaces"][int]["l2_links"] != undefined) {
      for(let lid in data["devs"][dev_id]["interfaces"][int]["l2_links"]) {
        let link_id=data["devs"][dev_id]["interfaces"][int]["l2_links"][lid];
        if(connections[link_id] !== undefined) {
          let nei_dev;
          if(data["l2_links"][link_id][0]["DevId"] == dev_id) {
            nei_dev=data["l2_links"][link_id][1]["DevId"];
          } else {
            nei_dev=data["l2_links"][link_id][0]["DevId"];
          };
          if(dev_selected.indexOf(nei_dev) >= 0 || excl.indexOf(nei_dev) >= 0) continue; //for(let link_id ...
          dev_selected.push(nei_dev);
          dev_select_border($(document.getElementById(nei_dev)), true);
          for(let nei_int_i in data["devs"][nei_dev]["interfaces_sorted"]) {
            let nei_int = data["devs"][nei_dev]["interfaces_sorted"][nei_int_i];
            select_down(nei_dev, nei_int, excl, counter + 1);
          };
        };
      };
    };
  };
};


function add_device(dev_id) {

// build drawable interface list
// 0 do not draw
// 1 draw outside
// 2 draw inside

  let power_sensor=undefined;
  let power_sensor_at=undefined;

  let on_battery=0;

  let draw1_count=0;
  let draw2_count=0;

  temp_data["devs"][dev_id]={};
  temp_data["devs"][dev_id]["interfaces"]={};

  if(data["devs"][dev_id]["powerState"] != undefined && data["devs"][dev_id]["powerState"] != 1
     && ! /(?:^|\W)rps(?:\W|$)/i.test(data["devs"][dev_id]["sysLocation"])
  ) {
    power_sensor=0;
    power_sensor_at="Onboard";
    on_battery=1;
  };

  if(data["devs"][dev_id]["interfaces"] != undefined) {
    for(let int_i in data["devs"][dev_id]["interfaces_sorted"]) {
      let int = data["devs"][dev_id]["interfaces_sorted"][int_i];
      if(data["devs"][dev_id]["interfaces"][int]["ifAlias"] != undefined &&
         /power.*sensor/i.test(data["devs"][dev_id]["interfaces"][int]["ifAlias"]) &&
         power_sensor == undefined &&
         data["devs"][dev_id]["interfaces"][int]["ifAdminStatus"] == 1
      ) {
        if(power_sensor_at == undefined) {
          power_sensor_at = int;
        } else {
          power_sensor_at += ", "+int;
        };
        if(data["devs"][dev_id]["interfaces"][int]["ifOperStatus"] == 1) {
          if(power_sensor == undefined) {
            power_sensor=1;
          };
        } else {
          power_sensor=0;
        };
      };
      temp_data["devs"][dev_id]["interfaces"][int]={};

// draw 0 - do not put interface on main screen
// draw 1 - put interface around device
// draw 2 - put interface below device name
      if(site == "l3") {
        if(
          data["devs"][dev_id]["interfaces"][int]["ips"] != undefined &&
          data["devs"][dev_id]["interfaces"][int]["ifType"] != 24 &&
//String(int).indexOf("56137") > 0 && //TEMP
//String(int).indexOf("Tu") == 0 && //TEMP
          true
        ) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=1;
          draw1_count++;
        } else if(
          data["devs"][dev_id]["interfaces"][int]["ifType"] == 24 && //loopback
//          false &&//TEMP
          true
        ) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=2;
          draw2_count++;
        } else {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=0;
        };
      } else {
        if( data["devs"][dev_id]["interfaces"][int]["ifType"] == 131 ) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=0;
        } else  if(
            (
             data["devs"][dev_id]["interfaces"][int]['l2_links'] != undefined
            ) ||
            (data["devs"][dev_id]["interfaces"][int]["ifAlias"] != undefined &&
             (/alert/i.test(data["devs"][dev_id]["interfaces"][int]["ifAlias"]))
            ) ||
            (data["devs"][dev_id]["interfaces"][int]["ifType"] == 6 &&
             data["devs"][dev_id]["interfaces"][int]["ips"] != undefined &&
             !int.match(/^(?:BD|Vl|CPU port)/)
            ) ||
            (data["devs"][dev_id]["interfaces"][int]["macs_count"] != undefined &&
             data["devs"][dev_id]["interfaces"][int]["macs_count"] > 3 &&
             data["devs"][dev_id]["interfaces"][int]["ifType"] == 6
            ) ||
            (data["devs"][dev_id]["virtual"] != undefined) ||
            false
        ) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=1;
          draw1_count++;
        } else if(data["devs"][dev_id]["interfaces"][int]["ifAlias"] !== undefined && /hide/.test(data["devs"][dev_id]["interfaces"][int]["ifAlias"])) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=0;
        } else if(data["devs"][dev_id]["sysLocation"] != undefined && data["devs"][dev_id]["sysLocation"].match(/[, ]show_all/i) &&
                  (data["devs"][dev_id]["interfaces"][int]["ifType"] == 6 || data["devs"][dev_id]["interfaces"][int]["ifType"] == 117) &&
                  !int.match(/^(?:BD|Vl|CPU port)/) &&
                  1
        ) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=1;
          draw1_count++;
        } else if((//data["devs"][dev_id]["interfaces"][int]["portIndex"] == undefined &&
                   data["devs"][dev_id]["interfaces"][int]["ips"] != undefined &&
                   data["devs"][dev_id]["interfaces"][int]["ifAdminStatus"] == 1 &&
                   data["devs"][dev_id]["interfaces"][int]["ifType"] != 23 &&
                   data["devs"][dev_id]["interfaces"][int]["ifType"] != 135 &&
                   !int.match(/^BD/) &&
                   data["devs"][dev_id]["isGroup"] == undefined &&
                   true) ||
                  (int.match(/^Po\d+$/) && data["devs"][dev_id]["interfaces"][int]["ifType"] == 53 &&
                   data["devs"][dev_id]["interfaces"][int]["ifAdminStatus"] == 1
                  ) ||
                  (int.match(/^EPON\d+\/\d+$/) && data["devs"][dev_id]["interfaces"][int]["ifAdminStatus"] == 1) ||
                  (data["devs"][dev_id]["interfaces"][int]["macs_count"] != undefined &&
                   data["devs"][dev_id]["interfaces"][int]["macs_count"] > 3
                  ) ||
                  false
        ) {
          temp_data["devs"][dev_id]["interfaces"][int]["_draw"]=2;
          draw2_count++;
        };
      };
    };
  };

  let x=0;
  let y=0;
  if(map_data["loc"] != undefined && map_data["loc"][dev_id] != undefined) {
    x=map_data["loc"][dev_id]["x"];
    if(x < 0) x=0;
    y=map_data["loc"][dev_id]["y"];
    if(y < 0) y=0;
  };

  x=Math.floor(x/grid)*grid;
  y=Math.floor(y/grid)*grid;

  let name_color="darkorange";
  let name_bg = "white";
  let bcolor = "green";
/*
  if(data["devs"][dev_id]["overall_status"] == "warn") {
    name_color="orange";
  } else if(data["devs"][dev_id]["overall_status"] == "error") {
    name_color="red";
  } else if(data["devs"][dev_id]["overall_status"] == "paused") {
    name_color="grey";
  } else if(data["devs"][dev_id]["overall_status"] == "ok") {
    name_color="black";
  };
*/

  if(data["devs"][dev_id]["overall_status"] == "warn") {
    name_color="black";
    name_bg = "orange";
    bcolor =  "orange";
  } else if(data["devs"][dev_id]["overall_status"] == "error") {
    name_color="black";
    name_bg = "#FFE0E0";
    bcolor =  "#800000";
  } else if(data["devs"][dev_id]["overall_status"] == "paused") {
    name_color="black";
    name_bg = "#E0E0E0";
    bcolor =  "#808080";
  } else if(data["devs"][dev_id]["overall_status"] == "ok") {
    name_color="black";
    name_bg = "#F8FFF8";
    bcolor =  "green";
  };

  if(data["devs"][dev_id]["virtual"] != undefined) {
    name_bg = "#F0F0FF";
  };

  let dev_name_text=data["devs"][dev_id]["short_name"] != undefined ? data["devs"][dev_id]["short_name"] : "no data";

  let name_border;

  let dev_name=$(LABEL)
   .data("dev_id", dev_id)
   .text(dev_name_text)
   .addClass("devname")
   .addClass("handle")
   .addClass("ns")
   .css("position", "absolute")
   .css("top", int_size+"px")
   .css("left", int_size+"px")
   .css("white-space", "nowrap")
   .css("background", name_bg)
   .css("font-size", dev_name_size)
   .css("text-align", "center")
   .css("color", name_color)
   .hover(
     function (e) {
       e.stopPropagation();
       device_in(data["devs"][$(this).data("dev_id")])
     },
     device_out
   )
  ;

  if(data["devs"][dev_id]["isGroup"] != undefined) {
    dev_name.css("border", "1px "+bcolor+" dashed")
  } else {
    dev_name.css("border", "1px "+bcolor+" solid")
  };


  let device=$(DIV, { id: dev_id })
   .addClass("device")
   .addClass("ns")
   .css("left", x+"px")
   .css("top", y+"px")
   .css("background-color", (map_data["colors"][dev_id] != undefined ? map_data["colors"][dev_id] : "white") )
   .css("position", "absolute")
   .append(dev_name)
   .append( $(DIV)
     .addClass("select_border")
     .hide()
     .css({"position": "absolute", "top": sel_border_offset, "bottom": sel_border_offset,
           "left": sel_border_offset, "right": sel_border_offset, "border": sel_border_width+"px "+sel_border_line_color, "z-index": "-1"
     })
   )
   .draggable({
     start: drag_start,
     stop: device_drag_stop,
     handle: ".handle",
     grid: [grid, grid],
     zIndex: 2147483647
   })
   .click(function(e) {
     e.stopPropagation();
     if($(e.target).is(".devname")) {
       device_click($(e.target), e);
     };
   })
   .dblclick(function(e) {
     e.stopPropagation();
     if($(e.target).is(".devname")) {
       device_dblclick($(e.target));
     };
   })
   .css("dummy", "dummy")
  ;

  device.css("border", dev_border);

  if(movementLock) {
    device.draggable('disable');
    device.off("dblclick");
  };

  temp_data["devs"][dev_id]["_draw"] = 1;
  workspace.append(device);

  let name_width=dev_name.outerWidth();
  let name_height=dev_name.outerHeight();

  let name_cells_x=Math.ceil(name_width/int_size);
  let name_cells_y=Math.ceil(name_height/int_size);

  if(name_cells_x == 0) name_cells_x = 1;
  if(name_cells_y == 0) name_cells_y = 1;

  let outer_slots=4 + name_cells_x * 2 + name_cells_y * 2;
  let add_rows=0;
  let add_cols=0;

  while(outer_slots < draw1_count) {
    if((name_cells_x+add_cols) > (name_cells_y+add_rows)) {
      add_rows++;
    } else {
      add_cols++;
    };

    outer_slots=4 + name_cells_x * 2 + name_cells_y * 2 + add_rows * 2 + add_cols * 2;
  };

  let inner_slots=add_rows * name_cells_x + add_rows * add_cols;
  while(inner_slots < draw2_count) {
    if((name_cells_x+add_cols) > (name_cells_y+add_rows)) {
      add_rows++;
    } else {
      add_cols++;
    };

    outer_slots=4 + name_cells_x * 2 + name_cells_y * 2 + add_rows * 2 + add_cols * 2;
    inner_slots=add_rows * name_cells_x + add_rows * add_cols;
  };

  name_width=name_cells_x * int_size + add_cols * int_size;
  name_height=name_cells_y * int_size;

  //device.width(name_width + int_size * 2 + add_cols * int_size - 2);
  //device.height(name_height + int_size * 2 + add_rows * int_size - 2);
  device.width(name_width + int_size * 2 - 2);
  device.height(name_height + int_size * 2 + add_rows * int_size -2)

  dev_name.width(name_width-3); // minus border width
  dev_name.height(name_height-3); // minus border width

  if(power_sensor != undefined) {
    let ps_bg_color="green";
    let ps_html="On";
    let ps_title="220V Ok";
    let ps_size="7px";
    if(!power_sensor) {
      ps_bg_color="red";
      ps_html="Off";
      ps_title="220V Off";
      if(on_battery) {
        ps_bg_color="orangered";
        ps_html="Batt";
        ps_title="On battery";
      };
      ps_size="15px";
    };
    $(DIV)
     .css("position", "absolute")
     .css("border", "1px solid "+ps_bg_color)
     .css("background-color", ps_bg_color)
     .css("left", "-1px")
     .css("right", "-1px")
     .css("bottom", "-1px")
     .css("font-size", "6px")
     .css("color", "white")
     .prop("title", ps_title+"; Sensor at: "+power_sensor_at)
     .html(ps_html)
     .appendTo(dev_name);
  };

//  dev_name.prop("title", data["devs"][dev_id]['sysLocation']+" "+draw1_count+":"+outer_slots+" "+draw2_count+":"+inner_slots);
  temp_data["devs"][dev_id]["_window"]=device;
  temp_data["devs"][dev_id]["_cols"]=name_cells_x+add_cols+2;
  temp_data["devs"][dev_id]["_rows"]=name_cells_y+add_rows+2;
  temp_data["devs"][dev_id]["_inner_start_row"]=1+name_cells_y;
  temp_data["devs"][dev_id]["_inner_cols"]=name_cells_x+add_cols;
  temp_data["devs"][dev_id]["_inner_rows"]=add_rows;

  let cur_row=0;
  let cur_col=0;

  let cur_row_inn=temp_data["devs"][dev_id]["_inner_start_row"];
  let cur_col_inn=1;

  if(data["devs"][dev_id]["interfaces_sorted"] != undefined) {
    for(let int_i=0; int_i < data["devs"][dev_id]["interfaces_sorted"].length; int_i++) {
      let int=data["devs"][dev_id]["interfaces_sorted"][int_i];
      if(temp_data["devs"][dev_id]["interfaces"][int]["_draw"] != undefined &&
         temp_data["devs"][dev_id]["interfaces"][int]["_draw"] != 0
      ) {
        let x,y;
        if(temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1) {
          temp_data["devs"][dev_id]["interfaces"][int]["_col"] = cur_col;
          temp_data["devs"][dev_id]["interfaces"][int]["_row"] = cur_row;
          x=cur_col * int_size;
          y=cur_row * int_size;
          if(cur_row > 0 && cur_row < (temp_data["devs"][dev_id]["_rows"] - 1)) {
            if(cur_col == 0) {
              cur_col = temp_data["devs"][dev_id]["_cols"] - 1;
            } else {
              cur_col++;
            };
          } else {
            cur_col++;
          };

          if(cur_col == temp_data["devs"][dev_id]["_cols"]) {
            cur_col = 0;
            cur_row++;
          };
        } else {
          temp_data["devs"][dev_id]["interfaces"][int]["_col"] = cur_col_inn;
          temp_data["devs"][dev_id]["interfaces"][int]["_row"] = cur_row_inn;
          x=cur_col_inn * int_size;
          y=cur_row_inn * int_size;
          cur_col_inn++;
          if(cur_col_inn >= (temp_data["devs"][dev_id]["_cols"] - 1)) {
            cur_col_inn=1;
            cur_row_inn++;
          };
        };
        let if_text="Un";
        let if_type=data["devs"][dev_id]["interfaces"][int]["ifType"];
        if(if_type == 24) {
          if_text="Lo";
        } else if(if_type == 6 || if_type == 117) {
          if(int.match(/^BD/)) {
            if_text="Bd";
          } else if(int.match(/^CPU port/)) {
            if_text="Cp";
          } else {
            if_text="Et";
          };
        } else if(if_type == 136 || if_type == 53) {
          if(/^Po\d+$/.test(int)) {
            if_text="Po";
          } else {
            if_text="Vl";
          };
        } else if(if_type == 135) {
          if_text="Dt";
        } else if(if_type == 161) {
          if_text="Po";
        } else if(if_type == 131) {
          if_text="Tu";
        } else if(if_type == 23) {
          if_text="Pp";
        } else if(if_type == 1 && int.match(/^EPON\d+\/\d+:\d+/)) {
          if_text="On";
        };

        if(site != "l3" && ( if_type == 6 || if_type == 117) && !int.match(/^BD/) && !int.match(/^CPU port/)) {
          let portnum;
          if(portnum = int.match(/^(?:.*[^0-9]+)?([0-9]+)$/)) {
            if_text=portnum[1];
          };
        };

        let int_div=$(LABEL, { id: int+"@"+dev_id })
         .data("int", int)
         .data("dev", data["devs"][dev_id])
         .css("position", "absolute")
         .css("text-align", "center")
         .css("top", (y)+"px")
         .css("left", (x)+"px")
         .css("border", "1px darkgreen solid")
         .css("font-size", (int_size-6)+"px")
         .css("width", (int_size-4)+"px")
         .css("height", (int_size-4)+"px")
         .text(if_text)
         .click(function (e) {
           e.stopPropagation();
           interface_click($(this).data("int"), $(this).data("dev"), e)
         })
         .dblclick(function (e) {
           e.stopPropagation();
           //interface_dblclick($(this).data("int"), $(this).data("dev"), e)
         })
         .hover(
           function (e) {
             e.stopPropagation();
             interface_in($(this).data("int"), $(this).data("dev"))
           },
           interface_out
         )
        ;
        if(/^Tu/.test(int) && data["devs"][dev_id]["interfaces"][int]["ips"] !== undefined) {
          for(let ip in data["devs"][dev_id]["interfaces"][int]["ips"]) {
            if(data["devs"][dev_id]["interfaces"][int]["ips"][ip]["masklen"] < 30) {
              // is HUB
              int_div.css({"font-weight": "bold"});
              break;
            };
          };
        };
        let int_st=int_style(int, data["devs"][dev_id]);
        int_div.css("background-color", int_st["label_bg_color"]);
        int_div.appendTo(device);
      };
    };
  };
};

function build_connections() {
  for(let dev_id in data["devs"]) {
    let from_div=document.getElementById(dev_id);
    if(from_div != null && data["devs"][dev_id]["interfaces"] != undefined) {
      for(let int_i in data["devs"][dev_id]["interfaces_sorted"]) {
        let int = data["devs"][dev_id]["interfaces_sorted"][int_i];

        let int_links = [];

        if(site == "l3") {
          if(data["devs"][dev_id]["interfaces"][int]["ips"] !== undefined &&
             temp_data["devs"][dev_id] != undefined &&
             temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1
          ) {
            temp_data["devs"][dev_id]["interfaces"][int]["l3_links"] = [];
            for(let ip in data["devs"][dev_id]["interfaces"][int]["ips"]) {
              let ip_net = data["devs"][dev_id]["interfaces"][int]["ips"][ip]["net"];
              if(String(ip).indexOf("127.") == 0) continue;
              if(data["l3_links"] !== undefined &&
                 data["l3_links"][ ip_net ] !== undefined &&
                 data["l3_links"][ ip_net ] !== undefined &&
                 data["l3_links"][ ip_net ][ip] !== undefined &&
                 data["l3_links"][ ip_net ][ip]["dev_id"] == dev_id &&
                 hash_length(data["l3_links"][ip_net]) == 2
              ) {
                let net = data["l3_links"][ip_net];
                let nei_ip = undefined;
                for(let _ip in net) {
                  if(_ip != ip) {
                    nei_ip = _ip;
                    break;
                  };
                };
                let nei_dev = net[nei_ip]["dev_id"];
                let nei_int = net[nei_ip]["ifName"];
                if(nei_dev == dev_id) continue;

                if(data["devs"][nei_dev] === undefined ||
                   data["devs"][nei_dev]["interfaces"][nei_int] === undefined ||
                   temp_data["devs"][nei_dev] === undefined ||
                   temp_data["devs"][nei_dev]["interfaces"][nei_int]["_draw"] != 1 ||
                   false
                ) {
                  continue;
                };

                let link_status = 2;
                if(data["devs"][dev_id]["interfaces"][int]["ifOperStatus"] == 1 &&
                   data["devs"][nei_dev]["interfaces"][nei_int]["ifOperStatus"] == 1
                ) {
                  link_status = 1;
                };
                let link_id = ip_link_id(dev_id, int, net[nei_ip]["dev_id"], net[nei_ip]["ifName"]);
                temp_data["devs"][dev_id]["interfaces"][int]["l3_links"].push(link_id);
                temp_data["p2p_links"][link_id] = {"from_dev": dev_id, "from_int": int, "to_dev": nei_dev, "to_int": nei_int, "status": link_status};
                if(connections[link_id] === undefined) {
                  int_links.push({"link_id": link_id, "nei_dev": nei_dev, "nei_int": nei_int, "status": link_status});
                };
              };
            };
          };
        } else {
          if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1) {
            for(let lid in data["devs"][dev_id]["interfaces"][int]["l2_links"]) {
              let link_id=data["devs"][dev_id]["interfaces"][int]["l2_links"][lid];
              if(connections[link_id] == undefined &&
                 data["l2_links"][link_id] !== undefined &&
                 data["l2_links"][link_id][0]["DevId"] != data["l2_links"][link_id][1]["DevId"]
              ) {
                let nei_dev;
                let nei_int;
                if(data["l2_links"][link_id][0]["DevId"] == dev_id) {
                  nei_dev=data["l2_links"][link_id][1]["DevId"];
                  nei_int=data["l2_links"][link_id][1]["ifName"];
                } else {
                  nei_dev=data["l2_links"][link_id][0]["DevId"];
                  nei_int=data["l2_links"][link_id][0]["ifName"];
                };
                let link_status = data["l2_links"][link_id]["status"];
                int_links.push({"link_id": link_id, "nei_dev": nei_dev, "nei_int": nei_int, "status": link_status});
              };
            };
          };
        };
        for(let li in int_links) {
          let link_id = int_links[li]["link_id"];
          let nei_dev = int_links[li]["nei_dev"];
          let nei_int = int_links[li]["nei_int"];
          let link_status = int_links[li]["status"];

          let to_div=document.getElementById(nei_dev);
          if(to_div != null) {

            connections[link_id] = {};
            connections[link_id]["legs"] = [];
            connections[link_id]["tps"] = {};
            connections[link_id]["from_dev"] = dev_id;
            connections[link_id]["from_int"] = int;
            connections[link_id]["to_dev"] = nei_dev;
            connections[link_id]["to_int"] = nei_int;
            connections[link_id]["status"] = link_status;

            let from_div_x=$(from_div).position().left+workspace.scrollLeft()+Math.floor( $(from_div).width() / 2 );
            let from_div_y=$(from_div).position().top+workspace.scrollTop()+Math.floor( $(from_div).height() / 2 );
            let to_div_x=$(to_div).position().left+workspace.scrollLeft()+Math.floor( $(to_div).width() / 2 );
            let to_div_y=$(to_div).position().top+workspace.scrollTop()+Math.floor( $(to_div).height() / 2 );
            if(map_data["tps"][link_id] != undefined) {
              connections[link_id]["tps"]={};
              for(let tpi in map_data["tps"][link_id]) {
                let tp=map_data["tps"][link_id][tpi];
                connections[link_id]["tps"][tpi]={};
                if(tp["type"] == "devdev") {
                  if((tp["from_dev"] != dev_id && tp["from_dev"] != nei_dev) || (tp["to_dev"] != dev_id && tp["to_dev"] != nei_dev)) {
                    error_at("invalid turnpoint "+tpi+" @ "+link_id);
                    continue;
                  };
                  connections[link_id]["legs"].push({
                    type: "devtp",
                    from_dev: tp["from_dev"],
                    from_int: tp["from_int"],
                    to_tp: tpi,
                    drawn: false
                  });
                  connections[link_id]["legs"].push({
                    type: "devtp",
                    from_dev: tp["to_dev"],
                    from_int: tp["to_int"],
                    to_tp: tpi,
                    drawn: false
                  });
                } else if(tp["type"] == "devtp") {

                  if(connections[link_id]["tps"][ tp["to_tp"] ] == undefined) connections[link_id]["tps"][ tp["to_tp"] ]={};

                  if(tp["from_dev"] != dev_id && tp["from_dev"] != nei_dev) {
                    error_at("invalid turnpoint "+tpi+" @ "+link_id);
                    continue;
                  };
                  connections[link_id]["legs"].push({
                    type: "devtp",
                    from_dev: tp["from_dev"],
                    from_int: tp["from_int"],
                    to_tp: tpi,
                    drawn: false
                  });

                  if(connections[link_id]["tps"][tpi]["connected"] == undefined ||
                     connections[link_id]["tps"][tpi]["connected"][ tp["to_tp"] ] == undefined) {
                    connections[link_id]["legs"].push({
                      type: "tptp",
                      from_tp: tpi,
                      to_tp: tp["to_tp"],
                      drawn: false
                    });

                    if(connections[link_id]["tps"][ tp["to_tp"] ]["connected"] == undefined) {
                      connections[link_id]["tps"][ tp["to_tp"] ]["connected"] = {};
                    };
                    if(connections[link_id]["tps"][tpi]["connected"] == undefined) {
                      connections[link_id]["tps"][tpi]["connected"] = {};
                    };
                    connections[link_id]["tps"][ tp["to_tp"] ]["connected"][tpi]=1;
                    connections[link_id]["tps"][tpi]["connected"][ tp["to_tp"] ]=1;
                  };
                } else if(tp["type"] == "tptp") {
                  if(connections[link_id]["tps"][ tp["from_tp"] ] == undefined) connections[link_id]["tps"][ tp["from_tp"] ] = {};
                  if(connections[link_id]["tps"][ tp["to_tp"] ] == undefined) connections[link_id]["tps"][ tp["to_tp"] ] = {};

                  if(connections[link_id]["tps"][tpi]["connected"] == undefined || connections[link_id]["tps"][tpi]["connected"][ tp["from_tp"] ] == undefined) {
                    connections[link_id]["legs"].push({
                      type: "tptp",
                      from_tp: tpi,
                      to_tp: tp["from_tp"],
                      drawn: false
                    });

                    if(connections[link_id]["tps"][ tp["from_tp"] ] == undefined) connections[link_id]["tps"][ tp["from_tp"] ] = {};

                    if(connections[link_id]["tps"][ tp["from_tp"] ]["connected"] == undefined) {
                      connections[link_id]["tps"][ tp["from_tp"] ]["connected"] = {};
                    };
                    if(connections[link_id]["tps"][tpi]["connected"] == undefined) {
                      connections[link_id]["tps"][tpi]["connected"] = {};
                    };
                    connections[link_id]["tps"][ tp["from_tp"] ]["connected"][tpi]=1;
                    connections[link_id]["tps"][tpi]["connected"][ tp["from_tp"] ]=1;
                  };

                  if(connections[link_id]["tps"][tpi]["connected"] == undefined || connections[link_id]["tps"][tpi]["connected"][ tp["to_tp"] ] == undefined) {
                    connections[link_id]["legs"].push({
                      type: "tptp",
                      from_tp: tpi,
                      to_tp: tp["to_tp"],
                      drawn: false
                    });
                    if(connections[link_id]["tps"][ tp["to_tp"] ]["connected"] == undefined) {
                      connections[link_id]["tps"][ tp["to_tp"] ]["connected"] = {};
                    };
                    if(connections[link_id]["tps"][tpi]["connected"] == undefined) {
                      connections[link_id]["tps"][tpi]["connected"] = {};
                    };
                    connections[link_id]["tps"][ tp["to_tp"] ]["connected"][tpi]=1;
                    connections[link_id]["tps"][tpi]["connected"][ tp["to_tp"] ]=1;
                  };

                };
              };
            } else {
              connections[link_id]["legs"].push({
                type: "devdev",
                from_dev: dev_id,
                from_int: int,
                to_dev: nei_dev,
                to_int: nei_int,
                drawn: false
              });
            };
          };
        };
      };
    };
  };
};

function arrange_interfaces_dev2tp(dev_id, moved) {

  let from_elm=document.getElementById(dev_id);
  if(from_elm == null) {
    error_at("Undefined from element"); 
    return;
  };
  let from_x=$(from_elm).position().left+workspace.scrollLeft()+Math.floor( $(from_elm).width() / 2 ); //device center
  let from_y=$(from_elm).position().top+workspace.scrollTop()+Math.floor( $(from_elm).height() / 2 );
    
  let from_x_0=$(from_elm).position().left+workspace.scrollLeft(); //device top left corner
  let from_y_0=$(from_elm).position().top+workspace.scrollTop();

  let r=0;

  temp_data["devs"][dev_id]["slots"] = [];
  temp_data["devs"][dev_id]["relocated"] = {};
  
  while(r < temp_data["devs"][dev_id]["_rows"]) {
    let c=0;
    while(c < temp_data["devs"][dev_id]["_cols"]) {

      temp_data["devs"][dev_id]["slots"].push({ "col": c, "row": r, "occupied": false});

      c++;
      if(r > 0 && r < (temp_data["devs"][dev_id]["_rows"] - 1) && c == 1) {
        c = temp_data["devs"][dev_id]["_cols"] - 1;
      };
    };
    r++;
  };


  if(data["devs"][dev_id]["interfaces"] != undefined) {
    for(let int_i in data["devs"][dev_id]["interfaces_sorted"]) {
      let int = data["devs"][dev_id]["interfaces_sorted"][int_i];
      if(temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1) {
        let relocated=false;
        let distances=Array();

        let int_links = [];

        if(site != "l3" && data["devs"][dev_id]["interfaces"][int]["l2_links"] != undefined) {
          int_links = data["devs"][dev_id]["interfaces"][int]["l2_links"];
        } else if(site == "l3" && temp_data["devs"][dev_id]["interfaces"][int]["l3_links"] !== undefined) {
          int_links = temp_data["devs"][dev_id]["interfaces"][int]["l3_links"];
        };

        int_links.sort();

        for(let i in int_links) {
          let link_id=int_links[i];

          if(connections[link_id] == undefined) {
            continue;
          };

          let leg_count=hash_length(connections[link_id]["legs"]);

          let to_x=undefined;
          let to_y=undefined;

          let nei_dev=undefined;
          let nei_int=undefined;

          if(connections[link_id]["from_dev"] == dev_id && connections[link_id]["from_int"] == int) {
            nei_dev=connections[link_id]["to_dev"];
            nei_int=connections[link_id]["to_int"];
          } else if(connections[link_id]["to_dev"] == dev_id && connections[link_id]["to_int"] == int) {
            nei_dev=connections[link_id]["from_dev"];
            nei_int=connections[link_id]["from_int"];
          } else {
            error_at("Connections error "+link_id);
            return;
          };

          if(leg_count == 1) {
            continue;
          } else {
            //connected via turnpoint
            for(let l in connections[link_id]["legs"]) {
              if(connections[link_id]["legs"][l]["type"] == "devtp" &&
                 connections[link_id]["legs"][l]["from_dev"] == dev_id &&
                 connections[link_id]["legs"][l]["from_int"] == int &&
                 true
              ) {
                let tp=connections[link_id]["legs"][l]["to_tp"];
                if(map_data["tps"] == undefined || map_data["tps"][link_id] == undefined ||
                   map_data["tps"][link_id][tp] == undefined ||
                   map_data["tps"][link_id][tp]["type"] == "tptp"
                ) {
                  alert("Turnpoint error");
                  return;
                };
                to_x=map_data["tps"][link_id][tp]["x"];
                to_y=map_data["tps"][link_id][tp]["y"];
                break;
              };
            };
            if(to_x == undefined) {
              alert("Turnpoint not found");
              return;
            };
          };
          let dx=to_x - from_x;
          let dy=to_y - from_y;

          let distance=dx*dx+dy*dy; //center of device to turnpoint (?center? TODO check)

          distances.push({"distance": distance, "x": to_x, "y": to_y, "link_id": link_id });
        };

        if(hash_length(distances) > 0) {
          distances.sort(function(a,b) { return a["distance"]-b["distance"] }); //shortest first
          let to_x=distances[0]["x"]; //use closest turnpoint as reference
          let to_y=distances[0]["y"];

          let link_id = distances[0]["link_id"];

          let nearest_slot=undefined;
          let nearest_distance=0;

          for(let sl in temp_data["devs"][dev_id]["slots"]) if(temp_data["devs"][dev_id]["slots"][sl]["occupied"] == false) {

            let dx=from_x_0+temp_data["devs"][dev_id]["slots"][sl]["col"]*int_size - to_x;
            let dy=from_y_0+temp_data["devs"][dev_id]["slots"][sl]["row"]*int_size - to_y;

            let distance=dx*dx+dy*dy;

            if(nearest_slot == undefined || nearest_distance > distance) {
              nearest_slot=sl;
              nearest_distance=distance;
            };
          };

          if(nearest_slot != undefined) {
            let c=temp_data["devs"][dev_id]["slots"][nearest_slot]["col"];
            let r=temp_data["devs"][dev_id]["slots"][nearest_slot]["row"];

            temp_data["devs"][dev_id]["slots"][nearest_slot]["occupied"]=true;
            temp_data["devs"][dev_id]["slots"][nearest_slot]["by"]=int;
            temp_data["devs"][dev_id]["slots"][nearest_slot]["func"]="dev2tp";

            let int_elm=document.getElementById(int+"@"+dev_id);
            if(int_elm == null) {
              error_at("Cannot find interface element "+int+"@"+dev_id);
              return;
            };

            if(temp_data["devs"][dev_id]["interfaces"][int]["_col"] != c ||
               temp_data["devs"][dev_id]["interfaces"][int]["_row"] != r ||
               moved
            ) {
              connections_rearranged[link_id] = 1;
            }; // else no point in recursion
               // no point in redraw

            temp_data["devs"][dev_id]["interfaces"][int]["_col"] = c;
            temp_data["devs"][dev_id]["interfaces"][int]["_row"] = r;

            $(int_elm).css("top", (r*int_size)+"px").css("left", (c*int_size)+"px");
            relocated=true;

          } else {
            error_at("no slots!");
            return;
          };
        };
        if(relocated) {
          temp_data["devs"][dev_id]["relocated"][int] = 1;
        };
      };
    };
  };
};

function arrange_interfaces_dev2dev(dev_id, recursive, moved) {

  let from_elm=document.getElementById(dev_id);
  if(from_elm == null) {
    error_at("Undefined from element"); 
    return;
  };
  let from_x=$(from_elm).position().left+workspace.scrollLeft()+Math.floor( $(from_elm).width() / 2 ); //device center
  let from_y=$(from_elm).position().top+workspace.scrollTop()+Math.floor( $(from_elm).height() / 2 );
    
  let from_x_0=$(from_elm).position().left+workspace.scrollLeft(); //device top left corner
  let from_y_0=$(from_elm).position().top+workspace.scrollTop();

  let nei_devs={};

  if(data["devs"][dev_id]["interfaces"] != undefined) {
    for(let int_i in data["devs"][dev_id]["interfaces_sorted"]) {
      let int = data["devs"][dev_id]["interfaces_sorted"][int_i];
      if(temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1) {
        let relocated=false;
        let distances=Array();

        let int_links = [];

        if(site != "l3" && data["devs"][dev_id]["interfaces"][int]["l2_links"] != undefined) {
          int_links = data["devs"][dev_id]["interfaces"][int]["l2_links"];
        } else if(site == "l3" && temp_data["devs"][dev_id]["interfaces"][int]["l3_links"] !== undefined) {
          int_links = temp_data["devs"][dev_id]["interfaces"][int]["l3_links"];
        };

        int_links.sort();

        for(let i in int_links) {
          let link_id=int_links[i];

          if(connections[link_id] == undefined) {
            continue;
          };

          let leg_count=hash_length(connections[link_id]["legs"]);

          let to_x=undefined;
          let to_y=undefined;

          let nei_dev=undefined;
          let nei_int=undefined;

          if(connections[link_id]["from_dev"] == dev_id && connections[link_id]["from_int"] == int) {
            nei_dev=connections[link_id]["to_dev"];
            nei_int=connections[link_id]["to_int"];
          } else if(connections[link_id]["to_dev"] == dev_id && connections[link_id]["to_int"] == int) {
            nei_dev=connections[link_id]["from_dev"];
            nei_int=connections[link_id]["from_int"];
          } else {
            error_at("Connections error "+link_id);
            return;
          };

          if(leg_count == 1) {
            //direct link without map_data["tps"]
            let to_elm=document.getElementById(nei_dev);
            if(to_elm == null) {
              error_at("Cannot find nei element");
              return;
            };

            let from_left = $(from_elm).position().left + workspace.scrollLeft() + int_half;
            let from_top = $(from_elm).position().top + workspace.scrollTop() + int_half;
            let from_right = from_left + $(from_elm).width() - int_size;
            let from_bottom = from_top + $(from_elm).height() - int_size;

            let to_left = $(to_elm).position().left + workspace.scrollLeft() + int_half;
            let to_top = $(to_elm).position().top + workspace.scrollTop() + int_half;
            let to_right = to_left + $(to_elm).width() - int_size;
            let to_bottom = to_top + $(to_elm).height() - int_size;

            if(to_right <= from_left && to_bottom <= from_top) { // neighbour is in left top corner
              to_x = to_right;
              to_y = to_bottom;
            } else if(to_right <= from_left &&
                      to_bottom >= from_top &&
                      to_top <= from_bottom
            ) {                                                 //neigbour is to the left
              to_x = to_right;
              let top_ref;
              let bottom_ref;
              if(to_top > from_top) { top_ref = to_top } else { top_ref = from_top };
              if(to_bottom < from_bottom) { bottom_ref = to_bottom } else { bottom_ref = from_bottom };
              if(top_ref > bottom_ref) { error_at(); return; };
              to_y = top_ref + Math.floor( (bottom_ref-top_ref) / 2);
            } else if(to_right <= from_left && to_top < from_bottom) { // neighbour is in left bottom corner
              to_x = to_right;
              to_y = to_top;
            } else if(to_left >= from_right && to_bottom <= from_top) { // neighbour is in right top corner
              to_x = to_left;
              to_y = to_bottom;
            } else if(to_left >= from_right && to_top > from_bottom) { // neighbour is in right bottom corner
              to_x = to_left;
              to_y = to_top;
            } else if(to_left >= from_right &&
                      to_bottom >= from_top &&
                      to_top <= from_bottom
            ) {                                                 //neigbour is to the right
              to_x = to_left;
              let top_ref;
              let bottom_ref;
              if(to_top > from_top) { top_ref = to_top } else { top_ref = from_top };
              if(to_bottom < from_bottom) { bottom_ref = to_bottom } else { bottom_ref = from_bottom };
              if(top_ref > bottom_ref) { error_at(); return; };
              to_y = top_ref + Math.floor( (bottom_ref-top_ref) / 2);
            } else if(to_bottom <= from_top &&
                      to_right >= from_left &&
                      to_left <= from_right
            ) {                                                //neigbour is to the top
              to_y = to_bottom;
              let left_ref;
              let right_ref;
              if(to_left > from_left) { left_ref = to_left } else { left_ref = from_left };
              if(to_right < from_right) { right_ref = to_right } else { right_ref = from_right };
              if(left_ref > right_ref) { error_at(); return; };
              to_x = left_ref + Math.floor( (right_ref-left_ref) / 2);
            } else if(to_top >= from_bottom &&
                      to_right >= from_left &&
                      to_left <= from_right
            ) {                                                //neigbour is to the bottom
              to_y = to_top;
              let left_ref;
              let right_ref;
              if(to_left > from_left) { left_ref = to_left } else { left_ref = from_left };
              if(to_right < from_right) { right_ref = to_right } else { right_ref = from_right };
              if(left_ref > right_ref) { error_at(); return; };
              to_x = left_ref + Math.floor( (right_ref-left_ref) / 2);
            } else {
              to_x = to_left + Math.floor( (to_right - to_left) /2 );
              to_y = to_top + Math.floor( (to_bottom - to_top) /2 );
            };

          } else {
            continue;
          };
          let dx=to_x - from_x;
          let dy=to_y - from_y;

          let distance=dx*dx+dy*dy; //center of device to center of device

          distances.push({"distance": distance, "x": to_x, "y": to_y, "dev_id": nei_dev, "link_id": link_id });
        };

        if(hash_length(distances) > 0) {
          distances.sort(function(a,b) { return a["distance"]-b["distance"] }); //shortest first
          let to_x=distances[0]["x"]; //use closest device as reference
          let to_y=distances[0]["y"];
          let nei_dev = distances[0]["dev_id"];
          let link_id = distances[0]["link_id"];

          let nearest_slot=undefined;
          let nearest_distance=0;

          for(let sl in temp_data["devs"][dev_id]["slots"]) if(temp_data["devs"][dev_id]["slots"][sl]["occupied"] == false) {

            let dx=from_x_0+temp_data["devs"][dev_id]["slots"][sl]["col"]*int_size+int_half - to_x;
            let dy=from_y_0+temp_data["devs"][dev_id]["slots"][sl]["row"]*int_size+int_half - to_y;

            let distance=dx*dx+dy*dy;

            if(nearest_slot == undefined || nearest_distance > distance) {
              nearest_slot=sl;
              nearest_distance=distance;
            };
          };

          if(nearest_slot != undefined) {
            let c=temp_data["devs"][dev_id]["slots"][nearest_slot]["col"];
            let r=temp_data["devs"][dev_id]["slots"][nearest_slot]["row"];

            temp_data["devs"][dev_id]["slots"][nearest_slot]["occupied"]=true;
            temp_data["devs"][dev_id]["slots"][nearest_slot]["by"]=int;
            temp_data["devs"][dev_id]["slots"][nearest_slot]["func"]="dev2dev_dev";

            let int_elm=document.getElementById(int+"@"+dev_id);
            if(int_elm == null) {
              error_at("Cannot find interface element "+int+"@"+dev_id);
              return;
            };

            if(temp_data["devs"][dev_id]["interfaces"][int]["_col"] != c ||
               temp_data["devs"][dev_id]["interfaces"][int]["_row"] != r ||
               moved
            ) {
              nei_devs[nei_dev]=1;
              connections_rearranged[link_id] = 1;
            }; // else no point in recursion
               // no point in redraw

            temp_data["devs"][dev_id]["interfaces"][int]["_col"] = c;
            temp_data["devs"][dev_id]["interfaces"][int]["_row"] = r;

            $(int_elm).css("top", (r*int_size)+"px").css("left", (c*int_size)+"px");
            relocated=true;

          } else {
            error_at("no slots!");
            return;
          };
        };
        if(relocated) {
          temp_data["devs"][dev_id]["relocated"][int] = 1;
        };
      };
    };
  };

  if(data["devs"][dev_id]["interfaces"] != undefined) {
    for(let int_i in data["devs"][dev_id]["interfaces_sorted"]) {
      let int = data["devs"][dev_id]["interfaces_sorted"][int_i];
      if(temp_data["devs"][dev_id]["interfaces"][int]["_draw"] == 1 &&
         temp_data["devs"][dev_id]["relocated"][int] === undefined
      ) {
        let relocated=false;
        for(let sl in temp_data["devs"][dev_id]["slots"]) if(temp_data["devs"][dev_id]["slots"][sl]["occupied"] == false) {
          let c=temp_data["devs"][dev_id]["slots"][sl]["col"];
          let r=temp_data["devs"][dev_id]["slots"][sl]["row"];

          temp_data["devs"][dev_id]["slots"][sl]["occupied"]=true;
          temp_data["devs"][dev_id]["slots"][sl]["by"]=int;
          temp_data["devs"][dev_id]["slots"][sl]["func"]="dev2dev_reloc";

          let int_elm=document.getElementById(int+"@"+dev_id);
          if(int_elm == null) {
            error_at("Cannot find interface element "+int+"@"+dev_id);
            return;
          };

          temp_data["devs"][dev_id]["interfaces"][int]["_col"] = c;
          temp_data["devs"][dev_id]["interfaces"][int]["_row"] = r;

          $(int_elm).css("top", (r*int_size)+"px").css("left", (c*int_size)+"px");
          relocated=true;
          break;
        };
        if(!relocated) {
          error_at("Relocation error for "+int+"@"+dev_id);
          return;
        };
      };
    };
  };

  devices_arranged[dev_id]=1;

  if(recursive == true) {
    for(let dev in nei_devs) {
      arrange_interfaces_dev2tp(dev, false);
    };
    for(let dev in nei_devs) {
      if(devices_arranged[dev] == undefined) {
        arrange_interfaces_dev2tp(dev, false);
        arrange_interfaces_dev2dev(dev, false, false);
      };
    };
  };
};

function draw_connection(link_id) {
 
  if(connections[link_id] === undefined) {
    return;
  };
  let virtual = false;
  if(site != "l3" && data["l2_links"][link_id]["virtual"] != undefined) {
    virtual = true;
  };

  for(let l in connections[link_id]["legs"]) {
    let leg=connections[link_id]["legs"][l];
    let x1, x2, y1, y2, len;
    if(leg["type"] == "devdev") {
      let d1=leg["from_dev"];
      let i1=leg["from_int"];

      let elm_d1=document.getElementById(d1);
      let elm_i1=document.getElementById(i1+"@"+d1);

      if(elm_d1 == null || elm_i1 == null) {
        error_at("undefined elm_d1 or elm_i1");
        continue;
      };

      let d2=leg["to_dev"];
      let i2=leg["to_int"];

      let elm_d2=document.getElementById(d2);
      let elm_i2=document.getElementById(i2+"@"+d2);

      if(elm_d2 == null || elm_i2 == null) {
        error_at("undefined elm_d2 or elm_i2");
        continue;
      };

      x1=$(elm_d1).position().left + workspace.scrollLeft() +
         $(elm_i1).position().left + Math.floor( $(elm_i1).width() / 2 ) + 2;
      y1=$(elm_d1).position().top + workspace.scrollTop() + $(elm_i1).position().top +
         Math.floor( $(elm_i1).height() / 2 ) + 2;

      x2=$(elm_d2).position().left + workspace.scrollLeft() +
         $(elm_i2).position().left + Math.floor( $(elm_i2).width() / 2 ) + 2;
      y2=$(elm_d2).position().top + workspace.scrollTop() + $(elm_i2).position().top +
         Math.floor( $(elm_i2).height() / 2 ) + 2;


    } else if(leg["type"] == "devtp") {
      let d1=leg["from_dev"];
      let i1=leg["from_int"];

      let elm_d1=document.getElementById(d1);
      let elm_i1=document.getElementById(i1+"@"+d1);

      if(elm_d1 == null || elm_i1 == null) {
        error_at("undefined elm_d1 or elm_i1");
        continue;
      };

      x1=$(elm_d1).position().left + workspace.scrollLeft() +
         $(elm_i1).position().left + Math.floor( $(elm_i1).width() / 2 ) + 2;
      y1=$(elm_d1).position().top + workspace.scrollTop() + $(elm_i1).position().top +
         Math.floor( $(elm_i1).height() / 2 ) + 2;

      x2=map_data["tps"][link_id][ leg["to_tp"] ]["x"];
      y2=map_data["tps"][link_id][ leg["to_tp"] ]["y"];

    } else if(leg["type"] == "tptp") {

      x1=map_data["tps"][link_id][ leg["from_tp"] ]["x"];
      y1=map_data["tps"][link_id][ leg["from_tp"] ]["y"];

      x2=map_data["tps"][link_id][ leg["to_tp"] ]["x"];
      y2=map_data["tps"][link_id][ leg["to_tp"] ]["y"];

    } else {
      error_at("Unknown leg type "+leg["type"]+" at "+link_id+" @ "+l);
      continue;
    };

    let line_id="line_"+link_id+"_leg_"+l;
    connections[link_id]["legs"][l]["drawn"]=line_id;

    let color="black";

    if(connections[link_id]["status"] == 2) {
      color="red";
    } else if(connections[link_id]["status"] == 3) {
      color="mediumblue";
    } else if(connections[link_id]["status"] == 4) {
      color="saddlebrown";
    };

    let stroke_width = 1;
    if(site == "l3" && !tp_show) stroke_width = 0;

    if(!virtual) {
      draw_line(line_id, x1, y1, x2, y2, color, stroke_width, undefined);
    } else {
      draw_line(line_id, x1, y1, x2, y2, color, stroke_width+1, "6,4");
    };

    len=Math.sqrt( (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1) );

    let new_tp_btn_id="new_tp_"+link_id+"@"+l;
    let new_tp_btn=$(document.getElementById(new_tp_btn_id));

    if(len > min_line_length) {
      let cx=Math.ceil( (x2-x1)/2 + x1);
      let cy=Math.ceil( (y2-y1)/2 + y1);

      if(new_tp_btn.length == 0) {
        new_tp_btn=$(LABEL, {
          id: "new_tp_"+link_id+"@"+l
        })
        .addClass("new_tp")
        .addClass("ns")
        .data("link_id", link_id)
        .data("leg", l)
        .css("position", "absolute")
        .css("text-align", "center")
        .css("vertical-align", "middle")
        .css("height", tp_btn_size+"px")
        .css("width", tp_btn_size+"px")
        .css("border-radius", Math.ceil(tp_btn_size/2))
        .css("background-color", "orange")
        .css("border", "1px orangered solid")
        .css("font-size", tp_btn_size-1+"px")
        .text("+")
        .css("z-index", 0)
        .css("dummy", "dummy")
        .dblclick(new_tp)
        .click(tp_click)
        .hover(
          function() {
            let link_id=$(this).data("link_id");
            link_highlight(link_id);
          },
          interface_out
        )
        .appendTo(workspace);
      };
      new_tp_btn
        .data("cx", cx)
        .data("cy", cy)
        .css("left", cx - Math.ceil(tp_btn_size/2) - 0)
        .css("top", cy - Math.ceil(tp_btn_size/2) - 0);

      
      if(movementLock) {
        new_tp_btn.off("dblclick");
      };

      if(!tp_show) new_tp_btn.hide();
    } else {
      if(new_tp_btn.length > 0) new_tp_btn.remove();
    };
  };
  if(connections[link_id]["tps"] != undefined) {
    for(let tpi in connections[link_id]["tps"]) {
      let cx=map_data["tps"][link_id][tpi]["x"];
      let cy=map_data["tps"][link_id][tpi]["y"];
      let tp_btn_id="tp_"+link_id+"@"+tpi;

      let tp_btn=$(document.getElementById(tp_btn_id));

      if(tp_btn.length == 0) {
        tp_btn=$(LABEL, { id: tp_btn_id })
         .addClass("tp")
         .addClass("ns")
         .data("link_id", link_id)
         .data("tpi", tpi)
         .css("position", "absolute")
         .css("text-align", "center")
         .css("vertical-align", "middle")
         .css("height", tp_btn_size+"px")
         .css("width", tp_btn_size+"px")
         .css("border-radius", Math.ceil(tp_btn_size/2))
         .css("background-color", "pink")
         .css("border", "1px salmon solid")
         .css("font-size", tp_btn_size-1+"px")
         .html("&#10535;")
         .css("z-index", 0)
         .css("dummy", "dummy")
         .hover(
           function() {
             let link_id=$(this).data("link_id");
             link_highlight(link_id);
           },
           interface_out
         )
         .dblclick(remove_tp)
         .click(function(e) {
         })
         .draggable({
           start: drag_start,
           stop: tp_moved,
           //containment: [$(superworkspace).position().left,$(superworkspace).position().top,2048,2048],
           grid: [tp_grid, tp_grid],
           zIndex: 2147483647
         })
         .appendTo(workspace)
        ;

      };
      tp_btn
       .data("x", cx)
       .data("y", cy)
       .css("left", cx - Math.ceil(tp_btn_size/2))
       .css("top", cy - Math.ceil(tp_btn_size/2))
      ;

      if(movementLock) {
        tp_btn.draggable('disable');
        tp_btn.off("dblclick");
      };

      if(!tp_show) tp_btn.hide();
    };
  };
};

function draw_line(line_id, x1, y1, x2, y2, color, width, dasharray) {

  let cx,cy,fx,fy,tx,ty,w,h;

  if(x1 < x2) {
    cx=x1;
    fx=0;
    tx=x2-x1;
    w=tx;
  } else {
    cx=x2;
    tx=0;
    fx=x1-x2;
    w=fx;
  };

  if(y1 < y2) {
    cy=y1;
    fy=0;
    ty=y2-y1;
    h=ty;
  } else {
    cy=y2;
    ty=0;
    fy=y1-y2;
    h=fy;
  };

  if(w < 1) w=1;
  if(h < 1) h=1;

  w++;
  h++;

  let link_html="<SVG style=\"display:block;overflow:visible\" width=\""+w+"\" height=\""+h+"\">" +
    "<line x1=\""+fx+"\" y1=\""+fy+"\" x2=\""+tx+"\" y2=\""+ty+"\"" +
    " shape-rendering=\"crispEdges\"" +
    " stroke=\""+color+"\" stroke-width=\""+width+"\""
  ;

  if(dasharray != undefined) {
    link_html += " stroke-dasharray=\"" + dasharray + "\"";
  };

  link_html += "/></SVG>";

  $( document.getElementById(line_id) ).remove();
  let line=$(DIV, { id: line_id })
   .css("position", "absolute")
   .css("z-index", "-1")
   .css("left", cx+"px")
   .css("top", cy+"px")
   .width("width", w)
   .height("height", h)
   .html(link_html)
   .data("stroke_width", width)
   .appendTo( workspace )
  ;
};

function clear_link_objects(link_id) {
  if(connections[link_id] != undefined) {
    for(let l in connections[link_id]["legs"]) {
      if(connections[link_id]["legs"][l]["drawn"]) {
        let elm_line=document.getElementById(connections[link_id]["legs"][l]["drawn"]);
        if(elm_line != null) $( elm_line ).remove();
        connections[link_id]["legs"][l]["drawn"]=false;
      };
      let new_tp_btn_id="new_tp_"+link_id+"@"+l;
      let elm_tp=document.getElementById(new_tp_btn_id);
      if(elm_tp != null) $( elm_tp ).remove();
    };
  };

  if(map_data["tps"][link_id] != undefined) {
    for(let tpii in map_data["tps"][link_id]) {
      let elm_tp=document.getElementById("tp_"+link_id+"@"+tpii);
      if(elm_tp != null) $( elm_tp ).remove();
    };
  };
};

function remove_tp(e) {
  let link_id=$(this).data("link_id");
  let tpi=$(this).data("tpi");


  clear_link_objects(link_id);

  if(map_data["tps"][link_id][tpi]["type"] == "devdev") {
    //do nothing
  } else if(map_data["tps"][link_id][tpi]["type"] == "devtp") {
    let next_tp=map_data["tps"][link_id][tpi]["to_tp"];

    if(map_data["tps"][link_id][next_tp]["type"] == "devtp") {
      if(map_data["tps"][link_id][next_tp]["to_tp"] != tpi) {
        error_at("Corrupted turnpoints database, link_id: "+link_id);
        return;
      };
      map_data["tps"][link_id][next_tp]["type"] = "devdev";
      delete map_data["tps"][link_id][next_tp]["to_tp"];
      map_data["tps"][link_id][next_tp]["to_dev"] = map_data["tps"][link_id][tpi]["from_dev"];
      map_data["tps"][link_id][next_tp]["to_int"] = map_data["tps"][link_id][tpi]["from_int"];
    } else if(map_data["tps"][link_id][next_tp]["type"] == "tptp") {
      let to_tp;
      if(map_data["tps"][link_id][next_tp]["from_tp"] == tpi) {
        to_tp=map_data["tps"][link_id][next_tp]["to_tp"];
      } else if(map_data["tps"][link_id][next_tp]["to_tp"] == tpi) {
        to_tp=map_data["tps"][link_id][next_tp]["from_tp"];
      } else {
        error_at("Corrupted turnpoints database, link_id: "+link_id);
        return;
      };
      map_data["tps"][link_id][next_tp]["type"] = "devtp";
      delete map_data["tps"][link_id][next_tp]["from_tp"];
      map_data["tps"][link_id][next_tp]["to_tp"]=to_tp;
      map_data["tps"][link_id][next_tp]["from_dev"] = map_data["tps"][link_id][tpi]["from_dev"];
      map_data["tps"][link_id][next_tp]["from_int"] = map_data["tps"][link_id][tpi]["from_int"];
    } else {
      error_at("Corrupted turnpoints database, link_id: "+link_id);
      return;
    };
  } else if(map_data["tps"][link_id][tpi]["type"] == "tptp") {
    let prev_tp=map_data["tps"][link_id][tpi]["from_tp"];
    let next_tp=map_data["tps"][link_id][tpi]["to_tp"];

    if(map_data["tps"][link_id][prev_tp]["type"] == "devtp") {
      if(map_data["tps"][link_id][prev_tp]["to_tp"] != tpi) {
        error_at("Corrupted turnpoints database, link_id: "+link_id);
        return;
      };
      map_data["tps"][link_id][prev_tp]["to_tp"] = next_tp;
    } else if(map_data["tps"][link_id][prev_tp]["type"] == "tptp") {
      if(map_data["tps"][link_id][prev_tp]["from_tp"] == tpi) {
        map_data["tps"][link_id][prev_tp]["from_tp"]=next_tp;
      } else if(map_data["tps"][link_id][prev_tp]["to_tp"] == tpi) {
        map_data["tps"][link_id][prev_tp]["to_tp"]=next_tp;
      } else {
        error_at("Corrupted turnpoints database, link_id: "+link_id);
        return;
      };
    } else {
      error_at("Corrupted turnpoints database, link_id: "+link_id);
      return;
    };

    if(map_data["tps"][link_id][next_tp]["type"] == "devtp") {
      if(map_data["tps"][link_id][next_tp]["to_tp"] != tpi) {
        error_at("Corrupted turnpoints database, link_id: "+link_id);
        return;
      };
      map_data["tps"][link_id][next_tp]["to_tp"] = prev_tp;
    } else if(map_data["tps"][link_id][next_tp]["type"] == "tptp") {
      if(map_data["tps"][link_id][next_tp]["from_tp"] == tpi) {
        map_data["tps"][link_id][next_tp]["from_tp"]=prev_tp;
      } else if(map_data["tps"][link_id][next_tp]["to_tp"] == tpi) {
        map_data["tps"][link_id][next_tp]["to_tp"]=prev_tp;
      } else {
        error_at("Corrupted turnpoints database, link_id: "+link_id);
        return;
      };
    } else {
      error_at("Corrupted turnpoints database, link_id: "+link_id);
      return;
    };
  };

  delete map_data["tps"][link_id][tpi];
  if(hash_length(map_data["tps"][link_id]) == 0) {
    delete map_data["tps"][link_id];
  } else {
  };
  save_map("tps", link_id);

  delete connections[link_id];
  build_connections();
  devices_arranged={};
  connections_rearranged={};
/*
  arrange_interfaces_dev2tp(connections[link_id]["from_dev"], true);
  arrange_interfaces_dev2tp(connections[link_id]["to_dev"], true);

  arrange_interfaces_dev2dev(connections[link_id]["from_dev"], false, true);
  arrange_interfaces_dev2dev(connections[link_id]["to_dev"], false, true);
*/

  for(let dev_id in data["devs"]) {
    if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["_draw"] == 1) {
      arrange_interfaces_dev2tp(dev_id, false);
      arrange_interfaces_dev2dev(dev_id, false, false);
    };
  };

  for(let lid in connections) {
    draw_connection(lid);
  };
};

function tp_moved(e, ui) {
  let x=$(this).position().left+workspace.scrollLeft();
  let y=$(this).position().top+workspace.scrollTop();

  let offset = tp_grid_offset - Math.ceil(tp_btn_size/2);
  x = Math.floor((x - offset) / tp_grid) * tp_grid + offset;
  y = Math.floor((y - offset) / tp_grid) * tp_grid + offset;

  if(x < 0) x = 0;
  if(y < 0) y = 0;

  $(this).css({"top": y, "left": x});

  let link_id=$(this).data("link_id");
  let tpi=$(this).data("tpi");

  x += tp_btn_size/2;
  y += tp_btn_size/2;

  map_data["tps"][link_id][tpi]["x"]=x;
  map_data["tps"][link_id][tpi]["y"]=y;
  save_map("tps", link_id);

  devices_arranged={};
  connections_rearranged={};

  for(let dev_id in data["devs"]) {
    if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["_draw"] == 1) {
      arrange_interfaces_dev2tp(dev_id, false);
      arrange_interfaces_dev2dev(dev_id, false, false);
    };
  };
  for(let lid in connections) {
    draw_connection(lid);
  };
};

function tp_click(e) {
  if(e.shiftKey) {
    e.stopPropagation();
    let link_id=$(e.target).data("link_id");
  };
};

function new_tp(e) {
  e.stopPropagation();
  let link_id=$(e.target).data("link_id");
  let leg=$(e.target).data("leg");
  let cx=$(e.target).data("cx");
  let cy=$(e.target).data("cy");
  $(e.target).remove();

  cx=Math.floor(cx/tp_grid)*tp_grid + tp_grid_offset;
  cy=Math.floor(cy/tp_grid)*tp_grid + tp_grid_offset;

  //delete connection graphic objects and turn points
  for(let l in connections[link_id]["legs"]) {
    if(connections[link_id]["legs"][l]["drawn"]) {
      let elm_line=document.getElementById(connections[link_id]["legs"][l]["drawn"]);
      if(elm_line != null) $( elm_line ).remove();
      connections[link_id]["legs"][l]["drawn"]=false;
    };
    let new_tp_btn_id="new_tp_"+link_id+"@"+l;
    let elm_tp=document.getElementById(new_tp_btn_id);
    if(elm_tp != null) $( elm_tp ).remove();
  };

  if(map_data["tps"][link_id] != undefined) {
    for(let tpi in map_data["tps"][link_id]) {
      let elm_tp=document.getElementById("tp_"+tpi);
      if(elm_tp != null) $( elm_tp ).remove();
    };
  };

  if((map_data["tps"][link_id] != undefined && connections[link_id]["legs"][leg]["type"] == "devdev") ||
     (map_data["tps"][link_id] == undefined && connections[link_id]["legs"][leg]["type"] != "devdev")
  ) {
    error_at("Invalid leg type");
    return;
  };

  if(map_data["tps"][link_id] == undefined) {
    map_data["tps"][link_id]={};
  };

  let new_tpi=0;
  while(map_data["tps"][link_id][new_tpi] != undefined) new_tpi++;
  map_data["tps"][link_id][new_tpi]={};
  map_data["tps"][link_id][new_tpi]["x"]=cx;
  map_data["tps"][link_id][new_tpi]["y"]=cy;

  if(connections[link_id]["legs"][leg]["type"] == "devdev") {
    map_data["tps"][link_id][new_tpi]["type"]="devdev";
    map_data["tps"][link_id][new_tpi]["from_dev"]=connections[link_id]["legs"][leg]["from_dev"];
    map_data["tps"][link_id][new_tpi]["from_int"]=connections[link_id]["legs"][leg]["from_int"];
    map_data["tps"][link_id][new_tpi]["to_dev"]=connections[link_id]["legs"][leg]["to_dev"];
    map_data["tps"][link_id][new_tpi]["to_int"]=connections[link_id]["legs"][leg]["to_int"];
  } else if(connections[link_id]["legs"][leg]["type"] == "devtp") {
    let old_tp1=connections[link_id]["legs"][leg]["to_tp"];

    map_data["tps"][link_id][new_tpi]["type"]="devtp";
    map_data["tps"][link_id][new_tpi]["from_dev"]=connections[link_id]["legs"][leg]["from_dev"];
    map_data["tps"][link_id][new_tpi]["from_int"]=connections[link_id]["legs"][leg]["from_int"];
    map_data["tps"][link_id][new_tpi]["to_tp"]=old_tp1;

    if(map_data["tps"][link_id][old_tp1]["type"] == "devdev") {
      map_data["tps"][link_id][old_tp1]["type"]="devtp";

      if(map_data["tps"][link_id][old_tp1]["from_dev"] == map_data["tps"][link_id][new_tpi]["from_dev"]) {
        map_data["tps"][link_id][old_tp1]["from_dev"] = map_data["tps"][link_id][old_tp1]["to_dev"];
        map_data["tps"][link_id][old_tp1]["from_int"] = map_data["tps"][link_id][old_tp1]["to_int"];
      };
      map_data["tps"][link_id][old_tp1]["to_tp"]=new_tpi;
      delete map_data["tps"][link_id][old_tp1]["to_dev"];
      delete map_data["tps"][link_id][old_tp1]["to_int"];
    } else if(map_data["tps"][link_id][old_tp1]["type"] == "devtp") {
      map_data["tps"][link_id][old_tp1]["type"]="tptp";
      map_data["tps"][link_id][old_tp1]["from_tp"]=new_tpi;
      delete map_data["tps"][link_id][old_tp1]["from_dev"];
      delete map_data["tps"][link_id][old_tp1]["from_int"];
    };
  } else if(connections[link_id]["legs"][leg]["type"] == "tptp") {
    let old_tp1=connections[link_id]["legs"][leg]["from_tp"];
    let old_tp2=connections[link_id]["legs"][leg]["to_tp"];

    map_data["tps"][link_id][new_tpi]["type"]="tptp";
    map_data["tps"][link_id][new_tpi]["from_tp"]=old_tp1;
    map_data["tps"][link_id][new_tpi]["to_tp"]=old_tp2;

    if(map_data["tps"][link_id][old_tp1]["type"] == "devtp") {
      map_data["tps"][link_id][old_tp1]["to_tp"]=new_tpi;
    } else if(map_data["tps"][link_id][old_tp1]["type"] == "tptp") {
      if(map_data["tps"][link_id][old_tp1]["from_tp"] == old_tp2) {
        map_data["tps"][link_id][old_tp1]["from_tp"] = new_tpi;
      } else {
        map_data["tps"][link_id][old_tp1]["to_tp"] = new_tpi;
      };
    };

    if(map_data["tps"][link_id][old_tp2]["type"] == "devtp") {
      map_data["tps"][link_id][old_tp2]["to_tp"]=new_tpi;
    } else if(map_data["tps"][link_id][old_tp2]["type"] == "tptp") {
      if(map_data["tps"][link_id][old_tp2]["from_tp"] == old_tp1) {
        map_data["tps"][link_id][old_tp2]["from_tp"] = new_tpi;
      } else {
        map_data["tps"][link_id][old_tp2]["to_tp"] = new_tpi;
      };
    };

  };

  save_map("tps", link_id);

  delete connections[link_id];

  build_connections();

  devices_arranged={};
  connections_rearranged={};
/*
  arrange_interfaces_dev2tp(connections[link_id]["from_dev"], true);
  arrange_interfaces_dev2tp(connections[link_id]["to_dev"], true);

  arrange_interfaces_dev2dev(connections[link_id]["from_dev"], false, true);
  arrange_interfaces_dev2dev(connections[link_id]["to_dev"], false, true);
*/

  for(let dev_id in data["devs"]) {
    if(temp_data["devs"][dev_id] != undefined && temp_data["devs"][dev_id]["_draw"] == 1) {
      arrange_interfaces_dev2tp(dev_id, false);
      arrange_interfaces_dev2dev(dev_id, false, false);
    };
  };

  for(let lid in connections) {
    draw_connection(lid);
  };

};

function link_highlight(link_id) {
  int_popup_label(connections[link_id]["from_int"], connections[link_id]["from_dev"]);
  int_popup_label(connections[link_id]["to_int"], connections[link_id]["to_dev"]);

  for(let l in connections[link_id]["legs"]) {
    let leg=connections[link_id]["legs"][l];
    if(connections[link_id]["legs"][l]["drawn"] !== undefined) {
      let line_id=connections[link_id]["legs"][l]["drawn"];
      let line_div=$(document.getElementById(line_id));
      line_div.addClass("line_highlight");
      let orig_stroke_width = Number(line_div.data("stroke_width"));
      let svg=line_div.find("svg");
      let svg_width=svg.attr("width");
      let svg_height=svg.attr("height");
      let line=svg.find("line");
      let x1=line.attr("x1");
      let x2=line.attr("x2");
      let y1=line.attr("y1");
      let y2=line.attr("y2");
      line_div.data("svg_width", svg_width);
      line_div.data("svg_height", svg_height);
      line_div.data("x1", x1);
      line_div.data("x2", x2);
      line_div.data("y1", y1);
      line_div.data("y2", y2);
      svg.attr("width", Number(svg_width)+3);
      svg.attr("height", Number(svg_height)+3);
      line.attr("stroke-width", orig_stroke_width + 2);
      if(Number(x1) == Number(x2) && Number(x1) == 0) {
        line.attr("x1", 1);
        line.attr("x2", 1);
      } else if(Number(y1) == Number(y2) && Number(y1) == 0) {
        line.attr("y1", 1);
        line.attr("y2", 1);
      };
    };
  };
};


function save_map(key, id, fk, md) {
  if(!enable_save) {
    g_unsaved = true;
    return;
  };
  if(md == undefined) md = map_data;
  let save_fk = file_key;
  if(fk !== undefined) save_fk = fk;
  let save_data;
  let query = {};
  if(key !== undefined && id !== undefined) {
    save_data = md[key][id];
    if(save_data !== undefined) {
      query = {"action": "save_map_key_id", "key": key, "id": id, "file_key": save_fk, "save_data": JSON.stringify(save_data)};
    } else {
      query = {"action": "del_map_key_id", "key": key, "id": id, "file_key": save_fk};
    };
  } else if(key !== undefined) {
    save_data = md[key];
    if(save_data !== undefined) {
      query = {"action": "save_map_key", "key": key, "file_key": save_fk, "save_data": JSON.stringify(save_data)};
    } else {
      query = {"action": "del_map_key", "key": key, "file_key": save_fk};
    };
  } else {
    save_data = md;
    query = {"action": "save_map", "file_key": save_fk, "save_data": JSON.stringify(save_data)};
  };

  if(data["default_map"] != undefined && save_fk == "") {
    save_data = md;
    query = {"action": "save_map", "file_key": save_fk, "save_data": JSON.stringify(save_data)};
  };

  query["site"] = site;
  query["proj"] = proj;
  run_query(query, function() {
    if(fk === undefined) {
      file_saved = unix_timestamp();
      g_unsaved = false;
    };
    if(data["default_map"] != undefined) {
      $("#filename").text("").title("").hide();
      delete(data["default_map"]);
    };
  });
};

function get_file_row(fk) {
  let tr = $(TR)
   .data("id", fk)
  ;

  tr
   .tooltip({
     classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
     //items: "TR",
     content: function() {
       return $(this).prop("title");
     }
   })
  ;

  let name_td = $(TD).appendTo(tr);

  if(fk === file_key) {
    //tr.addClass("current_map_file");
    let t = data["files_list"][fk]["time"];
    if(file_saved != 0) { t = file_saved; };
    tr.title("Последнее сохранение: "+from_unix_time(t, false, 'н/д'));
    name_td
     .append( $(LABEL).addClass(["ui-icon", "ui-icon-check"])
       .css({"color": "green"})
       .title("Текущая загруженная раскладка")
     )
    ;
  } else {
    tr.title("Последнее сохранение: "+from_unix_time(data["files_list"][fk]["time"], false, 'н/д'));
    name_td
     .append( $(LABEL).addClass(["ui-icon", "ui-icon-empty"]) )
    ;
  };

  if(fk === "") {
    name_td
     .append( $(LABEL).text("Основная раскладка")
       .title("Раскладка, которая загружается при выборе локации и проекта, по умолчанию")
     )
    ;
  } else {
    let map_name = "";
    if(data["files_list"][fk]["name"] !== undefined) {
      map_name = data["files_list"][fk]["name"];
    };

    name_td
     .append( $(INPUT).addClass("map_name")
       .val(map_name)
       .inputStop(500)
       .on("input_stop", function() {
         let tr = $(this).closest("TR");
         let fk = tr.data("id");

         let new_name = String($(this).val()).trim();
         if(new_name == "") return;

         let query = {"action": "rename_map", "file_key": fk, "site": site, "proj": proj, "name": new_name};

         run_query(query, function(res) {
           data["files_list"][fk]["name"] = new_name;
         });
       })
     )
    ;
  };

  let act_td = $(TD).appendTo(tr);

  act_td
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-extlink"])
     .title("Загрузить раскладку")
     .click(function() {
       let tr = $(this).closest("TR");
       let fk = tr.data("id");

       window.location = "?action=get_front&site="+site+"&proj="+proj+"&file_key="+fk+(DEBUG?"&debug":"");
     })
   )
  ;

  if(data["files_list"][fk]["shared"] !== undefined) {
    act_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-clipboard"])
       .title("Скопировать ссылку общего доступа")
       .click(function() {
         let tr = $(this).closest("TR");
         let fk = tr.data("id");

         let url = window.location.origin + window.location.pathname +
                   "?shared="+data["files_list"][fk]["shared"];

         try {
           navigator.clipboard.writeText(url).then(
             function() {
               /* clipboard successfully set */
               tr.closest(".dialog_start").animateHighlight("green", 500);
             },
             function() {
               /* clipboard write failed */
               error_at('Opps! Your browser does not support the Clipboard API')
             }
           );
         } catch(e) {
           error_at(e);
         };

       })
     )
    ;
    act_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-cancel"])
       .title("Убрать общий доступ")
       .click(function() {
         let tr = $(this).closest("TR");
         let fk = tr.data("id");
         let query = {"action": "unshare_map", "file_key": fk, "site": site, "proj": proj};

         let text = "Внимание, после закрытия, повторное открытие общего доступа"+
                    "\nсоздаст ДРУГУЮ ссылку. Текущая перестанет работать без возможности отката.";
         show_confirm_checkbox(text, function() {
           run_query(query, function(res) {
             delete(data["files_list"][fk]["shared"]);
             tr.replaceWith( get_file_row(fk) );
           });
         });
       })
     )
    ;
  } else {
    act_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-group"])
       .title("Открыть общий доступ")
       .click(function() {
         let tr = $(this).closest("TR");
         let fk = tr.data("id");
         let query = {"action": "share_map", "file_key": fk, "site": site, "proj": proj};

         run_query(query, function(res) {
           data["files_list"][fk]["shared"] = res["ok"]["key"];
           tr.replaceWith( get_file_row(fk) );
         });
       })
     )
    ;
  };


  if(fk !== file_key ||
     (fk == "" && file_key == "" && data["default_map"] != undefined)
  ) {
    act_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-save"])
       .title("Сохранить текущую раскладку в эту")
       .click(function() {
         let tr = $(this).closest("TR");
         let fk = tr.data("id");
         show_confirm_checkbox("Подтвердите перезапись данных.\nВНИМАНИЕ: Отмена будет невозможна!", function() {
           save_map(undefined, undefined, fk);
         })
       })
     )
    ;
  };


  act_td
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-erase"])
     .title("Очистить раскладку")
     .click(function() {
       let tr = $(this).closest("TR");
       let fk = tr.data("id");
       let text = "Подтвердите удаление данных.";
       if(data["files_list"][fk]["shared"] !== undefined) {
         text += "\nК очищаемой раскладке предоставлен общий доступ.";
       };
       show_confirm_checkbox(text, function() {
         save_map(undefined, undefined, fk, {});
         if(fk === file_key) {
           window.location = "?action=get_front&site="+site+"&proj="+proj+"&file_key="+fk+(DEBUG?"&debug":"");
         };
       })
     })
   )
  ;

  if(/*fk != ""*/true) {
    act_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
       .title("Удалить данные раскладки")
       .click(function() {
         let tr = $(this).closest("TR");
         let fk = tr.data("id");
         let text = "Подтвердите удаление данных.";
         if(fk === file_key) {
           text += "\nВы удаляете текущую раскладку. После удаления будет загружена Основная раскладка или раскладка по умолчанию, если Основной нет.";
         };
         if(data["files_list"][fk]["shared"] !== undefined) {
           text += "\n\nК удаляемой раскладке предоставлен общий доступ.\nПосле удаления, ссылка общего доступа станет недоступна.";
         };
         show_confirm_checkbox(text, function() {
           let query = {"action": "del_map", "file_key": fk, "site": site, "proj": proj};

           run_query(query, function() {
             if(fk === file_key) {
               window.location = "?action=get_front&site="+site+"&proj="+proj+(DEBUG?"&debug":"");
             } else {
               if(fk !== "") {
                 tr.remove();
                 delete(data["files_list"][fk]);
               } else {
                 data["files_list"][fk] = {};
                 tr.replaceWith(get_file_row(""));
               };
             };
           });
         })
       })
     )
    ;
  };

  if(fk == "" && data["is_default_map_owner"] == undefined &&
     data["default_map"] == undefined
  ) {
    act_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-star-h"])
       .title("Установить раскладкой по умолчанию для всех пользователей")
       .click(function() {
         let tr = $(this).closest("TR");

         show_confirm("Подтвердите выполнение действия", function() {
           run_query({"action": "set_default_map", "site": site, "proj": proj}, function(res) {
             if(!shared && file_key == "") {
               data["is_default_map_owner"] = 1;
               showFileWindow();
             };
           })
         });
       })
     )
    ;
  };

  act_td.find("LABEL.button").css({"margin-right": "0.5em"});

  return tr;
};

function showFileWindow() {
  let dlg = createWindow("files", "Управление раскладками", {modal: true});

  let content = dlg.find(".content");

  if(data["is_default_map_owner"] != undefined) {
    content
      .append( $(DIV)
        .css({"padding-bottom": "0.2em"})
        .text("Вы владелец раскладки по умолчанию")
        .title("Другие пользователи, которые впервые откроют текущую локацию, увидят вашу раскладку")
      )
    ;
  } else if(data["has_default_map"] != undefined && data["default_map"] == undefined) {
    content
      .append( $(DIV)
        .css({"padding-bottom": "0.2em"})
        .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-download"])
          .title("Загрузить раскладку по умолчанию")
          .click(function() {
            window.location = "?action=get_front&site="+site+"&proj="+proj+"&file_key="+
              "&load_default=1"+
              (DEBUG?"&debug":"")
            ;
          })
        )
        .append( $(SPAN).text(" Загрузить раскладку по умолчанию") )
      )
    ;
  };


  let table = $(TABLE).addClass("fixed_head_table")
   .append( $(THEAD)
     .append( $(TR)
       .append( $(TH).text("Имя раскладки") )
       .append( $(TH).text("Операция") )
     )
   )
   .append( $(TBODY)
   )
   .append( $(TFOOT)
     .append( $(TR)
       .append( $(TD)
         .append( $(INPUT).addClass("new_file_name") )
       )
       .append( $(TD)
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-copy"])
           .title("Сохранить копию текущей раскладки под новым именем")
           .click(function(e) {
             e.stopPropagation();
             let new_name = String($(".new_file_name").val()).trim();
             if(new_name == "") { $(".new_file_name").animateHighlight("red", 300); return; };

             let found = false;

             $(this).closest("TABLE").find("TBODY").find("TR").each(function() {
               let this_name = String($(this).find("INPUT").val()).trim();
               if(this_name.toLowerCase() == new_name.toLowerCase()) {
                 found = true;
                 $(this).animateHighlight("red", 300);
                 return false;
               };
             });
             if(found) return;

             let query = {"action": "new_map", "site": site, "proj": proj, "map_name": new_name,
                          "map_data": JSON.stringify(map_data)
             };

             let tb = $(this).closest("TABLE").find("TBODY");

             run_query(query, function(res) {
               let fk = res["ok"]["file"]["file_key"];
               data["files_list"][fk] = res["ok"]["file"];
               tb.append( get_file_row(fk) );
               $(".new_file_name").val("");
             });
           })
         )
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .title("Создать пустую раскладку")
           .click(function(e) {
             e.stopPropagation();
             let new_name = String($(".new_file_name").val()).trim();
             if(new_name == "") { $(".new_file_name").animateHighlight("red", 300); return; };

             let found = false;

             $(this).closest("TABLE").find("TBODY").find("TR").each(function() {
               let this_name = String($(this).find("INPUT").val()).trim();
               if(this_name.toLowerCase() == new_name.toLowerCase()) {
                 found = true;
                 $(this).animateHighlight("red", 300);
                 return false;
               };
             });
             if(found) return;

             let query = {"action": "new_map", "site": site, "proj": proj, "map_name": new_name,
                          "map_data": JSON.stringify({})
             };

             let tb = $(this).closest("TABLE").find("TBODY");

             run_query(query, function(res) {
               let fk = res["ok"]["file"]["file_key"];
               data["files_list"][fk] = res["ok"]["file"];
               tb.append( get_file_row(fk) );
               $(".new_file_name").val("");
             });
           })
         )
       )
     )
   )
  ;

  table.find("TFOOT").find("LABEL.button").css({"margin-right": "0.5em"});

  let tbody = table.find("TBODY");

  let k = keys(data["files_list"]);
  k.sort();

  for(let i in k) {
    let fk = k[i];
    tbody.append(get_file_row(fk));
  };


  table.appendTo(content);

  dlg.trigger("recenter");
  dlg.find(".new_file_name").focus();
};

function selectLocation(e) {
  e.stopPropagation();
  let buttons = [];
  buttons.push({
    "text": "Перейти",
    "click": function() {
      let sites_selected = $("#site_tree").jstree(true).get_selected(false);
      let projs_selected = $("#proj_tree").jstree(true).get_selected(false);

      if(sites_selected.length != 1) { $("#selected_site").animateHighlight("red", 500); return; };
      if(projs_selected.length == 0) { $("#selected_proj").animateHighlight("red", 500); return; };
      if(projs_selected.length > 1 && (projs_selected.indexOf("all") >= 0 || projs_selected.indexOf("none") >= 0)) {
        $("#selected_proj").animateHighlight("red", 500);
        return;
      };

      window.location = "?action=get_front&site="+sites_selected[0]+"&proj="+projs_selected.join(",")+"&file_key="+(DEBUG?"&debug":"");
    },
  });
  buttons.push({
    "text": "Закрыть",
    "click": function() {
      $(this).dialog( "close" );
    },
  });
  let dlg = createWindow("location", "Выбор локации и инф. системы", {
    minHeight: 800,
    height: 800,
    minWidth: 1000,
    width: 1000,
    buttons: buttons,
    position: {"my": "center top", "at": "center top", "of": window},
  });
  let content = dlg.find(".content")
  ;

  let header_div = $(DIV)
   .css({"position": "absolute", "top": "0px", "left": "0px", "right": "0px", "height": "2em", "white-space": "nowrap",
         "padding-top": "0.5em"
   })
   .appendTo(content)
  ;

  let selected_site_div = $(DIV, {"id": "selected_site"})
   .css({"display": "inline-block", "width": "50%",
   })
   .append( get_tag({"id": "root", "data": {}, "children": data["sites"]}, site) )
   .appendTo(header_div)
  ;

  let selected_proj_div = $(DIV, {"id": "selected_proj"})
   .css({"display": "inline-block", "width": "50%",
   })
   .appendTo(header_div)
  ;

  let projs = String(proj).split(",");
  for(let i in projs) {
    selected_proj_div
     .append( get_tag({"id": "root", "data": {}, "children": data["projects"]}, projs[i]) )
    ;
  };

  let search_div = $(DIV)
   .css({"position": "absolute", "top": "2em", "left": "0px", "right": "0px", "height": "2em", "white-space": "nowrap",
         "padding-top": "0.5em"
   })
   .appendTo(content)
  ;

  $(DIV)
   .css({"display": "inline-block", "width": "50%",
   })
   .append( $(SPAN).text("Поиск: ") )
   .append( $(INPUT, {"type": "search"})
     .inputStop(500)
     .on("input_stop", function() {
       let instance = $("#site_tree").jstree(true);
       instance.search($(this).val());
     })
   )
   .appendTo(search_div)
  ;

  $(DIV)
   .css({"display": "inline-block", "width": "50%",
   })
   .append( $(SPAN).text("Поиск: ") )
   .append( $(INPUT, {"type": "search"})
     .inputStop(500)
     .on("input_stop", function() {
       let instance = $("#proj_tree").jstree(true);
       instance.search($(this).val());
     })
   )
   .appendTo(search_div)
  ;

  let trees_div = $(DIV)
   .css({"position": "absolute", "top": "4.5em", "left": "0px", "right": "0px", "bottom": "0px"})
   .appendTo(content)
  ;

  let loc_div = $(DIV)
   .css({"display": "inline-block", "top": "0px", "left": "0px", "width": "calc(50% - 1px)", "bottom": "0px", "overflow-y": "scroll",
         "position": "absolute", "background-color": "white", "border-right": "0px solid gray", "border-top": "1px solid gray"
   })
   .appendTo(trees_div)
  ;

  let loc_tree = $(DIV, {"id": "site_tree"}).addClass("tree")
   .appendTo(loc_div)
  ;

  let loc_tree_plugins = [ "search" ];
  loc_tree
   .jstree({
     "core": {
       "multiple" : false,
       "animation" : 0,
       "data": data["sites"],
       "dblclick_toggle": true,
       "force_text": true
     },
     "state": { "key": "jstree_loc_"+user_self_sub + "_" + site + proj },
     "plugins": loc_tree_plugins
   })
   .on("ready.jstree", function(e, tree_data) {
     let instance = tree_data.instance;
     instance.deselect_all(false);
     instance.select_node(site, true);
   })
   .on("deselect_node.jstree", function(e, tree_data) {
     $(this).trigger("select_node.jstree", tree_data);
   })
   .on("select_node.jstree", function(e, tree_data) {
     let instance = tree_data.instance;
     let nodes = instance.get_selected(false);
     $("#selected_site").empty();
     if(nodes.length == 0) {
        $("#selected_site").append( $(LABEL).addClass("tag").text("Не выбран") );
        return;
     }; 
     if(nodes.length > 1) { error_at(); return; };

     let tag_elm = get_tag({"id": "root", "data": {}, "children": data["sites"]}, nodes[0]);
     $("#selected_site").append( tag_elm );
   })
  ;

  let proj_div = $(DIV)
   .css({"display": "inline-block", "top": "0px", "right": "0px", "width": "50%", "bottom": "0px", "overflow-y": "scroll",
         "position": "absolute", "background-color": "white", "border-top": "1px solid gray"
   })
   .appendTo(trees_div)
  ;

  let proj_tree = $(DIV, {"id": "proj_tree"}).addClass("tree")
   .appendTo(proj_div)
  ;

  let proj_tree_plugins = [ "search" ];
  proj_tree
   .jstree({
     "core": {
       "multiple" : true,
       "animation" : 0,
       "data": data["projects"],
       "dblclick_toggle": true,
       "force_text": true,
     },
     "state": { "key": "jstree_proj_"+user_self_sub + "_" + site + proj },
     "plugins": proj_tree_plugins
   })
   .on("ready.jstree", function(e, tree_data) {
     let instance = tree_data.instance;
     instance.deselect_all(false);
     instance.select_node(proj, true);
   })
   .on("deselect_node.jstree", function(e, tree_data) {
     $(this).trigger("select_node.jstree", tree_data);
   })
   .on("select_node.jstree", function(e, tree_data) {
     let instance = tree_data.instance;
     let nodes = instance.get_selected(false);
     $("#selected_proj").empty();
     if(nodes.length == 0) {
        $("#selected_proj").append( $(LABEL).addClass("tag").text("Не выбран") );
        return;
     }; 

     for(let i in nodes) {
       $("#selected_proj").append( get_tag({"id": "root", "data": {}, "children": data["projects"]}, nodes[i]) );
     };

   })
  ;
  //dlg.trigger("recenter");
};

$.fn.graph = function(gdata) {
  let cont = $(this);
  cont.addClass("graph");
  cont.data("gdata", gdata);
  cont.css({"border-top": "1px solid lightgray", "margin-top": "0.2em"});

  let win_part_id = gdata["win_part_id"];
  let win_part_key = gdata["win_part_key"];

  let win_part_data = get_win_part(win_part_id, win_part_key, {});

  let sync = "sync_" + gdata["dev_id"];

  let head_text;

  let safe_if_name;
  if(gdata["type"] == "int_io" || gdata["type"] == "int_pkts" ||
     false
  ) {
    if(gdata["type"] == "int_io") {
      head_text = "Ввод/вывод бит/с";
    } else if(gdata["type"] == "int_pkts") {
      head_text = "Ввод/вывод пакеты/с";
    };

    sync += "_int_" + gdata["int"];
  };


  cont.data("sync", sync);
  cont.addClass(sync);

  let show = true;
  if(gdata["hide"] === true) show = false;

  show = if_undef(win_part_data["show"], show);

  let canvas = $(DIV).addClass("canvas");
  let controls = $(DIV).addClass("control");

  cont
   .append( gdata["no_head"] === true ? $(LABEL) : $(DIV)
     .css({"padding-top": "0.3em", "padding-bottom": "0.3em"})
     .append( $(SPAN).text(head_text) )
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-arrowthickstop-1-n"])
       .css({"position": "absolute", "right": "0px", "margin-right": "0.5em"})
       .title("Свернуть/развернуть")
       .click(function() {
         let collapsable = $(this).closest(".graph").find(".collapse");
         let gdata = $(this).closest(".graph").data("gdata");

         let win_part_id = gdata["win_part_id"];
         let win_part_key = gdata["win_part_key"];


         let new_state;
         if(collapsable.data("show")) {
           collapsable.css("height", "0px");
           collapsable.data("show", false);
           new_state = false;
         } else {
           collapsable.css("height", "auto");
           collapsable.data("show", true);
           new_state = true;
         };
         if(win_part_id != undefined && win_part_key != undefined) {
           let win_part_data = get_win_part(win_part_id, win_part_key, {});
           win_part_data["show"] = new_state;
           set_win_part(win_part_id, win_part_key, win_part_data);
         };

       })
     )
   )
   .append( $(DIV).addClass("collapse")
     .css({"overflow": "hidden"})
     .css("height", show?"auto":"0px")
     .data("show", show)
     .append( canvas )
     .append( controls )
   )
   .append( $(DIV).addClass("debug").addClass("wsp")
   )
  ;
     
  canvas
   .css({"display": "inline-block", "position": "relative" })
   .append( $(LABEL).addClass("len_ind").addClass("ns")
     .css({"position": "absolute", "top": "0px", "left": "0px", "background-color": "#E0E0E080",
       "font-size": "x-small", "line-height": "90%",
     })
   )
   .append( $(LABEL).addClass("ind").addClass("ns")
     .css({"position": "absolute", "top": "0px", "right": "0px", "background-color": "#E0E0E080",
       "font-size": "x-small", "line-height": "90%",
     })
     .hide()
   )
   .append( $(DIV).addClass("time").addClass("ns")
     .css({"position": "absolute", "overflow": "hidden" })
     .on("mousewheel", function(e) {
       let elm_offset = $(this).offset();
       let x = e.pageX - elm_offset.left;
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let g_start = Number(im["start"]);
       let g_end = Number(im["end"]);
       let g_w = Number(im["graph_width"]);

       let pos_time = Math.floor(g_start + (g_end - g_start)*x/g_w);

       let new_half;
       let new_start;
       let new_end;

       let timer = $(this).data("timer");
       if(timer !== undefined) clearTimeout(timer);
       $(this).removeData("timer");

       let wheel_count = $(this).data("wheel_count");
       if(wheel_count === undefined) wheel_count = 0;

       if(e.originalEvent.wheelDelta > 0) {
         wheel_count++;
       } else {
         wheel_count--;
       };

       $(this).data("wheel_count", wheel_count);

       if(wheel_count == 0) return;

       if(wheel_count > 0) {
         //scroll Up - zoom IN
         new_half = Math.floor((g_end - g_start)/(4*wheel_count));
         if(new_half < 150) return;
       } else {
         new_half = Math.abs((g_end - g_start)*wheel_count);
       };


       new_start = pos_time - new_half;
       new_end = pos_time + new_half;

       let show_start = new_start;
       let show_end = new_end;

       if(new_end >= unix_timestamp()) {
         let r_len = new_end - new_start;
         new_end = "now";
         new_start = "now-"+r_len;
         show_end = unix_timestamp();
         show_start = show_end - r_len;
       };

       $(this).parent().find(".ind").text(from_unix_time(show_start) + " - " + from_unix_time(show_end) +
         " : " + wdhm(show_end - show_start))
       ;

       timer = setTimeout(function(elm, time_div) {
         if(document.contains(elm[0])) {
           time_div.removeData("timer");
           let g = elm;
           let wheel_count = time_div.data("wheel_count");

           if(wheel_count === undefined || wheel_count == 0) {
             return;
           };

           let elm_offset = time_div.offset();
           let x = e.pageX - elm_offset.left;
           let im = g.data("im");

           let g_start = Number(im["start"]);
           let g_end = Number(im["end"]);
           let g_w = Number(im["graph_width"]);

           let pos_time = Math.floor(g_start + (g_end - g_start)*x/g_w);

           let new_half;
           let new_start;
           let new_end;

           if(wheel_count > 0) {
             //scroll Up - zoom IN
             new_half = Math.floor((g_end - g_start)/(4*wheel_count));
             if(new_half < 150) return;
           } else {
             new_half = Math.abs((g_end - g_start)*wheel_count);
           };

           new_start = pos_time - new_half;
           new_end = pos_time + new_half;

           if(new_end >= unix_timestamp()) {
             let r_len = new_end - new_start;
             new_end = "now";
             new_start = "now-"+r_len;
           };

           time_div.removeData("wheel_count");

           $("."+$.escapeSelector(g.data("sync"))).each(function() {
             let gd = $(this).data("gdata");
             gd["start"] = new_start;
             gd["end"] = new_end;
             $(this).data("gdata", gd);
           }).trigger("graph_update");

         };
       }, 1000, g, $(this));
       $(this).data("timer", timer);
     })
     .on("mouseup", function(e) {
       if($(this).data("md") && $(this).data("range-start") !== undefined) {
         let new_start = Number($(this).data("range-start"));
         let new_end = Number($(this).data("range-end"));
         if((new_end - new_start) > 300) {

           let g= $(this).closest(".graph");

           $("."+$.escapeSelector(g.data("sync"))).each(function() {
             let gd = $(this).data("gdata");
             gd["start"] = new_start;
             gd["end"] = new_end;
             $(this).data("gdata", gd);
           }).trigger("graph_update");

         };
       };
     })
     .on("mousemove", function(e) {
       e.stopPropagation();
       let elm_offset = $(this).offset();
       let x = e.pageX - elm_offset.left;
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let timer = $(this).data("timer");
       if(timer !== undefined) clearTimeout(timer);
       $(this).removeData("timer");
       $(this).removeData("wheel_count");

       let g_start = Number(im["start"]);
       let g_end = Number(im["end"]);
       let g_w = Number(im["graph_width"]);

       let pos_time = Math.floor(g_start + (g_end - g_start)*x/g_w);

       if($(this).data("md")) {
         let cursor = $(this).find(".rangecursor");
         if(cursor.length == 0) {
           cursor = $(DIV).addClass("rangecursor").appendTo($(this));
         };
         let left = $(this).data("md-x");
         let width = Number(x) - Number(left);
         if(width < 0) {
           left = x;
           width = -width;
         };
         let new_start = Math.floor(g_start + (g_end - g_start)*left/g_w);
         let new_end = Math.floor(g_start + (g_end - g_start)*(left+width)/g_w);
         $(this).data("range-start", new_start);
         $(this).data("range-end", new_end);
         cursor.css({"left": left+"px", "width": width+"px"});
         $(this).parent().find(".ind").text(from_unix_time(new_start) + " - " + from_unix_time(new_end) + " : " + wdhm(new_end - new_start));
       } else {
         $(this).parent().find(".ind").text(from_unix_time(pos_time));
       };
       $(this).parent().find(".ind").show();
     })
     .on("mouseout", function() {
       $(this).parent().find(".ind").hide();

       let timer = $(this).data("timer");
       if(timer !== undefined) clearTimeout(timer);
       $(this).removeData("timer");
       $(this).removeData("wheel_count");
     })
     .on("mousedown", function(e) {
       e.stopPropagation();
       if(e.which != 1) return;
       let elm_offset = $(this).offset();
       let x = e.pageX - elm_offset.left;
       $(this).data("md", true);
       $(this).data("md-x", x);

       let timer = $(this).data("timer");
       if(timer !== undefined) clearTimeout(timer);
       $(this).removeData("timer");
       $(this).removeData("wheel_count");
     })
   )
  ;

  let size_sel = $(SELECT).addClass("size_sel");

  for(let i in graph_sizes_list) {
    size_sel.append( $(OPTION).text(graph_sizes_list[i]).val(graph_sizes_list[i]) );
  };

  size_sel.val(if_undef(win_part_data["graph_WxH"], default_graph_size));

  controls
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-arrowthick-1-w"])
     .title("На страницу влево")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let offset = Number(im["end"]) - Number(im["start"]);
       let new_start = Number(im["start"]) - offset;
       let new_end = Number(im["end"]) - offset;

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-arrow-l"])
     .title("На четверть страницы влево")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let offset = Math.floor((Number(im["end"]) - Number(im["start"]))/4);
       let new_start = Number(im["start"]) - offset;
       let new_end = Number(im["end"]) - offset;

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-arrow-r"])
     .title("На четверть страницы вправо")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let offset = Math.floor((Number(im["end"]) - Number(im["start"]))/4);
       let new_start = Number(im["start"]) + offset;
       let new_end = Number(im["end"]) + offset;

       if(new_end > unix_timestamp()) {
         let diff = new_end - new_start;
         new_end = "now";
         new_start = "end-"+diff;
       };

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-arrowthick-1-e"])
     .title("На страницу вправо")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let offset = Number(im["end"]) - Number(im["start"]);
       let new_start = Number(im["start"]) + offset;
       let new_end = Number(im["end"]) + offset;

       if(new_end > unix_timestamp()) {
         let diff = new_end - new_start;
         new_end = "now";
         new_start = "end-"+diff;
       };

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-arrowthickstop-1-e"])
     .title("Сейчас")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let diff = Number(im["end"]) - Number(im["start"]);
       let new_end = "now";
       let new_start = "end-"+diff;

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .append( $(LABEL).addClass("min5em") )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-zoomin"])
     .title("Уменьшить масштаб (также можно прокрутить колесо мыши вверх наведя на график)")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let diff = Number(im["end"]) - Number(im["start"]);
       let center = Number(im["start"]) + Math.floor(diff/2);
       let new_start = center - Math.floor(diff/4);
       let new_end = center + Math.floor(diff/4);
       let new_diff = new_end - new_start;
       if(new_diff < 300) { return; };

       if(new_end > unix_timestamp()) {
         let diff = new_end - new_start;
         new_end = "now";
         new_start = "end-"+diff;
       };

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");
     })
   )
   .append( $(LABEL).addClass(["button"]).text("1H")
     .addClass("range_btn")
     .data("half-range", 1800)
     .data("now-start", "end-1h")
     .title("Установить масштаб в 1 час")
   )
   .append( $(LABEL).addClass(["button"]).text("12H")
     .addClass("range_btn")
     .data("half-range", 60*60*12/2)
     .data("now-start", "end-12h")
     .title("Установить масштаб в 12 часов")
   )
   .append( $(LABEL).addClass(["button"]).text("1D")
     .addClass("range_btn")
     .data("half-range", 60*60*24/2)
     .data("now-start", "end-1d")
     .title("Установить масштаб в 1 день")
   )
   .append( $(LABEL).addClass(["button"]).text("1W")
     .addClass("range_btn")
     .data("half-range", 60*60*24*7/2)
     .data("now-start", "end-7d")
     .title("Установить масштаб в 1 неделя")
   )
   .append( $(LABEL).addClass(["button"]).text("1M")
     .addClass("range_btn")
     .data("half-range", 60*60*24*31/2)
     .data("now-start", "end-31d")
     .title("Установить масштаб в 1 месяц")
   )
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-zoomout"])
     .title("Увеличить масштаб (также можно прокрутить колесо мыши вниз наведя на график)")
     .click(function(e) {
       e.stopPropagation();
       let g = $(this).closest(".graph");
       let im = g.data("im");

       let diff = Number(im["end"]) - Number(im["start"]);
       let center = Number(im["start"]) + Math.floor(diff/2);
       let new_start = center - diff;
       let new_end = center + diff;
       let new_diff = new_end - new_start;

       if(new_end > unix_timestamp()) {
         let diff = new_end - new_start;
         new_end = "now";
         new_start = "end-"+diff;
       };

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["start"] = new_start;
         gd["end"] = new_end;
         $(this).data("gdata", gd);
       }).trigger("graph_update");
     })
   )
   .append( size_sel
     .on("change", function() {
       let g = $(this).closest(".graph");
       let a = String($(this).val()).split("x");

       let gdata = g.data("gdata");

       let win_part_id = gdata["win_part_id"];
       let win_part_key = gdata["win_part_key"];
       if(win_part_id != undefined && win_part_key != undefined) {
         let win_part_data = get_win_part(win_part_id, win_part_key, {});
         win_part_data["graph_WxH"] = $(this).val();
         set_win_part(win_part_id, win_part_key, win_part_data);
       };

       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["width"] = a[0];
         gd["height"] = a[1];
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .append( $(LABEL).addClass("min1em") )
   .append( $(LABEL).text("Комп.:").title("Компактный вид, без статистики") )
   .append( $(INPUT, {"type": "checkbox", "checked": get_local("graph_compact", false)})
     .on("change", function() {
       let compact = $(this).is(":checked");
       save_local("graph_compact", compact);
       let g = $(this).closest(".graph");
       $("."+$.escapeSelector(g.data("sync"))).each(function() {
         let gd = $(this).data("gdata");
         gd["compact"] = compact;
         $(this).data("gdata", gd);
       }).trigger("graph_update");

     })
   )
   .find(".button").css({"margin-right": "0.5em"})
  ;

  controls.find(".range_btn")
    .click(function(e) {
      e.stopPropagation();
      let g = $(this).closest(".graph");
      let im = g.data("im");

      let half_range = $(this).data("half-range");
      let now_start = $(this).data("now-start");

      let diff = Number(im["end"]) - Number(im["start"]);
      let center = Number(im["start"]) + Math.floor(diff/2);
      let new_start = center - half_range;
      let new_end = center + half_range;
      let new_diff = new_end - new_start;

      let btn_gd = g.data("gdata");

      if(new_end > unix_timestamp()) {
        let diff = new_end - new_start;
        new_end = "now";
        new_start = "end-"+diff;
      } else if(btn_gd["end"] === "now") {
        new_end = "now";
        new_start = now_start;
      };

      $("."+$.escapeSelector(g.data("sync"))).each(function() {
        let gd = $(this).data("gdata");
        gd["start"] = new_start;
        gd["end"] = new_end;
        $(this).data("gdata", gd);
      }).trigger("graph_update");
    })
  ;

  //{
  // "file": "lldpc18ef63b54580.Gi0s28.int_io_500x150.png",
  // "graph_width": "500",
  // "graph_height": "150",
  // "graph_left": "51",
  // "graph_top": "15",
  // "image_width": "581",
  // "image_height": "289",
  // "start": "1676350613"
  // "end": "1676354213",
  // }

  cont.on("graph_update", function(e) {
    e.stopPropagation();
    let gdata = $(this).data("gdata");
    let cont = $(this);


    let safe_dev_id = data["devs"][ gdata["dev_id"] ]["safe_dev_id"];
    let query = {"json": 1, "type": gdata["type"], "dev_id": safe_dev_id};

    let win_part_id = gdata["win_part_id"];
    let win_part_key = gdata["win_part_key"];

    let win_part_data = get_win_part(win_part_id, win_part_key, {});

    let graph_WxH = if_undef(win_part_data["graph_WxH"], default_graph_size);
    let a = String(graph_WxH).split("x");

    if(gdata["max"] !== undefined) {
      query["max"] = gdata["max"];
    };

    if(gdata["width"] !== undefined) {
      query["width"] = gdata["width"];
      query["height"] = gdata["height"];
    } else {
      query["width"] = a[0];
      query["height"] = a[1];
    };

    if(gdata["compact"] === true || get_local("graph_compact", false)) {
      query["compact"] = 1;
    };

    if(gdata["start"] !== undefined) {
      query["start"] = gdata["start"];
      query["end"] = gdata["end"];
    };

    if(gdata["type"] == "int_io" || gdata["type"] == "int_pkts" ||
       false
    ) {
      query["int"] = data["devs"][ gdata["dev_id"] ]["interfaces"][ gdata["int"] ]["safe_if_name"];
    } else if(gdata["type"] == "cpu") {
      query["cpu_list"] = gdata["cpu_list"];
      let cpus = String(gdata["cpu_list"]).split(",");
      for(let cpui in cpus) {
        let cpu_idx = cpus[cpui];
        query["cpu_name"+cpu_idx] = gdata["cpu_name"+cpu_idx];
        query["cpu_key"+cpu_idx] = gdata["cpu_key"+cpu_idx];
      };
    };

    run_query(query, function(res) {
      if(res["ok"] == "no_data") {
        cont.empty();
        return;
      };

      let im = res["ok"];
      cont.data("im", im);
      let canvas = cont.find(".canvas");
      let control = cont.find(".control");

      canvas.find(".len_ind").text(wdhm(im["end"] - im["start"]));

      canvas
       .css({"display": "inline-block", "width": im["image_width"]+"px", "height": im["image_height"]+"px",
             "background-image": "url(\"graph?file=" + im["file"] + "&"+ unix_timestamp() + "\")",
             "position": "relative"
       })
      ;

      canvas.find(".time")
       .css({"position": "absolute", "top": im["graph_top"]+"px", "left": im["graph_left"]+"px",
             "width": im["graph_width"]+"px", "height": im["graph_height"]+"px",
             "overflow": "hidden"
       })
      ;

    }, "graph");


  });
  cont.trigger("graph_update");
  return this;
};

function interface_win(dev_id, int) {
  run_query({"action": "get_device", "dev_id": dev_id}, function(res) {
    if(res["ok"]["fail"] !== undefined) {
      show_dialog("Устройство отсутствует в данных.");
      return;
    };
    if(res["ok"]["dev"]["interfaces"][int] == undefined) {
      show_dialog("Интерфейс отсутствует в данных.");
      return;
    };
    let int_info = res["ok"]["dev"]["interfaces"][int];
    data["devs"][dev_id] = res["ok"]["dev"];

    let win_id = "int_win_"+int+"@"+dev_id;

    let dlg_options = {
      _close: function() {
        let dlg = $(this).closest(".ui-dialog").find(".dialog_start");
        let win_id = dlg.data("win_id");

        delete(win_parts[win_id]);

        dlg.dialog("close");
        interface_out();
      },
    };

    let dlg = createWindow(win_id, data["devs"][dev_id]["short_name"] + ": " + int, dlg_options);

    dlg.dialog("widget").find(".ui-dialog-titlebar")
     .append( $(BUTTON).addClass(["ui-button", "ui-corner-all", "ui-widget",
         "ui-button-icon-only", "ui-dialog-titlebar-close"]
       )
       .css({"right": "4em", "height": "20px", "font-size": "x-small"})
       .append( $(SPAN).addClass(["ui-button-icon", "ui-icon", "ui-icon-reload"])
       )
       .append( $(SPAN).addClass(["ui-button-icon-space"]) )
       .click(function() {
         let dlg = $(this).closest(".ui-dialog").find(".dialog_start");
         let dev_id = dlg.data("dev_id");
         let win_id = dlg.data("win_id");
         let ifName = dlg.data("int");
         set_win_part(win_id, "scroll", dlg.scrollTop());
         interface_win(dev_id, ifName);
       })
     )
    ;

    dlg.dialog("widget")
      .hover(
        function (e) {
          e.stopPropagation();
          let dlg = $(this).find(".dialog_start");
          let int = dlg.data("int");
          let dev_id = dlg.data("dev_id");
          interface_in(int, data["devs"][dev_id])
        },
        interface_out
      )
    ;

    dlg.data("dev_id", dev_id);
    dlg.data("int", int);

    dlg.data("win_id", win_id);

    let im = int_metrics(int, data["devs"][dev_id]);

    let content = dlg.find(".content");
    content
     .append( $(DIV)
       .css({"white-space": "nowrap"})
       .append( int_labels(int, data["devs"][dev_id]) )
     )
     .append( $(DIV)
       .css({"white-space": "nowrap"})
       .append( $(SPAN).text(int_info["ifDescr"] != "" ? int_info["ifDescr"] : int) )
       .append( $(SPAN)
         .css({"float": "right", "margin-left": "2em"})
         .append( $(LABEL).text("BW: ") )
         .append( $(SPAN).text(im["02_speed"]["short_text"]) )
         .append( int_info["ifDelay"] == undefined ? $(LABEL) : $(LABEL).text(" DLY: ") )
         .append( int_info["ifDelay"] == undefined ? $(LABEL) : $(SPAN).text(Math.floor(int_info["ifDelay"]/10))
           .title("Cisco DLY: "+int_info["ifDelay"]+"\nConfig delay: "+Math.floor(int_info["ifDelay"]/10))
         )
         .append( !DEBUG ? $(LABEL) : $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
           .css({"margin-left": "0.3em"})
           .data("json", jstr(int_info))
           .data("int", int)
           .data("dev_id", dev_id)
           .click(function() {
             let dev_id = $(this).data("dev_id");
             let int = $(this).data("int");
             createWindow("int_json_" + int + "@" + dev_id, "JSON: " + data["devs"][dev_id]["short_name"] + ": "+int, {
                           minWidth: 500,
                           maxWidth: 1500,
                           width: 500,
              })
              .find(".content").css({"white-space": "pre"}).text( $(this).data("json") )
              .parent().trigger("recenter")
             ;
           })
         )
       )
     )
    ;

    if(int_info["tunnelEncap"]) {
      let encap = "Unk";
      let encap_title = "Unknown: "+int_info["tunnelEncap"];

      let sec = "Unk";
      let sec_title = "Unknown: "+int_info["tunnelSec"];

      let src = "Unk";
      let src_title = "Unknwon: "+int_info["tunnelSrc"];

      let dst = "Unk";
      let dst_title = "Unknwon: "+int_info["tunnelDst"];

      switch(int_info["tunnelEncap"]) {
      case 1:
        encap = "Oth";
        encap_title = "Encap: Other";
        break;
      case 2:
        encap = "Dir";
        encap_title = "Encap: Direct";
        break;
      case 3:
        encap = "GRE";
        encap_title = "Encap: GRE";
        break;
      case 4:
        encap = "Min";
        encap_title = "Encap: Minimal";
        break;
      case 5:
        encap = "L2TP";
        encap_title = "Encap: L2TP";
        break;
      case 6:
        encap = "PPTP";
        encap_title = "Encap: PPTP";
        break;
      case 7:
        encap = "L2F";
        encap_title = "Encap: L2F";
        break;
      case 8:
        encap = "UDP";
        encap_title = "Encap: UDP";
        break;
      case 9:
        encap = "ATMP";
        encap_title = "Encap: ATMP";
        break;
      };

      switch(int_info["tunnelSec"]) {
      case 1:
        sec = "None";
        sec_title = "Sec: None";
        break;
      case 2:
        sec = "IPsec";
        sec_title = "Sec: IPsec";
        break;
      case 3:
        sec = "Other";
        sec_title = "Sec: Other";
        break;
      };

      if(int_info["tunnelSrcDecoded"] !== undefined) {
        src = int_info["tunnelSrcDecoded"];
        src_title = int_info["tunnelSrcDecoded"];

        if(int_info["tunnelSrcIfName"] !== undefined) {
          src_title += " ("+int_info["tunnelSrcIfName"]+")";
        };
      };

      if(int_info["tunnelDstDecoded"] !== undefined) {
        dst = int_info["tunnelDstDecoded"];
        dst_title = int_info["tunnelDstDecoded"];
      };

      content
       .append( $(DIV)
         .css({"border-top": "1px solid lightgray", "padding-top": "0.1em", "padding-bottom": "0.1em",
           "margin-top": "0.2em", "margin-bottom": "0.2em"}
         )
         .append( $(LABEL).text(encap).title(encap_title)
           .css({"border": "1px solid black", "margin-right": "0.5em", "padding-left": "0.2em",
             "padding-right": "0.2em"}
           )
         )
         .append( $(LABEL).text(sec).title(sec_title)
           .css({"border": "1px solid black", "margin-right": "0.5em", "padding-left": "0.2em",
             "padding-right": "0.2em"}
           )
         )
         .append( $(LABEL).text("Src: ")
         )
         .append( $(LABEL).text(src).title(src_title)
         )
         .append( $(LABEL).addClass("min2em") )
         .append( $(LABEL).text("Dst: ")
         )
         .append( $(LABEL).text(dst).title(dst_title)
         )
       )
      ;

    };

    content
     .append( $(DIV)
       .css({"border": "1px solid lightgray", "padding-top": "0.1em", "padding-bottom": "0.1em",
         "margin-top": "0.2em", "margin-bottom": "0.2em"}
       )
       .append( $(SPAN).text(int_info["ifAlias"]) )
     )
    ;

    if(int_info["ips"] !== undefined) {
      let ips = $(DIV)
       .css({"display": "inline-block", "padding-left": "1em"})
      ;
      let ips_a = keys(int_info["ips"]);
      ips_a.sort(num_compare);
      for(let ipi in ips_a) {
        let ip = ips_a[ipi];
        ips
         .append( $(DIV)
           .append( $(SPAN).text(ip+"/"+int_info["ips"][ip]["masklen"])
             .ip_info(ip)
             .css({"margin-right": "0.5em", "min-width": "8em", "display": "inline-block"})
           )
           .append( $(A, {"target": "blank", "href": "ssh://"+ip}).text("SSH")
             .css({"margin-right": "0.5em"})
           )
           .append( $(A, {"target": "blank", "href": "telnet://"+ip}).text("TELNET")
             .css({"margin-right": "0.5em"})
           )
           .append( $(A, {"target": "blank", "href": "http://"+ip+"/"}).text("HTTP")
             .css({"margin-right": "0.5em"})
           )
           .append( $(A, {"target": "blank", "href": "https://"+ip+"/"}).text("HTTPS")
             .css({"margin-right": "0.5em"})
           )
           .append( $(A, {"target": "blank", "href": "/ipdb/?action=link&ip="+ip}).text("IPDB")
           )
           .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-copy"])
             .title("Скопировать IP в буфер")
             .data("to_copy", ip)
             .click(function() {
               let flash = $(this).closest("DIV");
               copy_to_clipboard( $(this).data("to_copy"),
                 function() {
                   flash.animateHighlight("lightgreen", 200);
                 }
               );
             })
             .css({"margin-left": "1em"})
           )
         )
        ;
      };
      content
       .append( $(DIV)
         .css({"white-space": "nowrap"})
         .append( $(DIV).text("IP:")
           .css({"display": "inline-block", "vertical-align": "top"})
         )
         .append( ips )
       )
      ;
    };

    if(data["devs"][dev_id]["virtual"] == undefined) {
      content
       .append( $(DIV)
         .graph({"type": "int_io", "dev_id": dev_id, "int": int,
                 "win_part_id": win_id, "win_part_key": "int_io"
         })
       )
       .append( $(DIV)
         .graph({"type": "int_pkts", "dev_id": dev_id, "int": int, "hide": true,
                 "win_part_id": win_id, "win_part_key": "int_pkts"
         })
       )
      ;
    };

    let tabs = $(DIV).addClass("tabs")
     .css({"border-top": "1px solid lightgray", "margin-top": "0.3em"})
     .appendTo(content)
    ;
    let tab_items = $(DIV).addClass("tab_items")
     .css({"border-top": "1px solid lightgray", "margin-top": "0.3em"})
     .appendTo(content)
    ;

    if(int_info["cdp_portIndex"] !== undefined &&
      data["devs"][dev_id]["cdp_ports"][ int_info["cdp_portIndex"] ]["neighbours"] !== undefined
    ) {
      tabs
       .append( $(LABEL).text("CDP").addClass("button")
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "cdp", false);
           set_win_part(win_id, "cdp", state);
           $(this).closest(".dialog_start").find(".cdp_neighbours").toggle(state);
         })
       )
      ;

      let neighbours = $(DIV).addClass("table").addClass("cdp_neighbours")
        .toggle(get_win_part(win_id, "cdp", false))
        .css({"border-top": "1px solid lightgray", "margin-top": "0.5em"})
      ;
      let tbody = $(DIV).addClass("tbody").appendTo(neighbours);

      for(let i in data["devs"][dev_id]["cdp_ports"][ int_info["cdp_portIndex"] ]["neighbours"]) {
        let ni = data["devs"][dev_id]["cdp_ports"][ int_info["cdp_portIndex"] ]["neighbours"][i];
        let tr = $(DIV).addClass("tr")
         .data("data", ni)
         .append( $(LABEL).addClass("td").text("CDP") )
         .append( $(SPAN).addClass("td")
           .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
             .css({"font-size": "x-small"})
             .click(function() {
               let ni = $(this).closest(".tr").data("data");
               let js = jstr(ni);
               let dev_id = $(this).closest(".dialog_start").data("dev_id");
               let int = $(this).closest(".dialog_start").data("int");
               let win_id = "nei_cdp_json_"+int+"@"+dev_id+"_"+ni["cdpRemIfName"]+"@"+ni["cdpRemDevId"];

               createWindow(win_id, "JSON: CDP neigh: "+dev_id+": "+int, {
                            minWidth: 500,
                            maxWidth: 1500,
                            width: 500,
                })
                .find(".content").css({"white-space": "pre"}).text( js )
                .parent().trigger("recenter")
               ;
             })
           )
         )
         .append( $(SPAN).addClass("td").text(ni["cdpRemAddrDecoded"])
           .title( ni["cdpRemCapsDecoded"] !== undefined ? "CAPS: " + ni["cdpRemCapsDecoded"] : "")
         )
         .append( $(SPAN).addClass("td").text(ni["cdpRemDevId"])
           .title( ni["cdpRemSoftware"] !== undefined ? "SW: " + ni["cdpRemSoftware"] : "")
         )
         .append( $(SPAN).addClass("td").text(ni["cdpRemIfName"])
           .title( ni["cdpRemPlatform"] !== undefined ? "Platform: " + ni["cdpRemPlatform"] : "")
         )
        ;
        tr.appendTo(tbody);
      };

      neighbours.appendTo(tab_items);
    };

    if(int_info["lldp_portIndex"] !== undefined &&
      data["devs"][dev_id]["lldp_ports"] !== undefined &&
      data["devs"][dev_id]["lldp_ports"][ int_info["lldp_portIndex"] ] !== undefined &&
      data["devs"][dev_id]["lldp_ports"][ int_info["lldp_portIndex"] ]["neighbours"] !== undefined
    ) {
      tabs
       .append( $(LABEL).text("LLDP").addClass("button")
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "lldp", false);
           set_win_part(win_id, "lldp", state);
           $(this).closest(".dialog_start").find(".lldp_neighbours").toggle(state);
         })
       )
      ;

      let neighbours = $(DIV).addClass("table").addClass("lldp_neighbours")
       .toggle(get_win_part(win_id, "lldp", false))
       .css({"border-top": "1px solid lightgray", "margin-top": "0.5em"})
      ;
      let tbody = $(DIV).addClass("tbody").appendTo(neighbours);

      for(let i in data["devs"][dev_id]["lldp_ports"][ int_info["lldp_portIndex"] ]["neighbours"]) {
        let ni = data["devs"][dev_id]["lldp_ports"][ int_info["lldp_portIndex"] ]["neighbours"][i];

        let ip = "no IP";

        if(ni["RemMgmtAddr"] !== undefined) {
          for(let i in ni["RemMgmtAddr"]) {
            ip = ni["RemMgmtAddr"][i];
            break;
          };
        };

        let tr = $(DIV).addClass("tr")
         .data("data", ni)
         .append( $(LABEL).addClass("td").text("LLDP") )
         .append( $(SPAN).addClass("td")
           .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
             .css({"font-size": "x-small"})
             .click(function() {
               let ni = $(this).closest(".tr").data("data");
               let js = jstr(ni);
               let dev_id = $(this).closest(".dialog_start").data("dev_id");
               let int = $(this).closest(".dialog_start").data("int");
               let win_id = "nei_json_"+int+"@"+dev_id+"_"+ni["RemPortId"]+"@"+ni["RemChassisId"];

               createWindow(win_id, "JSON: LLDP neigh: "+dev_id+": "+int, {
                            minWidth: 500,
                            maxWidth: 1500,
                            width: 500,
                })
                .find(".content").css({"white-space": "pre"}).text( js )
                .parent().trigger("recenter")
               ;
             })
           )
         )
         .append( $(SPAN).addClass("td").text(ip)
           .title( ni["RemSysCapsDecoded"] !== undefined ? "CAPS: " + ni["RemSysCapsDecoded"] : "")
         )
         .append( $(SPAN).addClass("td")
           .text(ni["RemSysName"] !== undefined ? ni["RemSysName"] : "no name advertized")
           .title( ni["RemSysDescr"] !== undefined ? "Descr: " + ni["RemSysDescr"] : "")
         )
         .append( $(SPAN).addClass("td").text(ni["RemPortId"])
           .title( ni["RemPortDescr"] !== undefined ? "PortDescr: " + ni["RemPortDescr"] : "")
         )
        ;
        tr.appendTo(tbody);
      };

      neighbours.appendTo(tab_items);
    };

    if(int_info["macs"] != undefined) {
      tabs
       .append( $(LABEL).text("MACs "+int_info["macs_count"]).addClass("button")
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "macs", false);
           set_win_part(win_id, "macs", state);
           $(this).closest(".dialog_start").find(".macs").toggle(state);
         })
       )
      ;

      let sect = $(DIV).addClass("table").addClass("macs")
        .toggle(get_win_part(win_id, "macs", false))
        .css({"border-top": "1px solid lightgray", "margin-top": "0.5em"})
        .append( $(DIV).addClass("thead")
          .append( $(SPAN).addClass("th").text("VLAN") )
          .append( $(SPAN).addClass("th").text("MAC") )
        )
      ;
      let tbody = $(DIV).addClass("tbody").appendTo(sect);

      let if_vlans = keys(int_info["macs"]).sort(num_compare);
      for(let i in if_vlans) {
        let vlan = if_vlans[i];

        let vlan_macs = int_info["macs"][vlan];
        vlan_macs.sort(num_compare);

        for(let v in vlan_macs) {
          let mac = vlan_macs[v];
          let vlan_name = "";

          if(data["devs"][dev_id]["vlanNames"] != undefined ) {
            vlan_name = if_undef(data["devs"][dev_id]["vlanNames"][vlan], "");
          };

          let tr = $(DIV).addClass("tr")
            .append( $(SPAN).addClass("td").text(vlan)
              .title(vlan_name)
            )
            .append( $(SPAN).addClass("td")
              .append( $(SPAN).text(format_mac(mac))
                .css({"font-family": "monospace"})
                .mac_info(mac)
              )
              .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
                .css({"margin-left": "0.3em"})
                .data("search", mac)
                .click(function() { showSearchWindow($(this).data("search")); })
              )
            )
            .appendTo(tbody)
          ;
        };
      };
      sect.appendTo(tab_items);
    };

    if(int_info["arp"] != undefined) {
      tabs
       .append( $(LABEL).text("ARP "+hash_length(int_info["arp"])).addClass("button")
         .click(function() {
           let win_id = $(this).closest(".dialog_start").data("win_id");
           let state = !get_win_part(win_id, "arp", false);
           set_win_part(win_id, "arp", state);
           $(this).closest(".dialog_start").find(".arp").toggle(state);
         })
       )
      ;

      let sect = $(DIV).addClass("table").addClass("arp")
        .toggle(get_win_part(win_id, "arp", false))
        .css({"border-top": "1px solid lightgray", "margin-top": "0.5em"})
        .append( $(DIV).addClass("thead")
          .append( $(SPAN).addClass("th").text("IP") )
          .append( $(SPAN).addClass("th").text("MAC") )
        )
      ;
      let tbody = $(DIV).addClass("tbody").appendTo(sect);

      let if_arps = keys(int_info["arp"]).sort(num_compare);
      for(let i in if_arps) {
        let arp = if_arps[i];

        let mac = int_info["arp"][arp];

        let tr = $(DIV).addClass("tr")
          .append( $(SPAN).addClass("td")
            .append( $(SPAN).text(arp)
              .ip_info(arp)
            )
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
              .css({"margin-left": "0.3em", "float": "right"})
              .data("search", arp)
              .click(function() { showSearchWindow($(this).data("search")); })
            )
          )
          .append( $(SPAN).addClass("td")
            .append( $(SPAN).text(format_mac(mac))
              .css({"font-family": "monospace"})
              .mac_info(mac)
            )
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
              .css({"margin-left": "0.3em"})
              .data("search", mac)
              .click(function() { showSearchWindow($(this).data("search")); })
            )
          )
          .appendTo(tbody)
        ;
      };
      sect.appendTo(tab_items);
    };

    if(data["devs"][dev_id]["config"] !== undefined && int_info["ifDescr"] != undefined && int_info["ifDescr"] != "") {

      let lines = String(data["devs"][dev_id]["config"]).split("\n");

      let if_lines = [];

      let if_sect = false;

      let sect_reg = new RegExp("^interface "+escapeRegex(int_info["ifDescr"])+"$");
      let sect_space = new RegExp("^ ");

      for(let l in lines) {
        let line = lines[l];
        if(sect_reg.test(line)) {
          if_sect = true;
          if_lines.push(line);
        } else if(if_sect) {
          if(sect_space.test(line)) {
            if_lines.push(line);
          } else {
            if_sect = false;
          };
        };
      };

      if(if_lines.length > 0) {

        tabs
         .append( $(LABEL).text("Конфигурация").addClass(["button"])
           .click(function() {
             let win_id = $(this).closest(".dialog_start").data("win_id");
             let state = !get_win_part(win_id, "config", false);
             $(this).closest(".dialog_start").find(".config").toggle(state);
             set_win_part(win_id, "config", state);
           })
         )
        ;

        let section = $(DIV).addClass("config")
          .addClass("wsp")
          .toggle(get_win_part(win_id, "config", false))
          .text(if_lines.join("\n"))
        ;

        section.appendTo( tab_items );
      };
    };


    dlg.scrollTop(get_win_part(win_id, "scroll", 0));
  });
};

function macVendorWindow() {
  let dlg = createWindow("mac_vendor_lookup", "MAC Vendor lookup");
  dlg.find(".content")
   .append( $(DIV)
     .append( $(INPUT, {"type": "search"})
       .css({"width": "10em"})
     )
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
       .css({"margin-left": "0.5em"})
       .click(function() {
         let mac = $(this).closest(".dialog_start").find("INPUT").val();
         if(! /^[0-9a-fA-F]{2}(?:[\-:\.]?[0-9a-fA-F]{2}){5}$/.test(mac)) {
           $(this).closest(".dialog_start").find("INPUT").animateHighlight("red", 300);
           return;
         };
         let result_elm = $(this).closest(".dialog_start").find(".result");
         run_query({"action": "mac_vendor", "mac": mac}, function(res) {
           if(res["ok"]["not_found"] !== undefined) {
             result_elm.text("Не найдено");
           } else {
             result_elm.text(res["ok"]["corp"]);
           };
         });
       })
     )
   )
   .append( $(DIV).addClass("result").html("&nbsp;")
     .css({"font-size": "larger", "margin-top": "0.3em"})
   )
  ;
};

function showSearchWindow(find="") {
  let dlg_options = {
  };
  let now = unix_timestamp();
  let dlg = createWindow("search_" + now, "Поиск", dlg_options);

  let content = dlg.find(".content");

  content
   .append( $(DIV)
     .append( $(LABEL).text("Текст/IP/MAC: ") )
     .append( $(INPUT, {"type": "search"}).val(find)
       .css({"width": "30em"})
       .enterKey(function() { $(this).parent().find("LABEL.ui-icon-search").trigger("click"); })
     )
     .append( $(LABEL, {"for": "search_reg_"+now}).text(" Re: ")
       .title("Поиск по регулярному выражению")
     )
     .append( $(INPUT, {"type": "checkbox", "id": "search_reg_"+now}).addClass("reg")
       .title("Поиск по регулярному выражению")
     )
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
       .css({"margin-left": "1em"})
       .click(function() {
         let search_for = String($(this).parent().find("INPUT[type=search]").val()).trim();
         if(search_for == "") return;
         let dlg = $(this).closest(".dialog_start");
         let results = dlg.find(".results");
         let reg = 0;
         if(dlg.find(".reg").is(":checked")) {
           reg = 1;
           try {
             new RegExp(search_for);
           } catch(e) {
             dlg.find("INPUT[type=search]").animateHighlight("red", 300);
             return;
           };
         };

         run_query({"action": "search", "for": search_for, "reg": reg}, function(res) {
           results.empty();

           if(res["ok"]["origin_type"] == "mac") {
             results.append( mac_results(res["ok"]) );
             results.append( ip_results(res["ok"]) );
           } else {
             results.append( ip_results(res["ok"]) );
             results.append( mac_results(res["ok"]) );
           };

           results.append( devs_results(res["ok"]) );
           results.append( ints_results(res["ok"]) );
           results.append( neigs_results(res["ok"]) );

           dlg.trigger("recenter");
         });
       })
     )
   )
   .append( $(DIV).addClass("results") )
  ;

  dlg.trigger("recenter");
  dlg.find("INPUT[type=search]").focus();

  if(find != "") {
    dlg.find("LABEL.ui-icon-search").trigger("click");
  };
};

function section(title, state, content) {
  let init_icon = state?"ui-icon-minus":"ui-icon-plus";
  let ret = $(DIV).addClass("section")
   .append( $(DIV).addClass("sect_head")
     .append( $(LABEL).addClass(["sect_toggle", "button", "ui-icon", init_icon])
       .css({"font-size": "x-small"})
       .click(function() {
         if($(this).hasClass("ui-icon-minus")) {
           $(this).removeClass("ui-icon-minus").addClass("ui-icon-plus");
         } else {
           $(this).removeClass("ui-icon-plus").addClass("ui-icon-minus");
         };
         $(this).closest(".section").find(".sect_content").first().toggle();
       })
     )
     .append( $(SPAN).text( title )
       .css({"margin-left": "0.5em"})
     )
   )
   .append( $(DIV).addClass("sect_content")
     .css({"padding-left": "1em"})
     .css({"padding-top": "0.2em"})
     .toggle(state)
   )
  ;

  if(content !== undefined) {
    ret.find(".sect_content").append( content );
  };

  return ret;
};

$.fn.searchHighlight_dev = function(dev_id) {
  $(this)
    .data("sh_dev_id", dev_id)
    .hover(
      function(e) {
        e.stopPropagation();
        let dev_elm = $("#"+$.escapeSelector( $(this).data("sh_dev_id") ));
        if(dev_elm.length > 0) {
          dev_elm.addClass("search_highlight");

          let elm_offset = dev_elm.offset();
          let elm_width = dev_elm.width();
          let elm_height = dev_elm.height();
          let w_scroll_left = $(window).scrollLeft();
          let w_scroll_top = $(window).scrollTop();
          let w_width = $(window).width();
          let w_height = $(window).height();

          if(elm_offset.left >= w_width + w_scroll_left) {
            $("BODY")
              .append( $(DIV).addClass("dev_dir_"+dev_id)
                .css({"position": "fixed", "right": "0.5em", "width": "0.5em", "top": "0.5em", "bottom": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          } else if((elm_offset.left + elm_width) <= w_scroll_left) {
            $("BODY")
              .append( $(DIV).addClass("dev_dir_"+dev_id)
                .css({"position": "fixed", "left": "0.5em", "width": "0.5em", "top": "0.5em", "bottom": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          };

          if(elm_offset.top >= w_height + w_scroll_top) {
            $("BODY")
              .append( $(DIV).addClass("dev_dir_"+dev_id)
                .css({"position": "fixed", "bottom": "0.5em", "height": "0.5em", "left": "0.5em", "right": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          } else if((elm_offset.top + elm_height) <= w_scroll_top) {
            $("BODY")
              .append( $(DIV).addClass("dev_dir_"+dev_id)
                .css({"position": "fixed", "top": "0.5em", "height": "0.5em", "left": "0.5em", "right": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          };

          $(".dialog_start").each(function() {
            let wg = $(this).dialog("widget");

            let wg_width = wg.width();
            let wg_height = wg.height();

            let wg_offset = wg.offset();

            if(wg_offset.left <= elm_offset.left &&
               (wg_offset.left + wg_width) >= (elm_offset.left + elm_width) &&
               wg_offset.top <= elm_offset.top &&
               (wg_offset.top + wg_height) >= (elm_offset.top + elm_height) &&
               true
            ) {
              wg.addClass("search_highlight");
            };

          });

        };
      },
      function(e) {
        e.stopPropagation();
        let dev_elm = $("#"+$.escapeSelector( $(this).data("sh_dev_id") ));
        if(dev_elm.length > 0) {
          dev_elm.removeClass("search_highlight");
        };
        $(".dev_dir_"+$.escapeSelector( $(this).data("sh_dev_id") )).remove();
        $(".dialog_start").each(function() {
          let wg = $(this).dialog("widget");
          wg.removeClass("search_highlight");
        });

      }
    )
  ;
  return this;
};

$.fn.searchHighlight_int = function(dev_id, ifName) {
  $(this)
    .data("sh_dev_id", dev_id)
    .data("sh_ifName", ifName)
    .hover(
      function(e) {
        e.stopPropagation();
        let dev_id = $(this).data("sh_dev_id");
        let ifName = $(this).data("sh_ifName");

        let elm = $("#"+$.escapeSelector( ifName + "@" + dev_id ));
        if(elm.length > 0) {
          elm.addClass("search_highlight");

          let elm_offset = elm.offset();
          let elm_width = elm.width();
          let elm_height = elm.height();
          let w_scroll_left = $(window).scrollLeft();
          let w_scroll_top = $(window).scrollTop();
          let w_width = $(window).width();
          let w_height = $(window).height();

          if(elm_offset.left >= w_width + w_scroll_left) {
            $("BODY")
              .append( $(DIV).addClass("dev_int_dir_"+ifName + "@" + dev_id)
                .css({"position": "fixed", "right": "0.5em", "width": "0.5em", "top": "0.5em", "bottom": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          } else if((elm_offset.left + elm_width) <= w_scroll_left) {
            $("BODY")
              .append( $(DIV).addClass("dev_int_dir_"+ifName + "@" + dev_id)
                .css({"position": "fixed", "left": "0.5em", "width": "0.5em", "top": "0.5em", "bottom": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          };

          if(elm_offset.top >= w_height + w_scroll_top) {
            $("BODY")
              .append( $(DIV).addClass("dev_int_dir_"+ifName + "@" + dev_id)
                .css({"position": "fixed", "bottom": "0.5em", "height": "0.5em", "left": "0.5em", "right": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          } else if((elm_offset.top + elm_height) <= w_scroll_top) {
            $("BODY")
              .append( $(DIV).addClass("dev_int_dir_"+ifName + "@" + dev_id)
                .css({"position": "fixed", "top": "0.5em", "height": "0.5em", "left": "0.5em", "right": "0.5em",
                      "background-color": "orange", "z-index": windows_z + 1000000,
                })
              )
            ;
          };

          $(".dialog_start").each(function() {
            let wg = $(this).dialog("widget");

            let wg_width = wg.width();
            let wg_height = wg.height();

            let wg_offset = wg.offset();

            if(wg_offset.left <= elm_offset.left &&
               (wg_offset.left + wg_width) >= (elm_offset.left + elm_width) &&
               wg_offset.top <= elm_offset.top &&
               (wg_offset.top + wg_height) >= (elm_offset.top + elm_height) &&
               true
            ) {
              wg.addClass("search_highlight");
            };

          });

        };
      },
      function(e) {
        e.stopPropagation();
        let dev_id = $(this).data("sh_dev_id");
        let ifName = $(this).data("sh_ifName");

        let selector = $.escapeSelector( ifName + "@" + dev_id );
        let elm = $("#" + selector);
        if(elm.length > 0) {
          elm.removeClass("search_highlight");
        };
        $(".dev_int_dir_" + selector ).remove();
        $(".dialog_start").each(function() {
          let wg = $(this).dialog("widget");
          wg.removeClass("search_highlight");
        });

      }
    )
  ;
  return this;
};

function ip_results(ok) {
  if(ok["ips"] === undefined) return $([]);

  let ips = keys(ok["ips"]);

  let ret = section(ips.length + " IP Адресов", ok["origin_type"] == "ip");
  let ret_cont = ret.find(".sect_content");

  ips.sort(function(a, b) {
    if(ok["origin_type"] == "ip") {
      if(a == ok["origin"]) return -1;
      if(b == ok["origin"]) return 1;
    };
    return num_compare(a, b);
  });

  for(let i in ips) {
    let ip = ips[i];
    let data_row = ok["ips"][ip];
    let row = section(ip, ok["origin_type"] == "ip" && ip == ok["origin"]);
    let row_cont = row.find(".sect_content");

    let table = $(TABLE);

    if(data_row["hostname"] != undefined) {
      table
        .append( $(TR)
          .append( $(TD).text("IPDB:")
          )
          .append( $(TD)
            .append( $(SPAN).text(data_row["hostname"]) )
            .append( $(A, {"target": "blank", "href": "/ipdb/?action=link&ip="+ip}).text("IPDB")
              .css({"margin-left": "1em"})
            )
          )
        )
      ;
    };

    if(data_row["site"] != undefined) {
      table
        .append( $(TR)
          .append( $(TD).text("Локация:")
          )
          .append( $(TD)
            .append( get_tag({"id": "root", "children": data["sites"], "data": {}}, data_row["site"])
            )
            .append( site == data_row["site"] ? $(SPAN) : $(LABEL).addClass(["button", "ui-icon", "ui-icon-linkext"])
              .css({"margin-left": "0.5em"})
              .title("Перейти")
              .data("site", data_row["site"])
              .click(function() {
                window.location = "?action=get_front&site="+$(this).data("site")+"&proj="+proj+"&file_key="+(DEBUG?"&debug":"");
              })
            )
          )
        )
      ;
    };

    if(data_row["net"] !== undefined) {
      table
        .append( $(TR)
          .append( $(TD).text("IPDB сеть:")
          )
          .append( $(TD)
            .append( $(SPAN).text(data_row["net_cidr"]) )
            .append( $(A, {"target": "blank",
                "href": "/ipdb/?action=link&ip="+String(data_row["net_cidr"]).replace(/\/.*$/, "")
              })
              .text("IPDB")
              .css({"margin-left": "1em"})
            )
          )
        )
        .append( $(TR)
          .append( $(TD).text("Имя сети:")
          )
          .append( $(TD).text(data_row["net"])
          )
        )
      ;
    };

    if(data_row["dns"] != undefined) {
      table
        .append( $(TR)
          .append( $(TD).text("DNS:")
          )
          .append( $(TD).text(data_row["dns"])
          )
        )
      ;
    };
    if(data_row["whois"] != undefined) {
      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( section("WHOIS", false,
                $(DIV)
                  .css({"white-space": "pre", "font-family": "monospace"})
                  .text( data_row["whois"] )
              )
            )
          )
        )
      ;
    };

    if(data_row["ip_macs"].length > 0) {
      data_row["ip_macs"].sort(num_compare);

      let macs_list = $([]);

      for(let i in data_row["ip_macs"]) {
        macs_list = macs_list
          .add( $(SPAN)
            .append( $(SPAN).text(format_mac(data_row["ip_macs"][i])) )
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
              .css({"font-size": "small", "margin-left": "0.2em"})
              .data("search", data_row["ip_macs"][i])
              .click(function() { showSearchWindow( $(this).data("search") ); })
            )
          )
        ;
        if(i < (data_row["ip_macs"].length - 1)) {
          macs_list = macs_list.add( $(SPAN).text(", ") );
        };
      };


      table
        .append( $(TR)
          .css({"background-color": (data_row["ip_macs"].length > 1)?"lightcoral":"initial"})
          .append( $(TD).text("MACs:")
          )
          .append( $(TD).append(macs_list)
          )
        )
      ;
    };

    if(data_row["ip_ifs"] != undefined) {
      let subsect = section("Устройства с IP " + ip, false);
      let sub_cont = subsect.find(".sect_content");

      data_row["ip_ifs"].sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        return num_compare(a["ifName"], b["ifName"]);
      });

      for(let i in data_row["ip_ifs"]) {
        let ip_if = data_row["ip_ifs"][i];
        let ifName = ip_if["ifName"];

        let vdev = {
          "interfaces": {}
        };

        vdev["interfaces"][ifName] = ip_if["interface"];

        let dev_id = ip_if["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

        sub_cont
          .append( $(DIV).addClass("data_row")
            .css({"padding-top": "0.3em"})
            .data("dev_id", ip_if["dev_id"])
            .data("int", ip_if["ifName"])
            .append( $(LABEL).text(ip_if["short_name"])
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": ip_if["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                device_win(dev_id);
              })
              .searchHighlight_dev(ip_if["dev_id"])
            )
            .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
              .css({"margin": "initial 0.2em"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let elm = $("#" + $.escapeSelector(dev_id));
                if(elm.length > 0) {
                  elm[0].scrollIntoView();
                  $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                };
              })
              .searchHighlight_dev(ip_if["dev_id"])
            )
            .append( $(SPAN).text(" : ") )
            .append( $(LABEL).text(ip_if["ifName"])
              .title(if_undef(ip_if["interface"]["ifAlias"], ""))
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": ip_if["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let int = $(this).closest(".data_row").data("int");
                interface_win(dev_id, int);
              })
            )
            .append( int_labels(ifName, vdev) )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };

    if(data_row["ip_net_ifs"] != undefined) {
      let subsect = section("Устройства в одной сети с " + ip, false);
      let sub_cont = subsect.find(".sect_content");

      data_row["ip_net_ifs"].sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        return num_compare(a["ifName"], b["ifName"]);
      });

      for(let i in data_row["ip_net_ifs"]) {
        let ip_if = data_row["ip_net_ifs"][i];
        let ifName = ip_if["ifName"];

        let vdev = {
          "interfaces": {}
        };

        vdev["interfaces"][ifName] = ip_if["interface"];

        let dev_id = ip_if["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

        sub_cont
          .append( $(DIV).addClass("data_row")
            .css({"padding-top": "0.3em"})
            .data("dev_id", ip_if["dev_id"])
            .data("int", ip_if["ifName"])
            .append( $(LABEL).text(ip_if["short_name"])
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": ip_if["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                device_win(dev_id);
              })
              .searchHighlight_dev(ip_if["dev_id"])
            )
            .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
              .css({"margin": "initial 0.2em"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let elm = $("#" + $.escapeSelector(dev_id));
                if(elm.length > 0) {
                  elm[0].scrollIntoView();
                  $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                };
              })
              .searchHighlight_dev(ip_if["dev_id"])
            )
            .append( $(SPAN).text(" : ") )
            .append( $(LABEL).text(ip_if["ifName"])
              .title(if_undef(ip_if["interface"]["ifAlias"], ""))
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": ip_if["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let int = $(this).closest(".data_row").data("int");
                interface_win(dev_id, int);
              })
            )
            .append( int_labels(ifName, vdev) )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };

    if(data_row["ip_neigs"] != undefined) {
      let subsect = section("CDP/LLDP соседи с IP " + ip, false);
      let sub_cont = subsect.find(".sect_content");

      data_row["ip_neigs"].sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        if(a["ifName"] !== undefined && b["ifName"] !== undefined) return num_compare(a["ifName"], b["ifName"]);
        return Number(a["port_index"]) - Number(b["port_index"]);
      });

      for(let i in data_row["ip_neigs"]) {
        let neigh = data_row["ip_neigs"][i];
        let ifName = undefined;
        let ifAlias = undefined;
        let vdev = {
          "interfaces": {}
        };

        if(neigh["ifName"] != undefined) {
          ifName = neigh["ifName"];
          ifAlias = neigh["interface"]["ifAlias"];
          vdev["interfaces"][ifName] = neigh["interface"];
        };

        let neigh_ip = "NO IP";
        if(neigh["source"] == "CDP" && neigh["neighbour"]["cdpRemAddrDecoded"] != undefined) {
          neigh_ip = neigh["neighbour"]["cdpRemAddrDecoded"];
        } else if(neigh["source"] == "LLDP" && neigh["neighbour"]["RemMgmtAddr"] != undefined &&
          neigh["neighbour"]["RemMgmtAddr"]["1"] != undefined
        ) {
          neigh_ip = neigh["neighbour"]["RemMgmtAddr"]["1"];
        };

        let dev_id = neigh["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

        sub_cont
          .append( $(DIV).addClass("data_row")
            .data("dev_id", neigh["dev_id"])
            .css({"padding-top": "0.3em"})
            .append( $(DIV)
              .data("int", (ifName != undefined? ifName:""))
              .append( $(LABEL).text(neigh["source"])
                .css({"margin-right": "0.5em"})
              )
              .append( $(LABEL).text(neigh["short_name"])
                .css({"border": "1px solid black", "padding": "0 0.2em"})
                .css({"background-color": neigh["overall_status"] == "ok"?"white":"#FFE0E0"})
                .click(function() {
                  let dev_id = $(this).closest(".data_row").data("dev_id");
                  device_win(dev_id);
                })
                .searchHighlight_dev(dev_id)
              )
              .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
                .css({"margin": "initial 0.2em"})
                .click(function() {
                  let dev_id = $(this).closest(".data_row").data("dev_id");
                  let elm = $("#" + $.escapeSelector(dev_id));
                  if(elm.length > 0) {
                    elm[0].scrollIntoView();
                    $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                  };
                })
                .searchHighlight_dev(dev_id)
              )
              .append( $(SPAN).text(" : ") )
              .append( $(LABEL).text(ifName != undefined?ifName:(neigh["source"] + " Port: "+neigh["port_index"]))
                .title(if_undef(ifAlias, ""))
                .css({"border": "1px solid black", "padding": "0 0.2em"})
                .css({"background-color": neigh["overall_status"] == "ok"?"white":"#FFE0E0"})
                .click(function() {
                  let dev_id = $(this).closest(".data_row").data("dev_id");
                  let int = $(this).closest(".data_row").data("int");
                  if(int != "") {
                    interface_win(dev_id, int);
                  };
                })
              )
              .append( ifName != undefined?int_labels(ifName, vdev):$(SPAN) )
            )
            .append( (neigh["source"] == "CDP") ? $(DIV)
              .data("data", neigh["neighbour"])
              .data("nei_index", neigh["nei_index"])
              .data("port_index", neigh["port_index"])
              .append( $(SPAN).addClass("td")
                .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
                  .css({"font-size": "x-small"})
                  .click(function() {
                    let ni = $(this).closest("DIV").data("data");
                    let neigh_index = $(this).closest("DIV").data("nei_index");
                    let port_index = $(this).closest("DIV").data("port_index");
                    let js = jstr(ni);
                    let dev_id = $(this).closest(".data_row").data("dev_id");
                    let win_id = "nei_cdp_json_"+neigh_index+"@"+port_index+"@"+dev_id;

                    createWindow(win_id, "JSON: CDP neigh: "+dev_id+": Port "+port_index + ": Neigh "+neigh_index, {
                                 minWidth: 500,
                                 maxWidth: 1500,
                                 width: 500,
                     })
                     .find(".content").css({"white-space": "pre"}).text( js )
                     .parent().trigger("recenter")
                    ;
                  })
                )
              )
              .append( $(SPAN).addClass("td").text(neigh_ip)
                .title( neigh["neighbour"]["cdpRemCapsDecoded"] !== undefined ?
                  neigh["neighbour"]["cdpRemCapsDecoded"] : ""
                )
              )
              .append( $(SPAN).addClass("td").text(neigh["neighbour"]["cdpRemDevId"])
                .title( neigh["neighbour"]["cdpRemSoftware"] !== undefined ?
                  neigh["neighbour"]["cdpRemSoftware"] : ""
                )
              )
              .append( $(SPAN).addClass("td").text(neigh["neighbour"]["cdpRemIfName"])
                .title( neigh["neighbour"]["cdpRemPlatform"] !== undefined ?
                  neigh["neighbour"]["cdpRemPlatform"] : ""
                )
              )
              : $(DIV)
              .data("data", neigh["neighbour"])
              .data("nei_index", neigh["nei_index"])
              .data("port_index", neigh["port_index"])
              .append( $(SPAN).addClass("td")
                .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
                  .css({"font-size": "x-small"})
                  .click(function() {
                    let ni = $(this).closest("DIV").data("data");
                    let neigh_index = $(this).closest("DIV").data("nei_index");
                    let port_index = $(this).closest("DIV").data("port_index");
                    let js = jstr(ni);
                    let dev_id = $(this).closest(".data_row").data("dev_id");
                    let win_id = "nei_lldp_json_"+neigh_index+"@"+port_index+"@"+dev_id;

                    createWindow(win_id, "JSON: LLDP neigh: "+dev_id+": Port "+port_index + ": Neigh "+neigh_index, {
                                 minWidth: 500,
                                 maxWidth: 1500,
                                 width: 500,
                     })
                     .find(".content").css({"white-space": "pre"}).text( js )
                     .parent().trigger("recenter")
                    ;
                  })
                )
              )
              .append( $(SPAN).addClass("td").text(neigh_ip)
                .title( neigh["neighbour"]["RemSysCapsDecoded"] !== undefined ?
                  neigh["neighbour"]["RemSysCapsDecoded"] : ""
                )
              )
              .append( $(SPAN).addClass("td")
                .text(neigh["neighbour"]["RemSysName"] !== undefined ?
                  neigh["neighbour"]["RemSysName"] : "no name advertized"
                )
                .title( neigh["neighbour"]["RemSysDescr"] !== undefined ? neigh["neighbour"]["RemSysDescr"] : "")
              )
              .append( $(SPAN).addClass("td").text(neigh["neighbour"]["RemPortId"])
                .title( neigh["neighbour"]["RemPortDescr"] !== undefined ? neigh["neighbour"]["RemPortDescr"] : "")
              )
            )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };
    table.appendTo(row_cont);
    row.appendTo(ret_cont);
  };

  return ret;
};

function mac_results(ok) {
  if(ok["macs"] === undefined) return $([]);

  let macs = keys(ok["macs"]);

  let ret = section(macs.length + " MAC Адресов", true);
  let ret_cont = ret.find(".sect_content");

  macs.sort(function(a, b) {
    if(ok["origin_type"] == "mac") {
      if(a == ok["origin"]) return -1;
      if(b == ok["origin"]) return 1;
    };
    return num_compare(a, b);
  });

  for(let i in macs) {
    let mac = macs[i];
    let data_row = ok["macs"][mac];
    let row = section(format_mac(mac), ok["origin_type"] == "mac" && mac == ok["origin"]);
    let row_cont = row.find(".sect_content");

    let table = $(TABLE);

    if(data_row["corp"] != undefined) {
      table
        .append( $(TR)
          .append( $(TD).text("Вендор:")
          )
          .append( $(TD).text(data_row["corp"])
          )
        )
      ;
    };

    if(data_row["mac_ips"].length > 0 ) {
      data_row["mac_ips"].sort(num_compare);

      let ips_list = $([]);

      for(let i in data_row["mac_ips"]) {
        ips_list = ips_list
          .add( $(SPAN)
            .append( $(SPAN).text(data_row["mac_ips"][i]) )
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-search"])
              .css({"font-size": "small", "margin-left": "0.2em"})
              .data("search", data_row["mac_ips"][i])
              .click(function() { showSearchWindow( $(this).data("search") ); })
            )
          )
        ;
        if(i < (data_row["mac_ips"].length - 1)) {
          ips_list = ips_list.add( $(SPAN).text(", ") );
        };
      };

      table
        .append( $(TR)
          //.css({"background-color": (data_row["mac_ips"].length > 1)?"lightcoral":"initial"})
          .append( $(TD).text("IPs:")
          )
          .append( $(TD).append(ips_list)
          )
        )
      ;
    };

    if(data_row["mac_ifs"] != undefined) {
      let subsect = section("Устройства с MAC " + format_mac(mac), true);
      let sub_cont = subsect.find(".sect_content");

      data_row["mac_ifs"].sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        return num_compare(a["ifName"], b["ifName"]);
      });

      for(let i in data_row["mac_ifs"]) {
        let mac_if = data_row["mac_ifs"][i];
        let ifName = mac_if["ifName"];

        let vdev = {
          "interfaces": {}
        };

        vdev["interfaces"][ifName] = mac_if["interface"];

        let dev_id = mac_if["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

        sub_cont
          .append( $(DIV).addClass("data_row")
            .css({"padding-top": "0.3em"})
            .data("dev_id", mac_if["dev_id"])
            .data("int", mac_if["ifName"])
            .append( $(LABEL).text(mac_if["short_name"])
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": mac_if["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                device_win(dev_id);
              })
              .searchHighlight_dev(dev_id)
            )
            .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
              .css({"margin": "initial 0.2em"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let elm = $("#" + $.escapeSelector(dev_id));
                if(elm.length > 0) {
                  elm[0].scrollIntoView();
                  $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                };
              })
              .searchHighlight_dev(dev_id)
            )
            .append( $(SPAN).text(" : ") )
            .append( $(LABEL).text(mac_if["ifName"])
              .title(if_undef(mac_if["interface"]["ifAlias"], ""))
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": mac_if["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let int = $(this).closest(".data_row").data("int");
                interface_win(dev_id, int);
              })
            )
            .append( int_labels(ifName, vdev) )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };

    let end_ports = [];
    let trunk_ports = [];

    if(data_row["ports"] != undefined) {
      for(let i in data_row["ports"]) {
        let mac_port = data_row["ports"][i];
        if( mac_port["interface"]["l2_links"] == undefined &&
            mac_port["interface"]["lag_members"] == undefined
        ) {
          end_ports.push(mac_port);
        } else {
          trunk_ports.push(mac_port);
        };
      };
    };

    if(end_ports.length > 0) {
      let subsect = section("Конечные порты с MAC " + format_mac(mac), true);
      let sub_cont = subsect.find(".sect_content");

      end_ports.sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        return num_compare(a["ifName"], b["ifName"]);
      });

      for(let i in end_ports) {
        let mac_port = end_ports[i];
        let ifName = mac_port["ifName"];

        let vdev = {
          "interfaces": {}
        };

        vdev["interfaces"][ifName] = mac_port["interface"];

        let dev_id = mac_port["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);


        sub_cont
          .append( $(DIV).addClass("data_row")
            .css({"padding-top": "0.3em"})
            .data("dev_id", mac_port["dev_id"])
            .data("int", mac_port["ifName"])
            .append( $(LABEL).text("VLAN "+mac_port["vlan"])
              .css({"border": "1px solid black", "margin-right": "0.5em", "padding": "0 0.2em"})
            )
            .append( $(LABEL).text(mac_port["short_name"])
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": mac_port["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                device_win(dev_id);
              })
              .searchHighlight_dev(dev_id)
            )
            .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
              .css({"margin": "initial 0.2em"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let elm = $("#" + $.escapeSelector(dev_id));
                if(elm.length > 0) {
                  elm[0].scrollIntoView();
                  $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                };
              })
              .searchHighlight_dev(dev_id)
            )
            .append( $(SPAN).text(" : ") )
            .append( $(LABEL).text(mac_port["ifName"])
              .title(if_undef(mac_port["interface"]["ifAlias"], ""))
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": mac_port["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let int = $(this).closest(".data_row").data("int");
                interface_win(dev_id, int);
              })
            )
            .append( int_labels(ifName, vdev) )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };

    if(trunk_ports.length > 0) {
      let subsect = section("Транзитные порты с MAC " + format_mac(mac), false);
      let sub_cont = subsect.find(".sect_content");

      trunk_ports.sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        return num_compare(a["ifName"], b["ifName"]);
      });

      for(let i in trunk_ports) {
        let mac_port = trunk_ports[i];
        let ifName = mac_port["ifName"];

        let vdev = {
          "interfaces": {}
        };

        vdev["interfaces"][ifName] = mac_port["interface"];

        let dev_id = mac_port["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

        sub_cont
          .append( $(DIV).addClass("data_row")
            .css({"padding-top": "0.3em"})
            .data("dev_id", mac_port["dev_id"])
            .data("int", mac_port["ifName"])
            .append( $(LABEL).text("VLAN "+mac_port["vlan"])
              .css({"border": "1px solid black", "margin-right": "0.5em", "padding": "0 0.2em"})
            )
            .append( $(LABEL).text(mac_port["short_name"])
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": mac_port["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                device_win(dev_id);
              })
              .searchHighlight_dev(dev_id)
            )
            .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
              .css({"margin": "initial 0.2em"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let elm = $("#" + $.escapeSelector(dev_id));
                if(elm.length > 0) {
                  elm[0].scrollIntoView();
                  $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                };
              })
              .searchHighlight_dev(dev_id)
            )
            .append( $(SPAN).text(" : ") )
            .append( $(LABEL).text(mac_port["ifName"])
              .title(if_undef(mac_port["interface"]["ifAlias"], ""))
              .css({"border": "1px solid black", "padding": "0 0.2em"})
              .css({"background-color": mac_port["overall_status"] == "ok"?"white":"#FFE0E0"})
              .click(function() {
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let int = $(this).closest(".data_row").data("int");
                interface_win(dev_id, int);
              })
            )
            .append( int_labels(ifName, vdev) )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };

    if(data_row["mac_neigs"] != undefined) {
      let subsect = section("CDP/LLDP соседи с MAC " + format_mac(mac), false);
      let sub_cont = subsect.find(".sect_content");

      data_row["mac_neigs"].sort(function(a, b) {
        if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
        if(a["ifName"] !== undefined && b["ifName"] !== undefined) return num_compare(a["ifName"], b["ifName"]);
        return Number(a["port_index"]) - Number(b["port_index"]);
      });

      for(let i in data_row["mac_neigs"]) {
        let neigh = data_row["mac_neigs"][i];
        let ifName = undefined;
        let ifAlias = undefined;
        let vdev = {
          "interfaces": {}
        };

        if(neigh["ifName"] != undefined) {
          ifName = neigh["ifName"];
          ifAlias = neigh["interface"]["ifAlias"];
          vdev["interfaces"][ifName] = neigh["interface"];
        };

        let neigh_ip = "NO IP";
        if(neigh["source"] == "CDP" && neigh["neighbour"]["cdpRemAddrDecoded"] != undefined) {
          neigh_ip = neigh["neighbour"]["cdpRemAddrDecoded"];
        } else if(neigh["source"] == "LLDP" && neigh["neighbour"]["RemMgmtAddr"] != undefined &&
          neigh["neighbour"]["RemMgmtAddr"]["1"] != undefined
        ) {
          neigh_ip = neigh["neighbour"]["RemMgmtAddr"]["1"];
        };

        let dev_id = neigh["dev_id"];
        let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

        sub_cont
          .append( $(DIV).addClass("data_row")
            .data("dev_id", neigh["dev_id"])
            .data("int", if_undef(neigh["ifName"], ""))
            .css({"padding-top": "0.3em"})
            .append( $(DIV)
              .append( $(LABEL).text(neigh["source"])
                .css({"margin-right": "0.5em"})
              )
              .append( $(LABEL).text(neigh["short_name"])
                .css({"border": "1px solid black", "padding": "0 0.2em"})
                .css({"background-color": neigh["overall_status"] == "ok"?"white":"#FFE0E0"})
                .click(function() {
                  let dev_id = $(this).closest(".data_row").data("dev_id");
                  device_win(dev_id);
                })
                .searchHighlight_dev(dev_id)
              )
              .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
                .css({"margin": "initial 0.2em"})
                .click(function() {
                  let dev_id = $(this).closest(".data_row").data("dev_id");
                  let elm = $("#" + $.escapeSelector(dev_id));
                  if(elm.length > 0) {
                    elm[0].scrollIntoView();
                    $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
                  };
                })
                .searchHighlight_dev(dev_id)
              )
              .append( $(SPAN).text(" : ") )
              .append( $(LABEL).text(ifName != undefined?ifName:(neigh["source"] + " Port: "+neigh["port_index"]))
                .title(if_undef(ifAlias, ""))
                .css({"border": "1px solid black", "padding": "0 0.2em"})
                .css({"background-color": neigh["overall_status"] == "ok"?"white":"#FFE0E0"})
                .click(function() {
                  let dev_id = $(this).closest(".data_row").data("dev_id");
                  let int = $(this).closest(".data_row").data("int");
                  if(int != "") {
                    interface_win(dev_id, int);
                  };
                })
              )
              .append( ifName != undefined?int_labels(ifName, vdev):$(SPAN) )
            )
            .append( (neigh["source"] == "CDP") ? $(DIV)
              .data("data", neigh["neighbour"])
              .data("nei_index", neigh["nei_index"])
              .data("port_index", neigh["port_index"])
              .append( $(SPAN).addClass("td")
                .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
                  .css({"font-size": "x-small"})
                  .click(function() {
                    let ni = $(this).closest("DIV").data("data");
                    let neigh_index = $(this).closest("DIV").data("nei_index");
                    let port_index = $(this).closest("DIV").data("port_index");
                    let js = jstr(ni);
                    let dev_id = $(this).closest(".data_row").data("dev_id");
                    let win_id = "nei_cdp_json_"+neigh_index+"@"+port_index+"@"+dev_id;

                    createWindow(win_id, "JSON: CDP neigh: "+dev_id+": Port "+port_index + ": Neigh "+neigh_index, {
                                 minWidth: 500,
                                 maxWidth: 1500,
                                 width: 500,
                     })
                     .find(".content").css({"white-space": "pre"}).text( js )
                     .parent().trigger("recenter")
                    ;
                  })
                )
              )
              .append( $(SPAN).addClass("td").text(neigh_ip)
                .title( neigh["neighbour"]["cdpRemCapsDecoded"] !== undefined ?
                  neigh["neighbour"]["cdpRemCapsDecoded"] : ""
                )
              )
              .append( $(SPAN).addClass("td").text(neigh["neighbour"]["cdpRemDevId"])
                .title( neigh["neighbour"]["cdpRemSoftware"] !== undefined ?
                  neigh["neighbour"]["cdpRemSoftware"] : ""
                )
              )
              .append( $(SPAN).addClass("td").text(neigh["neighbour"]["cdpRemIfName"])
                .title( neigh["neighbour"]["cdpRemPlatform"] !== undefined ?
                  neigh["neighbour"]["cdpRemPlatform"] : ""
                )
              )
              : $(DIV)
              .data("data", neigh["neighbour"])
              .data("nei_index", neigh["nei_index"])
              .data("port_index", neigh["port_index"])
              .append( $(SPAN).addClass("td")
                .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
                  .css({"font-size": "x-small"})
                  .click(function() {
                    let ni = $(this).closest("DIV").data("data");
                    let neigh_index = $(this).closest("DIV").data("nei_index");
                    let port_index = $(this).closest("DIV").data("port_index");
                    let js = jstr(ni);
                    let dev_id = $(this).closest(".data_row").data("dev_id");
                    let win_id = "nei_lldp_json_"+neigh_index+"@"+port_index+"@"+dev_id;

                    createWindow(win_id, "JSON: LLDP neigh: "+dev_id+": Port "+port_index + ": Neigh "+neigh_index, {
                                 minWidth: 500,
                                 maxWidth: 1500,
                                 width: 500,
                     })
                     .find(".content").css({"white-space": "pre"}).text( js )
                     .parent().trigger("recenter")
                    ;
                  })
                )
              )
              .append( $(SPAN).addClass("td").text(neigh_ip)
                .title( neigh["neighbour"]["RemSysCapsDecoded"] !== undefined ?
                  neigh["neighbour"]["RemSysCapsDecoded"] : ""
                )
              )
              .append( $(SPAN).addClass("td")
                .text(neigh["neighbour"]["RemSysName"] !== undefined ?
                  neigh["neighbour"]["RemSysName"] : "no name advertized"
                )
                .title( neigh["neighbour"]["RemSysDescr"] !== undefined ? neigh["neighbour"]["RemSysDescr"] : "")
              )
              .append( $(SPAN).addClass("td").text(neigh["neighbour"]["RemPortId"])
                .title( neigh["neighbour"]["RemPortDescr"] !== undefined ? neigh["neighbour"]["RemPortDescr"] : "")
              )

            )
          )
        ;
      };

      table
        .append( $(TR)
          .append( $(TD, {"colspan": "2"})
            .append( subsect )
          )
        )
      ;
    };
    table.appendTo(row_cont);
    row.appendTo(ret_cont);
  };

  return ret;
};

function devs_results(ok) {
  if(ok["devs"] == undefined) return $([]);

  ok["devs"].sort(function(a, b) {
    return num_compare(a["short_name"], b["short_name"]);
  });


  let ret = section(ok["devs"].length + " Устройств", false);
  let ret_cont = ret.find(".sect_content");

  for(let i in ok["devs"]) {
    let item = ok["devs"][i];

    let dev_id = item["dev_id"];
    let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

    ret_cont
      .append( $(DIV).addClass("data_row")
        .css({"padding-top": "0.3em"})
        .data("dev_id", item["dev_id"])
        .append( $(LABEL).text(item["short_name"])
          .css({"border": "1px solid black", "padding": "0 0.2em"})
          .css({"background-color": item["overall_status"] == "ok"?"white":"#FFE0E0"})
          .click(function() {
            let dev_id = $(this).closest(".data_row").data("dev_id");
            device_win(dev_id);
          })
          .searchHighlight_dev(dev_id)
        )
        .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
          .css({"margin": "initial 0.2em"})
          .click(function() {
            let dev_id = $(this).closest(".data_row").data("dev_id");
            let elm = $("#" + $.escapeSelector(dev_id));
            if(elm.length > 0) {
              elm[0].scrollIntoView();
              $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
            };
          })
          .searchHighlight_dev(dev_id)
        )
      )
    ;
  };
  return ret;
};

function ints_results(ok) {
  if(ok["ints"] == undefined) return $([]);

  ok["ints"].sort(function(a, b) {
    if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
    return num_compare(a["ifName"], b["ifName"]);
  });


  let ret = section(ok["ints"].length + " Интерфейсов", false);
  let ret_cont = ret.find(".sect_content");

  for(let i in ok["ints"]) {
    let item = ok["ints"][i];
    let ifName = item["ifName"];

    let vdev = {
      "interfaces": {}
    };

    vdev["interfaces"][ifName] = item["interface"];

    let dev_id = item["dev_id"];
    let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

    ret_cont
      .append( $(DIV).addClass("data_row")
        .css({"padding-top": "0.3em"})
        .data("dev_id", item["dev_id"])
        .data("int", item["ifName"])
        .append( $(LABEL).text(item["short_name"])
          .css({"border": "1px solid black", "padding": "0 0.2em"})
          .css({"background-color": item["overall_status"] == "ok"?"white":"#FFE0E0"})
          .click(function() {
            let dev_id = $(this).closest(".data_row").data("dev_id");
            device_win(dev_id);
          })
          .searchHighlight_dev(dev_id)
        )
        .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
          .css({"margin": "initial 0.2em"})
          .click(function() {
            let dev_id = $(this).closest(".data_row").data("dev_id");
            let elm = $("#" + $.escapeSelector(dev_id));
            if(elm.length > 0) {
              elm[0].scrollIntoView();
              $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
            };
          })
          .searchHighlight_dev(dev_id)
        )
        .append( $(SPAN).text(" : ") )
        .append( $(LABEL).text(item["ifName"])
          .title(if_undef(item["interface"]["ifAlias"], ""))
          .css({"border": "1px solid black", "padding": "0 0.2em"})
          .css({"background-color": item["overall_status"] == "ok"?"white":"#FFE0E0"})
          .click(function() {
            let dev_id = $(this).closest(".data_row").data("dev_id");
            let int = $(this).closest(".data_row").data("int");
            interface_win(dev_id, int);
          })
        )
        .append( int_labels(ifName, vdev) )
      )
    ;
  };
  return ret;
};

function neigs_results(ok) {
  if(ok["neigs"] == undefined) return $([]);

  let ret = section(ok["neigs"].length + " соседей", false);
  let ret_cont = ret.find(".sect_content");

  ok["neigs"].sort(function(a, b) {
    if(a["short_name"] != b["short_name"]) return num_compare(a["short_name"], b["short_name"]);
    if(a["ifName"] !== undefined && b["ifName"] !== undefined) return num_compare(a["ifName"], b["ifName"]);
    return Number(a["port_index"]) - Number(b["port_index"]);
  });

  for(let i in ok["neigs"]) {
    let neigh = ok["neigs"][i];
    let ifName = undefined;
    let ifAlias = undefined;
    let vdev = {
      "interfaces": {}
    };

    if(neigh["ifName"] != undefined) {
      ifName = neigh["ifName"];
      ifAlias = neigh["interface"]["ifAlias"];
      vdev["interfaces"][ifName] = neigh["interface"];
    };

    let neigh_ip = "NO IP";
    if(neigh["source"] == "CDP" && neigh["neighbour"]["cdpRemAddrDecoded"] != undefined) {
      neigh_ip = neigh["neighbour"]["cdpRemAddrDecoded"];
    } else if(neigh["source"] == "LLDP" && neigh["neighbour"]["RemMgmtAddr"] != undefined &&
      neigh["neighbour"]["RemMgmtAddr"]["1"] != undefined
    ) {
      neigh_ip = neigh["neighbour"]["RemMgmtAddr"]["1"];
    };

    let dev_id = neigh["dev_id"];
    let show_eye = ($("#" + $.escapeSelector(dev_id)).length > 0);

    ret_cont
      .append( $(DIV).addClass("data_row")
        .data("dev_id", neigh["dev_id"])
        .data("int", if_undef(neigh["ifName"], ""))
        .css({"padding-top": "0.3em"})
        .append( $(DIV)
          .append( $(LABEL).text(neigh["source"])
            .css({"margin-right": "0.5em"})
          )
          .append( $(LABEL).text(neigh["short_name"])
            .css({"border": "1px solid black", "padding": "0 0.2em"})
            .css({"background-color": neigh["overall_status"] == "ok"?"white":"#FFE0E0"})
            .click(function() {
              let dev_id = $(this).closest(".data_row").data("dev_id");
              device_win(dev_id);
            })
            .searchHighlight_dev(dev_id)
          )
          .append( !show_eye ? $(SPAN) : $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
            .css({"margin": "initial 0.2em"})
            .click(function() {
              let dev_id = $(this).closest(".data_row").data("dev_id");
              let elm = $("#" + $.escapeSelector(dev_id));
              if(elm.length > 0) {
                elm[0].scrollIntoView();
                $(".dev_dir_"+$.escapeSelector( dev_id )).remove();
              };
            })
            .searchHighlight_dev(dev_id)
          )
          .append( $(SPAN).text(" : ") )
          .append( $(LABEL).text(ifName != undefined?ifName:(neigh["source"] + " Port: "+neigh["port_index"]))
            .title(if_undef(ifAlias, ""))
            .css({"border": "1px solid black", "padding": "0 0.2em"})
            .css({"background-color": neigh["overall_status"] == "ok"?"white":"#FFE0E0"})
            .click(function() {
              let dev_id = $(this).closest(".data_row").data("dev_id");
              let int = $(this).closest(".data_row").data("int");
              if(int != "") {
                interface_win(dev_id, int);
              };
            })
          )
          .append( ifName != undefined?int_labels(ifName, vdev):$(SPAN) )
        )
        .append( (neigh["source"] == "CDP") ? $(DIV)
          .data("data", neigh["neighbour"])
          .data("nei_index", neigh["nei_index"])
          .data("port_index", neigh["port_index"])
          .append( $(SPAN).addClass("td")
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
              .css({"font-size": "x-small"})
              .click(function() {
                let ni = $(this).closest("DIV").data("data");
                let neigh_index = $(this).closest("DIV").data("nei_index");
                let port_index = $(this).closest("DIV").data("port_index");
                let js = jstr(ni);
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let win_id = "nei_cdp_json_"+neigh_index+"@"+port_index+"@"+dev_id;

                createWindow(win_id, "JSON: CDP neigh: "+dev_id+": Port "+port_index + ": Neigh "+neigh_index, {
                             minWidth: 500,
                             maxWidth: 1500,
                             width: 500,
                 })
                 .find(".content").css({"white-space": "pre"}).text( js )
                 .parent().trigger("recenter")
                ;
              })
            )
          )
          .append( $(SPAN).addClass("td").text(neigh_ip)
            .title( neigh["neighbour"]["cdpRemCapsDecoded"] !== undefined ?
              neigh["neighbour"]["cdpRemCapsDecoded"] : ""
            )
          )
          .append( $(SPAN).addClass("td").text(neigh["neighbour"]["cdpRemDevId"])
            .title( neigh["neighbour"]["cdpRemSoftware"] !== undefined ?
              neigh["neighbour"]["cdpRemSoftware"] : ""
            )
          )
          .append( $(SPAN).addClass("td").text(neigh["neighbour"]["cdpRemIfName"])
            .title( neigh["neighbour"]["cdpRemPlatform"] !== undefined ?
              neigh["neighbour"]["cdpRemPlatform"] : ""
            )
          )
          : $(DIV)
          .data("data", neigh["neighbour"])
          .data("nei_index", neigh["nei_index"])
          .data("port_index", neigh["port_index"])
          .append( $(SPAN).addClass("td")
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
              .css({"font-size": "x-small"})
              .click(function() {
                let ni = $(this).closest("DIV").data("data");
                let neigh_index = $(this).closest("DIV").data("nei_index");
                let port_index = $(this).closest("DIV").data("port_index");
                let js = jstr(ni);
                let dev_id = $(this).closest(".data_row").data("dev_id");
                let win_id = "nei_lldp_json_"+neigh_index+"@"+port_index+"@"+dev_id;

                createWindow(win_id, "JSON: LLDP neigh: "+dev_id+": Port "+port_index + ": Neigh "+neigh_index, {
                             minWidth: 500,
                             maxWidth: 1500,
                             width: 500,
                 })
                 .find(".content").css({"white-space": "pre"}).text( js )
                 .parent().trigger("recenter")
                ;
              })
            )
          )
          .append( $(SPAN).addClass("td").text(neigh_ip)
            .title( neigh["neighbour"]["RemSysCapsDecoded"] !== undefined ?
              neigh["neighbour"]["RemSysCapsDecoded"] : ""
            )
          )
          .append( $(SPAN).addClass("td")
            .text(neigh["neighbour"]["RemSysName"] !== undefined ?
              neigh["neighbour"]["RemSysName"] : "no name advertized"
            )
            .title( neigh["neighbour"]["RemSysDescr"] !== undefined ? neigh["neighbour"]["RemSysDescr"] : "")
          )
          .append( $(SPAN).addClass("td").text(neigh["neighbour"]["RemPortId"])
            .title( neigh["neighbour"]["RemPortDescr"] !== undefined ? neigh["neighbour"]["RemPortDescr"] : "")
          )

        )
      )
    ;
  };
  return ret;
};

function vDevsWindow() {
  let list = [];
  for(let dev_id in data["devs"]) {
    if(data["devs"][dev_id]["virtual"] != undefined) {
      list.push(data["devs"][dev_id]);
    };
  };

  list.sort(function(a, b) { return num_compare(a["short_name"], b["short_name"]); });

  let dlg = createWindow("vdevs", "Виртуальные устройства");
  let content = dlg.find(".content");

  let table = $(TABLE)
    .append( $(THEAD)
      .append( $(TR)
        .append( $(TH).text("Имя") )
        .append( $(TH).text("Портов") )
        .append( $(TH).text("Локация") )
        .append( $(TH) )
      )
    )
    .appendTo(content)
  ;

  let tbody = $(TBODY).appendTo(table);

  for(let i in list) {
    let dev = list[i];
    tbody.append( get_vdev_row(dev) );
  };

  $(TFOOT)
    .append( $(TR)
      .append( $(TD, {"colspan": table.find("THEAD").find("TH").length})
        .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
          .click(function() {
            let tbody = $(this).closest("TABLE").find("TBODY");
            edit_vdev(undefined, function(vdev) {
              tbody.append( get_vdev_row(vdev) );
            })
          })
        )
      )
    )
    .appendTo(table)
  ;

  dlg.trigger("recenter");
};

function get_vdev_row(vdev) {
  let act_td = $(TD);

  act_td
    .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-edit"])
      .css({"margin-right": "0.5em"})
      .title("Редактировать")
      .click(function() {
        let row = $(this).closest("TR");
        let dev_id = row.data("dev_id");

        edit_vdev(data["devs"][dev_id], function(vdev) {
          row.replaceWith(get_vdev_row(vdev));
        });
      })
    )
    .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
      .title("Удалить")
      .click(function() {
        let row = $(this).closest("TR");
        show_confirm("Внимание, удаление устройства приведет к удалению виртуальных связей,\n"+
          "если они есть\nОтмена будет невозможна", function() {
            let dev_id = row.data("dev_id");

            run_query({"action": "del_vdev", "vdev_id": dev_id}, function(res) {
              if($(document.getElementById(dev_id)).length > 0) {
                remove_from_map(dev_id, false);
              } else {
                $("#dev_list").find(".dev_in_list").each(function() {
                  if( $(this).data("id") == dev_id ) {
                    $(this).remove();
                    return false;
                  };
                });
                resort_dev_list();
              };

              delete(data["devs"][dev_id]);

              for(let link_id in data["l2_links"]) {
                if(data["l2_links"][link_id][0]["DevId"] == dev_id ||
                   data["l2_links"][link_id][1]["DevId"] == dev_id
                ) {
                  wipe_l2_link(link_id);
                };
              };

              row.remove();
            });
          }
        );
      })
    )
  ;

  let tr = $(TR)
    .data("dev_id", vdev["id"])
    .append( $(TD).text(vdev["short_name"])
      .title( vdev["sysDescr"] )
    )
    .append( $(TD).text(hash_length(vdev["interfaces"]))
    )
    .append( $(TD)
      .append( get_tag({"id": "root", "data": {}, "children": data["sites"]}, vdev["site"]) )
    )
    .append( act_td )
  ;

  return tr;
};

function edit_vdev(vdev, donefunc) {

  let buttons = [
    {
      'text': 'Сохранить',
      'click': function() {
        let dlg = $(this);
        let donefunc = dlg.data("donefunc");
        let vdev = dlg.data("vdev");
        let is_new = dlg.data("is_new");

        let prev_ports = vdev["interfaces_sorted"];
        let prev_name = vdev["short_name"];

        let short_name = dlg.find(".short_name").val();
        if(!g_short_name_reg.test(short_name.trim())) {
          dlg.find(".short_name").animateHighlight("red", 400);
          return;
        };

        vdev["short_name"] = short_name.trim();
        vdev["sysDescr"] = dlg.find(".sysDescr").val().trim();
        vdev["model_short"] = dlg.find(".model_short").val().trim();
        vdev["site"] = dlg.find(".site").val().trim();
        vdev["sysLocation"] = dlg.find(".sysLocation").val().trim();
        vdev["data_ip"] = dlg.find(".data_ip").val().trim();

        let interfaces = {};
        let err = false;

        dlg.find(".interfaces").find(".tr").each(function() {
          let ifName = $(this).find(".ifName").text().trim();
          if(ifName == "" || ifName == undefined) {
            err = true;
            return false;
          };
          let ifAlias = $(this).find(".ifAlias").val().trim();
          interfaces[ifName] = {
            "ifName": ifName,
            "ifAlias": ifAlias,
            "ifDescr": ifName,
            "ifAdminStatus": 1,
            "ifOperStatus": 1,
            "ifDelay": 1,
            "ifSpeed": 1000000000,
            "ifHighSpeed": 1000,
            "ifIndex": 0,
            "ifType": 6,
            "safe_if_name": "none",
          };
        });

        if(err) return;

        vdev["interfaces"] = interfaces;
        vdev["interfaces_sorted"] = keys(interfaces);
        vdev["interfaces_sorted"].sort(num_compare);

        let dev_id = vdev["id"];

        run_query({"action": "save_vdev", "vdev_id": dev_id, "vdev_json": JSON.stringify(vdev)}, function(res) {
          data["devs"][dev_id] = vdev;

          if(is_new) {
            device_to_list(dev_id);
            resort_dev_list();
          } else {
            let new_ports = vdev["interfaces_sorted"];

            let ports_changed = false;
            for(let i in prev_ports) {
              if(!in_array(new_ports, prev_ports[i])) {
                ports_changed = true;
                wipe_l2_link_by_dev_int(dev_id, prev_ports[i]);
              };
            };
            for(let i in new_ports) {
              if(!in_array(prev_ports, new_ports[i])) {
                ports_changed = true;
                break;
              };
            };

            if(ports_changed || prev_name != short_name) {
              if($(document.getElementById(dev_id)).length > 0) {
                data_loaded(data, false);
                //remove_from_map(dev_id);
              } else {
                $("#dev_list").find(".dev_in_list").each(function() {
                  if( $(this).data("id") == dev_id ) {
                    $(this).find(".short_name").text(short_name);
                    return false;
                  };
                });
              };
            };
          };

          if(donefunc !== undefined) {
            donefunc(vdev);
          };
          dlg.dialog("close");
        });
      }
    },
    {
      'text': 'Отмена',
      'click': function() {$(this).dialog( "close" );},
    }
  ];

  let dlg = createWindow("vdev_edit", "Виртуальное устройство",  {"modal": true, "buttons": buttons});
  let content = dlg.find(".content");

  if(vdev == undefined) {
    dlg.data("is_new", true);
    vdev = {
      "id": "vdev:" + gen_code(),
      "data_ip": "",
      "short_name": "",
      "sysDescr": "",
      "overall_status": "ok",
      "interfaces_sorted": [],
      "interfaces": {},
      "last_seen": unix_timestamp(),
      "model_short": "Virtual device",
      "site": site,
      "sysLocation": "",
      "sysUpTimeStr": "Forever",
      "virtual": 1,
    };
  } else {
    dlg.data("is_new", false);
  };

  dlg.data("vdev", vdev);
  dlg.data("donefunc", donefunc);

  let table = $(TABLE).appendTo(content);

  table
    .append( $(TR)
      .append( $(TD).text("Hostname:") )
      .append( $(TD)
        .append( $(INPUT).addClass("short_name")
          .val(vdev["short_name"])
          .title(String(g_short_name_reg))
        )
      )
    )
    .append( $(TR)
      .append( $(TD).text("IP:") )
      .append( $(TD)
        .append( $(INPUT).addClass("data_ip")
          .val(vdev["data_ip"])
        )
      )
    )
    .append( $(TR)
      .append( $(TD).text("Описание:") )
      .append( $(TD)
        .append( $(TEXTAREA).addClass("sysDescr")
          .val(vdev["sysDescr"])
        )
      )
    )
    .append( $(TR)
      .append( $(TD).text("Модель:") )
      .append( $(TD)
        .append( $(INPUT).addClass("model_short")
          .val(vdev["model_short"])
        )
      )
    )
    .append( $(TR)
      .append( $(TD).text("Локация:") )
      .append( $(TD)
        .append( $(INPUT, {"type": "hidden"}).addClass("site")
          .val(vdev["site"])
        )
        .append( get_tag({"id": "root", "data": {}, "children": data["sites"]}, vdev["site"]) )
      )
    )
    .append( $(TR)
      .append( $(TD).text("sysLocation:") )
      .append( $(TD)
        .append( $(INPUT).addClass("sysLocation")
          .val(vdev["sysLocation"])
        )
      )
    )
  ;

  let ports = $(DIV).addClass("table")
    .append( $(DIV).addClass("thead")
      .append( $(SPAN).addClass("th").text("ifName") )
      .append( $(SPAN).addClass("th").text("Description") )
      .append( $(SPAN).addClass("th").text("") )
    )
    .append( $(DIV).addClass("tbody").addClass("interfaces") )
    .append( $(DIV).addClass("tfoot")
      .append( $(SPAN).addClass("td")
        .append( $(INPUT, {"placeholder": "Eth1/0/x"}).val("Eth1/0/").addClass("ifName")
          .title(String(g_ifName_reg))
        )
      )
      .append( $(SPAN).addClass("td")
        .append( $(INPUT).addClass("ifAlias") )
      )
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
          .click(function() {
            let ifName = $(this).closest(".tfoot").find(".ifName").val();
            if(ifName == undefined) return;
            if(ifName == "Eth1/0/" || !g_ifName_reg.test(ifName)) {
              $(this).closest(".tfoot").find(".ifName").animateHighlight("orange", 400);
              return;
            };
            let ifAlias = $(this).closest(".tfoot").find(".ifAlias").val();
            if(ifAlias == undefined) return;
            ifName = String(ifName).trim();
            let found = undefined;

            $(this).closest(".table").find(".tbody").find(".ifName").each(function() {
              let this_ifName = $(this).text();
              if(this_ifName == ifName) {
                found = $(this);
                return false;
              };
            });

            if(found != undefined) {
              found[0].scrollIntoView();
              found.animateHighlight("red", 500);
              return;
            };

            $(this).closest(".table").find(".tbody")
              .append( get_vdev_port(ifName, ifAlias) )
            ;
            $(this).closest(".tfoot").find(".ifName").val("Eth1/0/");
            $(this).closest(".tfoot").find(".ifName").focus();
          })
        )
      )
    )
  ;

  for(let i in vdev["interfaces_sorted"]) {
    let ifName = vdev["interfaces_sorted"][i];
    ports.find(".interfaces").append( get_vdev_port(ifName, vdev["interfaces"][ifName]["ifAlias"]) );
  };

  table
    .append( $(TR)
      .append( $(TD, {"colspan": 2})
        .append( ports )
      )
    )
  ;

  dlg.trigger("recenter");
};

function get_vdev_port(ifName, ifAlias) {
  let ret = $(DIV).addClass("tr")
    .append( $(SPAN).addClass("td").addClass("ifName").text(ifName) )
    .append( $(SPAN).addClass("td")
      .append( $(INPUT).addClass("ifAlias")
        .val(ifAlias)
      )
    )
    .append( $(SPAN).addClass("td")
      .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-minus"])
        .click(function() {
          let row = $(this).closest(".tr");
          show_confirm("Внимание, удаление порта приведет к удалению виртуальных связей,\n"+
            "если они есть\nОтмена будет невозможна", function() { row.remove(); }
          );
        })
      )
    )
  ;
  return ret;
};

function wipe_l2_link(link_id) {
  try {
    for(let i = 0; i < 2; i++) {
      let dev_id = data["l2_links"][link_id][i]["DevId"];
      let int = data["l2_links"][link_id][i]["ifName"];

      try {
        let old_links = data["devs"][dev_id]["interfaces"][int]["l2_links"];
        let new_links = [];
        for(let l in old_links) {
          if(old_links[l] != link_id) {
            new_links.push(old_links[l]);
          };
        };
        if(new_links.length > 0) {
          data["devs"][dev_id]["interfaces"][int]["l2_links"] = new_links;
        } else {
          delete(data["devs"][dev_id]["interfaces"][int]["l2_links"]);
        };
      } catch(e) {
        //ignore
      };
    };
    delete(data["l2_links"][link_id]);
  } catch(e) {
    // ignore
  };
};

function wipe_l2_link_by_dev_int(dev_id, ifName) {
  for(let link_id in data["l2_links"]) {
    if((data["l2_links"][link_id][0]["DevId"] == dev_id &&
        data["l2_links"][link_id][0]["ifName"] == ifName) ||
       (data["l2_links"][link_id][1]["DevId"] == dev_id &&
        data["l2_links"][link_id][1]["ifName"] == ifName)
    ) {
      wipe_l2_link(link_id);
    };
  };
};

function vLinksWindow(sel_changed = false) {
  if(sel_changed) {
    let elm = $("#vlink_win");
    if(elm.length == 0) {
      return;
    } else if(elm.find("TABLE").length > 0) {
      return;
    };
  };

  let dlg = createWindow("vlink_win", "Виртуальная связь");
  let content = dlg.find(".content");

  if(dev_selected.length != 2) {
    content.text("Выберете 2 (ДВА) устройства")
      .css({"font-size": "large"})
    ;

    return;
  };

  let left_sel = $(SELECT)
    .css({"font-family": "monospace", "font-size": "larger"})
    .data("dev_id", dev_selected[0])
    .append( $(OPTION).text("Выбрать интерфейс...").val("") )
  ;

  let right_sel = $(SELECT)
    .css({"font-family": "monospace", "font-size": "larger"})
    .data("dev_id", dev_selected[1])
    .append( $(OPTION).text("Выбрать интерфейс...").val("") )
  ;

  for(let i in data["devs"][dev_selected[0]]["interfaces_sorted"]) {
    let ifName = data["devs"][dev_selected[0]]["interfaces_sorted"][i];
    let text = data["devs"][dev_selected[0]]["interfaces"][ifName]["ifOperStatus"] == 1?"&nbsp;":"&#x21A7;";
    text += " " + escapeHtml(ifName);
    if(data["devs"][dev_selected[0]]["interfaces"][ifName]["ifAlias"] != undefined &&
       data["devs"][dev_selected[0]]["interfaces"][ifName]["ifAlias"] != ""
    ) {
      text += " ("+escapeHtml(data["devs"][dev_selected[0]]["interfaces"][ifName]["ifAlias"])+")";
    };
    left_sel.append( $(OPTION).html(text).val(ifName) );
  };

  for(let i in data["devs"][dev_selected[1]]["interfaces_sorted"]) {
    let ifName = data["devs"][dev_selected[1]]["interfaces_sorted"][i];
    let text = data["devs"][dev_selected[1]]["interfaces"][ifName]["ifOperStatus"] == 1?"&nbsp;":"&#x21A7;";
    text += " " + escapeHtml(ifName);
    if(data["devs"][dev_selected[1]]["interfaces"][ifName]["ifAlias"] != undefined &&
       data["devs"][dev_selected[1]]["interfaces"][ifName]["ifAlias"] != ""
    ) {
      text += " ("+escapeHtml(data["devs"][dev_selected[1]]["interfaces"][ifName]["ifAlias"])+")";
    };
    right_sel.append( $(OPTION).html(text).val(ifName) );
  };

  content
    .append( $(TABLE)
      .append( $(TR)
        .append( $(TD).text(data["devs"][dev_selected[0]]["short_name"]) )
        .append( $(TD).text(data["devs"][dev_selected[1]]["short_name"]) )
      )
    )
  ;

  for(let link_id in data["l2_links"]) {
    if(data["l2_links"][link_id]["virtual"] != undefined &&
       ((data["l2_links"][link_id][0]["DevId"] == dev_selected[0] &&
         data["l2_links"][link_id][1]["DevId"] == dev_selected[1]) ||
        (data["l2_links"][link_id][1]["DevId"] == dev_selected[0] &&
         data["l2_links"][link_id][0]["DevId"] == dev_selected[1])
       )
    ) {
      let tr = $(TR).data("link_id", link_id);
      if(data["l2_links"][link_id][0]["DevId"] == dev_selected[0]) {
        tr
          .append( $(TD).text(data["l2_links"][link_id][0]["ifName"]) )
          .append( $(TD).text(data["l2_links"][link_id][1]["ifName"]) )
        ;
      } else {
        tr
          .append( $(TD).text(data["l2_links"][link_id][1]["ifName"]) )
          .append( $(TD).text(data["l2_links"][link_id][0]["ifName"]) )
        ;
      };

      tr
        .append( $(TD)
          .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
            .click(function() {
              let link_id = $(this).closest("TR").data("link_id");
              show_confirm("Подтвердите удаление связи.\nВнимание: отмена будет невозможна!", function() {
                run_query({"action": "del_vlink", "vlink_id": link_id}, function(res) {
                  wipe_l2_link(link_id);

                  dlg.dialog("close");
                  data_loaded(data, false);
                });
              });
            })
          )
        )
      ;
      tr.appendTo( content.find("TABLE") );
    };
  };

  content.find("TABLE")
    .append( $(TR)
      .append( $(TD)
        .append( left_sel )
      )
      .append( $(TD)
        .append( right_sel )
      )
    )
    .append( $(TR)
      .append( $(TD, {"colspan": 2})
        .append( $(LABEL).addClass(["button"])
          .css({"color": "gray"})
          .text("Создать")
          .click(function() {
            let dlg = $(this).closest(".dialog_start");
            let pairs = [];
            $(this).closest("TABLE").find("SELECT").each(function() {
              let dev_id = $(this).data("dev_id");
              let ifName = $(this).val();
              if(ifName != "") {
                pairs.push({"DevId": dev_id, "ifName": ifName});
              };
            });
            if(pairs.length == 2) {
              pairs.sort(function(a, b) {
                return String(a["DevId"]).localeCompare(b["DevId"]);
              });

              let link_id = String(pairs[0]["DevId"]) + "@" + String(pairs[0]["ifName"]) +
                  "#" + String(pairs[1]["DevId"]) + "@" + String(pairs[1]["ifName"])
              ;
              let link_status = 1;
              if(data["devs"][ pairs[0]["DevId"] ]["interfaces"][ pairs[0]["ifName"] ]["ifOperStatus"] != 1 ||
                 data["devs"][ pairs[1]["DevId"] ]["interfaces"][ pairs[1]["ifName"] ]["ifOperStatus"] != 1
              ) {
                link_status = 2;
              };
              let link = { "0": pairs[0], "1": pairs[1], "status": link_status, "virtual": 1 };

              if(data["l2_links"][link_id] != undefined) {
                $(this).closest("TABLE").find("SELECT").animateHighlight("red", 500);
                return;
              };
              run_query({"action": "save_vlink", "vlink_id": link_id, "vlink_json": JSON.stringify(link)},
                function(res) {
                  data["l2_links"][link_id] = link;

                  let list0;
                  try {
                    list0 = data["devs"][ pairs[0]["DevId"] ]["interfaces"][ pairs[0]["ifName"] ]["l2_links"];
                  } catch(e) {
                    list0 = undefined;
                  };
                  if(list0 == undefined) list0 = [];

                  list0 = append_once(list0, link_id);
                  try {
                    data["devs"][ pairs[0]["DevId"] ]["interfaces"][ pairs[0]["ifName"] ]["l2_links"] = list0;
                  } catch(e) {
                    //ignore
                  };

                  let list1;
                  try {
                    list1 = data["devs"][ pairs[1]["DevId"] ]["interfaces"][ pairs[1]["ifName"] ]["l2_links"];
                  } catch(e) {
                    list1 = undefined;
                  };
                  if(list1 == undefined) list1 = [];

                  list1 = append_once(list1, link_id);
                  try {
                    data["devs"][ pairs[1]["DevId"] ]["interfaces"][ pairs[1]["ifName"] ]["l2_links"] = list1;
                  } catch(e) {
                    //ignore
                  };


                  dlg.dialog("close");
                  data_loaded(data, false);
                },
              );
            };
          })
        )
      )
    )
  ;

       

  content.find("SELECT").on("change", function() {
    let vals = 0;
    $(this).closest("TR").find("SELECT").each(function() {
      if($(this).val() != "") {
        vals++;
      };
    });
    if(vals == 2) {
      $(this).closest("TABLE").find(".button").css({"color": "black"});
    } else {
      $(this).closest("TABLE").find(".button").css({"color": "gray"});
    };
  });

  dlg.trigger("recenter");
};

function VLANsWindow(with_links = false) {
  let dlg = createWindow("vlans_win", "VLAN");
  let content = dlg.find(".content");

  content
    .append( $(DIV)
      .append( $(LABEL, {"for": "vlans_with_links"}).text("Показывать порты со связями: ") )
      .append( $(INPUT, {"id": "vlans_with_links", "type": "checkbox", "checked": with_links})
        .on("change", function() {
          VLANsWindow($(this).is(":checked"));
        })
      )
    )
  ;

  let vlans = {};

  for(let dev_id in data["devs"]) {
    if(data["devs"][dev_id]["interfaces"] != undefined &&
       data["devs"][dev_id]["vlans"] != undefined
    ) {
      let dev_vlans = {};
      for(let v in data["devs"][dev_id]["vlans"]) {
        dev_vlans[ data["devs"][dev_id]["vlans"][v] ] = 1;
      };
      for(let ifName in data["devs"][dev_id]["interfaces"]) {
        if((with_links || data["devs"][dev_id]["interfaces"][ifName]["l2_links"] == undefined) &&
           data["devs"][dev_id]["interfaces"][ifName]["lag_members"] == undefined &&
           data["devs"][dev_id]["interfaces"][ifName]["lag_parent"] == undefined &&
           data["devs"][dev_id]["interfaces"][ifName]["pagp_members"] == undefined &&
           data["devs"][dev_id]["interfaces"][ifName]["pagp_parent"] == undefined &&
           true
        ) {
          let portMode = data["devs"][dev_id]["interfaces"][ifName]["portMode"];
          let pvid = data["devs"][dev_id]["interfaces"][ifName]["portPvid"];
          let trv = data["devs"][dev_id]["interfaces"][ifName]["portTrunkVlans"];
          let htv = data["devs"][dev_id]["interfaces"][ifName]["portHybridTag"];
          let huv = data["devs"][dev_id]["interfaces"][ifName]["portHybridUntag"];

          if(pvid !== undefined) {
            pvid = String(pvid);
          };

          if(data["devs"][dev_id]["interfaces"][ifName]["routedVlan"] !== undefined) {
            let vlan = String(data["devs"][dev_id]["interfaces"][ifName]["routedVlan"]);
            if(vlan !== pvid && dev_vlans[vlan] != undefined) {
              if(vlans[vlan] == undefined) { vlans[vlan] = {}; };
              if(vlans[vlan][dev_id] == undefined) { vlans[vlan][dev_id] = {}; };
              vlans[vlan][dev_id][ifName] = 1;
            };
          } else {
            let a = ifName.match(/^(?:Vlan|Vl|Po|Vlanif|.*\.)(\d+)$/);
            if(a !== undefined && a !== null) {
              let vlan = a[1];
              if(vlan !== pvid && dev_vlans[vlan] != undefined) {
                if(vlans[vlan] == undefined) { vlans[vlan] = {}; };
                if(vlans[vlan][dev_id] == undefined) { vlans[vlan][dev_id] = {}; };
                vlans[vlan][dev_id][ifName] = 1;
              };
            };
          };

          if(pvid != undefined && dev_vlans[pvid] != undefined) {
            let vlan = pvid;
            if(vlans[vlan] == undefined) { vlans[vlan] = {}; };
            if(vlans[vlan][dev_id] == undefined) { vlans[vlan][dev_id] = {}; };
            vlans[vlan][dev_id][ifName] = 1;
          };

          if(portMode == 2) {
            if(trv !== undefined) {
              let list = unwind_list(trv);
              for(let v in list) {
                let vlan = list[v];
                if(vlan !== pvid && dev_vlans[vlan] != undefined) {
                  if(vlans[vlan] == undefined) { vlans[vlan] = {}; };
                  if(vlans[vlan][dev_id] == undefined) { vlans[vlan][dev_id] = {}; };
                  vlans[vlan][dev_id][ifName] = 1;
                };
              };
            };
          } else if(portMode == 3) {
            if(htv !== undefined) {
              let list = unwind_list(htv);
              for(let v in list) {
                let vlan = list[v];
                if(vlan !== pvid && dev_vlans[vlan] != undefined) {
                  if(vlans[vlan] == undefined) { vlans[vlan] = {}; };
                  if(vlans[vlan][dev_id] == undefined) { vlans[vlan][dev_id] = {}; };
                  vlans[vlan][dev_id][ifName] = 1;
                };
              };
            };
            if(huv !== undefined) {
              let list = unwind_list(huv);
              for(let v in list) {
                let vlan = list[v];
                if(vlan !== pvid && dev_vlans[vlan] != undefined) {
                  if(vlans[vlan] == undefined) { vlans[vlan] = {}; };
                  if(vlans[vlan][dev_id] == undefined) { vlans[vlan][dev_id] = {}; };
                  vlans[vlan][dev_id][ifName] = 1;
                };
              };
            };
          };
        };
      };
    };
  };

  let vlan_list = keys(vlans);
  vlan_list.sort(num_compare);

  let cont = $(TABLE)
  ;

  for(let v in vlan_list) {
    let vlan = vlan_list[v];

    cont
      .append( $(TBODY)
        .append( $(TR)
          .data("vlan", vlan)
          .data("vlan_data", vlans[vlan])
          .data("filled", false)
          .click(function() {
            let vlan = $(this).data("vlan");
            let vdata = $(this).data("vlan_data");
            let filled = $(this).data("filled");

            if($(this).find("LABEL.ui-icon").hasClass("ui-icon-plus")) {
              $(this).find("LABEL.ui-icon").removeClass("ui-icon-plus");
              $(this).find("LABEL.ui-icon").addClass("ui-icon-minus");
            } else {
              $(this).find("LABEL.ui-icon").removeClass("ui-icon-minus");
              $(this).find("LABEL.ui-icon").addClass("ui-icon-plus");
            };

            let vcont = $("#vlan_cont_"+vlan);
            if(!filled) {
              let dev_list = keys(vdata);

              dev_list.sort(function(a, b) {
                return(num_compare(data["devs"][a]["short_name"], data["devs"][b]["short_name"]));
              });

              for(let d in dev_list) {
                let dev_id = dev_list[d];

                let port_list = keys(vdata[dev_id]);
                port_list.sort(num_compare);

                vcont
                  .append( $(TR)
                    .append( $(TD, {"colspan": 3})
                      .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-minus"])
                        .css({"margin-left": "1em", "margin-right": "0.5em"})
                        .data("dev_id", dev_id)
                        .data("vlan", vlan)
                        .click(function() {
                          if($(this).hasClass("ui-icon-plus")) {
                            $(this).removeClass("ui-icon-plus");
                            $(this).addClass("ui-icon-minus");
                          } else {
                            $(this).removeClass("ui-icon-minus");
                            $(this).addClass("ui-icon-plus");
                          };
                          let dev_id = $(this).data("dev_id");
                          let vlan = $(this).data("vlan");

                          $("." + $.escapeSelector("vlan_"+vlan+"_@_"+dev_id)).toggle();

                        })
                      )
                      .append( $(LABEL)
                        .css({"border": "1px solid black", "padding": "0 0.2em"})
                        .text( data["devs"][dev_id]["short_name"] )
                        .searchHighlight_dev(dev_id)
                        .data("dev_id", dev_id)
                        .click(function() {
                          let dev_id = $(this).data("dev_id");
                          device_win(dev_id);
                        })
                      )
                    )
                  )
                ;

                for(let p in port_list) {
                  let ifName = port_list[p];

                  vcont
                    .append( $(TR).addClass("vlan_"+vlan+"_@_"+dev_id)
                      .append( $(TD)
                        .css({"padding-left": "2em"})
                        .append( $(LABEL)
                          .css({"border": "1px solid black", "padding": "0 0.2em"})
                          .searchHighlight_dev(dev_id)
                          .searchHighlight_int(dev_id, ifName)
                          .text(ifName)
                          .data("dev_id", dev_id)
                          .data("ifName", ifName)
                          .click(function() {
                            let dev_id = $(this).data("dev_id");
                            let ifName = $(this).data("ifName");
                            interface_win(dev_id, ifName);
                          })
                        )
                      )
                      .append( $(TD)
                        .append( int_labels(ifName, data["devs"][dev_id]) )
                      )
                      .append( $(TD)
                        .text(data["devs"][dev_id]["interfaces"][ifName]["ifAlias"])
                      )
                    )
                  ;
                };
              };

              $(this).data("filled", true);
            };
            vcont.toggle();
          })
          .append( $(TD, {"colspan": 3})
            .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"]) )
            .append( $(SPAN).text(" VLAN " + vlan + "  ("+keys(vlans[vlan]).length+" устройств)")
            )
          )
        )
      )
      .append( $(TBODY, {"id": "vlan_cont_"+vlan}).hide() )
    ;

  };

  cont.appendTo(content);

  dlg.trigger("recenter");
};

function tag_compare(base, tag_a, tag_b) {
  if(tag_a === tag_b) return 0;

  if(tag_a === "all") return -1;
  if(tag_b === "all") return 1;
  if(tag_a === "nodata") return -1;
  if(tag_b === "nodata") return 1;
  if(tag_a === "l3") return -1;
  if(tag_b === "l3") return 1;

  let path_a = get_tag_path(base, tag_a, 0);
  let path_b = get_tag_path(base, tag_b, 0);

  if(path_a === null) return -1;
  if(path_b === null) return 1;

  let a_labels = [];
  for(let i in path_a) {
    if( path_a[i]["flags"] !== undefined &&
        ((path_a[i]["flags"] & F_IN_LABEL) > 0 || String(path_a[i]["id"]) === String(tag_a))
    ) {
      a_labels.push(path_a[i]["text"]);
    };
  };

  let b_labels = [];
  for(let i in path_b) {
    if( path_b[i]["flags"] !== undefined &&
        ((path_b[i]["flags"] & F_IN_LABEL) > 0 || String(path_b[i]["id"]) === String(tag_b))
    ) {
      b_labels.push(path_b[i]["text"]);
    };
  };

  for(let i = 0; (i < a_labels.length) && (i < b_labels.length); i++) {
    if(a_labels[i] != b_labels[i]) return num_compare(a_labels[i], b_labels[i]);
  };

  return a_labels.length - b_labels.length;
};

function selectLayout(others = false) {
  run_query({"action": "list_maps", "others": others?"1":"0"}, function(res) {
    res["ok"]["list"].sort(function(a, b) {
      if(a["site"] != b["site"]) {
        return tag_compare({"id": "root", "children": data["sites"], "data": {}}, a["site"], b["site"]);
      };
      if(a["proj"] != b["proj"]) {
        return tag_compare({"id": "root", "children": data["projects"], "data": {}}, a["proj"], b["proj"]);
      };

      return num_compare(a["file_name"], b["file_name"]);
    });

    let dlg = createWindow("layouts", "Раскладки");
    let content = dlg.find(".content");
    let table = $(DIV).addClass("table").appendTo(content);

    table
      .append( $(DIV).addClass("thead")
        .append( $(SPAN).addClass("th")
          .append( $(SPAN).text("Локация") )
        )
        .append( $(SPAN).addClass("th")
          .append( $(SPAN).text("Инф.система") )
        )
        .append( $(SPAN).addClass("th")
        )
      )
    ;

    for(let i in res["ok"]["list"]) {
      let row = res["ok"]["list"][i];

      let tr = $(DIV).addClass("tr")
        .addClass("data_row")
        .data("data", row)
        .append( $(SPAN).addClass("td")
          .css({"padding": "0.2em 0.2em"})
          .append( get_tag({"id": "root", "children": data["sites"], "data": {}}, row["site"]) )
        )
        .append( $(SPAN).addClass("td")
          .css({"padding": "0.2em 0.2em"})
          .append( get_tag({"id": "root", "children": data["projects"], "data": {}}, row["proj"]) )
        )
        .append( $(SPAN).addClass("td")
          .css({"padding": "0.2em 0.2em"})
          .text( row["file_name"] )
        )
        .append( $(SPAN).addClass("td")
          .css({"padding": "0.2em 0.2em"})
          .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-linkext"])
            .click(function() {
              let row = $(this).closest(".data_row").data("data");
              window.location = "?action=get_front&site="+row["site"]+"&proj="+row["proj"]+
                "&file_key="+row["file_key"]+(DEBUG?"&debug":"")
              ;
            })
          )
        )
      ;
      tr.appendTo( table );
    };

    dlg.trigger("recenter");
  });
};

function devEvents(dev_id) {
  run_query({"action": "dev_events", "dev_id": dev_id}, function(res) {
    let win_id = "events_" + dev_id;
    let short_name;
    if(data["devs"][dev_id] != undefined) {
      short_name = data["devs"][dev_id]["short_name"];
    } else {
      short_name = "";
    };
    let dlg = createWindow(win_id, "События " + short_name);
    let content = dlg.find(".content");

    let table = $(DIV).addClass("table").appendTo(content);

    for(let i in res["ok"]["events"]) {
      let row = event_row(dev_id, res["ok"]["events"][i]);
      if(row != undefined ) {
        table.append( row );
      };
    };

    dlg.trigger("recenter");
  });
};

function event_row(dev_id, event_json) {
  let ret = $(DIV).addClass("tr");
  let ev;

  try {
    ev = JSON.parse(event_json);
  } catch(e) {
    ret
      .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-error"])
        .data("text", "Ошибка раскодирования JSON\n" + event_json)
        .click(function() {
          show_dialog( $(this).data("text") );
        })
      )
    ;
    return ret;
  };

  if(ev["event"] == "if_key_reset") return undefined;
  
  ret
    .append( $(SPAN).addClass("td")
      .append( !DEBUG ? $(LABEL) : $(LABEL)
        .addClass(["button", "ui-icon", "ui-icon-info"])
        .data("text", jstr(ev))
        .click(function() {
          show_dialog( $(this).data("text") );
        })
      )
      .append( $(SPAN).text( from_unix_time( ev["time"] ) ) )
    )
  ;

  switch(ev["event"]) {
  case "key_change":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-2-e-w"])
          .title("Изменение переменной")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text( ev["key"]) )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN).text(ev["fields"]["old_value"])
          .css({"max-width": "20em", "display": "inline-block"})
        )
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-1-e"]) )
        .append( $(SPAN).text(ev["fields"]["new_value"])
          .css({"max-width": "20em", "display": "inline-block"})
        )
      )
    ;
    break;
  case "if_key_change":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-2-e-w"])
          .title("Изменение переменной интерфейса")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(LABEL).text( ev["key"] )
          .css({"padding": "0 0.2em", "border": "1px solid black"})
          .data("dev_id", dev_id)
          .data("ifName", ev["key"])
          .click(function() {
            interface_win( $(this).data("dev_id"), $(this).data("ifName") );
          })
          .hover(
            function (e) {
              e.stopPropagation();
              let int = $(this).data("ifName");
              let dev_id = $(this).data("dev_id");
              interface_in(int, data["devs"][dev_id])
            },
            interface_out
          )
        )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN).text(ev["fields"]["key"] + ": ") )
        .append( $(SPAN).text(ev["fields"]["old_value"]) )
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-1-e"]) )
        .append( $(SPAN).text(ev["fields"]["new_value"]) )
      )
    ;
    break;
  case "lldp_port_nei_gone":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-minus"])
          .title("LLDP сосед пропал")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text( "LLDP" ) )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN)
          .text( if_undef(ev["fields"]["RemSysName"], "") +
            " " + if_undef(ev["fields"]["RemPortDescr"],
                           if_undef(ev["fields"]["RemPortId"], "")
                  )
          )
          .css({"margin-right": "0.5em"})
        )
        .append( $(LABEL)
          .addClass(["button", "ui-icon", "ui-icon-info"])
          .data("text", jstr(ev["fields"]))
          .click(function() {
            show_dialog( $(this).data("text") );
          })
        )
      )
    ;
    break;
  case "lldp_port_nei_new":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-plus"])
          .title("LLDP сосед появился")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text( "LLDP" ) )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN)
          .text( if_undef(ev["fields"]["RemSysName"], "") +
            " " + if_undef(ev["fields"]["RemPortDescr"],
                           if_undef(ev["fields"]["RemPortId"], "")
                  )
          )
          .css({"margin-right": "0.5em"})
        )
        .append( $(LABEL)
          .addClass(["button", "ui-icon", "ui-icon-info"])
          .data("text", jstr(ev["fields"]))
          .click(function() {
            show_dialog( $(this).data("text") );
          })
        )
      )
    ;
    break;
  case "cdp_port_nei_gone":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-minus"])
          .title("CDP сосед пропал")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text( "CDP" ) )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN)
          .text( ev["fields"]["cdpRemDevId"] + " " + ev["fields"]["cdpRemIfName"] )
          .css({"margin-right": "0.5em"})
        )
        .append( $(LABEL)
          .addClass(["button", "ui-icon", "ui-icon-info"])
          .data("text", jstr(ev["fields"]))
          .click(function() {
            show_dialog( $(this).data("text") );
          })
        )
      )
    ;
    break;
  case "cdp_port_nei_new":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-plus"])
          .title("CDP сосед появился")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text( "CDP" ) )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN)
          .text( ev["fields"]["cdpRemDevId"] + " " + ev["fields"]["cdpRemIfName"] )
          .css({"margin-right": "0.5em"})
        )
        .append( $(LABEL)
          .addClass(["button", "ui-icon", "ui-icon-info"])
          .data("text", jstr(ev["fields"]))
          .click(function() {
            show_dialog( $(this).data("text") );
          })
        )
      )
    ;
    break;
  case "if_key_reset":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrowrefresh-1-s"])
          .title("Сброс счетчика")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(LABEL).text( ev["key"] )
          .css({"padding": "0 0.2em", "border": "1px solid black"})
          .data("dev_id", dev_id)
          .data("ifName", ev["key"])
          .click(function() {
            interface_win( $(this).data("dev_id"), $(this).data("ifName") );
          })
          .hover(
            function (e) {
              e.stopPropagation();
              let int = $(this).data("ifName");
              let dev_id = $(this).data("dev_id");
              interface_in(int, data["devs"][dev_id])
            },
            interface_out
          )
        )
      )
      .append( $(SPAN).addClass("td")
        .append( $(SPAN)
          .text(ev["fields"]["key"] + ": ")
        )
        .append( $(SPAN).text(ev["fields"]["old_value"]) )
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-1-e"]) )
        .append( $(SPAN).text(ev["fields"]["new_value"]) )
      )
    ;
    break;
  case "if_gone":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-minus"])
          .title("Интерфейс пропал")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(LABEL).text( ev["key"] )
          .css({"padding": "0 0.2em", "border": "1px solid black"})
        )
      )
    ;
    break;
  case "if_new":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-plus"])
          .title("Интерфейс появился")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(LABEL).text( ev["key"] )
          .css({"padding": "0 0.2em", "border": "1px solid black"})
        )
      )
    ;
    break;
  case "if_ip_gone":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-2-e-w"])
          .title("Пропал IP адрес")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(LABEL).text( ev["key"] )
          .css({"padding": "0 0.2em", "border": "1px solid black"})
        )
      )
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-minus"])
          .title("Пропал IP адрес")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text("IP: ") )
        .append( $(LABEL).text( ev["fields"]["ip"]+" / "+ev["fields"]["mask"] )
        )
      )
    ;
    break;
  case "if_ip_new":
    ret
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-2-e-w"])
          .title("Добавлен IP адрес")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(LABEL).text( ev["key"] )
          .css({"padding": "0 0.2em", "border": "1px solid black"})
        )
      )
      .append( $(SPAN).addClass("td")
        .append( $(LABEL).addClass(["ui-icon", "ui-icon-circle-b-plus"])
          .title("Добавлен IP адрес")
          .css({"color": "blue", "margin-right": "0.5em"})
        )
        .append( $(SPAN).text("IP: ") )
        .append( $(LABEL).text( ev["fields"]["ip"]+" / "+ev["fields"]["mask"] )
        )
      )
    ;
    break;
  default:
    ret
      .append( $(SPAN).addClass("td")
        .text( ev["event"] )
        .title("Обработчик события еще не добавлен")
      )
    ;
  };


  return ret;
};
