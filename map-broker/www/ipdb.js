'use strict';

var body;
var workarea;
var fixed_div;
var user_self_sub="none";
var user_self_id;

var g_range_bar_width = 10;
var g_range_bar_margin = 5;

var global_mouse_down=false;

var g_show_tooltips = true;

var g_sorting = false;
var g_autosave = true;
var g_autosave_changes = 0;
var g_autosave_timeout = 500; //ms

var g_default_range_style = {"background-color": "black"};
var g_default_ext_range_style = {"color": "black"};
var g_default_range_icon = "ui-icon-arrow-2-n-s";
var g_default_range_icon_style = {"color": "black"};

var g_vlan_css = {"border": "1px solid black", "padding-left": "0.2em",
                  "padding-right": "0.2em", "background-color": "#FAFAFF"
                 };

var g_show_net_info = false;
var g_show_vdom_info = false;

var g_edit_all = false;

var initial_g_name = "usr_netapp_ipdb_";

var net_cols_ids;

//var g_node_name_reg = new RegExp('^([^()]+)(?:\(([^()]+)\))?$');
//                                ^\s*([^()]+)\s*(?:\(([^()]+)\)\s*)?$
//var g_node_name_reg = new RegExp('^\\s*([^()]+)\\s*(?:\\(\\s*([^()]+)\\s*\\)\\s*)?$');
var g_node_name_reg = /^\s*([^()]+)\s*(?:\(\s*([a-zA-Z0-9_\-]+)\s*\)\s*)?$/;
var g_data; //resets by main pages

var usedonly = false;
/* fetched from consts.js node in http_server.go
const R_NAME = 1;
const R_VIEW_NET_INFO = 2;
const R_VIEW_NET_IPS = 4;
const R_EDIT_IP_VLAN = 8;
const R_IGNORE_R_DENY = 16;
const R_MANAGE_NET = 32;
const R_DENYIP = 64;
const ADMIN_GROUP = "usr_netapp_ipdb_appadmins";

const F_ALLOW_LEAFS = 1;
*/

let r_keys = keys(g_rights);
r_keys.sort(function(a, b) { return Number(a) - Number(b); });

function gen_code() {
  let code_chars="qwertyuiopasdfghjkzxcvbnmQWERTYUPASDFGHJKLZXCVBNM23456789";
  let code = "";

  for(let i=0; i < 32; i++) {
    let idx = Math.floor(Math.random() * code_chars.length);
    code += code_chars.charAt(idx);
  };

  return code;
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

function autosave_normalize(elm) {
  let elm_data = elm.data("autosave_data");
  if(elm_data === undefined) { error_at(); return false; };
  if(elm_data['object'] === undefined) { error_at(); return false; };

  let value;

  switch(elm_data['object']) {
  case 'global_rights':
    return elm.val();
  case 'group':
    switch(elm_data['prop']) {
    case 'g_name':
      return String(elm.val()).trim().toLowerCase();
      break;
    case 'g_descr':
      return String(elm.val()).trim();
      break;
    default:
      return elm.val();
    };
    break;
  case 'ip_value':
    return elm.val();
    break;
  case 'ip':
    return elm.val();
    break;
  case 'net':
    switch(elm_data['prop']) {
    case 'v4net_name':
      return String(elm.val()).trim();
      break;
    default:
      return elm.val();
    };
    break;
  case 'vdom':
    switch(elm_data['prop']) {
    case 'vd_name':
      return String(elm.val()).trim();
      break;
    default:
      return elm.val();
    };
    break;
  case 'vlan_value':
    switch(elm_data['prop']) {
    case 'vlan_name':
      return String(elm.val()).trim();
      break;
    case 'vlan_descr':
      return String(elm.val()).trim();
      break;
    default:
      error_at("Unknown object: "+elm_data['object']+" prop: "+elm_data['prop']);
    };
    return elm.val();
    break;
  case 'ics':
    switch(elm_data['prop']) {
    case 'sort':
      return String(elm.val()).trim();
      break;
    };
    break;
  case 'ic':
    switch(elm_data['prop']) {
    case 'ic_api_name':
      return String(elm.val()).toLowerCase().trim();
    };
    return String(elm.val()).trim();
    break;
  case 'tp':
    return String(elm.val()).trim();
    break;
  case 'oob':
    return String(elm.val()).trim();
    break;
  };
  error_at("Unknown object: "+elm_data['object']+" prop: "+elm_data['prop']);
};

function saveable_check(elm) {
  let value = autosave_normalize(elm);
  if(value === undefined) { error_at(); return false; };
  let elm_data = elm.data("autosave_data");
  if(elm_data === undefined) { error_at(); return false; };
  if(elm_data['object'] === undefined) { error_at(); return false; };
  let row;
  let row_data;
  let found;

  switch(elm_data['object']) {
  case 'global_rights':
    return true;
  case 'group':
    let id = elm_data['id'];
    if(id === undefined) { error_at(); return false; };
    switch(elm_data['prop']) {
    case 'g_name':
      if(!value.match(/^\S.*\S$/)) {
        return false;
      } else if(value == ADMIN_GROUP) {
        return false;
      } else {
        found = false;
        elm.closest(".table").find(".tr").each(function() {
          let row_id = $(this).data("id");
          if(row_id === undefined) { error_at(); return false; };
          let row_val = autosave_normalize($(this).find(".g_name"));
          if(row_val === undefined) { error_at(); return false; };
          if(row_id != id && row_val === value) {
            found = true;
            return false;
          };
        });
        if(found) {
          return false;
        } else {
          return true;
        };
      };
      break;
    default:
      return true;
    };
    break;
  case 'ip_value':
    try {
      let col_id = elm_data['col_id'];
      if(g_data['net_cols'][col_id]['ic_regexp'] != "") {
        let re = new RegExp(g_data['net_cols'][col_id]['ic_regexp']);
        return re.test(value);
      };
      return true;
    } catch(e) {
      return false;
    };
  case 'ip':
    return true;
  case 'net':
    return true;
  case 'vdom':
    return true;
  case 'vlan_value':
    switch(elm_data['prop']) {
    case 'vlan_name':
      found = false;
      let vlan_number = elm.closest("TR").data("row_data")['vlan_number'];
      elm.closest("TABLE").find("TR.row").each(function() {
        let row_data = $(this).data("row_data");
        if(row_data['is_taken'] && String(row_data['vlan_name']).trim() === value &&
           row_data['vlan_number'] != vlan_number
        ) {
          found = true;
          return false;
        };

      });
      if(found) {
        return false;
      };
      break;
    };
    return true;
  case 'ics':
    return true;
  case 'ic':
    switch(elm_data['prop']) {
    case 'ic_icon':
      if(!String(value).match(/^(?:|ui-icon-[a-z\-0-9]+)$/)) return false;
    case 'ic_name':
      let cmp_val;
      row = elm.closest(".tr");
      row_data = row.data("row_data");
      if(elm_data['prop'] == 'ic_name') {
        cmp_val = String(value) + String(g_data['ics'][ row_data['ic_id'] ]['ic_icon']).toLowerCase().trim();
      } else {
        cmp_val = String(g_data['ics'][ row_data['ic_id'] ]['ic_name']).trim() + String(value);
      };
      found = false;
      row.closest(".tbody").find(".tr").each(function() {
        let r_data = $(this).data("row_data");
        if(r_data['ic_id'] == row_data['ic_id']) return;

        let r_val = String(g_data['ics'][ r_data['ic_id'] ]['ic_name']).trim() +
                    String(g_data['ics'][ r_data['ic_id'] ]['ic_icon']).toLowerCase().trim();

        if(r_val === cmp_val) {
          found = true;
          return false;
        };
      });
      if(found) return false;
      break;
    case 'ic_api_name':
      if(!String(value).match(/^[a-z0-9_]+$/)) return false;
      row = elm.closest(".tr");
      row_data = row.data("row_data");
      found = false;
      row.closest(".tbody").find(".tr").each(function() {
        let r_data = $(this).data("row_data");
        if(r_data['ic_id'] == row_data['ic_id']) return;

        if(value === String(g_data['ics'][ r_data['ic_id'] ]['ic_api_name']).toLowerCase().trim()) {
          found = true;
          return false;
        };
      });
      if(found) return false;
      break;
    case 'ic_default':
      if(!String(value).match(/^[01]$/)) return false;
      break;
    case 'ic_regexp':
      try {
        new RegExp(value);
        return true;
      } catch(e) {
        return false;
      };
      break;
    case 'ic_icon_style':
    case 'ic_view_style':
    case 'ic_style':
      if(value === "") return true;
      try {
        JSON.parse(value);
        return true;
      } catch(e) {
        return false;
      };
      break;
    case 'ic_options':
      if(String(value).length > 0 && String(value)[0] === "{") {
        try {
          JSON.parse(value);
          return true;
        } catch(e) {
          return false;
        };
      };
      break;
    };
    return true;
  case 'tp':
    switch(elm_data['prop']) {
    case 'tp_name':
      row = elm.closest(".tr");
      row_data = row.data("row_data");
      found = false;
      row.closest(".tbody").find(".tr").each(function() {
        let r_data = $(this).data("row_data");
        if(r_data['tp_id'] == row_data['tp_id']) return;

        if(String(g_data['tps'][ r_data['tp_id'] ]['tp_name']).trim() === value) {
          found = true;
          return false;
        };
      });
      if(found) return false;
      break;
    };
    return true;
  case 'oob':
    return true;
  };
  error_at("Unknown object: "+elm_data['object']+" prop: "+elm_data['prop']);
  return false;
};

$.fn.saveable=function(data) {
  let timeout = (g_autosave_timeout===undefined?500:g_autosave_timeout);
  $(this)
   .addClass("autosave")
   .data("autosave_data", data)
  ;
  let norm_value = autosave_normalize($(this));

  $(this)
   .data("autosave_changed", false)
   .data("autosave_prev", norm_value)
   .data("autosave_saved", norm_value)
   .inputStop(timeout)
   .on("input_stop", function() {

     let autosave_data = $(this).data("autosave_data");

     let normalized_val = autosave_normalize($(this));

     if(!saveable_check($(this))) {
       $(this).css({"background-color": "lightcoral"});
       return;
     } else {
       $(this).css({"background-color": "white"});
     };

     let saved_val = $(this).data("autosave_saved");
     let already_changed = $(this).data("autosave_changed");

     if(already_changed) {
       if(saved_val === normalized_val) {
         g_autosave_changes--;
         $(this).data("autosave_changed", false);
         $(this).closest(".unsaved_elm").removeClass("unsaved");
         if(autosave_data !== undefined && autosave_data["_changed_show"] !== undefined) {
           $(autosave_data["_changed_show"]).hide();
         };
         if(autosave_data !== undefined && autosave_data["_unchanged_show"] !== undefined) {
           $(autosave_data["_unchanged_show"]).show();
         };
       };
     } else {
       if(saved_val !== normalized_val) {
         g_autosave_changes++;
         $(this).data("autosave_changed", true);
         $(this).closest(".unsaved_elm").addClass("unsaved");
         if(autosave_data !== undefined && autosave_data["_changed_show"] !== undefined) {
           $(autosave_data["_changed_show"]).show();
         };
         if(autosave_data !== undefined && autosave_data["_unchanged_show"] !== undefined) {
           $(autosave_data["_unchanged_show"]).hide();
         };
       };
     };

     if(g_autosave_changes < 0) {
       error_at();
       return;
     } else if(g_autosave_changes == 0) {
       $("#autosave_btn").css({"color": "gray"});
     } else {
       $("#autosave_btn").css({"color": "yellow"});
       if(g_autosave) {
         save_all();
       };
     };
   })
  ;
  return $(this);
};

function ellipsed(text, chars) {
  let ret = String(text);
  if(ret.length > (chars-3)) {
    ret = ret.substring(0, chars-3);
    ret += "...";
  };
  return ret;
};

var userinfo = {};

$( document ).ready(function() {
 
  usedonly = getUrlParameter("usedonly", false);

  //BEGIN begin
  window.onerror=function(errorMsg, url, lineNumber) {
    alert("Error occured: " + errorMsg + ", at line: " + lineNumber);//or any message
    return false;
  };

  $(document)
   .on("mousedown mouseup mousemove", function(e) {
     global_mouse_down = e.originalEvent.buttons === undefined ? e.which === 1 : e.buttons === 1;
   })
  ;

  $(window).on('beforeunload', function() {
    if(g_autosave_changes > 0) {
      return "На странице есть несохраненные поля. Подтвердите уход.";
    } else {
      return undefined;
    };
  });

  $(document).click(function() { $("UL.popupmenu").remove(); });
  $(document).keyup(function(e) {
    if (e.key === "Escape") { // escape key maps to keycode `27`
      $("UL.popupmenu").remove();
      $(".tooltip").remove();
    };
  });

  $("BODY").append (
    $(DIV).css({"position": "fixed", "right": "0.5em", "top": "0.5em", "min-width": "2em",
                "border": "1px solid black", "background-color": "lightgrey"
    }).prop("id", "indicator").text("Запуск интерфейса...")
  );

  if(version.match(/devel/)) {
    $("BODY")
     .append ( $(DIV).css({"position": "fixed", "right": "1em", "bottom": "1em", "color": "red" }).text("DEVELOPMENT"))
     .append ( $(DIV).css({"position": "fixed", "left": "1em", "bottom": "1em", "color": "red" }).text("DEVELOPMENT"))
    ;
  };

  $(document).ajaxComplete(function() {
    $("#indicator").text("Запрос завершен").css("background-color", "lightgreen");
  });

  $(document).ajaxStart(function() {
    $("#indicator").text("Запрос ...").css("background-color", "yellow");
  });

  //$( document ).tooltip({ items: ".tooltip[title]", show: null });
  body=$( "body" );
  body.css({"height": "100%", "margin": "0"});
  $("HTML").css({"height": "100%", "margin": "0"});

  if(DEBUG) {
    body
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
         .click(function() {
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
         .click(function() {
           $("#debug_win,#debug_clear_btn").toggle();
         })
       )
     )
    ;
  };


  run_query({"action": "userinfo"}, function(res) {

    userinfo = res["ok"];

    user_self_sub = userinfo["sub"];
    user_self_id = userinfo["id"];

    g_autosave = get_local("autosave", g_autosave);
    g_autosave_timeout = get_local("autosave_timeout", g_autosave_timeout);

    let menu = $(DIV).addClass("menu");
    body.append( menu );

    workarea = $(DIV).prop("id", "workarea").addClass("workarea");
    fixed_div = $(DIV).prop("id", "fixed_div").addClass("fixed_div");

    body.append( workarea );

    menu
     .append( userinfo_btn() )
     .append( $(SPAN)
       .css({"border": "1px solid #444444", "padding": "0.3em"})
       .addClass("ns")
       .append( $(LABEL).text("Автосохранение: ")
         .prop({"for": "autosave"})
       )
       .append( $(INPUT)
         .prop({"id": "autosave", "type": "checkbox", "checked": g_autosave})
         .on("change", function() {
           g_autosave = $(this).is(":checked");
           save_local("autosave", g_autosave);
           if(g_autosave) {
             save_all();
           };
         })
       )
       .append( $(LABEL).addClass("min1em") )
       .append( $(LABEL)
         .prop({"id": "autosave_btn"})
         .addClass(["button", "ui-icon", "ui-icon-save"])
         .css({"color": "gray"})
         .title("Сохранить")
         .click(save_all)
       )
     )
     .append( $(SPAN).addClass("bigbutton").text("IPDB")
       .click( function() {
         //actionFront();
         window.location = "?action=front"+(DEBUG?"&debug":"");
       })
     )
    ;

    if(userinfo["is_admin"]) {
      menu
       .append( $(SPAN).addClass("bigbutton").text("Группы доступа")
         .click( function() {
           window.location = "?action=groups"+(DEBUG?"&debug":"");
         })
       )
      ;
    };

    if(userinfo["has_vlans_access"]) {
      menu
       .append( $(SPAN).addClass("bigbutton").text("VLAN")
         .click( function() {
           window.location = "?action=vlan_domains"+(DEBUG?"&debug":"");
         })
       )
      ;
    };

    if(userinfo["is_admin"]) {
      menu
       .append( $(SPAN).addClass("bigbutton").text("Поля")
         .click( function() {
           window.location = "?action=fields"+(DEBUG?"&debug":"");
         })
       )
       .append( $(SPAN).addClass("bigbutton").text("Шаблоны")
         .click( function() {
           window.location = "?action=templates"+(DEBUG?"&debug":"");
         })
       )
      ;
    };

    if(userinfo["has_tags_access"]) {
      menu
       .append( $(SPAN).addClass("bigbutton").text("Теги")
         .click( function() {
           select_tag(null, null, undefined);
         })
       )
      ;
    };

    if(userinfo["has_oobs_access"]) {
      menu
       .append( $(SPAN).addClass("bigbutton").text("Внешние сети")
         .click( function() {
           window.location = "?action=oobs"+(DEBUG?"&debug":"");
         })
       )
      ;
    };

    if(userinfo["is_admin"]) {
      menu
       .append( $(SPAN).addClass("bigbutton").text("Общие Права")
         .click( function() {
           window.location = "?action=global_rights"+(DEBUG?"&debug":"");
         })
       )
      ;
    };

    menu.append( fixed_div )

    let action=getUrlParameter("action");
    switch(action) {
    case "front":
      actionFront();
      break;
    case "groups":
      actionGroups();
      break;
    case "nav_v4":
      actionNav4();
      break;
    case "view_v4":
      actionView4();
      break;
    case "vlan_domains":
      actionVlanDomains();
      break;
    case "view_vlan_domain":
      actionViewVlanDomain();
      break;
    case "fields":
      actionViewFields();
      break;
    case "templates":
      actionViewTemplates();
      break;
    case "oobs":
      actionViewOobs();
      break;
    case "global_rights":
      actionGlobalRights();
      break;
    case "link":
      actionLink();
      break;
    default:
      window.location = "?action=front"+(DEBUG?"&debug":"");
      //history.pushState(undefined, undefined, "?action=front"+(DEBUG?"&debug":""));
      //actionFront();
    };

  });
});

function userinfo_btn() {
  let ret=$(DIV)
   .addClass("userinfo")
   .css({"display": "inline-block", "padding": "0.5em"})
   .append( $(LABEL)
     .addClass(["button", "ui-icon", "ui-icon-user"])
     .css({"margin-right": "0.5em"})
     .click(function() { $(this).closest(".userinfo").find(".hideable").toggle(); })
   )
   .append( $(DIV)
     .css({"display": "inline-block", "position": "absolute", "top": "0em",
            "left": "2em", "background-color": "white", "z-index": 1000000,
            "border": "1px solid black", "padding": "0.5em"}
     )
     .addClass("hideable")
     .hide()
     .append( $(SPAN).text(userinfo["name"]).css({"margin-right": "0.5em"}) )
     .append( $(SPAN).text(userinfo["login"]).css({"margin-right": "0.5em"}) )
     .append( $(LABEL).addClass(["ui-icon", "ui-icon-info", "button"]).title(jstr(userinfo))
       .click(function() { show_dialog(jstr(userinfo)); })
     )
     .append( $(LABEL).css({"margin-left": "0.2em"}) )
     .append( $(LABEL).title("Выход")
       .addClass(["button", "ui-icon", "ui-icon-logout"])
       .click(function() { window.location = "/logout"; })
     )
   )
  ;
  return ret;
};

function save_all() {
  debugLog("AUTOSAVING");
  $("#autosave_btn").css({"color": "green"});

  let queue = [];
  let queue_elements = [];

  let has_error = false;

  $(".autosave").each(function() {
    let value = autosave_normalize($(this));
    if(!saveable_check($(this))) {
      has_error = true;
      return false;
    };

    if(value !== $(this).data("autosave_saved")) {
      queue.push({"value": value, "data": $(this).data("autosave_data")});
      queue_elements.push({"elm": $(this), "val": value, "data": $(this).data("autosave_data")});
    };
  });

  if(has_error) {
    $("#autosave_btn").css({"color": "red"});
    return;
  };

  debugLog(jstr(queue));

  if(queue.length == 0) {
    $("#autosave_btn").css({"color": "green"});
    return;
  };

  run_query({"action": "save_all", "queue": queue}, function(res) {

    if(res['ok']['done'] === undefined) {
      error_at();
      return;
    };

    let highlight = $([]);

    for(let i in queue_elements) {
      let qelm = queue_elements[i]['elm'];
      let qval = queue_elements[i]['val'];
      let qdata = queue_elements[i]['data'];
      let tr;

      let ed = qelm.closest(".editable");
      if(ed.length == 1) {
        let ed_data = ed.data("editable_data");
        if(ed_data['value'] !== undefined) {
          ed_data['value'] = qval;
          ed.data("editable_data", ed_data);
        };
      };

      qelm.data("autosave_saved", qval);
      qelm.data("autosave_changed", false);
      switch(qdata['object']) {
      case "tp":
        g_data['tps'][ qdata['id'] ][ qdata['prop'] ] = qval;
        break;
      case "ic":
        g_data['ics'][ qdata['id'] ][ qdata['prop'] ] = qval;
        g_data['ics'][ qdata['id'] ][ 'ts' ] = unix_timestamp();;
        g_data['ics'][ qdata['id'] ][ 'fk_u_id' ] = user_self_id;
        break;
      case "ip_value":
        tr = qelm.closest(".row");
        let ipdata = tr.data("ipdata");
        ipdata['values'][qdata['col_id']]['v'] = qval;
        ipdata['values'][qdata['col_id']]['ts'] = unix_timestamp();
        ipdata['values'][qdata['col_id']]['u_id'] = user_self_id;
        tr.data("ipdata", ipdata);
        let edit_state = qelm.closest(".ip_value").hasClass("ip_edit");
        let focus = qelm.is(":focus");
        let new_elm = ip_val_elm(ipdata, qdata['col_id'], edit_state);
        let qelm_tag = qelm.prop('nodeName');
        qelm.closest(".ip_value").replaceWith( new_elm );
        if(focus) new_elm.find(qelm_tag).focus();
        highlight = highlight.add(new_elm);
        break;
      case "vlan_value":
        tr = qelm.closest(".row");
        let row_data = tr.data("row_data");
        row_data[qdata['prop']] = qval;
        row_data['ts'] = unix_timestamp();
        row_data['u_id'] = user_self_id;
        tr.data("row_data", row_data);
        highlight = highlight.add(qelm);
        break;
      default:
        highlight = highlight.add(qelm);
      };

      if(qdata['_after_save'] !== undefined) {
        qdata['_after_save'](qelm, qval, res['ok']);
      };

      if(qdata['_changed_show'] !== undefined) {
        $(qdata['_changed_show']).hide();
      };
      if(qdata['_unchanged_show'] !== undefined) {
        $(qdata['_unchanged_show']).show();
      };
    };
    highlight.animateHighlight("lightgreen", 200);
    g_autosave_changes = 0;
    $("#autosave_btn").css({"color": "green"});
    $(".unsaved").removeClass("unsaved");
  });
};

function get_vlan_elm(vlan_data, allow_edit=false) {
  let ret = $(LABEL).addClass("vlan").addClass("vlan_elm")
   .data("vlan_data", vlan_data)
   .data("id", vlan_data["vlan_id"])
   .text("VLAN: "+vlan_data["vlan_number"])
   .tooltip({
     classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
     items: "LABEL",
     content: function() {
       let vlan_data = $(this).data('vlan_data');
      
       let ret = $(DIV)
        .append( $(DIV)
          .append( $(SPAN).text("VLAN: "+vlan_data['vlan_number']) )
        )
        .append( $(DIV)
          .append( $(SPAN).text("Домен: "+vlan_data['vd_name']) )
        )
        .append( $(DIV)
          .append( $(SPAN).text("Имя: "+vlan_data['vlan_name']) )
        )
       ;
       return ret;
     }
   })
   .click(!allow_edit?function(){}:function(e) {
     e.stopPropagation();
     let old_elm = $(this);
     let set = $(this).closest(".set");
     select_vlan(old_elm.data("vlan_data"), function(new_data) {
       if(new_data["vlan_id"] != "") {
         old_elm.replaceWith(get_vlan_elm(new_data, true));
       } else {
         old_elm.remove();
       };
       set.trigger("recalc");
     });
   })
  ;
  return ret;
};

function actionLink() {
  workarea.empty();
  fixed_div.empty();
  let ip_str = getUrlParameter("ip", undefined);
  let mask_str = getUrlParameter("mask", undefined);
  if(mask_str === false) mask_str = undefined;
  if(String(ip_str).match(/^\d+\.\d+\.\d+\.\d+$/)) {
    let ip = v4ip2long(ip_str);
    if(ip === false) {
      workarea.append( $(SPAN).addClass("link_error").text("Invalid IP address") );
      return;
    };
    if(mask_str !== undefined) {
      if(Number(mask_str) > 32) {
        workarea.append( $(SPAN).addClass("link_error").text("Invalid mask") );
        return;
      };
    };

    run_query({"action": "find_net", "v": "4", "addr": String(ip), "masklen": mask_str}, function(res) {
      if(res['ok']['notfound'] !== undefined) {
        workarea.append( $(SPAN).addClass("link_error").text("Сеть не найдена") );
        return;
      };
      if(res['ok']['nav'] !== undefined) {
        window.location = "?action=nav_v4&net="+res['ok']['net']+"&masklen="+res['ok']['masklen']+
                          (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
      } else {
        window.location = "?action=view_v4&net="+res['ok']['net']+"&masklen="+res['ok']['masklen']+"&focuson="+res['ok']['focuson']+
                          (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
      };
    });
  } else {
    workarea.append( $(SPAN).addClass("link_error").text("Bad IP "+ip_str) );
        return;
  };
};

function actionFront() {
  //history.pushState(undefined, undefined, "?action=front"+(DEBUG?"&debug":""));
  workarea.empty();
  fixed_div.empty();
  run_query({"action": "get_front"}, function(res) {

    if(g_data === undefined) g_data = {};

    if(res['ok']['tags'] !== undefined && g_data['tags'] === undefined) {
      g_data['tags'] = res['ok']['tags'];
    };

    let nav_div = $(DIV).css({"display": "inline-block", "vertical-align": "top"})
     .append( $(SPAN).text("Навигация: ") )
     .append( $(A).prop({"href": "?action=nav_v4&net=0&masklen=0"+(DEBUG?"&debug":"")}).text("0.0.0.0/0") )
     .append( $(SPAN).text(" (") )
     .append( $(A)
       .prop({"href": "?action=nav_v4&net=0&masklen=0&usedonly"+(DEBUG?"&debug":"")})
       .text("исп.").title("Только используемые")
     )
     .append( $(SPAN).text(")") )
     .append( $(BR) )
     .append( $(SPAN).text("Перейти: ") )
     .append( $(INPUT)
       .prop({"type": "search", "placeholder": "x.x.x.x/x", "id": "ipv4_goto"})
       .enterKey(function() {
         $("#ipv4_goto_btn").trigger("click")
       })
     )
     .append( $(LABEL).text(">").title("Перейти к отображению сети").addClass("button")
       .prop({"id": "ipv4_goto_btn"})
       .click(function() {
         let val = String($("#ipv4_goto").val()).trim();
         let m = val.match(/^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+))?/);
         if(m === null) {
           $("ipv4_goto").animateHighlight("red", 300);
           return;
         };
         let ip = v4ip2long(m[1]);
         if(ip === false) {
           $("ipv4_goto").animateHighlight("red", 300);
           return;
         };
         if(m[2] !== undefined) {
           if(Number(m[2]) > 32) {
             $("ipv4_goto").animateHighlight("red", 300);
             return;
           };
         };

         run_query({"action": "find_net", "v": "4", "addr": String(ip), "masklen": m[2]}, function(res) {
           if(res['ok']['notfound'] !== undefined) {
             $("ipv4_goto").animateHighlight("orange", 300);
             return;
           };
           if(res['ok']['nav'] !== undefined) {
             window.location = "?action=nav_v4&net="+res['ok']['net']+"&masklen="+res['ok']['masklen']+
                               (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
           } else {
             window.location = "?action=view_v4&net="+res['ok']['net']+"&masklen="+res['ok']['masklen']+"&focuson="+res['ok']['focuson']+
                               (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
           };
         });
       })
     )
     .append( $(BR) )
     .append( $(BR) )
     .append( $(SPAN).text("Поиск: ") )
     .append( $(INPUT)
       .prop({"type": "search", "id": "search_string"})
       .enterKey(function() {
         $("#search_btn").trigger("click")
       })
     )
     .append( $(LABEL).text(">").title("Перейти к отображению сети").addClass("button")
       .prop({"id": "search_btn"})
       .click(function() {
         let search_string = String($("#search_string").val()).trim();
         let tags = String($("#search_tags").val()).trim();
         let vlans = String($("#search_vlans").val()).trim();
         if(search_string === "" && tags === "" && vlans ===  "") {
           $("#search_string").animateHighlight("red", 300);
           return;
         };
         run_query({"action": "search", "search_string": search_string, "search_tags": tags, "search_vlans": vlans}, function(res) {
           show_search_results(res['ok']);
         });
       })
     )
     .append( $(BR) )
     .append( $(LABEL).text("Ограничить тегами: ") )
     .append( $(SPAN).addClass("tagset")
       .append( $(INPUT).prop({"id": "search_tags", "type": "hidden"}) )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
         .click(function() {
           let before = $(this);
           select_tag(null, null, function(tag_id) {
             if(tag_id !== null) {
               get_tag_elm(tag_id, true).insertBefore(before);
               before.closest(".tagset").trigger("recalc");
             };
           }, true);
         })
       )
       .on("recalc", function() {
         let list = [];
         $(this).find(".tag").each(function() {
           list.push( $(this).data("tag_id") );
         });
         $(this).find("INPUT[type=hidden]").val(list.join(","));
       })
     )
     .append( $(BR) )
     .append( $(LABEL).text("Ограничить VLAN-ами: ") )
     .append( $(SPAN).addClass("set")
       .append( $(INPUT).prop({"id": "search_vlans", "type": "hidden"}) )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
         .click(function() {
           let before = $(this);

           select_vlan(undefined, function(vlan_data) {
             if(vlan_data["vlan_id"] != "") {
               get_vlan_elm(vlan_data, true).insertBefore(before);
               before.closest(".set").trigger("recalc");
             };
           });
         })
       )
       .on("recalc", function() {
         let list = [];
         $(this).find(".vlan").each(function() {
           list.push($(this).data("id"));
         });
         $(this).find("INPUT[type=hidden]").val(list.join(","));
       })
     )
     .appendTo( fixed_div )
    ;

    if(res['ok']['v4favs'] !== undefined && Array.isArray(res['ok']['v4favs']) && res['ok']['v4favs'].length > 0) {
      let v4favs = $(DIV)
       .css({"display": "inline-block", "vertical-align": "top"})
       .append( $(DIV)
         .append( $(SPAN).text("Избранное") )
       )
      ;

      res['ok']['v4favs'].sort(function(a,b) { return a['v4net_addr']-b['v4net_addr']; });

      for(let i=0; i < res['ok']['v4favs'].length; i++) {
        let mask_bits = v4len2mask[ res['ok']['v4favs'][i]['v4net_mask'] ];
        let wildcard_bits = (~mask_bits) >>> 0;
        v4favs
         .append( $(DIV)
           .addClass("wsp")
           .addClass("fav_row")
           .append( $(A).prop({"href": "?action=nav_v4&net="+res['ok']['v4favs'][i]['v4net_addr']+"&masklen="+
                                        res['ok']['v4favs'][i]['v4net_mask']+(DEBUG?"&debug":"")})
             .text( v4long2ip(res['ok']['v4favs'][i]['v4net_addr'])+"/"+res['ok']['v4favs'][i]['v4net_mask'] )
             .title( "Mask: "+v4long2ip(mask_bits)+"\n"+"Wildcard: "+v4long2ip(wildcard_bits) )
           )
           .append( $(SPAN).text(" (") )
           .append( $(A).prop({"href": "?action=nav_v4&usedonly&net="+res['ok']['v4favs'][i]['v4net_addr']+"&masklen="+
                                        res['ok']['v4favs'][i]['v4net_mask']+(DEBUG?"&debug":"")})
             .text( "исп." )
             .title("Только используемые")
           )
           .append( $(SPAN).text(")") )
           .append( $(SPAN).addClass("min05em") )
           .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
             .css({"font-size": "smaller"})
             .title("Убрать из избранного")
             .data("net", res['ok']['v4favs'][i]['v4net_addr'])
             .data("masklen", res['ok']['v4favs'][i]['v4net_mask'])
             .click(function() {
               let net = $(this).data("net");
               let masklen = $(this).data("masklen");
               let row = $(this).closest(".fav_row");
               show_confirm("Подтвердите удаление сети из избранного", function() {
                 run_query({"action": "fav_v4", "net": String(net), "masklen": String(masklen), "fav": 0}, function(res) {
                   row.remove();
                 });
               });
             })
           )
         )
        ;
      };

      v4favs.appendTo( fixed_div );
    };
    if(res['ok']['v4accessible'] !== undefined && Array.isArray(res['ok']['v4accessible']) &&
       res['ok']['v4accessible'].length > 0
    ) {
      let v4accessible = $(DIV)
       .css({"display": "inline-block", "vertical-align": "top"})
       .append( $(DIV)
         .append( $(SPAN).text("С доступом") )
       )
      ;

      res['ok']['v4accessible'].sort(function(a,b) { return a['v4net_addr']-b['v4net_addr']; });

      for(let i=0; i < res['ok']['v4accessible'].length; i++) {
        let mask_bits = v4len2mask[ res['ok']['v4accessible'][i]['v4net_mask'] ];
        let wildcard_bits = (~mask_bits) >>> 0;
        v4accessible
         .append( $(DIV)
           .addClass("wsp")
           .append( $(A)
             .prop({"href": "?action=nav_v4&net="+res['ok']['v4accessible'][i]['v4net_addr']+"&masklen="+
                            res['ok']['v4accessible'][i]['v4net_mask']+(DEBUG?"&debug":"")}
             )
             .text( v4long2ip(res['ok']['v4accessible'][i]['v4net_addr'])+"/"+
                    res['ok']['v4accessible'][i]['v4net_mask']
             )
             .title( "Mask: "+v4long2ip(mask_bits)+"\n"+"Wildcard: "+v4long2ip(wildcard_bits) )
           )
           .append( $(SPAN).text(" (") )
           .append( $(A)
             .prop({"href": "?action=nav_v4&usedonly&net="+res['ok']['v4accessible'][i]['v4net_addr']+
                            "&masklen="+res['ok']['v4accessible'][i]['v4net_mask']+(DEBUG?"&debug":"")}
             )
             .text( "исп." )
             .title("Только используемые")
           )
           .append( $(SPAN).text(")") )
         )
        ;
      };

      v4accessible.appendTo( fixed_div );
    };
    workarea.append( $(DIV).prop("id", "searchresult").addClass("table") );
  });
};

function actionGroups() {
  //history.pushState(undefined, undefined, "?action=groups"+(DEBUG?"&debug":""));
  workarea.empty();
  fixed_div.empty();

  let table = $(DIV)
   .addClass("table")
   .appendTo( workarea )
  ;

  table
   .append( $(DIV)
     .addClass("thead")
     .append( $(DIV)
       .addClass("th")
       .append( $(SPAN)
         .text("id")
         .title("g_id в базе данных")
       )
     )
     .append( $(DIV)
       .addClass("th")
       .append( $(SPAN)
         .text("sAMAccountName")
         .title("Имя группы \"pre-Windows 2000\"")
       )
     )
     .append( $(DIV)
       .addClass("th")
       .append( $(SPAN)
         .text("Описание")
         .title("Назначение группы")
       )
     )
     .append( $(DIV)
       .addClass("th")
       .append( $(LABEL).html("&nbsp;")
       )
     )
   )
   .append( $(DIV)
     .addClass("tfoot")
     .append( $(DIV)
       .addClass("td")
       .append( $(LABEL).html("&nbsp;")
       )
     )
     .append( $(DIV)
       .addClass("td")
       .append( $(INPUT)
         .css({"width": "20em"})
         .val(initial_g_name)
         .addClass("g_name")
         .data("autosave_data", {"object": "group", "prop": "g_name"})
       )
     )
     .append( $(DIV)
       .addClass("td")
       .append( $(INPUT)
         .css({"width": "50em"})
         .addClass("g_descr")
         .data("autosave_data", {"object": "group", "prop": "g_descr"})
       )
     )
     .append( $(DIV)
       .addClass("td")
       .append( $(LABEL)
         .addClass(["button", "ui-icon", "ui-icon-plus"])
       )
       .title("Добавить")
       .click(function() {
         let g_name = autosave_normalize($(this).closest(".tfoot").find(".g_name"));
         if(g_name === undefined) error_at();
         g_name = String(g_name).trim().toLowerCase();

         let g_descr = autosave_normalize($(this).closest(".tfoot").find(".g_descr"));
         if(g_descr === undefined) error_at();
         g_descr = String(g_descr).trim();

         if(g_name == initial_g_name || g_name == ADMIN_GROUP || g_name == "Все") {
           $(this).closest(".tfoot").find(".g_name").animateHighlight("red", 500);
           $(this).closest(".tfoot").find(".g_name").focus();
           return;
         };
         let found = undefined;
         $(this).closest(".table").find(".tr").find(".g_name").each(function() {
           if( autosave_normalize($(this)) == g_name) {
             found = $(this);
             return false;
           };
         });
         if( found != undefined ) {
           found.add($(this).closest(".tfoot").find(".g_name")).animateHighlight("red", 500);
           $(this).closest(".tfoot").find(".g_name").focus();
           return;
         };

         let insert_before = $(this).closest(".tfoot");

         run_query({"action": "add_group", "g_name": g_name, "g_descr": g_descr}, function(res) {

           get_group_row(res['ok']['gs'], res['ok']['users']).insertBefore(insert_before);

           insert_before.find(".g_name").val(initial_g_name);
           insert_before.find(".g_descr").val("");
           insert_before.find(".g_name").focus();
         });
       })
     )
   )
  ;

  table.find(".tfoot").find(".g_name").focus();

  run_query({"action": "get_groups"}, function(res) {

    if(res['ok']['gs'] === undefined || !Array.isArray(res['ok']['gs'])) { return; };


    for(let i in res['ok']['gs']) {
      if(res['ok']['gs'][i]['any'] == 0 && res['ok']['gs'][i]['g_name'] != ADMIN_GROUP) {
        get_group_row(res['ok']['gs'][i], res['ok']['users']).insertBefore(table.find(".tfoot"));
      };
    };

  });
};

function get_group_row(db_row, users) {
  let id_title = "Добавлено: "+from_unix_time(db_row['added'], false, 'н/д');
  id_title += "\nИзменено: "+from_unix_time(db_row['ts'], false, 'н/д');
  if(users !== undefined && db_row['fk_u_id'] !== null && users[ db_row['fk_u_id'] ] !== undefined) {
    id_title += "\nКем: "+users[ db_row['fk_u_id'] ]['u_name']+" ("+users[ db_row['fk_u_id'] ]['u_login']+")";
  };

  let ret = $(DIV)
   .addClass("tr")
   .addClass("id_data")
   .data("id", db_row['g_id'])
   .data("data", db_row)
   .append( $(DIV)
     .addClass("td")
     .append( $(SPAN).text( db_row['g_id'] )
     )
     .title( id_title )
   )
   .append( $(DIV)
     .addClass("td")
     .append( $(INPUT)
       .css({"width": "20em"})
       .addClass("g_name")
       .val( db_row['g_name'] )
       .saveable({"object": "group", "id": String(db_row['g_id']), "prop": "g_name"})
     )
   )
   .append( $(DIV)
     .addClass("td")
     .append( $(INPUT)
       .css({"width": "50em"})
       .addClass("g_descr")
       .val( db_row['g_descr'] )
       .saveable({"object": "group", "id": String(db_row['g_id']), "prop": "g_descr"})
     )
   )
   .append( $(DIV)
     .addClass("td")
     .append( $(LABEL)
       .addClass(["button", "ui-icon", "ui-icon-delete"])
       .click(function() {
         let elm = $(this);
         let id_elm = elm.closest(".id_data");
         if(id_elm.length == 0) error_at();
         let id = id_elm.data("id");
         if(id === undefined) error_at();
         let g_name = autosave_normalize(elm.closest(".tr").find(".g_name"));
         show_confirm("Подтвердите удаление группы \""+g_name+"\".\nОТМЕНА ОПЕРАЦИИ БУДЕТ НЕВОЗМОЖНА!", function() {
           run_query({"action": "del_group", "id": String(id)}, function(res) {
           
             if(res['ok']['used'] !== undefined) {
               show_confirm_checkbox("ВНИМАНИЕ! Группа \""+g_name+"\" используется\nв "+res['ok']['used']+
                                     " списках доступа.\nУдаление приведет к удалению группы также из списков"+
                                     " доступа.\nОТМЕНА ОПЕРАЦИИ БУДЕТ НЕВОЗМОЖНА!", function() {
                 run_query({"action": "del_group", "id": String(id), "confirmed": 1}, function(_res) {
           
                   if(_res['ok']['done'] === undefined) {
                     error_at();
                     return;
                   };
                   elm.closest(".tr").remove();
                 });
               });
             } else if(res['ok']['done'] === undefined) {
               error_at();
               return;
             } else {
               elm.closest(".tr").remove();
             };
           });
         });
       })
     )
   )
  ;
  return ret;
};

function vrange_title(range) {
  let ret = "";
  ret += range['vr_name'];
  ret += " (id:"+range['vr_id']+")";
  ret += "\n";
  ret += range['vr_start']+"-"+range['vr_stop'];
  ret += "\n";
  ret += "Rights:" + range['rights'];
  ret += "\n";
  ret += range['vr_descr'];
  return ret;
};

function v4range_title(range) {
  let ret = "";
  ret += range['v4r_name'];
  ret += " (id:"+range['v4r_id']+")";
  ret += "\n";
  ret += v4long2ip(range['v4r_start'])+"-"+v4long2ip(range['v4r_stop']);
  ret += "\n";
  ret += "Rights:" + range['rights'];
  ret += "\n";
  ret += range['v4r_descr'];
  return ret;
};
function actionNav4() {
  workarea.empty();
  fixed_div.empty();
  let net = getUrlParameter("net", undefined);
  let masklen = getUrlParameter("masklen", undefined);

  if(net === undefined || ! String(net).match(/^\d+$/) || Number(net) > 4294967295) { error_at(); return; };
  if(masklen === undefined || ! String(masklen).match(/^\d{1,2}$/) || Number(masklen) > 32) { error_at(); return; };

  if(Number(net) != ip4net(net, masklen)) {
    error_at();
    return;
  };

  run_query({"action": "nav_v4", "net": net, "masklen": masklen}, function(res) {

    if(res['ok']['taken'] !== undefined) {
      window.location = "?action=view_v4&net="+net+"&masklen="+masklen+(usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
      return;
    };

    g_data = res['ok'];

    let backlen = 0;
    if(masklen <=8 ) {
      backlen = 0;
    } else if(masklen <= 16) {
      backlen = 8;
    } else if(masklen <= 24) {
      backlen = 16;
    } else {
      backlen = 24;
    };

    fixed_div
     .append( $(A)
       .prop("href", "?action=nav_v4&net="+ip4net(net, backlen)+"&masklen="+backlen+(usedonly?"&usedonly":"")+(DEBUG?"&debug":""))
       .text("<<<")
       .title( "Назад к сети: "+net_mask_wc(net, backlen) )
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(LABEL).text("Сеть: ") )
     .append( $(SPAN)
       .text( net_mask_wc(net, masklen) )
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(A)
       .prop("href", "?action=nav_v4&net="+net+"&masklen="+masklen+(!usedonly?"&usedonly":"")+(DEBUG?"&debug":""))
       .text(usedonly?"(Показать все)":"(Только используемые)")
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(LABEL).text("В избранном: ") )
     .append( $(INPUT).prop({"type": "checkbox", "checked": res['ok']['fav'] == 1})
       .on("change", function() {
         let checked = $(this).is(":checked");
         run_query({"action": "fav_v4", "net": net, "masklen": masklen, "fav": checked?1:0}, function(res) {
         });
       })
     )
    ;

    workarea
     .append( $(DIV)
     )
    ;

    let table = $(DIV).addClass("table")
    ;

    let thead = $(DIV).addClass("thead")
    ;

    thead.append( $(SPAN).addClass("th").text("Сеть") );

    for(let col_mask = Number(masklen)+1; col_mask <= Number(res['ok']['lastmask']); col_mask++) {
      let th = $(SPAN).addClass("th")
       .text("/"+String(col_mask))
       .title( v4long2ip(v4len2mask[col_mask])+" "+v4long2ip((~v4len2mask[col_mask]) >>> 0) )
       .appendTo(thead)
      ;
    };

    for(let i in res['ok']['ranges']) {
      let th = $(SPAN).addClass("th")
       .css({"padding-left": "0.1em", "padding-right": "0.1em"})
       .title(v4range_title(res['ok']['ranges'][i]))
      ;
      if(res['ok']['ranges'][i]['v4r_icon'] != "") {
        let label = $(LABEL)
         .html("&bull;")
         .data("r_i", i)
         .addClass("range_shown")
        ;
        if(res['ok']['ranges'][i]['v4r_style'] != "") {
          try {
            let style = JSON.parse(res['ok']['ranges'][i]['v4r_style']);
            label.css(style);
          } catch(e) {
            //ignore
          };
        };
        label.appendTo(th);
      };
      th.appendTo(thead);
    };

    thead
     .append( $(SPAN).addClass("th")
       .append( !userinfo['is_admin']?$(LABEL):$(LABEL)
         .addClass(["button", "ui-icon", "ui-icon-plus"])
         .title("Создать диапазон")
         .click(function() {
           edit_net_range("ext_v4net_range", undefined);
         })
       )
     )
    ;

    thead.appendTo(table);

    for(let i in res['ok']['rows']) {
      let row = res['ok']['rows'][i];
      let this_net = row['net'];
      let this_net_last_addr = row['last_addr'];
      if(usedonly &&
         res['ok']['rows'][i]['is_taken'] === undefined &&
         res['ok']['rows'][i]['is_part_of_taken'] === undefined &&
         res['ok']['rows'][i]['subnets'] === undefined &&
         true
      ) {
        continue;
      };
      let tr = $(DIV).addClass("tr")
      ;
      tr
       .append( $(SPAN).addClass("td")
         .text(v4long2ip(row["net"]))
       )
      ;

      for(let ci in res['ok']['rows'][i]['cols']) {
        let col_mask = Number(masklen)+Number(ci)+Number(1);
        let td = $(SPAN).addClass("td");

        if(res['ok']['rows'][i]['cols'][ci]['is_net'] !== undefined) {
          if(res['ok']['rows'][i]['cols'][ci]['is_taken'] == undefined) {
            if(res['ok']['rows'][i]['cols'][ci]['is_part_of_taken'] == undefined ) {
              if(col_mask < 32) {
                td
                 .append( $(A)
                   .prop("href", "?action=nav_v4&net="+row['net']+"&masklen="+col_mask+(usedonly?"&usedonly":"")+(DEBUG?"&debug":""))
                   .text("><")
                   .title("Перейти к "+v4long2ip(row["net"])+"/"+col_mask+"\n"+net_mask_wc(row["net"], col_mask))
                 )
                ;
              };
              if(res['ok']['rows'][i]['cols'][ci]['is_busy'] === undefined &&
                 (res['ok']['rows'][i]['cols'][ci]['ranges_rights'] & R_MANAGE_NET) > 0
              ) {
                td
                 .append( $(SPAN).addClass("min1em") )
                 .append( $(LABEL)
                   .addClass(["button", "ui-icon", "ui-icon-plus"])
                   .title("Занять "+v4long2ip(row["net"])+"/"+col_mask+"\n"+net_mask_wc(row["net"], col_mask))
                   .data("take_net", row['net'])
                   .data("take_masklen", col_mask)
                   .click(function() {
                     take_v4net($(this).data("take_net"), $(this).data("take_masklen"));
                   })
                 )
                ;
              };
            };
            if(res['ok']['rows'][i]['cols'][ci]['is_busy']) {
              td.css({"background-color": "gray"});
            };
          } else {
            if((res['ok']['rows'][i]['cols'][ci]['net_rights'] & (R_VIEW_NET_INFO | R_VIEW_NET_IPS)) > 0) {
              td
               .append( $(A)
                 .prop("href", "?action=view_v4&net="+row['net']+"&masklen="+col_mask+(usedonly?"&usedonly":"")+(DEBUG?"&debug":""))
                 .text("V")
                 .title("Просмотр "+v4long2ip(row["net"])+"/"+col_mask+"\n"+net_mask_wc(row["net"], col_mask))
               )
              ;
            };
            td.css({"border-top": "1px solid white"});
          };
          tr.append(td);
        };
        if(res['ok']['rows'][i]['cols'][ci]['is_taken'] !== undefined ||
           res['ok']['rows'][i]['cols'][ci]['is_part_of_taken'] !== undefined ||
           false
        ) {
          td.css({"background-color": "lightgray"});
          if(res['ok']['rows'][i]['is_taken'] !== undefined) {
            td.css({"background-color": "lightgray", "border-top": "1px solid white"});
          };
        };
        tr.append( td );
      };

      for(let r in res['ok']['ranges']) {
        let td = $(SPAN).addClass("td")
         .css({"padding-left": "0.1em", "padding-right": "0.1em"})
         .title(v4range_title(res['ok']['ranges'][r]))
        ;
        if(res['ok']['rows'][i]['ranges'][r]['in_range'] !== undefined) {
          let label_style;
          try {
            label_style = JSON.parse(res['ok']['ranges'][r]['v4r_style']);
          } catch(e) {
            label_style = g_default_ext_range_style;
          };

          let label = $(LABEL)
           .data("r_i", r)
           .addClass("range_shown")
           .css(label_style)
          ;
          let range_start = res['ok']['ranges'][r]['v4r_start'];
          let range_stop = res['ok']['ranges'][r]['v4r_stop'];

          if(range_start === this_net) {
            if(range_stop === this_net_last_addr) {
              //label.html("&#x2550;"); // ═
              label.html("&#x25C6;"); // ◆
            } else if(range_stop < this_net_last_addr) {
              label.html("&#x25BC;"); // ▼
            } else { //range_stop > this_net_last_addr
              label.html("&#x2533;"); // ┳
            };
          } else if(range_start < this_net) {
            if(range_stop === this_net_last_addr) {
              label.html("&#x253B;"); // ┻
            } else if(range_stop < this_net_last_addr) {
              label.html("&#x251B;"); // ┛
            } else { //range_stop > this_net_last_addr
              label.html("&#x2503;"); // ┃
            };
          } else { //range_start > this_net
            if(range_stop === this_net_last_addr) {
              label.html("&#x25B2;"); // ▲
            } else if(range_stop < this_net_last_addr) {
              label.html("&#x25BA;"); // ►
            } else { //range_stop > this_net_last_addr
              label.html("&#x2513;"); // ┓
            };
          };

          label.appendTo(td);
        };
        td.appendTo(tr);
      };

      if(res['ok']['rows'][i]['subnets'] != undefined) {
        tr
         .append( $(SPAN).addClass("td")
           .text(res['ok']['rows'][i]['subnets']+" подсетей...")
           .title(res['ok']['rows'][i]['subnets_names']+"\n...")
         )
        ;
      } else {
        tr
         .append( $(SPAN).addClass("td")
           .append( vlan_label("net", "", res['ok']['rows'][i]['vlan_data'], false, "VLAN: ", "")
             .css({"margin-right": "0.2em"})
           )
           .append( $(SPAN)
             .text(res['ok']['rows'][i]['net_name'] === undefined?"":ellipsed(res['ok']['rows'][i]['net_name'], 60))
             .title(res['ok']['rows'][i]['net_name'] === undefined?"":res['ok']['rows'][i]['net_name'])
           )
         )
        ;
      };

      tr.appendTo(table);
    };

    table.appendTo(workarea);

    table.find(".range_shown")
     .on("click dblclick", function(e) {
       if ((e.type == "click" && e.ctrlKey) ||
           e.type == "dblclick"
       ) {
         e.stopPropagation();
         let r_i = $(this).data("r_i");
         let r_id = g_data['ranges'][r_i]['v4r_id'];
         if(r_id === undefined) {
           error_at();
           return;
         };

         edit_net_range("ext_v4net_range", r_id);
       };
     })
    ;
  });
};

function ip_row(ipdata, focuson, col_hide_list) {
  let empty_colspan = net_cols_ids.length;
  let tr = $(TR).addClass("row").addClass("iprow")
   .data("ipdata", ipdata)
  ;

  let ip_td = $(TD).addClass("wsp")
  ;

  let ranges_span = $(SPAN)
   .css({"width": (g_range_bar_width+g_range_bar_margin)*g_data["net_ranges"].length, "display": "inline-block"})
  ;

  for(let i in g_data["net_ranges"]) {
    let r_label = $(LABEL).addClass("iprange");
    r_label.html('&#x200b;');
    r_label.css({"left": ((g_range_bar_width+g_range_bar_margin)*i)+"px",
                 "width": g_range_bar_width+"px",
                 "margin-right": g_range_bar_width+"px",
    });
    if(ipdata['ranges'][i]['in_range'] !== undefined) {
      r_label.addClass("iprange_shown");
      if(g_data["net_ranges"][i]['v4r_style'] != "{}") {
        try {
          let r_label_css = JSON.parse(g_data["net_ranges"][i]['v4r_style']);
          r_label.css(r_label_css);
        } catch(e) {
          r_label.css(g_default_range_style);

        };
      } else {
        r_label.css(g_default_range_style);
      };
      r_label.title(v4range_title(g_data["net_ranges"][i]));
      r_label.data("r_i", i);
    };
    ranges_span.append( r_label );
  };

  ip_td.append( ranges_span );

  let can_edit = false;
  if(ipdata['rights'] !== undefined &&
     (ipdata['rights'] & R_EDIT_IP_VLAN) > 0 &&
     ((ipdata['rights'] & R_DENYIP) == 0 ||
      (ipdata['rights'] & R_IGNORE_R_DENY) > 0
     )
  ) {
    can_edit = true;
  };


  if(ipdata['is_network'] !== undefined) {
    ip_td.append( $(SPAN).text(v4long2ip(ipdata['v4ip_addr'])) );
    ip_td.appendTo( tr );
    let empty_td = $(TD).prop("colspan", empty_colspan).addClass("empty_td")
     .text("Сеть")
    ;
    empty_td.appendTo( tr );
  } else if(ipdata['is_broadcast'] !== undefined) {
    ip_td.append( $(SPAN).text(v4long2ip(ipdata['v4ip_addr'])) );
    ip_td.appendTo( tr );
    let empty_td = $(TD).prop("colspan", empty_colspan).addClass("empty_td")
     .text("Broadcast")
    ;
    empty_td.appendTo( tr );
  } else if(ipdata['is_empty'] !== undefined) {
    ip_td.appendTo( tr );
    if(focuson !== undefined) {
      if(ipdata['start'] <= focuson && ipdata['stop'] >= focuson) {
        tr.addClass("focuson");
      };
    };
    let empty_td = $(TD).prop("colspan", empty_colspan).addClass("empty_td");
    if(can_edit) {
      empty_td
       .append( $(SPAN).text("Занять: ") )
       .append( $(LABEL).text(v4long2ip(ipdata['start']))
         .addClass("button")
         .data("take_type", "ip")
         .data("ip", ipdata['start'])
         .click(function() { take_ip($(this)); })
       )
      ;
      if((ipdata['stop'] - ipdata['start']) > 1) {
        let next_ip = ipdata['start'] + 1;
        let next_ip_t = v4long2ip(next_ip);
        let last_ip_t = v4long2ip(ipdata['stop']);

        let val = "";
        let i=1;

        while(i < next_ip_t.length && i < last_ip_t.length) {
          if(next_ip_t.substring(0, i) == last_ip_t.substring(0, i)) {
            val = next_ip_t.substring(0, i);
            i++;
          } else {
            break;
          };
        };

        empty_td
         .append( $(SPAN).text(" ... ") )
         .append( $(INPUT)
           .css({"width": "8em"})
           .addClass("any_ip")
           .val(val)
           .data("first", next_ip)
           .data("last", ipdata['stop']-1)
           .enterKey(function() { $(this).closest(".row").find(".take_any_btn").click(); })
         )
         .append( $(LABEL).text("+")
           .addClass("button")
           .addClass("take_any_btn")
           .data("take_type", "any_ip")
           .data("first", next_ip)
           .data("last", ipdata['stop']-1)
           .click(function() { take_ip($(this)); })
         )
        ;
      };
      if(ipdata['start'] !== ipdata['stop']) {
        empty_td
         .append( $(SPAN).text(" ... ") )
         .append( $(LABEL).text(v4long2ip(ipdata['stop']))
           .addClass("button")
           .data("ip", ipdata['stop'])
           .data("take_type", "ip")
           .click(function() { take_ip($(this)); })
         )
        ;
      };
    } else {
      if(ipdata['start'] === ipdata['stop']) {
        empty_td
         .append( $(SPAN).text("Свободно: ") )
         .append( $(SPAN).text(v4long2ip(ipdata['start']))
         )
        ;
      } else {
        empty_td
         .append( $(SPAN).text("Свободно: ") )
         .append( $(SPAN).text(v4long2ip(ipdata['start']))
         )
         .append( $(SPAN).text(" - ") )
         .append( $(SPAN).text(v4long2ip(ipdata['stop']))
         )
        ;
      };
    };
    empty_td.appendTo( tr );
  } else {
    // menu
    ip_td
     .append( $(LABEL)
       .addClass("button")
       .addClass("ns")
       .addClass(["ui-icon", "ui-icon-bars"])
       .css({"float": "right", "clear": "none"})
       .click(function(e) {
         e.stopPropagation();
         ip_menu($(this));
       })
     )
    ;
    if(focuson !== undefined) {
      if(Number(ipdata['v4ip_addr']) === Number(focuson)) {
        tr.addClass("focuson");
      };
    };
    //
    ip_td.append( $(SPAN).text(v4long2ip(ipdata['v4ip_addr'])).addClass("ip_addr") );

    ip_td
     .append( vlan_label("ip", ipdata['v4ip_id'],  ipdata['vlan_data'], can_edit, "", "").addClass("ip_vlan") )
    ;

    ip_td
     .append( $(SPAN)
       .addClass("ns")
       .css({"display": "inline-block", "min-width": "2em"})
       //.html('&#x200b;')
     )
    ;
    ip_td.tooltip({
      classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
      items: "SPAN.ip_addr",
      content: function() {
        if(!g_show_tooltips) return undefined;
        if( $("UL").length > 0 ) return undefined;
        let row = $(this).closest(".row");
        let ipdata = row.data("ipdata");
        let lines=[];
        if(ipdata['ts'] > 0) {
          lines.push("Занят: "+from_unix_time(ipdata['ts'], false, 'н/д'));
          if(ipdata['fk_u_id'] !== null && g_data['aux_userinfo'][ipdata['fk_u_id']] != undefined) {
            let user_row = g_data['aux_userinfo'][ipdata['fk_u_id']];
            lines.push("\t"+user_row['u_name']+" ("+user_row['u_login']+")");
          };
        };
        let latest_ts=0;
        let latest_u=undefined;
        let latest_c_id=undefined;

        for(let i in ipdata['values']) {
          if(ipdata['values'][i]['ts'] !== undefined && ipdata['values'][i]['ts'] > latest_ts) {
            latest_ts = ipdata['values'][i]['ts'];
            latest_c_id = i;
            if(ipdata['values'][i]['u_id'] !== undefined) {
              latest_u = g_data['aux_userinfo'][ipdata['values'][i]['u_id']];
            };
          };
        };

        if(latest_ts > 0) {
          lines.push("Последнее изменение: "+from_unix_time(latest_ts, false, 'н/д'));
          lines.push("Поле: "+g_data['net_cols'][latest_c_id]['ic_name']);
          if(latest_u != undefined) {
            lines.push("\t"+latest_u['u_name']+" ("+latest_u['u_login']+")");
          };
        };
        return lines.join("\n");
      }
    });


    ip_td.appendTo( tr );
    for(let col_i in net_cols_ids) {
      let col_id = net_cols_ids[col_i];
      let hide = in_array(col_hide_list, col_id);
      let td = $(TD)
       .addClass("unsaved_elm")
       .addClass("col_"+col_id)
       .toggle(!hide)
      ;
      td
       .append( ip_val_elm(ipdata, col_id, g_edit_all) )
      ;

      td.tooltip({
        classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
        items: "TD",
        content: function() {
          if(!g_show_tooltips) return undefined;
          if( $("UL").length > 0 ) return undefined;
          return $(this).find(".ip_value").data("title");
        }
      });

      td.appendTo( tr );
    };
  };

  if(can_edit) {
    tr
     .on("click dblclick", function(e) {
       if ((e.type == "click" && e.ctrlKey) ||
           e.type == "dblclick"
       ) {
         e.stopPropagation();
         let ipdata = $(this).data("ipdata");
         let td;
         if(e.target.nodeName == "INPUT" || e.target.nodeName == "TEXTAREA") {
           return;
         };

         if(e.target.nodeName == "TD") {
           td = $(e.target);
         } else {
           td = $(e.target).closest("TD");
         };
         if($(this).find(".ip_view").length > 0) {
           $(this).find(".ip_view").each(function() {
             $(this).replaceWith(ip_val_elm(ipdata, $(this).data('col_id'), true));
           });
           let focuson = td.find(".ip_edit").find(".autosave");

           if(focuson.length > 0) {
             focuson.focus();
           };
         } else if($(this).find(".ip_edit").length > 0) {
           $(this).find(".ip_edit").each(function() {
             let changed = $(this).data("autosave_changed");
             if(changed) {
               g_autosave_changes--;
             };
             $(this).replaceWith(ip_val_elm(ipdata, $(this).data('col_id'), false));
           });

           if(g_autosave_changes < 0) {
             error_at();
             return;
           } else if(g_autosave_changes == 0) {
             $("#autosave_btn").css({"color": "gray"});
           } else {
             $("#autosave_btn").css({"color": "yellow"});
           };
         };
       };
     })
    ;
  };

  return tr;
};

function actionView4() {
  workarea.empty();
  fixed_div.empty();
  let net = getUrlParameter("net", undefined);
  let masklen = getUrlParameter("masklen", undefined);
  let focuson = getUrlParameter("focuson", undefined);

  let is_new = getUrlParameter("is_new", false);

  if(net === undefined || ! String(net).match(/^\d+$/) || Number(net) > 4294967295) { error_at(); return; };
  if(masklen === undefined || ! String(masklen).match(/^\d{1,2}$/) || Number(masklen) > 32) { error_at(); return; };

  if(Number(net) != ip4net(net, masklen)) {
    error_at();
    return;
  };

  run_query({"action": "view_v4", "net": net, "masklen": masklen}, function(res) {

    if(res['ok']['gone'] !== undefined) {
      window.location = "?action=nav_v4net&net="+net+"&masklen="+masklen+(usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
      return;
    };

    g_data = res['ok'];

    let backlen = 0;
    if(masklen <=8 ) {
      backlen = 0;
    } else if(masklen <= 16) {
      backlen = 8;
    } else if(masklen <= 24) {
      backlen = 16;
    } else {
      backlen = 24;
    };

    let back_net = ip4net(net, backlen);

    document.title = "IPDB: "+v4long2ip(net)+"/"+masklen+" "+res['ok']['net_name'];

    fixed_div
     .append( $(DIV)
       .append( $(A)
         .prop("href", "?action=nav_v4&net="+ip4net(net, backlen)+"&masklen="+backlen+(usedonly?"&usedonly":"")+(DEBUG?"&debug":""))
         .text("<<<")
         .title( "Назад к сети: "+net_mask_wc(net, backlen) )
       )
       .append( $(SPAN).addClass("min1em") )
       .append( $(SPAN).text( net_mask_wc(net, masklen) ) )
       .append( $(SPAN).addClass("min1em") )
       .append( $(LABEL).text("В избранном: ") )
       .append( $(INPUT).prop({"type": "checkbox", "checked": res['ok']['fav'] == 1})
         .on("change", function() {
           let checked = $(this).is(":checked");
           run_query({"action": "fav_v4", "net": net, "masklen": masklen, "fav": checked?1:0}, function(res) {
           });
         })
       )
     )
     .append( $(DIV)
       .css({"display": "flex", "align-items": "center"})
       .append( $(LABEL).addClass(["ui-icon", "ui-icon-info", "button"])
         .css({"margin-left": "0.5em"})
         .click(function() {
           g_show_net_info = !g_show_net_info;
           $("#net_info").toggle(g_show_net_info);
           save_local("show_net_info", g_show_net_info);
         })
       )
       .append( $(SPAN).addClass("min1em") )
       .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
         .addClass(["ui-icon", "ui-icon-edit"])
         .title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
         .click(function() {
           let elm = $("#net_name_editable");
           if(elm.hasClass("editable_edit")) {
             $(this).title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
           } else {
             $(this).title("Отменить редактирование. Также можно нажать ESC когда курсор в поле ввода");
           };
           elm.trigger("editable_toggle");
         })
       )
       .append( $(SPAN)
         .css({"font-size": "xx-large"})
         .append(
           editable_elm({
             'object': 'net',
             'prop': 'v4net_name',
             'id': String(g_data['net_id']),
             '_edit_css': { 'width': '30em' },
             '_elm_id': 'net_name_editable',
             '_after_save': function(elm, new_val) {
               g_data['net_name'] = new_val;
               $("#net_changed_ts").text( from_unix_time( unix_timestamp() ) );
               $("#net_changed_user").text(userinfo['name'] +" ("+userinfo['login']+")"); 
             }
           }, is_new && (g_data['net_rights'] & R_MANAGE_NET) > 0)
         )
       )
       .append( $(SPAN).addClass("min1em") )
       .append( vlan_label("net", g_data['net_id'], g_data['vlan_data'], (g_data['net_rights'] & R_MANAGE_NET) > 0, "VLAN: ", "VLAN: не задан")
         .addClass("net_vlan")
       )
       .append( $(SPAN).addClass("min1em") )
       .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
         .addClass(["ui-icon", "ui-icon-edit"])
         .title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
         .click(function() {
           let elm = $("#net_tags_editable");
           if(elm.hasClass("editable_edit")) {
             $(this).title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
           } else {
             $(this).title("Отменить редактирование. Также можно нажать ESC когда курсор в поле ввода");
           };
           elm.trigger("editable_toggle");
         })
       )
       .append( $(SPAN).text("Теги: ") )
       .append( $(SPAN).addClass("min1em") )
       .append(
         editable_elm({
           'object': 'net',
           'prop': 'v4net_tags',
           'id': String(g_data['net_id']),
           '_elm_id': 'net_tags_editable',
           '_after_save': function(elm, new_val) {
             g_data['net_tags'] = new_val;
             $("#net_changed_ts").text( from_unix_time( unix_timestamp() ) );
             $("#net_changed_user").text(userinfo['name'] +" ("+userinfo['login']+")"); 
           }
         }, false)
       )
     )
    ;

    g_show_net_info = get_local("show_net_info", g_show_net_info);

    var info_div = $(DIV)
     .prop("id", "net_info")
    ;

    fixed_div
     .append( info_div.toggle(g_show_net_info) )
    ;

    if((g_data['net_rights'] & R_VIEW_NET_INFO) > 0) {

      info_div
       .append( $(DIV)
         .append( $(SPAN).text("Занята: ") )
         .append( $(SPAN).text(from_unix_time(res['ok']['taken_ts'], false, 'н.д.') ) )
         .append( res['ok']['taken_u_id'] === null?$(SPAN):$(SPAN).text(" Пользователем: ") )
         .append( res['ok']['taken_u_id'] === null?$(SPAN):$(SPAN)
           .text(g_data['aux_userinfo'][ res['ok']['taken_u_id'] ]['u_name']+" ("+
                 g_data['aux_userinfo'][ res['ok']['taken_u_id'] ]['u_login']+")"
           )
         )
         .append( $(SPAN).addClass("min1em") )
         .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
           .addClass(["button", "ui-icon", "ui-icon-trash"])
           .title("Удалить сеть")
           .data("back_net", back_net)
           .data("backlen", backlen)
           .click(function() {
             let back_net = $(this).data("back_net");
             let backlen = $(this).data("backlen");
             show_confirm_checkbox("Подтвердите удаление сети.\nВнимание: отменить операцию будет невозможно!", function() {
               run_query({"action": "del_net", "v": "4", "net_id": String(g_data['net_id'])}, function(res) {
                 g_autosave_changes = 0;
                 window.location = "?action=nav_v4&net="+back_net+"&masklen="+backlen+
                                   (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");

               });
             });
           })
         )
       )
      ;

      if(res['ok']['ts'] > 0 && res['ok']['fk_u_id'] !== null &&
         res['ok']['fk_u_id'] !== undefined && g_data['aux_userinfo'][ res['ok']['fk_u_id'] ] != undefined
      ) {
        info_div
         .append( $(DIV)
           .append( $(SPAN).text("Изменена: ") )
           .append( $(SPAN).text(from_unix_time(res['ok']['ts']) )
             .prop("id", "net_changed_ts")
           )
           .append( $(SPAN).text(" Пользователем: ") )
           .append( $(SPAN)
             .text(g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_name']+" ("+
                   g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_login']+")"
             )
             .prop("id", "net_changed_user")
           )
         )
        ;
      };

      info_div
       .append( $(DIV)
         .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
           .addClass(["ui-icon", "ui-icon-edit"])
           .css({"vertical-align": "top"})
           .title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
           .click(function() {
             let elm = $("#net_descr_editable");
             if(elm.hasClass("editable_edit")) {
               $(this).title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
             } else {
               $(this).title("Отменить редактирование. Также можно нажать ESC когда курсор в поле ввода");
             };
             elm.trigger("editable_toggle");
           })
         )
         .append(
           editable_elm({
             'object': 'net',
             'prop': 'v4net_descr',
             'id': String(g_data['net_id']),
             '_view_classes': ["wsp"],
             '_view_css': {"display": "inline-block", "border": "2px inset gray", "padding": "2px"},
             '_edit_css': { 'width': '50em', 'min-height': '20em' },
             '_elm_id': 'net_descr_editable',
             '_after_save': function(elm, new_val) {
               g_data['net_descr'] = new_val;
               $("#net_changed_ts").text( from_unix_time( unix_timestamp() ) );
               $("#net_changed_user").text(userinfo['name'] +" ("+userinfo['login']+")"); 
             }
           }, false)
         )
       )
      ;

      info_div
       .append( $(DIV)
         .append( $(SPAN).text("Владелец: ") )
         .append( editable_elm({
             "object": "net",
             "prop": "v4net_owner",
             'id': String(g_data['net_id']),
             '_elm_id': 'net_owner_editable',
             '_after_save': function(elm, new_val) {
               g_data['net_owner'] = new_val;
               $("#net_changed_ts").text( from_unix_time( unix_timestamp() ) );
               $("#net_changed_user").text(userinfo['name'] +" ("+userinfo['login']+")"); 
             }
           })
         )

         .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
           .addClass(["ui-icon", "ui-icon-edit"])
           .click(function() {
             $("#net_owner_editable").trigger("editable_toggle");
           })
         )
         .append( $(SPAN).addClass("min1em") )
         .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
           .addClass("button")
           .addClass("set_vlan_btn")
           .text("Задать VLAN")
           .click(function() {
             $(".vlan.net_vlan").trigger("set");
           })
         )
       )
      ;
    };

    let current_net_rights_span = $(SPAN);

    for(let k in r_keys) {
      let right = r_keys[k];
      let found = false;
      for(let i in g_rights[right]['used_in']) {
        if(g_rights[right]['used_in'][i] == "ext_v4net_range" ||
           g_rights[right]['used_in'][i] == "v4net_acl"
        ) {
          found = true;
          break;
        };
      };

      let is_set = (g_data['net_rights'] & right) > 0;
      if(is_set && found) {
        current_net_rights_span
         .append( $(SPAN).addClass("right_on")
           .text(g_rights[right]['label'])
           .title(g_rights[right]['descr'])
         )
        ;
      };
    };

    if( (g_data['net_rights'] & R_MANAGE_NET) > 0 ) {
      info_div
       .append( $(DIV)
         .append( $(SPAN).text("Назначение полей: ") )
         .append( $(LABEL)
           .addClass(["button", "ui-icon", "ui-icon-bullets"])
           .title("Назначение полей")
           .click(function() {
             if(g_autosave_changes > 0) {
               show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
               return;
             };
             net_cols_edit();
           })
         )
       )
      ;
    };
    info_div
     .append( $(DIV)
       .append( $(SPAN).text("Ваши права на сеть: ") )
       .append( current_net_rights_span )
       .append( (g_data['net_rights'] & R_VIEW_NET_INFO) == 0?$(LABEL):$(LABEL)
         .text("Права групп")
         .addClass("button")
         .click(function() {
           if(g_autosave_changes > 0) {
             show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
             return;
           };
           edit_rights("v4net_acl", g_data['net_id'], (g_data['net_rights'] & R_MANAGE_NET) > 0,  function() {
             window.location = "?action=view_v4&net="+g_data['net_addr']+"&masklen="+g_data['net_masklen']+
                               (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
             return;
           });
         })
       )
     )
    ;

    if((g_data['net_rights'] & R_VIEW_NET_INFO) > 0) {
      let net_ranges_span = $(SPAN);

      for(let i in g_data['net_in_ranges']) {
        let range = g_data['net_in_ranges'][i];
        let range_icon_css = {};
        try {
          range_icon_css = JSON.parse(range['v4r_icon_style']);
        } catch(e) {
          range_icon_css = {};
        };
        let range_icon = g_default_range_icon;
        if(range['v4r_icon'] !== "") {
          range_icon = range['v4r_icon'];
        };
        net_ranges_span
         .append( $(SPAN).addClass("range_span")
           .title( v4range_title(range) )
           .append( $(LABEL).addClass(["ui-icon", range_icon]).css(range_icon_css) )
           .append( $(SPAN).text(range['v4r_name']) )
         )
        ;
      };

      info_div
       .append( $(DIV)
         .append( $(SPAN).text("Сеть входит в диапазоны: ") )
         .append( net_ranges_span )
       )
      ;

    };

    if(res['ok']['ips'] !== undefined) {

      g_edit_all = get_local("edit_all", g_edit_all);

      g_show_tooltips = get_local("show_tooltips", g_show_tooltips);

      fixed_div
       .append( $(DIV)
         .append( $(SPAN)
           .append( $(LABEL)
             .text("Редактировать все: ")
             .prop("for", "edit_all")
           )
           .append( $(INPUT)
             .prop({"id": "edit_all", "type": "checkbox", "checked": g_edit_all})
             .on("change", function() {
               let state = $(this).is(":checked");
               save_local("edit_all", state);
               g_edit_all = state;

               $(".main_table").find("TBODY").find("TR").each(function() {
                 let row = $(this);
                 let row_ipdata = row.data("ipdata");
                 if(row_ipdata['is_taken'] !== undefined) {
                   row.find(".ip_value").each(function() {
                     let col_id = $(this).data("col_id");
                     let changed = $(this).find(".autosave").data("autosave_changed");
                     if(changed === undefined || changed === false) {
                       let new_elm = ip_val_elm(row_ipdata, col_id, state);
                       $(this).replaceWith(new_elm);
                     };
                   });
                 };
               });
             })
           )
         )
         .append( $(SPAN)
           .append( $(LABEL)
             .text("Всплывающие подсказки: ")
             .prop("for", "show_tooltips")
           )
           .append( $(INPUT)
             .prop({"id": "show_tooltips", "type": "checkbox", "checked": g_show_tooltips})
             .on("change", function() {
               let state = $(this).is(":checked");
               save_local("show_tooltips", state);
               g_show_tooltips = state;
               $(".tooltip").remove();
             })
           )
         )
       )
      ;

      let table = $(TABLE).addClass("main_table")
      ;

      let thead = $(TR)
      ;

      thead
       .append( $(TH)
         .text("IP")
         .append( $(LABEL)
           .addClass(["button", "ui-icon", "ui-icon-eye"])
           .title("Отображение полей")
           .css({"float": "right"})
           .click(function(e) {
             e.stopPropagation();
             let menu = $(UL)
              .addClass("popupmenu")
              .css({"background-color": "white", "border": "1px solid black", "display": "inline-block", "z-index": 100})
              .css({"padding": "0.2em"})
              .css({"position": "absolute"})
              .append( $(LI)
                .title("Закрыть меню")
                .append( $(DIV)
                  .addClass("wsp")
                  .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrowreturn-1-w"]) )
                  .append( $(SPAN).html("&#x200b;") )
                  .click(function(e) {
                    e.stopPropagation();
                    $("UL.popupmenu").remove();
                  })
                )
              )
             ;
             net_cols_ids = keys(g_data['net_cols']);
             net_cols_ids.sort(function(a, b) {
               return Number(g_data['net_cols'][a]['ic_sort']) - Number(g_data['net_cols'][b]['ic_sort']);
             });

             for(let col_i in net_cols_ids) {
               let col_id = net_cols_ids[col_i];
               let hidden = get_local('col_hide_'+g_data['v']+'_'+g_data['net_id']+'_'+col_id, false);
               menu
                .append( $(LI)
                  .title(g_data['net_cols'][col_id]['ic_name'])
                  .append( $(DIV)
                    .click(function(e) {
                      e.stopPropagation();
                      if(e.target.nodeName == "DIV") {
                        $(this).find("INPUT").trigger("click");
                      };
                    })
                    .addClass("wsp")
                    .css({"text-align": "right", "font-weight": "normal"})
                    .append( $(LABEL).prop("for", 'col_hide_'+g_data['v']+'_'+g_data['net_id']+'_'+col_id)
                      .text(g_data['net_cols'][col_id]['ic_name'])
                    )
                    .append( $(INPUT)
                      .prop({"id": 'col_hide_'+g_data['v']+'_'+g_data['net_id']+'_'+col_id,
                             "type": "checkbox",
                             "checked": !hidden
                      })
                      .data("col_id", col_id)
                      .on("change", function() {
                        let col_id = $(this).data("col_id");
                        let show = $(this).is(":checked");
                        if(show) {
                          del_local('col_hide_'+g_data['v']+'_'+g_data['net_id']+'_'+col_id);
                          $(".col_"+col_id).show();
                        } else {
                          save_local('col_hide_'+g_data['v']+'_'+g_data['net_id']+'_'+col_id, true);
                          $(".col_"+col_id).hide();
                        };

                        $("#hidden_cols").toggle($(this).closest("TABLE").find("THEAD").find(".column:hidden").length > 0);
                      })
                    )
                  )
                )
               ;
             };

             let td = $(this).closest("TH");

             let td_width = td.width();

             menu.css({"top": "1.3em", "left": td_width+10+"px"});

             menu.appendTo(td);

             menu.menu();

             menu.on("click dblclick", function(e) { e.stopPropagation(); });

             $(".tooltip").remove();
             
           })
         )
         .append( $(SPAN).prop("id", "hidden_cols")
           .css({"float": "right"})
           .title("Некоторые колонки скрыты!")
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-eye"])
             .css({"color": "darkorange"})
           )
           .hide()
         )
         .append( (g_data['net_rights'] & R_MANAGE_NET) == 0?$(LABEL):$(LABEL)
           .addClass(["button", "ui-icon", "ui-icon-plus"])
           .title("Добавить диапазон")
           .css({"float": "left"})
           .click(function() {
             if(g_autosave_changes > 0) {
               show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
               return;
             };
             edit_net_range("int_v4net_range", undefined);
           })
         )
       )
      ;

      net_cols_ids = keys(res['ok']['net_cols']);
      net_cols_ids.sort(function(a, b) {
        return Number(res['ok']['net_cols'][a]['ic_sort']) - Number(res['ok']['net_cols'][b]['ic_sort']);
      });

      g_data["_val_css"] = {};

      let col_hide_list = [];

      for(let col_i in net_cols_ids) {
        let col_id = net_cols_ids[col_i];

        let hide = get_local('col_hide_'+res['ok']['v']+'_'+res['ok']['net_id']+'_'+col_id, false);
        if(hide) col_hide_list.push(col_id);

        if(String(res['ok']['net_cols'][col_id]['ic_options']).length > 0 &&
           String(res['ok']['net_cols'][col_id]['ic_options'])[0] === "{"
        ) {
          try {
            let options_json = JSON.parse(res['ok']['net_cols'][col_id]['ic_options']);
            if(options_json["val_css"] !== undefined && Array.isArray(options_json["val_css"])) {
              g_data["_val_css"][col_id] = options_json["val_css"];
            };
          } catch(e) {};
        };

        let th = $(TH)
         .addClass('column')
         .addClass('col_'+col_id)
         .text(res['ok']['net_cols'][col_id]['ic_name'])
         .data("col_id", col_id)
         .toggle(!hide)
        ;
        if(res['ok']['net_cols'][col_id]['ic_icon'] != '') {
          let icon_css;
          try {
            icon_css = JSON.parse(res['ok']['net_cols'][col_id]['ic_icon_style']);
          } catch(e) {
            ison_css = {};
          };
          th
           .append( $(LABEL)
             .addClass("ui-icon")
             .addClass(res['ok']['net_cols'][col_id]['ic_icon'])
             .css(icon_css)
           )
          ;
        };
        th.appendTo(thead);
      };

      table
       .append( $(THEAD)
         .append( thead )
       )
      ;

      let tbody = $(TBODY);

//let start_t = Date.now();

      for(let ip_i in res['ok']['ips']) {
        let ipdata = res['ok']['ips'][ip_i];
        let tr = ip_row(ipdata, focuson, col_hide_list);
        tr.appendTo( tbody );

      };
//debugLog(Date.now() - start_t);
      table.append( tbody );
      table.appendTo( workarea );

      $("#hidden_cols").toggle(table.find("THEAD").find(".column:hidden").length > 0);

      table.tooltip({
        classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
        items: ".iprange",
        content: function() {
          if(!g_show_tooltips) return;
          let r_i = $(this).data("r_i");
          if(r_i === undefined) return;
          return v4range_title(g_data['net_ranges'][r_i]);
        }
      });

      if((g_data['net_rights'] & R_MANAGE_NET) > 0) {
        table.find(".iprange_shown").on("click dblclick", function(e) {
          if ((e.type == "click" && e.ctrlKey) ||
              e.type == "dblclick"
          ) {
            e.stopPropagation();
            let r_i = $(this).data("r_i");
            if(r_i === undefined) return;
            if(g_autosave_changes > 0) {
              show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
              return;
            };
            edit_net_range("int_v4net_range", g_data['net_ranges'][r_i]['v4r_id']);
          };
        });
      };


      if(focuson !== undefined) {
        let tr = $(".focuson");
        let prev = tr.prev();
        if(prev.length > 0) {
         prev[0].scrollIntoView();
        };
      };

        
    } else {
      fixed_div
       .append( $(DIV).text("У вас нет прав просмотра IP адресов этой сети") )
      ;
    };

    if(is_new && (g_data['net_rights'] & R_MANAGE_NET) > 0) {
      $("#net_name_editable").focus();
      history.pushState(undefined, undefined,
                        "?action=view_v4&net="+net+"&masklen="+masklen+(usedonly?"&usedonly":"")+(DEBUG?"&debug":"")
      );
    };
  });
};

function take_ip(elm) {
  let row = elm.closest(".row");
  let prev_ipdata = row.data("ipdata");
  let take_type = elm.data("take_type");
  if(take_type == undefined) { error_at(); return; };
  if(prev_ipdata == undefined) { error_at(); return; };

  let take_ip = undefined;
  if(take_type === "ip") {
    take_ip = elm.data("ip");
  } else if(take_type === "any_ip") {
    let v = row.find(".any_ip").val();
    take_ip = v4ip2long(v);
    if(take_ip === false) {
      row.find(".any_ip").animateHighlight("red", 500);
      return;
    };
    let first = elm.data("first");
    let last = elm.data("last");
    if(take_ip < first || take_ip > last) {
      row.find(".any_ip").animateHighlight("red", 500);
      return;
    };
  } else {
    error_at(); return;
  };

  if(take_ip === undefined) { error_at(); return; };

  run_query({"action": "take_ip4", "take_ip": String((take_ip >>> 0)), "ranges_orig": g_data['ranges_orig']}, function(res) {

    if(res['ok']['taken'] !== undefined) {
      show_dialog("Адрес уже кем-то занят, обновите страницу!");
      return;
    };

    if(res['ok']['gone'] !== undefined) {
      show_dialog("Сеть не существует. Возможно кто-то ее уже удалил, обновите страницу!");
      return;
    };

    if(res['ok']['ranges_changed'] !== undefined) {
      show_dialog("Кто-то внес изменения в диапазоны сети, обновите страницу!");
      return;
    };

    let hidden_cols = [];

    row.closest("TABLE").find("THEAD").find(".column:hidden").each(function() {
      hidden_cols.push($(this).data("col_id"));
    });

    let new_ipdata = res['ok']['ipdata'];
    let new_ip_row = ip_row(new_ipdata, undefined, hidden_cols);
    row.replaceWith( new_ip_row );

    let prev_start = prev_ipdata['start'];
    let prev_stop = prev_ipdata['stop'];

    if(prev_start != prev_stop) {
      if(take_ip > prev_start) {
        let before_data = dup(prev_ipdata);
        before_data['stop'] = take_ip - 1;
        let before_row = ip_row(before_data, undefined, hidden_cols);
        before_row.insertBefore(new_ip_row);
      };
      if(take_ip < prev_stop) {
        let after_data = dup(prev_ipdata);
        after_data['start'] = take_ip + 1;
        let after_row = ip_row(after_data, undefined, hidden_cols);
        after_row.insertAfter(new_ip_row);
      };
    };
  });
};

function ip_menu(elm) {
  $("UL.popupmenu").remove();
  let row = elm.closest(".row");
  let ipdata = row.data("ipdata");
  
  let menu = $(UL)
   .addClass("popupmenu")
   .css({"background-color": "white", "border": "1px solid black", "display": "inline-block", "z-index": 100})
   .css({"padding": "0.2em"})
   .css({"position": "absolute"})
   .append( $(LI)
     .title("Закрыть меню")
     .append( $(DIV)
       //.css({"display": "inline-block"})
       .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrowreturn-1-w"]) )
       .append( $(SPAN).html("&#x200b;") )
       .click(function(e) {
         e.stopPropagation();
         $("UL.popupmenu").remove();
       })
     )
   )
   .append( $(LI)
     .title("Скопировать в буфер")
     .append( $(DIV)
       //.css({"display": "inline-block"})
       .append( $(LABEL).addClass(["ui-icon", "ui-icon-copy"]) )
       .append( $(SPAN).text("Скопировать IP в буфер") )
       .click(function(e) {
         e.stopPropagation();
         let row = $(this).closest("TR");
         let ipdata = row.data("ipdata");
         let ip_addr = v4long2ip(ipdata["v4ip_addr"]);
         $("UL.popupmenu").remove();
         try {
           navigator.clipboard.writeText(ip_addr).then(
             function() {
               /* clipboard successfully set */
               row.find("TD").first().animateHighlight("green", 300);
             }, 
             function() {
               /* clipboard write failed */
               window.alert('Opps! Your browser does not support the Clipboard API')
             }
           );
         } catch(e) {
           alert(e);
         };
       })
     )
   )
   .append( $(LI)
     .append( $(DIV).text("Ссылки") )
     .append( $(UL)
       .append( $(LI)
         .append( $(DIV)
           .append( $(A)
             .prop({"target": "_blank", "href": "http://"+v4long2ip(ipdata['v4ip_addr'])+"/"})
             .text("HTTP")
           )
         )
       )
       .append( $(LI)
         .append( $(DIV)
           .append( $(A)
             .prop({"target": "_blank", "href": "https://"+v4long2ip(ipdata['v4ip_addr'])+"/"})
             .text("HTTPS")
           )
         )
       )
       .append( $(LI)
         .append( $(DIV)
           .append( $(A)
             .prop({"target": "_blank", "href": "ssh://"+v4long2ip(ipdata['v4ip_addr'])})
             .text("SSH")
           )
         )
       )
     )
   )
  ;


  if((ipdata['rights'] & R_EDIT_IP_VLAN) != 0 &&
     ((ipdata['rights'] & R_DENYIP) == 0 ||
      (ipdata['rights'] & R_IGNORE_R_DENY) != 0
     )
  ) {

    if(row.find(".ip_view").length > 0) {
      menu
       .append( $(LI)
         .append( $(DIV)
           .title("Также можно сделать CTRL-Click или dbl-Click на строке...")
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-edit"]) )
           .append( $(SPAN).html("Редактировать&#x20F0;") )
           .click(function(e) {
             e.stopPropagation();

             let row = $(this).closest("TR");

             row.find(".ip_view").each(function() {
               $(this).replaceWith(ip_val_elm(ipdata, $(this).data('col_id'), true));
             });
             $("UL.popupmenu").remove();

             row.find(".ip_edit").first().focus();
           })
         )
       )
      ;
    };

    if(row.find(".ip_edit").length > 0) {
      menu
       .append( $(LI)
         .append( $(DIV)
           //.css({"display": "inline-block"})
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-undo"]) )
           .append( $(SPAN).text("Перестать редактировать") )
           .click(function(e) {
             e.stopPropagation();

             let row = $(this).closest("TR");

             row.find(".ip_edit").each(function() {
               let changed = $(this).find(".autosave").data("autosave_changed");
               if(changed) {
                 g_autosave_changes--;
               };
               $(this).replaceWith(ip_val_elm(ipdata, $(this).data('col_id'), false));
             });
             row.find(".unsaved").removeClass("unsaved");
             if(g_autosave_changes < 0) {
               error_at();
               return;
             } else if(g_autosave_changes == 0) {
               $("#autosave_btn").css({"color": "gray"});
             } else {
               $("#autosave_btn").css({"color": "yellow"});
             };
             $("UL.popupmenu").remove();
           })
         )
       )
      ;
    };

    menu
     .append( $(LI)
       .append( $(DIV)
         //.css({"display": "inline-block"})
         .append( $(LABEL).addClass(["ui-icon", "ui-icon-trash"]) )
         .append( $(SPAN).text("Освободить") )
         .click(function(e) {
           e.stopPropagation();
           let row = $(this).closest("TR");
           let ipdata = row.data("ipdata");
           if(ipdata === undefined) { error_at(); return; };
           show_confirm("Подтвердите освобождение адреса "+v4long2ip(ipdata['v4ip_addr'])+
                        "\nВнимание: все данные по этому адресу будут удалены.\nОтмена будет невозможна", function() {
             let ip_id = ipdata['v4ip_id'];
             run_query({"action": "free_ip", "v": "4", "id": String(ip_id)}, function(res) {

               row.find(".ip_edit").each(function() {
                 let changed = $(this).data("autosave_changed");
                 if(changed) {
                   g_autosave_changes--;
                 };
               });
               if(g_autosave_changes < 0) {
                 error_at();
                 return;
               } else if(g_autosave_changes == 0) {
                 $("#autosave_btn").css({"color": "gray"});
               } else {
                 $("#autosave_btn").css({"color": "yellow"});
               };

               $("UL.popupmenu").remove();
               let new_ip_data = {};
               new_ip_data['ranges'] = ipdata['ranges'];
               new_ip_data['rights'] = ipdata['rights'];
               new_ip_data['is_empty'] = 1;
               new_ip_data['start'] = ipdata['v4ip_addr'];
               new_ip_data['stop'] = ipdata['v4ip_addr'];

               let hidden_cols = [];

               row.closest("TABLE").find("THEAD").find(".column:hidden").each(function() {
                 hidden_cols.push($(this).data("col_id"));
               });

               row.replaceWith( ip_row(new_ip_data, undefined, hidden_cols) );
             });
           });
         })
       )
     )
    ;

    menu
     .append( $(LI)
       .append( $(DIV)
         //.css({"display": "inline-block"})
         .append( $(LABEL).addClass(["ui-icon", "ui-icon-sitemap"]) )
         .append( $(SPAN).text("Задать VLAN") )
         .click(function(e) {
           e.stopPropagation();
           let row = $(this).closest("TR");
           $("UL.popupmenu").remove();
           row.find(".ip_vlan").trigger("set");
         })
       )
     )
    ;
  };

  //let elm_offset = elm.offset();
  //let elm_width = elm.width();

  let td_width = elm.closest("TD").width();

  menu.css({"top": "0px", "left": td_width+20+"px"});

  menu.appendTo(elm.closest("TD"));

  menu.menu();

  menu.on("click dblclick", function(e) { e.stopPropagation(); });

  $(".tooltip").remove();
};

function vlan_val_elm(row_data, prop, state) {
  let ret;

  let can_edit = false;
  if(row_data['rights'] !== undefined &&
     (row_data['rights'] & R_EDIT_IP_VLAN) > 0 &&
     ((row_data['rights'] & R_DENYIP) == 0 ||
      (row_data['rights'] & R_IGNORE_R_DENY) > 0
     )
  ) {
    can_edit = true;
  };

  let value = row_data[prop];

  if(state && can_edit) {
    if(prop == "vlan_descr") {
      ret = $(TEXTAREA);
      ret.css({"min-height": "1em", "min-width": "80em"});
      let lines = String(value).split("\n").length;
      ret.css({"height": lines+"em"});
    } else {
      ret = $(INPUT);
    };
    ret.val(value);

    ret.saveable({"object": "vlan_value", "id": String(row_data['vlan_id']), "prop": prop});
    ret.addClass("vlan_edit");

    ret.keyup(function(e) {
      if(e.key === "Escape") {
        e.stopPropagation();
        let row = $(this).closest(".row");
        row.find(".vlan_edit").each(function() {
          if(!$(this).data("autosave_changed")) {
            $(this).replaceWith( vlan_val_elm(row.data("row_data"), $(this).data("prop"), false ));
          };
        });
      };

    });

  } else {
    ret = $(SPAN)
     .addClass("wsp")
     .addClass("vlan_view")
     .text(value)
    ;
  };

  let css = {};
  ret.addClass("vlan_value");
  ret.data("prop", prop);
  ret.css(css);

  return ret;
};

function get_tag_elm(tag_id, can_edit) {
  let ret = $(LABEL)
   .addClass("tag")
   .addClass("value_tag_"+tag_id)
   .addClass(can_edit?"can_edit":"cannot_edit")
   .data("tag_id", tag_id)
  ;

  let label_span = $(SPAN);

  let chain = [tag_id];
  function tag_parents(_tag_id, counter) {
    if(counter > 100) {
      error_at();
      return;
    };

    if(g_data['tags'] !== undefined && g_data['tags'][_tag_id] !== undefined &&
       g_data['tags'][_tag_id]['tag_fk_tag_id'] !== null
    ) {
      chain.push(String(g_data['tags'][_tag_id]['tag_fk_tag_id']));
      tag_parents(g_data['tags'][_tag_id]['tag_fk_tag_id'], counter + 1);
    };
  };

  tag_parents(tag_id, 0);

  for(let i = (chain.length - 1); i >= 0; i--) {
    let chain_tag = chain[i];
    if(g_data['tags'] !== undefined && g_data['tags'][chain_tag] !== undefined &&
       (i == 0 || (g_data['tags'][chain_tag]['tag_flags'] & F_IN_LABEL) > 0)
    ) {
      if((g_data['tags'][chain_tag]['rights'] & R_VIEW_NET_IPS) > 0) {
        label_span.append( $(LABEL).text(g_data['tags'][chain_tag]['tag_name']) );
      } else {
        label_span.append( $(LABEL).addClass(["ui-icon", "ui-icon-forbidden"]) );
      };
      if(i != 0) {
        label_span.append( $(LABEL).text(":") );
      };
    } else if(i == 0) {
      label_span.append( $(LABEL).addClass("tag").text("Тег: "+chain_tag) );
    };
  };

  ret.append( label_span );

  ret
   .tooltip({
     classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
     items: "LABEL.tag",
     content: function() {
       $(".tooltip").remove();
       let tag_id = $(this).data("tag_id");
       let ret = $(DIV);

       let chain = [tag_id];
       function tag_parents(_tag_id, counter) {
         if(counter > 100) {
           error_at();
           return;
         };

         if(g_data['tags'] !== undefined && g_data['tags'][_tag_id] !== undefined &&
            g_data['tags'][_tag_id]['tag_fk_tag_id'] !== null
         ) {
           chain.push(String(g_data['tags'][_tag_id]['tag_fk_tag_id']));
           tag_parents(g_data['tags'][_tag_id]['tag_fk_tag_id'], counter + 1);
         };
       };

       tag_parents(tag_id, 0);

       for(let i = (chain.length - 1); i >= 0; i--) {
         let chain_tag = chain[i];
         if(g_data['tags'] !== undefined && g_data['tags'][chain_tag] !== undefined &&
            (i == 0 || (g_data['tags'][chain_tag]['tag_flags'] & F_DISPLAY) > 0)
         ) {
           if((g_data['tags'][chain_tag]['rights'] & R_VIEW_NET_IPS) > 0) {
             ret.append( $(LABEL).addClass("tag").text(g_data['tags'][chain_tag]['tag_name']) );
           } else {
             ret.append( $(LABEL).addClass("tag").addClass(["ui-icon", "ui-icon-forbidden"]) );
           };
         } else if(i == 0) {
           ret.append( $(LABEL).addClass("tag").text("Тег: "+chain_tag) );
         };
       };

       if(g_data['tags'] !== undefined && g_data['tags'][tag_id] !== undefined &&
          (g_data['tags'][tag_id]['rights'] & R_VIEW_NET_IPS) > 0 &&
          String(g_data['tags'][tag_id]['tag_descr']).trim() !== ""
       ) {
         ret.append( $(BR) ).append( $(SPAN).text(String(g_data['tags'][tag_id]['tag_descr']).trim()) );
       };

       
       return ret;
     },
   })
  ;

  if(can_edit) {
    ret
     .click(function(e) {
       e.stopPropagation();

       let tagset = $(this).closest(".tagset");
       let current_tag_id = $(this).data("tag_id");
       let collection = null;
       let col_id= tagset.data("col_id");
       if(col_id !== undefined) {
         let coldata = g_data['net_cols'][col_id];
         collection = String(coldata['ic_options']).trim().toLowerCase();
         if(collection === "") collection = null;
       };

       let current_tag = $(this);
       select_tag(collection, current_tag_id, function(tag_id) {
         if(tag_id !== null) {
           let new_tag = get_tag_elm(tag_id, true);
           current_tag.replaceWith(new_tag);
         } else {
           current_tag.remove();
         };
         tagset.trigger("recalc");
       });
     })
    ;
  };
  return ret;
};

function ip_val_elm(ipdata, col_id, state) {
  let ret = $(SPAN);
  let coldata = g_data['net_cols'][col_id];

  let can_edit = false;
  if(ipdata['rights'] !== undefined &&
     (ipdata['rights'] & R_EDIT_IP_VLAN) > 0 &&
     ((ipdata['rights'] & R_DENYIP) == 0 ||
      (ipdata['rights'] & R_IGNORE_R_DENY) > 0
     )
  ) {
    can_edit = true;
  };

  let value = "";
  let ts = undefined;
  let u_id = undefined;

  if(ipdata["values"][col_id]['v'] !== undefined) {
    value = ipdata["values"][col_id]['v'];
    ts = ipdata["values"][col_id]['ts'];
    u_id = ipdata["values"][col_id]['u_id'];
  };

  let title = "";
  if(ts !== undefined) {
    title = "Изменен: "+from_unix_time(ts);
    if(u_id !== undefined && g_data['aux_userinfo'][u_id] !== undefined) {
      title += "\n"+g_data['aux_userinfo'][u_id]['u_name']+" ("+g_data['aux_userinfo'][u_id]['u_login']+")";
    };
  };

  let style = "{}";

  if(state && can_edit) {
    style = coldata['ic_style'];
  } else {
    style = coldata['ic_view_style'];
  };

  let css = {};

  try {
    css = JSON.parse(style);
  } catch(e) {
    css = {};
  };

  if(state && can_edit) {
    let input_elm;

    if(coldata['ic_type'] == "textarea") {
      let lines = String(value).split("\n").length;
      input_elm = $(TEXTAREA)
       .css({"min-height": "1em"})
       .css({"height": lines+"em"})
      ;
      input_elm.css(css);
    } else if(coldata['ic_type'] == "tag") {
      input_elm = $(INPUT).prop("type", "hidden");
     } else if(coldata['ic_type'] == "multitag") {
      input_elm = $(INPUT).prop("type", "hidden");
    } else {
      input_elm = $(INPUT);
      input_elm.css(css);
    };
    input_elm.val(value);

    input_elm.saveable({"object": "ip_value", "id": String(ipdata['v4ip_id']), "col_id": col_id});

    input_elm.keyup(function(e) {
      if(e.key === "Escape") {
        e.stopPropagation();
        $(".tooltip").remove();
        let row = $(this).closest(".row");
        row.find(".ip_edit").each(function() {
          if(!$(this).find(".autosave").data("autosave_changed")) {
            $(this).replaceWith( ip_val_elm(row.data("ipdata"), $(this).data("col_id"), false ));
          };
        });
      };
    });
    ret.append( input_elm );
    ret.addClass("ip_edit");

  } else {
    ret
     .addClass("wsp")
     .addClass("ip_view")
    ;
    if(coldata['ic_type'] == "textarea" || coldata['ic_type'] == "text") {

      let options_css = {};

      if(g_data['_val_css'] !== undefined && g_data['_val_css'][ coldata['ic_id'] ] !== undefined) {
        let val_css = g_data['_val_css'][ coldata['ic_id'] ];

        for(let i in val_css) {
          if(val_css[i]["type"] === "default") {
            options_css = val_css[i]["css"];
            break;
          } else if(val_css[i]["type"] === "regexp") {
            try {
              let re = RegExp(val_css[i]["regexp"]);
              if(re.test(value)) {
                options_css = val_css[i]["css"];
                break;
              };
            } catch(e) {
            };
          } else if(val_css[i]["type"] === "===") {
            if(value === val_css[i]["than"]) {
              options_css = val_css[i]["css"];
              break;
            };
          } else if(val_css[i]["type"] === "==") {
            if(value == val_css[i]["than"]) {
              options_css = val_css[i]["css"];
              break;
            };
          } else if(val_css[i]["type"] === "<=") {
            if(value <= val_css[i]["than"]) {
              options_css = val_css[i]["css"];
              break;
            };
          } else if(val_css[i]["type"] === ">=") {
            if(value >= val_css[i]["than"]) {
              options_css = val_css[i]["css"];
              break;
            };
          } else if(val_css[i]["type"] === "<") {
            if(value < val_css[i]["than"]) {
              options_css = val_css[i]["css"];
              break;
            };
          } else if(val_css[i]["type"] === ">") {
            if(value > val_css[i]["than"]) {
              options_css = val_css[i]["css"];
              break;
            };
          };
        };
      };

      ret.append( $(SPAN).text(value).css(css).css(options_css) );
    };
  };

  if(coldata['ic_type'] == "tag" || coldata['ic_type'] == "multitag") {
    ret.addClass("tagset");
    let tag_ids = [];
    if(String(value).trim() != "") {
      tag_ids = String(value).split(",");
      for(let i in tag_ids) {
        let tag_id = tag_ids[i];
        let tag = get_tag_elm(tag_id, can_edit && state);
        tag.css(css).appendTo(ret);
      };
    };

    if(can_edit && state) {
      ret
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus", "add_tag_btn"])
         .click(function(e) {
           e.stopPropagation();

           let tagset = $(this).closest(".tagset");
           let col_id= tagset.data("col_id");
           let coldata = g_data['net_cols'][col_id];
           let collection = String(coldata['ic_options']).trim().toLowerCase();
           if(collection === "") collection = null;
           select_tag(collection, null, function(tag_id) {
             if(tag_id !== null) {
               get_tag_elm(tag_id, true).insertBefore(tagset.find(".add_tag_btn"));
               tagset.trigger("recalc");
             };
           });
         })
         .toggle(tag_ids.length == 0 || coldata['ic_type'] == "multitag")
       )
       .on("recalc", function() {
         let tagset = $(this).closest(".tagset");
         let list = [];
         tagset.find(".tag").each(function() {
           list.push($(this).data("tag_id"));
         });

         let col_id = tagset.data("col_id");
         let coldata = g_data['net_cols'][col_id];

         tagset.find(".add_tag_btn").toggle(list.length == 0 || coldata['ic_type'] == "multitag");

         tagset.find("INPUT[type=hidden]").val(list.join(",")).trigger("input_stop");
       })
      ;
    };
  };

  ret.addClass("ip_value");
  ret.data("col_id", col_id);
  ret.data("title", title);

  return ret;
};

function editable_elm(data, edit) {
  let ret_elm = $(SPAN).addClass("editable");
  ret_elm.addClass("wsp");
  let ret;
  let value = "";

  if(data['object'] == 'net' && data['prop'] == 'v4net_descr') {
    value = g_data[ 'net_descr' ];
  } else if(data['object'] == 'net' && data['prop'] == 'v4net_name') {
    value = g_data[ 'net_name' ];
  } else if(data['object'] == 'net' && data['prop'] == 'v4net_owner') {
    value = g_data[ 'net_owner' ];
  } else if(data['object'] == 'net' && data['prop'] == 'v4net_tags') {
    value = String(g_data[ 'net_tags' ]).trim();
  } else if(data['object'] == 'vdom' && data['prop'] == 'vd_name') {
    value = g_data[ 'vd_name' ];
  } else if(data['object'] == 'vdom' && data['prop'] == 'vd_descr') {
    value = g_data[ 'vd_descr' ];
  } else if(data['object'] == 'ic') {
    value = g_data['ics'][ data['id'] ][ data['prop'] ];
  } else if(data['object'] == 'tp') {
    value = g_data['tps'][ data['id'] ][ data['prop'] ];
  } else if(data['object'] == 'oob') {
    value = data['value'];
  } else if(data['value'] !== undefined) {
    value = data['value'];
  } else {
    error_at("Unknown object: "+data['object']+" prop: "+data['prop']);
    return;
  };
  if(edit) {
    if(data['object'] == 'net' && data['prop'] == 'v4net_descr') {
      ret = $(TEXTAREA);
    } else if(data['object'] == 'vdom' && data['prop'] == 'vd_descr') {
      ret = $(TEXTAREA);
    } else if(data['object'] == 'oob' && data['prop'] == 'tags') {
      ret = $(INPUT).prop("type", "hidden");
    } else if(data['object'] == 'net' && data['prop'] == 'v4net_tags') {
      ret = $(INPUT).prop("type", "hidden");
    } else if(data['object'] == 'net' && data['prop'] == 'v4net_owner') {
      ret = $(SELECT);
      ret.append( $(OPTION).text("не задан").val(0) );
      run_query({"action": "users_list"}, function(res) {

        for(let i in res['ok']['users_list']) {
          let u_id = res['ok']['users_list'][i]['u_id'];
          if(g_data['aux_userinfo'][u_id] === undefined) {
            g_data['aux_userinfo'][u_id] = res['ok']['users_list'][i];
          };
          ret.append( $(OPTION).val(u_id).text(res['ok']['users_list'][i]['u_name']+" ("+res['ok']['users_list'][i]['u_login']+")") );
        };

        ret.val(value);
        ret.on("select change", function() { $(this).trigger("input_stop"); });
      });
    } else if(data['_input'] !== undefined && String(data['_input']).toLowerCase() == 'hidden') {
      ret = $(INPUT).prop("type", "hidden");
    } else if(data['_input'] !== undefined && String(data['_input']).toLowerCase() == 'textarea') {
      ret = $(TEXTAREA);
      ret.addClass("wsp");
    } else {
      ret = $(INPUT).css("font-size", "inherit");
      if(data['_placeholder'] !== undefined) {
        ret.prop("placeholder", data['_placeholder'])
      };
    };
    ret_elm.addClass("editable_edit");
    ret.val(value);
    ret.saveable(data);
    ret.keyup(function(e) {
      if(e.key === "Escape") {
        e.stopPropagation();
        $(this).trigger("editable_toggle");
      };
    });
    if(data['_edit_css'] !== undefined) {
      ret.css(data['_edit_css']);
    };
    if(data['_edit_classes'] !== undefined) {
      ret.addClass(data['_edit_classes']);
    };
  } else {
    ret = $(SPAN);
    ret_elm.addClass("editable_view");
    if(data['object'] == 'net' && data['prop'] == 'v4net_owner') {
      if(value == 0) {
        ret.text("не задан");
      } else if(g_data['aux_userinfo'][value] !== undefined) {
        ret.text(g_data['aux_userinfo'][value]['u_name']+" ("+
                 g_data['aux_userinfo'][value]['u_login']+")"
        );
      } else {
        ret.text("нет данных");
      };
    } else if(data['object'] == 'net' && data['prop'] == 'v4net_tags') {
    } else if(data['object'] == 'oob' && data['prop'] == 'tags') {
    } else if(data['_input'] !== undefined && String(data['_input']).toLowerCase() == 'textarea') {
      let lines = String(value).split("\n");
      ret.text(lines[0]);
      ret.title(value);
    } else {
      ret.text(value);
    };
    if(data['_view_css'] !== undefined) {
      ret.css(data['_view_css']);
    };
    if(data['_view_classes'] !== undefined) {
      ret.addClass(data['_view_classes']);
    };
    ret_elm
     .on("click dblclick", function(e) {
       if ((e.type == "click" && e.ctrlKey) ||
           e.type == "dblclick"
       ) {
         e.stopPropagation();
         $(this).trigger("editable_toggle");
       };
     })
    ;
  };
  ret_elm.data("editable_data", data);
  ret_elm.on("editable_toggle", function() {
    let data = $(this).data("editable_data");
    if(data['object'] == 'net') {
      if( (g_data['net_rights'] & R_MANAGE_NET) == 0 ) return;
    } else if(data['object'] == 'oob') {
      if((userinfo['g_oobs_rights'] & R_EDIT_IP_VLAN) == 0) return;
    } else if(data['object'] == 'vdom') {
      if(!userinfo['is_admin']) return;
    };
    let new_state = $(this).hasClass("editable_view");
    if(!new_state && $(this).find(".autosave").data("autosave_changed") === true) {
      g_autosave_changes--;
      if(g_autosave_changes < 0) {
        error_at();
        return;
      } else if(g_autosave_changes == 0) {
        $("#autosave_btn").css({"color": "gray"});
      } else {
        $("#autosave_btn").css({"color": "yellow"});
      };
      $(this).closest(".unsaved_elm").removeClass("unsaved");
      if(data !== undefined && data["_changed_show"] !== undefined) {
        $(data["_changed_show"]).hide();
      };
      if(data !== undefined && data["_unchanged_show"] !== undefined) {
        $(data["_unchanged_show"]).show();
      };
    };
    let new_elm = editable_elm(data, new_state);
    $(this).replaceWith( new_elm );
    if(new_state) new_elm.find(".autosave").focus();
  });

  if(data['_elm_id'] !== undefined) {
    ret.prop('id', data['_elm_id']);
  };

  if((data['object'] == 'net' && data['prop'] == 'v4net_tags') ||
     (data['object'] == 'oob' && data['prop'] == 'tags')
  ) {
    ret_elm.addClass("tagset");
    if(value !== "") {
      let list = value.split(",");
      for(let i in list) {
        let tag_id = list[i];
        let tag = get_tag_elm(tag_id, edit);
        tag.appendTo(ret_elm);
      };
    };

    if(edit) {
      ret_elm
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus", "add_tag_btn"])
         .click(function(e) {
           e.stopPropagation();

           let tagset = $(this).closest(".tagset");
           select_tag(null, null, function(tag_id) {
             if(tag_id !== null) {
               get_tag_elm(tag_id, true).insertBefore(tagset.find(".add_tag_btn"));
               tagset.trigger("recalc");
             };
           });
         })
       )
       .on("recalc", function() {
         let tagset = $(this).closest(".tagset");
         let list = [];
         tagset.find(".tag").each(function() {
           list.push($(this).data("tag_id"));
         });

         tagset.find("INPUT[type=hidden]").val(list.join(",")).trigger("input_stop");
       })
      ;
    };
  };

  ret_elm.append(ret);
  return ret_elm;
};

function edit_rights(object, object_id, allow_edit, on_done) {
  run_query({'action': 'get_rights', 'object': object, 'object_id': String(object_id)}, function(res) {

    let dialog = $(DIV).addClass("dialog_start")
     .data('object', object)
     .data('object_id', object_id)
     .data('on_done', on_done)
     .data('groups', res['ok']['groups'])
    ;

    switch(object) {
    case "v4net_acl":
      dialog.title("Права доступа к сети: "+v4long2ip(g_data['net_addr'])+"/"+g_data['net_masklen']+" "+
                   g_data['net_name']
      );
      break;
    default:
      error_at("Object:"+object+" is not implemented");
    };

    let table = $(DIV).addClass("table")
     .appendTo(dialog)
    ;

    let change_check = "";

    let not_in_list = [];

    let k_a = keys(res['ok']['groups']);
    sort_by_string_key(k_a, res['ok']['groups'], 'g_name');

    for(let i in k_a) {
      let g_id = k_a[i];
      if(res['ok']['groups'][g_id]['rights'] == 0) {
        not_in_list.push(g_id);
        continue;
      };
      change_check += g_id+":"+res['ok']['groups'][g_id]['rights']+";";
      table.append( rights_row(object, object_id, res['ok']['groups'][g_id], allow_edit) );
    };

    dialog.data("change_check", change_check);

    if(allow_edit) {
      let last_row = $(DIV).addClass("tr");

      let select = $(SELECT)
       .append( $(OPTION).text("Выберете группу...").val(0) )
       .val(0)
       .tooltip({
         classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
         items: "SELECT",
         content: function() {
           return $(this).find("OPTION:selected").prop("title");
         }
       })
      ;

      for(let i in not_in_list) {
        let g_id = not_in_list[i];
        select
         .append( $(OPTION)
           .text(res['ok']['groups'][g_id]['g_name'])
           .title(res['ok']['groups'][g_id]['g_descr'])
           .val(g_id)
         )
        ;
      };

      last_row
       .append( $(SPAN).addClass("td")
         .append( select )
       )
      ;

      last_row
       .append( rights_tds(object, 0, true) )
      ;

      last_row
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .click(function() {
             let dialog = $(this).closest(".dialog_start");
             let select = dialog.find("SELECT");
             let option = select.find(":selected");
             let tr = $(this).closest(".tr");
             let g_id = select.val();
             if(g_id == 0) return;

             let this_rights = 0;

             tr.find(".right").each(function() {
               if( $(this).hasClass("right_on") ) {
                 this_rights = this_rights | $(this).data("right");
               };
             });

             if(this_rights == 0) return;

             let new_g_data = dialog.data("groups")[g_id];
             new_g_data['_new'] = true;
             new_g_data['rights'] = this_rights;
             let new_row = rights_row(dialog.data("object"), dialog.data("object_id"),
               new_g_data, true
             );
             new_row.insertBefore(tr);
             option.remove();
           })
         )
       )
      ;

      table.append( last_row );
    };

    let buttons = [];

    if(allow_edit) {
      buttons.push({
        'text': 'Сохранить',
        'click': function() {
          let dlg = $(this);

          let rights = {};

          dlg.find(".rights_row").each(function() {
            let this_rights = 0;
            $(this).find(".right").each(function() {
              if($(this).hasClass("right_on")) {
                let right = $(this).data("right");
                this_rights |= right;
              };
            });
            if(this_rights > 0) {
              let group = $(this).data("group");
              rights[ group['g_id'] ] = String(this_rights);
            };
          });

          let change_check = "";
          let groups = dlg.data("groups");
          let k_a = keys(res['ok']['groups']);
          sort_by_string_key(k_a, res['ok']['groups'], 'g_name');

          for(let i in k_a) {
            let g_id = k_a[i];
            if(rights[g_id] !== undefined) {
              change_check += g_id+":"+rights[g_id]+";";
            };
          };

          if(change_check === dlg.data("change_check")) {
            dlg.animateHighlight("lightcoral", 200);
            return;
          };

          run_query({
            "action": "set_rights",
            "object": dlg.data("object"),
            "object_id": dlg.data("object_id"),
            "rights": rights
          }, function(res) {
            let done_func = dlg.data("on_done");
            dlg.dialog( "close" );
            if(done_func !== undefined) done_func();
          });
        },
      });
    };

    buttons.push({
      'text': allow_edit?'Отмена':'Закрыть',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      maxHeight:1000,
      maxWidth:1800,
      minWidth:1200,
      width: "auto",
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );
  });
};

function rights_tds(object, rights_mask, allow_edit=false, elm_class="td", row_class="tr") {
  let ret = $([]);
  for(let i in r_keys) {
    let right = r_keys[i];
    if(!in_array(g_rights[right]['used_in'], object)) continue;
    let rclass = ((rights_mask & right) > 0)?"right_on":"right_off";
    ret = ret
     .add( $(SPAN).addClass(elm_class)
       .append( $(SPAN).addClass(["right", rclass, "ns", "right_"+right])
         .data("right", right)
         .data("row_class", row_class)
         .text(g_rights[right]['label'])
         .title(g_rights[right]['descr'])
         .click(!allow_edit?undefined:function() {
           let row_class = $(this).data("row_class");
           let row = $(this).closest("."+row_class);
           let right = $(this).data("right");
           if($(this).hasClass("right_on")) {
             $(this).removeClass("right_on").addClass("right_off");

             for(let i in g_rights[right]['required_by']) {
               let rr = g_rights[right]['required_by'][i];
               row.find(".right_"+rr).removeClass("right_on").addClass("right_off");
             };
           } else {
             $(this).removeClass("right_off").addClass("right_on");
             for(let i in g_rights) {
               if(in_array(g_rights[i]['required_by'], right)) {
                 row.find(".right_"+i).removeClass("right_off").addClass("right_on");
               };
             };
             for(let i in g_rights[right]['conflict_with']) {
               let rr = g_rights[right]['conflict_with'][i];
               row.find(".right_"+rr).removeClass("right_on").addClass("right_off");
             };
           };
           row.trigger("recalc");
         })
       )
     )
    ;
  };
  return ret;
};

function rights_row(object, object_id, group_data, allow_edit=false) {
  let ret = $(DIV).addClass("tr").addClass("rights_row")
   .data("object", object)
   .data("object_id", object_id)
   .data("group", group_data)
  ;

  let title = group_data['g_descr'];
  if(group_data['fk_u_id'] !== undefined && group_data['fk_u_id'] !== null &&
     g_data['aux_userinfo'][ group_data['fk_u_id'] ] !== undefined
  ) {
    title += "\nДоступ добавлен: "+from_unix_time(group_data['ts'], false, "н.д.");
    title += "\nПользователем: "+g_data['aux_userinfo'][ group_data['fk_u_id'] ]['u_name']+" ("+
             g_data['aux_userinfo'][ group_data['fk_u_id'] ]['u_login']+")";
  } else if (group_data['_new'] !== undefined) {
    title += "\nДоступ добавлен: "+from_unix_time(unix_timestamp());
    title += "\nВами, только что";
  };

  ret
   .append( $(SPAN).addClass("td")
     .append( $(SPAN)
       .text(group_data['g_name'])
       .title(title)
     )
   )
  ;

  ret.append( rights_tds(object, group_data['rights'], allow_edit) );

  if(allow_edit) {
    ret
     .append( $(SPAN).addClass("td")
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-minus"])
         .click(function() {
           let dlg = $(this).closest(".dialog_start");
           let group = $(this).closest(".tr").data("group");
           let select = dlg.find("SELECT");
           select
            .append( $(OPTION)
              .text( group['g_name'] )
              .title( group['g_descr'] )
              .val( group['g_id'] )
            )
           ;
           $(this).closest(".tr").remove();
         })
       )
     )
    ;
  };

  return ret;
};

function edit_net_range(object, object_id) {
  let allow_edit = false;
  switch(object) {
  case "int_v4net_range":
    allow_edit = (g_data['net_rights'] & R_MANAGE_NET) > 0;
    break;
  case "ext_v4net_range":
    allow_edit = userinfo["is_admin"];
    break;
  default:
    error_at(object);
    return;
  };

  let query;
  if(object_id !== undefined) {
    query = {"action": "get_net_range", "object": object, "object_id": object_id};
  } else {
    query = {"action": "get_groups"};
  };
  run_query(query, function(res) {

    if(res['ok']['aux_userinfo'] !== undefined) {
      if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
      for(let u_id in res['ok']['aux_userinfo']) {
        g_data['aux_userinfo'][u_id] = res['ok']['aux_userinfo'][u_id];
      };
    };

    if(object_id === undefined) {
      let r_start;
      let r_stop;
      let style;

      switch(object) {
      case "int_v4net_range":
        r_start = g_data['net_addr'];
        r_stop = g_data['net_last_addr'];
        style = JSON.stringify(g_default_range_style);
        break;
      case "ext_v4net_range":
        r_start = g_data['net_addr'];
        r_stop = g_data['net_last_addr'];
        style = JSON.stringify(g_default_ext_range_style);

        break;
      default:
        error_at();
        return;
      };

      let groups = {};
      for(let i in res["ok"]["gs"]) {
        let g_id= res["ok"]["gs"][i]["g_id"];
        groups[g_id] = res["ok"]["gs"][i];
        groups[g_id]['rights'] = 0;
        groups[g_id]['ts'] = undefined;
        groups[g_id]['fk_u_id'] = null;
      };

      res = {
        "ok": {
          "groups": groups,
          "v4r_start": r_start,
          "v4r_stop": r_stop,
          "v4r_name": "",
          "v4r_descr": "",
          "v4r_id": undefined,
          "v4r_style": style,
          "v4r_icon": g_default_range_icon,
          "v4r_icon_style": JSON.stringify(g_default_range_icon_style),
          "ts": 0,
          "fk_u_id": null,
        }
      };
    };

    let title = "Диапазон адресов";
    switch(object) {
    case "int_v4net_range":
      title += " для сети "+g_data['net_name'];
      break;
    case "ext_v4net_range":
      break;
    default:
      error_at();
      return;
    };

    let dialog = $(DIV).addClass("dialog_start")
     .title(title)
     .data('object', object)
     .data('object_id', object_id)
     .data('groups', res['ok']['groups'])
     .data('r_data', res['ok'])
    ;

    $(DIV)
     .append( $(SPAN).text("Посл. изменение: ") )
     .append( $(SPAN).text(from_unix_time( res['ok']['ts'], false, 'н.д.' )) )
     .append( $(SPAN).addClass("min1em") )
     .append( res['ok']['fk_u_id'] === null?$(SPAN):$(SPAN)
       .text(
         g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_name']+" ("+
         g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_login']+")"
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("Диапазон: ") )
     .append( $(INPUT)
       .prop({"id": "r_start", "placeholder": v4long2ip(res['ok']['v4r_start']), "readonly": !allow_edit})
       .val(v4long2ip(res['ok']['v4r_start']))
     )
     .append( $(SPAN).text(" - ") )
     .append( $(INPUT)
       .prop({"id": "r_stop", "placeholder": v4long2ip(res['ok']['v4r_stop']), "readonly": !allow_edit})
       .val(v4long2ip(res['ok']['v4r_stop']))
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("Название: ") )
     .append( $(INPUT)
       .prop({"id": "r_name", "readonly": !allow_edit})
       .val(res['ok']['v4r_name'])
     )
     .appendTo( dialog )
    ;

    let css;
    try {
      css = JSON.parse(res['ok']['v4r_style']);
    } catch(e) {
      css = g_default_range_style;
    };

    let sample_label;

    switch(object) {
    case "int_v4net_range":
      sample_label = $(LABEL).addClass("iprange")
       .html('&#x200b;')
       .prop("id", "r_style_sample")
       .css({"width": g_range_bar_width+"px", "margin-right": g_range_bar_width+"px"})
      ;
      break;
    case "ext_v4net_range":
      sample_label = $(LABEL)
       .html('&#x2503;')
       .prop("id", "r_style_sample")
      ;
      break;
    default:
      error_at();
      return;
    };

    $(DIV)
     .append( $(SPAN).html("CSS колонки: ").title("Например: {\"background-color\": \"red\"}") )
     .append( $(INPUT)
       .prop({"id": "r_style", "readonly": !allow_edit})
       .val(res['ok']['v4r_style'])
       .on("input change keyup", function() {
         let j = $(this).val();
         try {
           css = JSON.parse(j);
           $("#r_style_sample").css(css);
           $("#r_style_error").hide();
           $(this).css("background-color", "white");
         } catch(e) {
           $("#r_style_error").show();
           $(this).css("background-color", "lightcoral");
         };
       })
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .css({"position": "relative"})
       .append( sample_label )
     )
     .append( $(SPAN)
       .css({"padding-left": g_range_bar_width+g_range_bar_width+2+"px"})
       .append( $(LABEL)
         .prop("id", "r_style_error")
         .addClass(["ui-icon", "ui-icon-alert"])
         .css({"color": "red"})
         .title("Неверный JSON стиля")
         .hide()
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(A)
       .prop({"href": "https://mkkeck.github.io/jquery-ui-iconfont/#icons", "target": "_blank"})
       .dotted("Выбрать можно тут")
       .text("Значек диапазона ui-icon-*: ")
     )
     .append( $(INPUT)
       .prop({"id": "r_icon", "readonly": !allow_edit})
       .val(res['ok']['v4r_icon'])
       .on("input change keyup", function() {
         let v = $(this).val();
         let j = $("#r_icon_style").val();
         let css;
         try {
           css = JSON.parse(j);
           $("#r_icon_style").css("background-color", "white");
           $("#r_icon_style_error").hide();
         } catch(e) {
           $("#r_icon_style").css("background-color", "lightcoral");
           $("#r_icon_style_error").show();
           switch( $(this).closest(".dialog_start").data("object") ) {
           case "int_v4net_range":
             css = g_default_range_icon_style;
             break;
           case "ext_v4net_range":
             css = g_default_range_icon_style;
             break;
           default:
             error_at();
             return;
           };
         };
         if(!String(v).match(/^ui-icon-[\-a-z0-9]+$/)) {
           $("#r_icon").css("background-color", "lightcoral");
           $("#r_icon_error").show();
           $("#r_icon_span").empty();
         } else {
           $("#r_icon").css("background-color", "white");
           $("#r_icon_error").hide();
           $("#r_icon_span")
            .empty()
            .append( $(LABEL)
              .addClass(["ui-icon", v])
              .css(css)
            )
           ;
         };
       })
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .prop("id", "r_icon_span")
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .append( $(LABEL)
         .prop("id", "r_icon_error")
         .addClass(["ui-icon", "ui-icon-alert"])
         .css({"color": "red"})
         .title("Неверный класс значка. Должен начинаться на ui-icon-")
         .hide()
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("CSS значка диапазона: ").title("Например: {\"color\": \"red\"}") )
     .append( $(INPUT)
       .prop({"id": "r_icon_style", "readonly": !allow_edit})
       .val(res['ok']['v4r_icon_style'])
       .on("input change keyup", function() {
         $("#r_icon").trigger("input");
       })
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .append( $(LABEL)
         .prop("id", "r_icon_style_error")
         .addClass(["ui-icon", "ui-icon-alert"])
         .css({"color": "red"})
         .title("Неверный JSON значка")
         .hide()
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("Описание: ").css("vertical-align", "top") )
     .append( $(TEXTAREA)
       .prop({"id": "r_descr", "readonly": !allow_edit})
       .val(res['ok']['v4r_descr'])
     )
     .appendTo( dialog )
    ;

    $(DIV).text("Права доступа:")
     .css({"margin-top": "0.5em", "margin-bottom": "0.5em"})
     .appendTo( dialog )
    ;

    let table = $(DIV).addClass("table")
     .appendTo(dialog)
    ;

    let not_in_list = [];

    let k_a = keys(res['ok']['groups']);
    sort_by_string_key(k_a, res['ok']['groups'], 'g_name');

    for(let i in k_a) {
      let g_id = k_a[i];
      if(res['ok']['groups'][g_id]['rights'] == 0) {
        not_in_list.push(g_id);
        continue;
      };
      table.append( rights_row(object, object_id, res['ok']['groups'][g_id], allow_edit) );
    };

    if(allow_edit) {
      let last_row = $(DIV).addClass("tr");

      let select = $(SELECT)
       .append( $(OPTION).text("Выберете группу...").val(0) )
       .val(0)
       .tooltip({
         classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
         items: "SELECT",
         content: function() {
           return $(this).find("OPTION:selected").prop("title");
         }
       })
      ;

      for(let i in not_in_list) {
        let g_id = not_in_list[i];
        select
         .append( $(OPTION)
           .text(res['ok']['groups'][g_id]['g_name'])
           .title(res['ok']['groups'][g_id]['g_descr'])
           .val(g_id)
         )
        ;
      };

      last_row
       .append( $(SPAN).addClass("td")
         .append( select )
       )
      ;

      last_row
       .append( rights_tds(object, 0, true) )
      ;

      last_row
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .click(function() {
             let dialog = $(this).closest(".dialog_start");
             let select = dialog.find("SELECT");
             let option = select.find(":selected");
             let tr = $(this).closest(".tr");
             let g_id = select.val();
             if(g_id == 0) return;

             let this_rights = 0;

             tr.find(".right").each(function() {
               if( $(this).hasClass("right_on") ) {
                 this_rights = this_rights | $(this).data("right");
                 $(this).removeClass("right_on").addClass("right_off");
               };
             });

             if(this_rights == 0) return;

             let new_g_data = dialog.data("groups")[g_id];
             new_g_data['_new'] = true;
             new_g_data['rights'] = this_rights;
             let new_row = rights_row(dialog.data("object"), dialog.data("object_id"),
               new_g_data, true
             );
             new_row.insertBefore(tr);
             option.remove();
           })
         )
       )
      ;

      table.append( last_row );
    };

    let buttons = [];

    if(allow_edit && object_id !== undefined) {
      buttons.push({
        'class': 'left_dlg_button',
        'text': 'Удалить',
        'click': function() {
          let dlg = $(this);
          let object = dlg.data("object");

          show_confirm("Подтвердите удаление диапазона.\nВнимание: отмена операции будет невозможна!", function() {
            run_query({"action": "del_net_range", "object": dlg.data("object"), "object_id": String(dlg.data("object_id"))}, function(res) {

              dlg.dialog( "close" );

              switch(object) {
              case "int_v4net_range":
                window.location = "?action=view_v4&net="+g_data['net_addr']+"&masklen="+g_data['net_masklen']+
                                  (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
                break;
              case "ext_v4net_range":
                window.location = "?action=nav_v4&net="+g_data['net_addr']+"&masklen="+g_data['net_masklen']+
                                  (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
                break;
              default:
                error_at();
                return;
              };
            });
          });
        },
      });
    };

    if(allow_edit) {
      buttons.push({
        'text': object_id===undefined?'Создать':'Сохранить',
        'click': function() {
          let dlg = $(this);

          let rights = {};

          if(dlg.find("SELECT").val() != 0 &&
            dlg.find("SELECT").closest(".tr").find(".right_on").length > 0
          ) {
            dlg.find("SELECT").closest(".tr").animateHighlight("lightcoral", 200);
            return;
          };

          dlg.find(".rights_row").each(function() {
            let this_rights = 0;
            $(this).find(".right").each(function() {
              if($(this).hasClass("right_on")) {
                let right = $(this).data("right");
                this_rights |= right;
              };
            });
            if(this_rights > 0) {
              let group = $(this).data("group");
              rights[ group['g_id'] ] = String(this_rights);
            };
          });

          let r_start = v4ip2long($("#r_start").val());
          if(r_start === false) {
            $("#r_start").animateHighlight("red", 300);
            return;
          };

          let r_stop = v4ip2long($("#r_stop").val());
          if(r_stop === false) {
            $("#r_stop").animateHighlight("red", 300);
            return;
          };

          if(r_stop < r_start) {
            $("#r_start,#r_stop").animateHighlight("red", 300);
            return;
          };

          let object = dlg.data("object");

          switch(object) {
          case "int_v4net_range":
            if(r_start < g_data['net_addr']) {
              $("#r_start").animateHighlight("red", 300);
              return;
            };
            if(r_stop > g_data['net_last_addr']) {
              $("#r_stop").animateHighlight("red", 300);
              return;
            };
            break;
          case "ext_v4net_range":
            break;
          default:
            error_at();
            return;
          };

          try {
            JSON.parse(String($("#r_style").val()).trim());
          } catch(e) {
            $("#r_style").animateHighlight("red", 300);
            return;
          };

          try {
            JSON.parse(String($("#r_icon_style").val()).trim());
          } catch(e) {
            $("#r_icon_style").animateHighlight("red", 300);
            return;
          };

          if(!String($("#r_icon").val()).trim().match(/^ui-icon-[\-a-z0-9]+$/)) {
            $("#r_icon").animateHighlight("red", 300);
            return;
          };

          let query = {
            "action": "save_range",
            "object": dlg.data("object"),
            "object_id": dlg.data("object_id")===undefined?"":String(dlg.data("object_id")),
            "net_id": dlg.data("object") === "int_v4net_range"?String(g_data['net_id']):null,
            "rights": rights,
            "r_start": String(r_start),
            "r_stop": String(r_stop),
            "r_name": String($("#r_name").val()).trim(),
            "r_descr": String($("#r_descr").val()).trim(),
            "r_style": String($("#r_style").val()).trim(),
            "r_icon": String($("#r_icon").val()).trim(),
            "r_icon_style": String($("#r_icon_style").val()).trim(),
          };
          run_query(query, function(res) {
            dlg.dialog( "close" );

            switch(object) {
            case "int_v4net_range":
              window.location = "?action=view_v4&net="+g_data['net_addr']+"&masklen="+g_data['net_masklen']+
                                (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
              break;
            case "ext_v4net_range":
              window.location = "?action=nav_v4&net="+g_data['net_addr']+"&masklen="+g_data['net_masklen']+
                                (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
              break;
            default:
              error_at();
              return;
            };
          });
        },
      });
    };

    buttons.push({
      'text': allow_edit?'Отмена':'Закрыть',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      maxHeight:1000,
      maxWidth:1800,
      minWidth:1200,
      width: "auto",
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );

    $("#r_style").trigger("input");
    $("#r_icon").trigger("input");
  });
};

function take_v4net(net, masklen) {
  run_query({"action": "list_net_templates"}, function(res) {
    if(res['ok']['templates'].length == 0) {
      show_dialog("В БД нет ни одного шаблона сети. Обратитесь к администратору.");
      return;
    };

    let dialog = $(DIV).addClass("dialog_start")
     .title("Занятие сети "+v4long2ip(net)+"/"+masklen)
     .data("net", net)
     .data("masklen", masklen)
    ;

    let select = $(SELECT)
     .append( $(OPTION).text("Выберите шаблон...").val(0) )
     .val(0)
    ;
    for(let i in res['ok']['templates']) {
      select
       .append( $(OPTION).text(res['ok']['templates'][i]['tp_name'])
         .val(res['ok']['templates'][i]['tp_id'])
       )
      ;
    };

    dialog
     .append( $(DIV)
       .append( select )
     )
    ;

    let buttons = [];
    buttons.push({
      'text': 'Занять',
      'click': function() {
        let dlg = $(this);
        let net = dlg.data("net");
        let masklen = dlg.data("masklen");
        let tp_id = dlg.find("SELECT").val();

        if(tp_id == 0) {
          dlg.find("SELECT").animateHighlight("red", 200);
          return;
        };

        run_query({"action": "take_net", "v": "4", "tp_id": String(tp_id),
                   "net": String(net), "masklen": String(masklen)},
                  function(res) {
          window.location = "?action=view_v4&net="+net+"&masklen="+masklen+"&is_new"+
                            (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
        });
      }, //click: function
    });

    buttons.push({
      'text': 'Отмена',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      //maxHeight:1000,
      //maxWidth:1800,
      minWidth: 600,
      width: 600,
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );
     
  });
};

function net_cols_edit() {
  run_query({"action": "get_netcols"}, function(res) {

    let dialog = $(DIV).addClass("dialog_start")
     .title("Выбор полей для сети "+v4long2ip(g_data['net_addr'])+"/"+g_data['net_masklen'])
    ;

    let table = $(DIV).addClass("table")
     .append( $(DIV).addClass("thead")
       .append( $(SPAN).addClass("th").text("Поле") )
       .append( $(SPAN).addClass("th").text("Вкл") )
       .append( $(SPAN).addClass("th").text("Тип") )
       .append( $(SPAN).addClass("th").text("RegExp") )
     )
     .appendTo(dialog)
    ;

    for(let i in res['ok']['netcols']) {
      let ic_id = res['ok']['netcols'][i]['ic_id'];

      let tr = $(DIV).addClass("tr")
       .append( $(SPAN).addClass("td")
         .append( $(SPAN)
           .text(res['ok']['netcols'][i]['ic_name'])
           .title(res['ok']['netcols'][i]['ic_descr']+"\n"+"API name: "+res['ok']['netcols'][i]['ic_api_name'])
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(INPUT)
           .data("ic_id", ic_id)
           .data("initial", g_data['net_cols'][ic_id] !== undefined)
           .prop({"type": "checkbox", "checked": g_data['net_cols'][ic_id] !== undefined})
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(SPAN)
           .text(res['ok']['netcols'][i]['ic_type'])
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(SPAN)
           .text(res['ok']['netcols'][i]['ic_regexp'])
         )
       )
       .appendTo(table)
      ;
    };

    let buttons = [];
    buttons.push({
      'text': 'Сохранить',
      'click': function() {
        let dlg = $(this);

        let on=[];
        let off=[];

        dlg.find("INPUT[type=checkbox]").each(function() {
          let ic_id = $(this).data("ic_id");
          let state = $(this).is(":checked");
          let initial = $(this).data("initial");

          if(state !== initial) {
            if(state) {
              on.push(String(ic_id));
            } else {
              off.push(String(ic_id));
            };
          };
        });

        if(on.length > 0 || off.length > 0) {
          show_confirm_checkbox("Внимание!\nОтключение полей приведет к удалению ВСЕХ данных,\nсвязаных с IP адресами и отключаемыми полями для данной сети!\n"+
                                "Отмена будет невозможна!", function() {
            run_query({"action": "net_set_cols", "net_id": String(g_data['net_id']), "v": g_data["v"], "on": on, "off": off}, function(res) {
              window.location = "?action=view_v"+g_data["v"]+"&net="+g_data['net_addr']+"&masklen="+g_data['net_masklen']+
                                (usedonly?"&usedonly":"")+(DEBUG?"&debug":"");
            });
          }, {}, off.length == 0);
        } else {
          dlg.dialog( "close" );
        };
      },
    });

    buttons.push({
      'text': 'Отмена',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      //maxHeight:1000,
      //maxWidth:1800,
      minWidth: 600,
      width: 600,
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );
     
  });
};

function actionVlanDomains() {
  workarea.empty();
  fixed_div.empty();

  run_query({"action": "list_vlan_domains"}, function(res) {
    if(res['ok']['aux_userinfo'] !== undefined) {
      if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
      for(let u_id in res['ok']['aux_userinfo']) {
        g_data['aux_userinfo'][u_id] = res['ok']['aux_userinfo'][u_id];
      };
    };

    g_data = res['ok'];

    let table = $(DIV).addClass("table")
     .css({"font-size": "larger"})
     .append( $(DIV).addClass("thead")
       .append( $(SPAN).addClass("th")
         .text("VLAN домен")
       )
       .append( $(SPAN).addClass("th")
         .text("Занято")
       )
       .append( $(SPAN).addClass("th")
         .text("Сетей v4")
       )
       .append( $(SPAN).addClass("th")
         .text("Адресов v4")
       )
       .append( $(SPAN).addClass("th")
         .text("Сетей v6")
       )
       .append( $(SPAN).addClass("th")
         .text("Адресов v6")
       )
     )
     .appendTo(workarea)
    ;

    for(let i in res['ok']['vds']) {
      let vd = res['ok']['vds'][i];
      let tr = $(DIV).addClass("tr")
       .data("id", vd['vd_id'])
      ;

      tr
       .append( $(SPAN).addClass("td")
         .append( $(A)
           .addClass("vd"+vd['vd_id'])
           .prop("href", "?action=view_vlan_domain&id="+vd['vd_id']+(DEBUG?"&debug":""))
           .text(vd['vd_name'])
           .title(vd['vd_descr'])
         )
       )
       .append( $(SPAN).addClass("td")
         .text(vd['num_taken'])
       )
       .append( $(SPAN).addClass("td")
         .text(vd['v4nets'])
       )
       .append( $(SPAN).addClass("td")
         .text(vd['v4ips'])
       )
       .append( $(SPAN).addClass("td")
         .text(vd['v6nets'])
       )
       .append( $(SPAN).addClass("td")
         .text(vd['v6ips'])
       )
      ;

      tr.appendTo(table);
    };

    if(userinfo['is_admin']) {
      let tr = $(DIV).addClass("tr")
       .append( $(SPAN).addClass("td")
         .append( $(INPUT).addClass("new_vlan_domain_name")
           .enterKey(function() {
             $(".vd_add_btn").trigger("click")
           })
         )
         .append( $(SPAN).addClass("min1em") )
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .addClass("vd_add_btn")
           .title("Добавить")
           .click(function() {
             let new_vd_name = $("INPUT.new_vlan_domain_name").val();
             if(new_vd_name === undefined) { error_at(); return; };
             new_vd_name = String(new_vd_name).trim();
             if(!new_vd_name.match(/^[a-zA-Z][a-zA-Z_0-9]*$/)) {
               $("INPUT.new_vlan_domain_name").animateHighlight("red", 300);
               return;
             };

             for(let i in g_data['vds']) {
               if(String(g_data['vds'][i]['vd_name']).toLowerCase() == new_vd_name.toLowerCase()) {
                 $(".vd"+g_data['vds'][i]['vd_id']+",INPUT.new_vlan_domain_name").animateHighlight("red", 300);
                 return;
               };
             };

             run_query({"action": "add_vdom", "name": new_vd_name}, function(res) {
               window.location = "?action=view_vlan_domain&id="+res['ok']['vd_id']+(DEBUG?"&debug":"");
             });
           })
         )
       )
       .append( $(SPAN).addClass("td") )
       .append( $(SPAN).addClass("td") )
       .append( $(SPAN).addClass("td") )
       .append( $(SPAN).addClass("td") )
       .append( $(SPAN).addClass("td") )
       .appendTo( table )
      ;
    };

  });
};

function vlan_row(row_data) {
  let empty_colspan = 6;

  let tr = $(TR).addClass("row")
   .data("row_data", row_data)
  ;

  let vlan_td = $(TD).addClass("wsp")
  ;

  let ranges_span = $(SPAN)
   .css({"width": (g_range_bar_width+g_range_bar_margin)*g_data["vdom_ranges"].length, "display": "inline-block"})
  ;

  for(let i in g_data["vdom_ranges"]) {
    let r_label = $(LABEL).addClass("iprange");
    r_label.html('&#x200b;');
    r_label.css({"left": ((g_range_bar_width+g_range_bar_margin)*i)+"px",
                 "width": g_range_bar_width+"px",
                 "margin-right": g_range_bar_width+"px",
    });
    if(row_data['ranges'][i]['in_range'] !== undefined) {
      r_label.addClass("vlanrange_shown");
      if(g_data["vdom_ranges"][i]['vr_style'] != "{}") {
        try {
          let r_label_css = JSON.parse(g_data["vdom_ranges"][i]['vr_style']);
          r_label.css(r_label_css);
        } catch(e) {
          r_label.css(g_default_range_style);

        };
      } else {
        r_label.css(g_default_range_style);
      };
      r_label.title(vrange_title(g_data["vdom_ranges"][i]));
      r_label.data("r_i", i);
    };
    ranges_span.append( r_label );
  };

  vlan_td.append( ranges_span );

  let can_edit = false;
  if(row_data['rights'] !== undefined &&
     (row_data['rights'] & R_EDIT_IP_VLAN) > 0 &&
     ((row_data['rights'] & R_DENYIP) == 0 ||
      (row_data['rights'] & R_IGNORE_R_DENY) > 0
     )
  ) {
    can_edit = true;
  };


  if(row_data['is_empty'] !== undefined) {
    vlan_td.appendTo( tr );
    let empty_td = $(TD).prop("colspan", empty_colspan).addClass("empty_td");
    if(can_edit) {
      empty_td
       .append( $(SPAN).text("Занять: ") )
       .append( $(LABEL).text(row_data['start'])
         .addClass("button")
         .data("take_type", "vlan")
         .data("vlan", row_data['start'])
         .click(function() { take_vlan($(this)); })
       )
      ;
      if((row_data['stop'] - row_data['start']) > 1) {
        let next_vlan = row_data['start'] + 1;
        let next_vlan_t = String(next_vlan);
        let last_vlan_t = String(row_data['stop']);

        let val = "";
        let i=1;

        while(i < next_vlan_t.length && i < last_vlan_t.length) {
          if(next_vlan_t.substring(0, i) == last_vlan_t.substring(0, i)) {
            val = next_vlan_t.substring(0, i);
            i++;
          } else {
            break;
          };
        };

        empty_td
         .append( $(SPAN).text(" ... ") )
         .append( $(INPUT)
           .css({"width": "8em"})
           .addClass("any_vlan")
           .val(val)
           .data("first", next_vlan)
           .data("last", row_data['stop']-1)
           .enterKey(function() { $(this).closest(".row").find(".take_any_btn").click(); })
         )
         .append( $(LABEL).text("+")
           .addClass("button")
           .addClass("take_any_btn")
           .data("take_type", "any_vlan")
           .data("first", next_vlan)
           .data("last", row_data['stop']-1)
           .click(function() { take_vlan($(this)); })
         )
        ;
      };
      if(row_data['start'] !== row_data['stop']) {
        empty_td
         .append( $(SPAN).text(" ... ") )
         .append( $(LABEL).text(row_data['stop'])
           .addClass("button")
           .data("vlan", row_data['stop'])
           .data("take_type", "vlan")
           .click(function() { take_vlan($(this)); })
         )
        ;
      };
    } else {
      if(row_data['start'] === row_data['stop']) {
        empty_td
         .append( $(SPAN).text("Свободно: ") )
         .append( $(SPAN).text(row_data['start'])
         )
        ;
      } else {
        empty_td
         .append( $(SPAN).text("Свободно: ") )
         .append( $(SPAN).text(row_data['start'])
         )
         .append( $(SPAN).text(" - ") )
         .append( $(SPAN).text(row_data['stop'])
         )
        ;
      };
    };
    empty_td.appendTo( tr );
  } else {
    // menu
    vlan_td
     .append( $(LABEL)
       .addClass("button")
       .addClass("ns")
       .addClass(["ui-icon", "ui-icon-bars"])
       .css({"float": "right", "clear": "none"})
       .click(function(e) {
         e.stopPropagation();
         vlan_menu($(this));
       })
     )
    ;
    //
    vlan_td.append( $(SPAN).text(row_data['vlan_number']).addClass("vlan_number") );

    vlan_td
     .append( $(SPAN)
       .addClass("ns")
       .css({"display": "inline-block", "min-width": "2em"})
       //.html('&#x200b;')
     )
    ;

    vlan_td.tooltip({
      classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
      items: "SPAN.vlan_number",
      content: function() {
        if( $("UL").length > 0 ) return undefined;
        let row = $(this).closest(".row");
        let row_data = row.data("row_data");
        let lines=[];
        if(row_data['ts'] > 0) {
          lines.push("Последнее изменение: "+from_unix_time(row_data['ts'], false, 'н/д'));
          if(row_data['fk_u_id'] !== null && g_data['aux_userinfo'][row_data['fk_u_id']] != undefined) {
            let user_row = g_data['aux_userinfo'][row_data['fk_u_id']];
            lines.push("\t"+user_row['u_name']+" ("+user_row['u_login']+")");
          };
        };
        return lines.join("\n");
      }
    });


    vlan_td.appendTo( tr );

    tr
     .append( $(TD)
       .append( vlan_val_elm(row_data, "vlan_name", g_edit_all) )
     )
     .append( $(TD)
       .append( vlan_val_elm(row_data, "vlan_descr", g_edit_all) )
     )
     .append( $(TD)
       .text( row_data['v4nets'] )
     )
     .append( $(TD)
       .text( row_data['v4ips'] )
     )
     .append( $(TD)
       .text( row_data['v6nets'] )
     )
     .append( $(TD)
       .text( row_data['v6ips'] )
     )
    ;

  };

  if(can_edit) {
    tr
     .on("click dblclick", function(e) {
       if ((e.type == "click" && e.ctrlKey) ||
           e.type == "dblclick"
       ) {
         e.stopPropagation();
         let row_data = $(this).data("row_data");
         let td;
         if(e.target.nodeName == "TD") {
           td = $(e.target);
         } else {
           td = $(e.target).closest("TD");
         };
         $(this).find(".vlan_view").each(function() {
           $(this).replaceWith(vlan_val_elm(row_data, $(this).data('prop'), true));
         });
         let focuson = td.find(".vlan_edit");

         if(focuson.length > 0) {
           focuson.focus();
         };
       };
     })
    ;
  };

  return tr;
};

function actionViewVlanDomain() {
  workarea.empty();
  fixed_div.empty();

  let vd_id = getUrlParameter("id", undefined);

  if(vd_id === undefined || !String(vd_id).match(/^\d+$/)) { error_at(); return; };

  run_query({"action": "view_vlan_domain", "id": String(vd_id)}, function(res) {
    g_data = res['ok'];
    document.title = "IPDB: VLAN домен "+res['ok']['vd_name'];

    fixed_div
     .append( $(DIV)
       .css({"display": "flex", "align-items": "center"})
       .append( $(LABEL).addClass(["ui-icon", "ui-icon-info", "button"])
         .css({"margin-left": "0.5em"})
         .click(function() {
           g_show_vdom_info = !g_show_vdom_info;
           $("#vdom_info").toggle(g_show_vdom_info);
           save_local("show_vdom_info", g_show_vdom_info);
         })
       )
       .append( $(SPAN).addClass("min1em") )
       .append( !userinfo['is_admin']?$(LABEL):$(LABEL)
         .addClass(["ui-icon", "ui-icon-edit"])
         .title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
         .click(function() {
           let elm = $("#vd_name_editable");
           if(elm.hasClass("editable_edit")) {
             $(this).title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
           } else {
             $(this).title("Отменить редактирование. Также можно нажать ESC когда курсор в поле ввода");
           };
           elm.trigger("editable_toggle");
         })
       )
       .append( $(SPAN)
         .css({"font-size": "xx-large"})
         .append(
           editable_elm({
             'object': 'vdom',
             'prop': 'vd_name',
             'id': String(g_data['vd_id']),
             '_edit_css': { 'width': '30em' },
             '_elm_id': 'vd_name_editable',
             '_after_save': function(elm, new_val) {
               g_data['vd_name'] = new_val;
               $("#vdom_changed_ts").text( from_unix_time( unix_timestamp() ) );
               $("#vdom_changed_user").text(userinfo['name'] +" ("+userinfo['login']+")"); 
             }
           })
         )
       )
     )
    ;

    g_show_vdom_info = get_local("show_vdom_info", g_show_vdom_info);

    var info_div = $(DIV)
     .prop("id", "vdom_info")
    ;

    fixed_div
     .append( info_div.toggle(g_show_vdom_info) )
    ;

    info_div
     .append( $(DIV)
       .append( !userinfo['is_admin']?$(LABEL):$(LABEL)
         .addClass(["button", "ui-icon", "ui-icon-trash"])
         .title("Удалить домен")
         .click(function() {
           show_confirm_checkbox("Подтвердите удаление домена.\nВнимание: отменить операцию будет невозможно!", function() {
             run_query({"action": "del_vdom", "object_id": String(g_data['vd_id'])}, function(res) {
               g_autosave_changes = 0;
               window.location = "?action=vlan_domains"+(DEBUG?"&debug":"");
             });
           });
         })
       )
     )
    ;

    if(res['ok']['ts'] > 0 && res['ok']['fk_u_id'] !== null &&
       res['ok']['fk_u_id'] !== undefined && g_data['aux_userinfo'][ res['ok']['fk_u_id'] ] != undefined
    ) {
      info_div
       .append( $(DIV)
         .append( $(SPAN).text("Изменена: ") )
         .append( $(SPAN).text(from_unix_time(res['ok']['ts']) )
           .prop("id", "vdom_changed_ts")
         )
         .append( $(SPAN).text(" Пользователем: ") )
         .append( $(SPAN)
           .text(g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_name']+" ("+
                 g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_login']+")"
           )
           .prop("id", "vdom_changed_user")
         )
       )
      ;
    };

    info_div
     .append( $(DIV)
       .append( !userinfo['is_admin']?$(LABEL):$(LABEL)
         .addClass(["ui-icon", "ui-icon-edit"])
         .css({"vertical-align": "top"})
         .title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
         .click(function() {
           let elm = $("#vd_descr_editable");
           if(elm.hasClass("editable_edit")) {
             $(this).title("Редактировать. Можно также сделать CTRL-Click или Dbl-Click на поле")
           } else {
             $(this).title("Отменить редактирование. Также можно нажать ESC когда курсор в поле ввода");
           };
           elm.trigger("editable_toggle");
         })
       )
       .append(
         editable_elm({
           'object': 'vdom',
           'prop': 'vd_descr',
           'id': String(g_data['vd_id']),
           '_view_classes': ["wsp"],
           '_view_css': {"display": "inline-block", "border": "2px inset gray", "padding": "2px"},
           '_edit_css': { 'width': '50em', 'min-height': '20em' },
           '_elm_id': 'vd_descr_editable',
           '_after_save': function(elm, new_val) {
             g_data['vd_descr'] = new_val;
             $("#vdom_changed_ts").text( from_unix_time( unix_timestamp() ) );
             $("#vdom_changed_user").text(userinfo['name'] +" ("+userinfo['login']+")"); 
           }
         })
       )
     )
    ;

    g_edit_all = get_local("edit_all", g_edit_all);

    fixed_div
     .append( $(DIV)
       .append( $(SPAN).text("Всего: ") )
       .append( $(SPAN).text("Сетей v4: ") )
       .append( $(SPAN).text(g_data['v4nets']) )
       .append( $(SPAN).html("&nbsp;&nbsp;Адресов v4: ") )
       .append( $(SPAN).text(g_data['v4ips']) )
       .append( $(SPAN).html("&nbsp;&nbsp;Сетей v6: ") )
       .append( $(SPAN).text(g_data['v6nets']) )
       .append( $(SPAN).html("&nbsp;&nbsp;Адресов v6: ") )
       .append( $(SPAN).text(g_data['v6ips']) )
     )
    ;

    fixed_div
     .append( $(DIV)
       .append( $(SPAN)
         .append( $(LABEL)
           .text("Редактировать все: ")
           .prop("for", "edit_all")
         )
         .append( $(INPUT)
           .prop({"id": "edit_all", "type": "checkbox", "checked": g_edit_all})
           .on("change", function() {
             let state = $(this).is(":checked");
             save_local("edit_all", state);


             $(".main_table").find("TBODY").find("TR").each(function() {
               let row = $(this);
               let row_row_data = row.data("row_data");
               if(row_row_data['is_taken'] !== undefined) {
                 row.find(".vlan_value").each(function() {
                   let prop = $(this).data("prop");
                   let changed = $(this).data("autosave_changed");
                   if(changed === undefined || changed === false) {
                     let new_elm = vlan_val_elm(row_row_data, prop, state);
                     $(this).replaceWith(new_elm);
                   };
                 });
               };
             });
           })
         )
       )
     )
    ;

    let table = $(TABLE).addClass("main_table")
    ;

    let thead = $(TR)
    ;

    thead
     .append( $(TH)
       .text("VLAN")
       .append( !userinfo['is_admin']?$(LABEL):$(LABEL)
         .addClass(["button", "ui-icon", "ui-icon-plus"])
         .title("Добавить диапазон")
         .css({"float": "left"})
         .click(function() {
           if(g_autosave_changes > 0) {
             show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
             return;
           };
           edit_vdom_range(undefined);
         })
       )
     )
     .append( $(TH)
       .text("Имя")
     )
     .append( $(TH)
       .text("Описание")
     )
     .append( $(TH)
       .text("Сетей v4")
     )
     .append( $(TH)
       .text("Адресов v4")
     )
     .append( $(TH)
       .text("Сетей v6")
     )
     .append( $(TH)
       .text("Адресов v6")
     )
    ;



    table
     .append( $(THEAD)
       .append( thead )
     )
    ;

    let tbody = $(TBODY);


    for(let vlan_i in res['ok']['vlans']) {
      let row_data = res['ok']['vlans'][vlan_i];
      let tr = vlan_row(row_data);
      tr.appendTo( tbody );

    };

    table.append( tbody );
    table.appendTo( workarea );

    table.tooltip({
      classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
      items: ".vlanrange",
      content: function() {
        let r_i = $(this).data("r_i");
        if(r_i === undefined) return;
        return range_title(g_data['vdom_ranges'][r_i]);
      }
    });

    if(userinfo['is_admin']) {
      table.find(".vlanrange_shown").on("click dblclick", function(e) {
        if ((e.type == "click" && e.ctrlKey) ||
            e.type == "dblclick"
        ) {
          e.stopPropagation();
          let r_i = $(this).data("r_i");
          if(r_i === undefined) return;
          if(g_autosave_changes > 0) {
            show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
            return;
          };
          edit_vdom_range(g_data['vdom_ranges'][r_i]['vr_id']);
        };
      });
    };
  });
};

function take_vlan(elm) {
  let row = elm.closest(".row");
  let prev_row_data = row.data("row_data");
  let take_type = elm.data("take_type");
  if(take_type == undefined) { error_at(); return; };
  if(prev_row_data == undefined) { error_at(); return; };

  let take_vlan = undefined;
  if(take_type === "vlan") {
    take_vlan = elm.data("vlan");
  } else if(take_type === "any_vlan") {
    let v = row.find(".any_vlan").val();
    take_vlan = v;
    let first = elm.data("first");
    let last = elm.data("last");
    if(take_vlan < first || take_vlan > last) {
      row.find(".any_vlan").animateHighlight("red", 500);
      return;
    };
  } else {
    error_at(); return;
  };

  if(take_vlan === undefined) { error_at(); return; };

  run_query({"action": "take_vlan", "take_vlan": String((take_vlan >>> 0)), "ranges_orig": g_data['ranges_orig'],
            "vd_id": String(g_data['vd_id'])
  }, function(res) {

    let new_row_data = res['ok']['row_data'];
    let new_vlan_row = vlan_row(new_row_data);
    row.replaceWith( new_vlan_row );

    let prev_start = prev_row_data['start'];
    let prev_stop = prev_row_data['stop'];

    if(prev_start != prev_stop) {
      if(take_vlan > prev_start) {
        let before_data = dup(prev_row_data);
        before_data['stop'] = Number(take_vlan) - 1;
        let before_row = vlan_row(before_data);
        before_row.insertBefore(new_vlan_row);
      };
      if(take_vlan < prev_stop) {
        let after_data = dup(prev_row_data);
        after_data['start'] = Number(take_vlan) + 1;
        let after_row = vlan_row(after_data);
        after_row.insertAfter(new_vlan_row);
      };
    };
  });
};

function vlan_menu(elm) {
  $("UL.popupmenu").remove();
  let row = elm.closest(".row");
  let row_data = row.data("row_data");
  
  let menu = $(UL)
   .addClass("popupmenu")
   .css({"background-color": "white", "border": "1px solid black", "display": "inline-block", "z-index": 100})
   .css({"padding": "0.2em"})
   .css({"position": "absolute"})
   .append( $(LI)
     .title("Закрыть меню")
     .append( $(DIV)
       //.css({"display": "inline-block"})
       .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrowreturn-1-w"]) )
       .append( $(SPAN).html("&#x200b;") )
       .click(function(e) {
         e.stopPropagation();
         $("UL.popupmenu").remove();
       })
     )
   )
  ;


  if((row_data['rights'] & R_EDIT_IP_VLAN) != 0 &&
     (row_data['rights'] & R_VIEW_NET_IPS) != 0 &&
     ((row_data['rights'] & R_DENYIP) == 0 ||
      (row_data['rights'] & R_IGNORE_R_DENY) != 0
     )
  ) {

    if(row.find(".vlan_view").length > 0) {
      menu
       .append( $(LI)
         .append( $(DIV)
           .title("Также можно сделать CTRL-Click или dbl-Click на строке...")
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-edit"]) )
           .append( $(SPAN).html("Редактировать&#x20F0;") )
           .click(function(e) {
             e.stopPropagation();

             let row = $(this).closest("TR");

             row.find(".vlan_view").each(function() {
               $(this).replaceWith(vlan_val_elm(row_data, $(this).data('prop'), true));
             });
             $("UL.popupmenu").remove();

             row.find(".vlan_edit").first().focus();
           })
         )
       )
      ;
    };

    if(row.find(".vlan_edit").length > 0) {
      menu
       .append( $(LI)
         .append( $(DIV)
           //.css({"display": "inline-block"})
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-undo"]) )
           .append( $(SPAN).text("Перестать редактировать") )
           .click(function(e) {
             e.stopPropagation();

             let row = $(this).closest("TR");

             row.find(".vlan_edit").each(function() {
               let changed = $(this).data("autosave_changed");
               if(changed) {
                 g_autosave_changes--;
               };
               $(this).replaceWith(vlan_val_elm(row_data, $(this).data('prop'), false));
             });
             if(g_autosave_changes < 0) {
               error_at();
               return;
             } else if(g_autosave_changes == 0) {
               $("#autosave_btn").css({"color": "gray"});
             } else {
               $("#autosave_btn").css({"color": "yellow"});
             };
             $("UL.popupmenu").remove();
           })
         )
       )
      ;
    };

    menu
     .append( $(LI)
       .append( $(DIV)
         //.css({"display": "inline-block"})
         .append( $(LABEL).addClass(["ui-icon", "ui-icon-trash"]) )
         .append( $(SPAN).text("Освободить") )
         .click(function(e) {
           e.stopPropagation();
           let row = $(this).closest("TR");
           let row_data = row.data("row_data");
           if(row_data === undefined) { error_at(); return; };
           show_confirm("Подтвердите освобождение VLAN "+row_data['vlan_number']+
                        "\nВнимание: отмена будет невозможна", function() {
             let vlan_id = row_data['vlan_id'];
             run_query({"action": "free_vlan", "id": String(vlan_id)}, function(res) {

               row.find(".vlan_edit").each(function() {
                 let changed = $(this).data("autosave_changed");
                 if(changed) {
                   g_autosave_changes--;
                 };
               });
               if(g_autosave_changes < 0) {
                 error_at();
                 return;
               } else if(g_autosave_changes == 0) {
                 $("#autosave_btn").css({"color": "gray"});
               } else {
                 $("#autosave_btn").css({"color": "yellow"});
               };

               $("UL.popupmenu").remove();
               let new_vlan_data = {};
               new_vlan_data['ranges'] = row_data['ranges'];
               new_vlan_data['rights'] = row_data['rights'];
               new_vlan_data['is_empty'] = 1;
               new_vlan_data['start'] = row_data['vlan_number'];
               new_vlan_data['stop'] = row_data['vlan_number'];

               row.replaceWith( vlan_row(new_vlan_data) );
             });
           });
         })
       )
     )
    ;

  };

  //let elm_offset = elm.offset();
  //let elm_width = elm.width();

  let td_width = elm.closest("TD").width();

  menu.css({"top": "0px", "left": td_width+10+"px"});

  menu.appendTo(elm.closest("TD"));

  menu.menu();

  menu.on("click dblclick", function(e) { e.stopPropagation(); });

  $(".tooltip").remove();
};

function edit_vdom_range(object_id) {
  let allow_edit = false;
  allow_edit = userinfo["is_admin"];

  let query;
  if(object_id !== undefined) {
    query = {"action": "get_vdom_range", "object_id": object_id};
  } else {
    query = {"action": "get_groups"};
  };
  run_query(query, function(res) {

    if(res['ok']['aux_userinfo'] !== undefined) {
      if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
      for(let u_id in res['ok']['aux_userinfo']) {
        g_data['aux_userinfo'][u_id] = res['ok']['aux_userinfo'][u_id];
      };
    };

    if(object_id === undefined) {
      let r_start;
      let r_stop;
      let style;

      r_start = 1;
      r_stop = g_data['vd_max_num'];
      style = JSON.stringify(g_default_range_style);

      let groups = {};
      for(let i in res["ok"]["gs"]) {
        let g_id= res["ok"]["gs"][i]["g_id"];
        groups[g_id] = res["ok"]["gs"][i];
        groups[g_id]['rights'] = 0;
        groups[g_id]['ts'] = undefined;
        groups[g_id]['fk_u_id'] = null;
      };

      res = {
        "ok": {
          "groups": groups,
          "vr_start": r_start,
          "vr_stop": r_stop,
          "vr_name": "",
          "vr_descr": "",
          "vr_id": undefined,
          "vr_style": style,
          "vr_icon": g_default_range_icon,
          "vr_icon_style": JSON.stringify(g_default_range_icon_style),
          "ts": 0,
          "fk_u_id": null,
        }
      };
    };

    let title = "Диапазон VLAN";

    let dialog = $(DIV).addClass("dialog_start")
     .title(title)
     .data('object_id', object_id)
     .data('groups', res['ok']['groups'])
     .data('r_data', res['ok'])
    ;

    $(DIV)
     .append( $(SPAN).text("Посл. изменение: ") )
     .append( $(SPAN).text(from_unix_time( res['ok']['ts'], false, 'н.д.' )) )
     .append( $(SPAN).addClass("min1em") )
     .append( res['ok']['fk_u_id'] === null?$(SPAN):$(SPAN)
       .text(
         g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_name']+" ("+
         g_data['aux_userinfo'][ res['ok']['fk_u_id'] ]['u_login']+")"
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("Диапазон: ") )
     .append( $(INPUT)
       .prop({"id": "r_start", "placeholder": res['ok']['vr_start'], "readonly": !allow_edit})
       .val(res['ok']['vr_start'])
     )
     .append( $(SPAN).text(" - ") )
     .append( $(INPUT)
       .prop({"id": "r_stop", "placeholder": res['ok']['vr_stop'], "readonly": !allow_edit})
       .val(res['ok']['vr_stop'])
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("Название: ") )
     .append( $(INPUT)
       .prop({"id": "r_name", "readonly": !allow_edit})
       .val(res['ok']['vr_name'])
     )
     .appendTo( dialog )
    ;

    let css;
    try {
      css = JSON.parse(res['ok']['vr_style']);
    } catch(e) {
      css = g_default_range_style;
    };

    let sample_label;

    sample_label = $(LABEL).addClass("iprange")
     .html('&#x200b;')
     .prop("id", "r_style_sample")
     .css({"width": g_range_bar_width+"px", "margin-right": g_range_bar_width+"px"})
    ;

    $(DIV)
     .append( $(SPAN).html("CSS колонки: ").title("Например: {\"background-color\": \"red\"}") )
     .append( $(INPUT)
       .prop({"id": "r_style", "readonly": !allow_edit})
       .val(res['ok']['vr_style'])
       .on("input change keyup", function() {
         let j = $(this).val();
         try {
           css = JSON.parse(j);
           $("#r_style_sample").css(css);
           $("#r_style_error").hide();
           $(this).css("background-color", "white");
         } catch(e) {
           $("#r_style_error").show();
           $(this).css("background-color", "lightcoral");
         };
       })
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .css({"position": "relative"})
       .append( sample_label )
     )
     .append( $(SPAN)
       .css({"padding-left": g_range_bar_width+g_range_bar_width+2+"px"})
       .append( $(LABEL)
         .prop("id", "r_style_error")
         .addClass(["ui-icon", "ui-icon-alert"])
         .css({"color": "red"})
         .title("Неверный JSON стиля")
         .hide()
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(A)
       .prop({"href": "https://mkkeck.github.io/jquery-ui-iconfont/#icons", "target": "_blank"})
       .dotted("Выбрать можно тут")
       .text("Значек диапазона ui-icon-*: ")
     )
     .append( $(INPUT)
       .prop({"id": "r_icon", "readonly": !allow_edit})
       .val(res['ok']['vr_icon'])
       .on("input change keyup", function() {
         let v = $(this).val();
         let j = $("#r_icon_style").val();
         let css;
         try {
           css = JSON.parse(j);
           $("#r_icon_style").css("background-color", "white");
           $("#r_icon_style_error").hide();
         } catch(e) {
           $("#r_icon_style").css("background-color", "lightcoral");
           $("#r_icon_style_error").show();
           css = g_default_range_icon_style;
         };
         if(!String(v).match(/^ui-icon-[\-a-z0-9]+$/)) {
           $("#r_icon").css("background-color", "lightcoral");
           $("#r_icon_error").show();
           $("#r_icon_span").empty();
         } else {
           $("#r_icon").css("background-color", "white");
           $("#r_icon_error").hide();
           $("#r_icon_span")
            .empty()
            .append( $(LABEL)
              .addClass(["ui-icon", v])
              .css(css)
            )
           ;
         };
       })
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .prop("id", "r_icon_span")
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .append( $(LABEL)
         .prop("id", "r_icon_error")
         .addClass(["ui-icon", "ui-icon-alert"])
         .css({"color": "red"})
         .title("Неверный класс значка. Должен начинаться на ui-icon-")
         .hide()
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("CSS значка диапазона: ").title("Например: {\"color\": \"red\"}") )
     .append( $(INPUT)
       .prop({"id": "r_icon_style", "readonly": !allow_edit})
       .val(res['ok']['vr_icon_style'])
       .on("input change keyup", function() {
         $("#r_icon").trigger("input");
       })
     )
     .append( $(SPAN).addClass("min1em") )
     .append( $(SPAN)
       .append( $(LABEL)
         .prop("id", "r_icon_style_error")
         .addClass(["ui-icon", "ui-icon-alert"])
         .css({"color": "red"})
         .title("Неверный JSON значка")
         .hide()
       )
     )
     .appendTo( dialog )
    ;

    $(DIV)
     .append( $(SPAN).text("Описание: ").css("vertical-align", "top") )
     .append( $(TEXTAREA)
       .prop({"id": "r_descr", "readonly": !allow_edit})
       .val(res['ok']['vr_descr'])
     )
     .appendTo( dialog )
    ;

    $(DIV).text("Права доступа:")
     .css({"margin-top": "0.5em", "margin-bottom": "0.5em"})
     .appendTo( dialog )
    ;

    let table = $(DIV).addClass("table")
     .appendTo(dialog)
    ;

    let not_in_list = [];

    let k_a = keys(res['ok']['groups']);
    sort_by_string_key(k_a, res['ok']['groups'], 'g_name');

    for(let i in k_a) {
      let g_id = k_a[i];
      if(res['ok']['groups'][g_id]['rights'] == 0) {
        not_in_list.push(g_id);
        continue;
      };
      table.append( rights_row("vlan_range", object_id, res['ok']['groups'][g_id], allow_edit) );
    };

    if(allow_edit) {
      let last_row = $(DIV).addClass("tr");

      let select = $(SELECT)
       .append( $(OPTION).text("Выберете группу...").val(0) )
       .val(0)
       .tooltip({
         classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
         items: "SELECT",
         content: function() {
           return $(this).find("OPTION:selected").prop("title");
         }
       })
      ;

      for(let i in not_in_list) {
        let g_id = not_in_list[i];
        select
         .append( $(OPTION)
           .text(res['ok']['groups'][g_id]['g_name'])
           .title(res['ok']['groups'][g_id]['g_descr'])
           .val(g_id)
         )
        ;
      };

      last_row
       .append( $(SPAN).addClass("td")
         .append( select )
       )
      ;

      last_row
       .append( rights_tds("vlan_range", 0, true) )
      ;

      last_row
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .click(function() {
             let dialog = $(this).closest(".dialog_start");
             let select = dialog.find("SELECT");
             let option = select.find(":selected");
             let tr = $(this).closest(".tr");
             let g_id = select.val();
             if(g_id == 0) return;

             let this_rights = 0;

             tr.find(".right").each(function() {
               if( $(this).hasClass("right_on") ) {
                 this_rights = this_rights | $(this).data("right");
                 $(this).removeClass("right_on").addClass("right_off");
               };
             });

             if(this_rights == 0) return;

             let new_g_data = dialog.data("groups")[g_id];
             new_g_data['_new'] = true;
             new_g_data['rights'] = this_rights;
             let new_row = rights_row("vlan_range", dialog.data("object_id"),
               new_g_data, true
             );
             new_row.insertBefore(tr);
             option.remove();
           })
         )
       )
      ;

      table.append( last_row );
    };

    let buttons = [];

    if(allow_edit && object_id !== undefined) {
      buttons.push({
        'class': 'left_dlg_button',
        'text': 'Удалить',
        'click': function() {
          let dlg = $(this);

          show_confirm("Подтвердите удаление диапазона.\nВнимание: отмена операции будет невозможна!", function() {
            run_query({"action": "del_vdom_range", "object_id": String(dlg.data("object_id"))}, function(res) {

              dlg.dialog( "close" );

              window.location = "?action=view_vlan_domain&id="+g_data['vd_id']+(DEBUG?"&debug":"");
              return;
            });
          });
        },
      });
    };

    if(allow_edit) {
      buttons.push({
        'text': object_id===undefined?'Создать':'Сохранить',
        'click': function() {
          let dlg = $(this);

          let rights = {};

          if(dlg.find("SELECT").val() != 0 &&
            dlg.find("SELECT").closest(".tr").find(".right_on").length > 0
          ) {
            dlg.find("SELECT").closest(".tr").animateHighlight("lightcoral", 200);
            return;
          };

          dlg.find(".rights_row").each(function() {
            let this_rights = 0;
            $(this).find(".right").each(function() {
              if($(this).hasClass("right_on")) {
                let right = $(this).data("right");
                this_rights |= right;
              };
            });
            if(this_rights > 0) {
              let group = $(this).data("group");
              rights[ group['g_id'] ] = String(this_rights);
            };
          });

          let r_start = $("#r_start").val();
          if(!String(r_start).match(/^\d+$/)) {
            $("#r_start").animateHighlight("red", 300);
            return;
          };

          let r_stop = $("#r_stop").val();
          if(!String(r_stop).match(/^\d+$/)) {
            $("#r_stop").animateHighlight("red", 300);
            return;
          };

          if(Number(r_stop) < Number(r_start)) {
            $("#r_start,#r_stop").animateHighlight("red", 300);
            return;
          };

          if(Number(r_start) < 1) {
            $("#r_start").animateHighlight("red", 300);
            return;
          };
          if(Number(r_stop) > Number(g_data['vd_max_num'])) {
            $("#r_stop").animateHighlight("red", 300);
            return;
          };

          try {
            JSON.parse(String($("#r_style").val()).trim());
          } catch(e) {
            $("#r_style").animateHighlight("red", 300);
            return;
          };

          try {
            JSON.parse(String($("#r_icon_style").val()).trim());
          } catch(e) {
            $("#r_icon_style").animateHighlight("red", 300);
            return;
          };

          if(!String($("#r_icon").val()).trim().match(/^ui-icon-[\-a-z0-9]+$/)) {
            $("#r_icon").animateHighlight("red", 300);
            return;
          };

          let query = {
            "action": "save_vdom_range",
            "object_id": dlg.data("object_id")===undefined?"":dlg.data("object_id"),
            "vd_id": String(g_data['vd_id']),
            "rights": rights,
            "r_start": String(r_start),
            "r_stop": String(r_stop),
            "r_name": String($("#r_name").val()).trim(),
            "r_descr": String($("#r_descr").val()).trim(),
            "r_style": String($("#r_style").val()).trim(),
            "r_icon": String($("#r_icon").val()).trim(),
            "r_icon_style": String($("#r_icon_style").val()).trim(),
          };
          run_query(query, function(res) {
            dlg.dialog( "close" );

            window.location = "?action=view_vlan_domain&id="+g_data['vd_id']+(DEBUG?"&debug":"");
            return;
          });
        },
      });
    };

    buttons.push({
      'text': allow_edit?'Отмена':'Закрыть',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      maxHeight:1000,
      maxWidth:1800,
      minWidth:1200,
      width: "auto",
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );

    $("#r_style").trigger("input");
    $("#r_icon").trigger("input");
  });
};

function select_vlan(pre_vlan_data, donefunc) {
  run_query({"action": "list_vlan_domains"}, function(res) {
    if(res['ok']['aux_userinfo'] !== undefined) {
      if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
      for(let u_id in res['ok']['aux_userinfo']) {
        g_data['aux_userinfo'][u_id] = res['ok']['aux_userinfo'][u_id];
      };
    };

    let dlg = $(DIV).addClass("dialog_start")
     .title("Выбор VLAN")
     .data("pre_vlan_data", pre_vlan_data)
     .data("donefunc", donefunc)
    ;

    let vd_sel = $(SELECT).addClass("vd_id")
     .append( $(OPTION).text("Выберите домен...")
       .val("0")
     )
     .append( $(OPTION).text("Убрать назначение VLAN")
       .val("")
     )
     .tooltip({
       classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
       items: "SELECT",
       content: function() {
         return $(this).find("OPTION:selected").prop("title");
       },
     })
    ;

    for(let i in res['ok']['vds']) {
      vd_sel
       .append( $(OPTION).text(res['ok']['vds'][i]['vd_name'])
         .title(res['ok']['vds'][i]['vd_descr'])
         .val(res['ok']['vds'][i]['vd_id'])
       )
      ;
    };

    if(pre_vlan_data !== undefined && pre_vlan_data['vlan_fk_vd_id'] !== undefined) {
      vd_sel.val(pre_vlan_data['vlan_fk_vd_id']);
    } else {
      vd_sel.val("0");
    };

    vd_sel
     .on("change", function() {
       let val = $(this).val();
       let dlg = $(this).closest(".dialog_start");

       if(val === "0" || val === "") {
         dlg.find(".vlan_id").empty()
          .append( $(OPTION).text("Домен не выбран").val("0") )
          .append( $(OPTION).text("Убрать назначение VLAN").val("") )
         ;
         dlg.find(".vlan_id").val(val);
         return;
       };

       run_query({"action": "view_vlan_domain", "id": String(val)}, function(res) {
         let sel = dlg.find(".vlan_id");
         sel.empty()
          .append( $(OPTION).text("Выберите VLAN...").val("0") )
          .append( $(OPTION).text("Убрать назначение VLAN").val("") )
         ;

         let pre_data = dlg.data("pre_vlan_data");

         let presel = "0";

         for(let vlan_i in res['ok']['vlans']) {
           if(res['ok']['vlans'][vlan_i]['is_taken'] !== undefined) {
             sel
              .append( $(OPTION)
                .text(String(res['ok']['vlans'][vlan_i]['vlan_number'])+" "+String(res['ok']['vlans'][vlan_i]['vlan_name']))
                .title(res['ok']['vlans'][vlan_i]['vlan_descr'])
                .val(res['ok']['vlans'][vlan_i]['vlan_id'])
                .data("vlan_data", res['ok']['vlans'][vlan_i])
              )
             ;
             if(pre_data !== undefined && pre_data['vlan_id'] == res['ok']['vlans'][vlan_i]['vlan_id']) {
               presel = pre_data['vlan_id'];
             };
           };
         };

         sel.val(presel);
       });
     })
    ;

    dlg
     .append( $(DIV)
       .append( vd_sel )
     )
     .append( $(DIV)
       .append( $(SELECT).addClass("vlan_id") )
     )
    ;

    let buttons = [];

    buttons.push({
      'text': 'Выбрать',
      'click': function() {
        let dlg = $(this);
        let donefunc = dlg.data("donefunc");

        let val = dlg.find(".vlan_id").val();

        if(val === "0") return;

        if(donefunc !== undefined) {
          let data = {"vlan_id": ""};
          if(val !== "") {
            data = dlg.find(".vlan_id").find("OPTION:selected").data("vlan_data");
            data["vd_name"] = dlg.find(".vd_id").find("OPTION:selected").text();
          };
          dlg.dialog( "close" );
          donefunc(data);
        };
      },
    });

    buttons.push({
      'text': 'Отмена',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      maxHeight:1000,
      maxWidth:1800,
      minWidth:1200,
      width: "auto",
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dlg.appendTo("BODY");
    dlg.dialog( dialog_options );

    dlg.find(".vd_id").trigger("change");

  });
};

function vlan_label(object, object_id, vlan_data, allow_edit = false, prefix = "", not_set = "") {
  let ret = $(LABEL)
   .addClass("vlan")
   .addClass("unsaved_elm")
   .data("object", object)
   .data("object_id", object_id)
   .data("vlan_data", vlan_data)
   .data("allow_edit", allow_edit)
   .data("prefix", prefix)
   .data("not_set", not_set)
  ;
  if(vlan_data !== undefined && vlan_data["vlan_id"] !== undefined && vlan_data["vlan_id"] !== "") {
    ret
     .append( $(SPAN)
       .addClass("vlan_label")
       .css(g_vlan_css)
       .text( prefix+String(vlan_data['vlan_number']) )
       .tooltip({
         classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
         items: "LABEL",
         content: function() {
           let vlan_data = $(this).data('vlan_data');
          
           let ret = $(DIV)
            .append( $(DIV)
              .append( $(SPAN).text("VLAN: "+vlan_data['vlan_number']) )
            )
            .append( $(DIV)
              .append( $(SPAN).text("Домен: "+vlan_data['vd_name']) )
            )
            .append( $(DIV)
              .append( $(SPAN).text("Имя: "+vlan_data['vlan_name']) )
            )
           ;
           return ret;
         }
       })
     )
    ;
  } else {
    ret
     .append( $(SPAN)
       .addClass("vlan_label")
       .css(g_vlan_css)
       .text(not_set)
       .toggle(not_set != "")
     )
    ;
  };

  if(allow_edit) {
    ret
     .append( $(INPUT)
       .prop({"type": "hidden"})
       .val(vlan_data === undefined?"":vlan_data["vlan_id"])
       .saveable({
         "object": object,
         "id": object_id,
         "prop": "vlan"
       })
     )
     .on("click dblclick", function(e) {
       if ((e.type == "click" && e.ctrlKey) ||
           e.type == "dblclick"
       ) {
         e.stopPropagation();
         $(this).trigger("set");
       };
     })
     .on("set", function() {
       let elm = $(this);
       let object = elm.data("object");
       let vlan_data = elm.data("vlan_data");
       let allow_edit = elm.data("allow_edit");
       let prefix = elm.data("prefix");
       let not_set = elm.data("not_set");

       select_vlan(vlan_data, function(new_data) {
         elm.find("INPUT[type=hidden]").val(new_data["vlan_id"]);
         elm.data("vlan_data", new_data);
         elm.find(".vlan_label").show();
         if(new_data["vlan_id"] != "") {
           elm.find(".vlan_label")
            .text(String(prefix)+String(new_data["vlan_number"]))
           ;
         } else {
           elm.find(".vlan_label").text(not_set);
         };

         elm.find("INPUT[type=hidden]").trigger("input_stop");
       })
     })
    ;
  };

  return ret;
};

function actionViewFields() {
  workarea.empty();
  fixed_div.empty();
  run_query({"action": "get_fields"}, function(res) {
    g_data = res['ok'];

    fixed_div
     .append( $(DIV)
       .append( $(SPAN).addClass("sort_changed").addClass("unsaved").text("Изменен порядок полей").hide() )
       .append( $(SPAN).addClass("sort_unchanged").html("&nbsp;") )
     )
    ;

    let table = $(DIV).addClass("table")
     .appendTo(workarea)
    ;

    $(DIV).addClass("thead")
     .append( $(SPAN).addClass("th")
       .append( $(LABEL).addClass(["ui-icon", "ui-icon-sorting"]) )
       .title("Перетащите мышью за значек")
     )
     .append( $(SPAN).addClass("th").text("Имя").title("Отображаемое имя поля. Должно быть уникальным") )
     .append( $(SPAN).addClass("th").text("Авто").title("Автоматически добавлять в шаблоны при создании") )
     .append( $(SPAN).addClass("th").text("API_name").title("Имя на латинице без пробелов, для использования в API запросах. Должно быть уникальным") )
     .append( $(SPAN).addClass("th").text("Описание") )
     .append( $(SPAN).addClass("th").text("Тип данных") )
     .append( $(SPAN).addClass("th")
       .append( $(SPAN).text("Опции") )
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-info"])
         .css({"font-size": "x-small", "margin-left": "0.3em", "vertical-align": "top"})
         .click(ic_options_help)
       )
     )
     .append( $(SPAN).addClass("th").text("RegExp")
       .title("Регулярное выражение для проверки вводимых данных. Должно быть совместимо с JS и golang одновременно")
     )
     .append( $(SPAN).addClass("th")
       .append( $(SPAN).text("Значек") )
       .append( $(A).prop({"href": "https://mkkeck.github.io/jquery-ui-iconfont/#icons", "target": "_blank"}).text("*") )
       .title("ui-icon-*")
     )
     .append( $(SPAN).addClass("th").text("CSS значка").title("Например {\"color\": \"blue\"}") )
     .append( $(SPAN).addClass("th").addClass("wsp").text("CSS значения в\n режиме просмотра").title("Например {\"color\": \"blue\"}") )
     .append( $(SPAN).addClass("th").addClass("wsp").text("CSS значения в\n режиме редактирования").title("Например {\"color\": \"blue\"}") )
     .append( $(SPAN).addClass("th") )
     .appendTo(table)
    ;

    let tbody = $(DIV).addClass("tbody")
     .appendTo(table)
    ;

    let ids=[];

    let ks = keys(g_data['ics']);
    sort_by_number_key(ks, g_data['ics'], 'ic_sort');

    for(let i in ks) {
      let ic_id = ks[i];
      ids.push(String(ic_id));
      tbody.append( field_row(g_data['ics'][ic_id]) );
    };

    g_data['sort_string'] = ids.join(",");

    table
     .append( $(DIV).addClass("tfoot")
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .click(function() {
             if(g_autosave_changes > 0) {
               show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
               return;
             };

             let ic_name = String($(this).closest(".tfoot").find(".ic_name").val()).trim();
             let ic_api_name = String($(this).closest(".tfoot").find(".ic_api_name").val()).trim().toLowerCase();

             let highlight = $([]);

             let found = false;

             if(ic_name == "") {
               highlight = highlight.add($(this).closest(".tfoot").find(".ic_name"));
               found = true;
             } else {

               for(let i in g_data['ics']) {
                 if(ic_name == (String(g_data['ics'][i]['ic_name']).trim()+String(g_data['ics'][i]['ic_icon']).trim())) {
                   highlight = highlight.add($(this).closest(".tfoot").find(".ic_name"));
                   found = true;
                   break;
                 };
               };
             };

             if(ic_api_name == "") {
               highlight = highlight.add($(this).closest(".tfoot").find(".ic_api_name"));
               found = true;
             } else {
               for(let i in g_data['ics']) {
                 if(ic_api_name == String(g_data['ics'][i]['ic_api_name']).trim().toLowerCase()) {
                   highlight = highlight.add($(this).closest(".tfoot").find(".ic_api_name"));
                   found = true;
                 };
               };
             };
             if(found) {
               highlight.animateHighlight("red", 300);
               return;
             };

             run_query({"action": "add_ic", "ic_name": ic_name, "ic_api_name": ic_api_name}, function(res) {
               if(res['ok']['aux_userinfo'] !== undefined) {
                 if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
                 for(let u_id in res['ok']['aux_userinfo']) {
                   g_data['aux_userinfo'][u_id] = res['ok']['aux_userinfo'][u_id];
                 };
               };

               let ic_id = res['ok']['ic']['ic_id'];
               g_data['ics'][ic_id] = res['ok']['ic'];
               let new_row = field_row(res['ok']['ic']);
               new_row.appendTo( $(".tbody") );
               new_row.find(".edit_btn").trigger("click");
             });
           })
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(INPUT)
           .addClass("ic_name")
           .css({ 'width': '10em' })
         )
       )
       .append( $(SPAN).addClass("td") )
       .append( $(SPAN).addClass("td")
         .append( $(INPUT)
           .addClass("ic_api_name")
           .css({ 'width': '10em' })
         )
       )
     )
    ;

    tbody.sortable({
      "axis": "y",
      "handle": ".handle",
      "helper": "clone",
      "stop": function() {
        let ids=[];
        $(".tbody").find(".tr").each(function() {
          let row_data = $(this).data("row_data");
          ids.push(String(row_data['ic_id']));
        });
        $(".sort_input").val(ids.join(","));
        $(".sort_input").trigger("input_stop");
      },
    });

    workarea
     .append( $(INPUT)
       .addClass("sort_input")
       .prop({"type": "hidden"})
       .val(g_data['sort_string'])
       .saveable({
         "object": "ics",
         "prop": "sort",
         "_changed_show": ".sort_changed",
         "_unchanged_show": ".sort_unchanged",
       })
     )
    ;
  });
};

function field_row(row_data) {
  let ret = $(DIV).addClass("tr")
   .data("row_data", row_data)
  ;

  ret
   .append( $(SPAN).addClass("td")
     .append( $(LABEL).addClass("handle")
       .addClass(["ui-icon", "ui-icon-bars"])
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_name",
         "id": String(row_data['ic_id']),
         "_edit_css": { 'width': '10em' },
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append( $(INPUT)
       .prop("type", "hidden")
       .val(row_data['ic_default'])
       .addClass("ic_default")
       .saveable({
         "object": "ic",
         "prop": "ic_default",
         "id": String(row_data['ic_id']),
       })
     )
     .append( $(INPUT)
       .prop("type", "checkbox")
       .prop("checked", row_data['ic_default'] > 0)
       .prop("disabled", true).css("color", "black")
       .on("change", function() {
         $(this).siblings(".ic_default")
          .val($(this).is(":checked")?"1":"0").trigger("input_stop")
         ;
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_api_name",
         "id": String(row_data['ic_id']),
         "_edit_css": { 'width': '10em' },
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_descr",
         "id": String(row_data['ic_id']),
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append( $(INPUT)
       .prop("type", "hidden")
       .val(row_data['ic_type'])
       .addClass("ic_type")
       .saveable({
         "object": "ic",
         "prop": "ic_type",
         "id": String(row_data['ic_id']),
       })
     )
     .append( $(SELECT)
       .prop("disabled", true).css("color", "black")
       .append( $(OPTION).text("Однострочный текст").val("text") )
       .append( $(OPTION).text("Многострочный текст").val("textarea") )
       .append( $(OPTION).text("Один тег")
         .title("Задайте в опциях API имя корневого тега, чтобы ограничить выбор значений")
         .val("tag")
       )
       .append( $(OPTION).text("Несколько тегов")
         .title("Задайте в опциях API имя корневого тега, чтобы ограничить выбор значений")
         .val("multitag")
       )
       .on("change", function() {
         $(this).siblings(".ic_type")
          .val($(this).val()).trigger("input_stop")
         ;
       })
       .val(row_data['ic_type'])
       .tooltip({
         classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
         items: "SELECT",
         content: function() {
           return $(this).find("OPTION:selected").prop("title");
         }
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_options",
         "_input": "textarea",
         "id": String(row_data['ic_id']),
         "_edit_css": { 'min-width': '7em' },
         "_view_css": { 'max-width': '7em', 'overflow-x': 'hidden', 'text-overflow': 'ellipsis', 'display': 'inline-block' },
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_regexp",
         "id": String(row_data['ic_id']),
         "_edit_css": { 'width': '10em' },
         "_input": "textarea",
         "_view_css": { 'width': '10em', 'overflow-x': 'hidden', 'text-overflow': 'ellipsis', 'display': 'inline-block' },
         "_placeholder": "^(?:boo|moo)$",
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_icon",
         "id": String(row_data['ic_id']),
         "_edit_css": { 'width': '7em' },
         "_placeholder": "ui-icon-...",
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_icon_style",
         "_input": "textarea",
         "id": String(row_data['ic_id']),
         "_edit_css": { 'width': '10em' },
         "_view_css": { 'max-width': '7em', 'overflow-x': 'hidden', 'text-overflow': 'ellipsis', 'display': 'inline-block' },
         "_placeholder": '{"color": "red"}',
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_view_style",
         "id": String(row_data['ic_id']),
         "_input": "textarea",
         "_edit_css": { 'width': '10em' },
         "_view_css": { 'max-width': '7em', 'overflow-x': 'hidden', 'text-overflow': 'ellipsis', 'display': 'inline-block' },
         "_placeholder": '{"font-size": "large"}',
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "ic",
         "prop": "ic_style",
         "id": String(row_data['ic_id']),
         "_input": "textarea",
         "_edit_css": { 'width': '10em' },
         "_view_css": { 'max-width': '7em', 'overflow-x': 'hidden', 'text-overflow': 'ellipsis', 'display': 'inline-block' },
         "_placeholder": '{"width": "2em"}',
       })
     )
   )
  ;

  let action_td = $(SPAN).addClass("td");

  action_td
   .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-edit", "edit_btn"])
     .click(function() {
       let row = $(this).closest(".tr");
       let row_data = row.data("row_data");
       let id = row_data['ic_id'];

       if((row.find(".editable_view,:disabled").length) > 0) {
         row.find(".editable_view").trigger("editable_toggle");
         row.find(":disabled").prop("disabled", false);
       } else if(row.find(".editable_edit,input[type=checkbox]:enabled,select:enabled").length > 0) {
         row.find(".editable_edit").trigger("editable_toggle");

         row.find("input[type=checkbox]:enabled").prop("checked", g_data['ics'][id]['ic_default'] > 0).prop("disabled", true);
         row.find(".ic_default").val(g_data['ics'][id]['ic_default']).trigger("input_stop");

         row.find("select:enabled").prop("disabled", true).val(g_data['ics'][id]['ic_type']);
         row.find(".ic_type").val(g_data['ics'][id]['ic_type']).trigger("input_stop");
         
       };
     })
   )
  ;

  if(row_data['used'] == 0) {
    action_td
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
       .css("margin-left", "0.5em")
       .click(function() {
         if(g_autosave_changes > 0) {
           show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
           return;
         };
         let row = $(this).closest(".tr");
         let ic_id = row.data("row_data")['ic_id'];

         show_confirm("Подтвердите удаление поля.\nВнимание: отмена будет невозможна", function() {
           run_query({"action": "del_ic", "ic_id": String(ic_id)}, function(res) {
             row.remove();
             delete(g_data['ics'][ic_id]);
           });
         });
       })
     )
    ;
  };

  action_td.appendTo( ret );

  ret
   .on("click dblclick", function(e) {
     if ((e.type == "click" && e.ctrlKey) ||
         e.type == "dblclick"
     ) {
       e.stopPropagation();
       if( $(e.target).hasClass("td")) {
         $(e.target).find(".editable_view").trigger("editable_toggle");
         $(e.target).find(":disabled").prop("disabled", false);
       } else {
       };
     };
   })
  ;

  return ret;
};

function actionViewTemplates() {
  workarea.empty();
  fixed_div.empty();
  run_query({"action": "get_templates"}, function(res) {
    g_data = res['ok'];

    let table = $(DIV).addClass("table")
     .appendTo(workarea)
    ;

    $(DIV).addClass("thead")
     .append( $(SPAN).addClass("th").text("Имя").title("Отображаемое имя поля. Должно быть уникальным") )
     .append( $(SPAN).addClass("th").text("Коментарий") )
     .append( $(SPAN).addClass("th").text("Поля") )
     .append( $(SPAN).addClass("th") )
     .appendTo(table)
    ;

    let tbody = $(DIV).addClass("tbody")
     .appendTo(table)
    ;

    let ks = keys(g_data['tps']);
    ks.sort(function(a, b) { return Number(a) - Number(b) });

    for(let i in ks) {
      let tp_id = ks[i];
      tbody.append( template_row(g_data['tps'][tp_id]) );
    };

    table
     .append( $(DIV).addClass("tfoot")
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .css({"margin-right": "0.5em"})
           .click(function() {
             if(g_autosave_changes > 0) {
               show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
               return;
             };

             let tp_name = String($(this).closest(".tfoot").find(".tp_name").val()).trim();

             let highlight = $([]);

             let found = false;

             if(tp_name == "") {
               highlight = highlight.add($(this).closest(".tfoot").find(".tp_name"));
               found = true;
             } else {

               for(let i in g_data['tps']) {
                 if(tp_name == String(g_data['tps'][i]['tp_name']).trim()) {
                   highlight = highlight.add($(this).closest(".tfoot").find(".tp_name"));
                   found = true;
                   break;
                 };
               };
             };

             if(found) {
               highlight.animateHighlight("red", 300);
               return;
             };

             run_query({"action": "add_tp", "tp_name": tp_name}, function(res) {
               if(res['ok']['aux_userinfo'] !== undefined) {
                 if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
                 for(let u_id in res['ok']['aux_userinfo']) {
                   g_data['aux_userinfo'][u_id] = res['ok']['aux_userinfo'][u_id];
                 };
               };

               let tp_id = res['ok']['tp']['tp_id'];
               g_data['tps'][tp_id] = res['ok']['tp'];
               let new_row = template_row(res['ok']['tp']);
               new_row.appendTo( $(".tbody") );
               new_row.find(".edit_btn").trigger("click");
             });
           })
         )
         .append( $(INPUT)
           .addClass("tp_name")
           .css({ 'width': '10em' })
         )
       )
     )
    ;
  });
};

function template_row(row_data) {
  let ret = $(DIV).addClass("tr")
   .data("row_data", row_data)
  ;

  ret
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "tp",
         "prop": "tp_name",
         "id": String(row_data['tp_id']),
         "_edit_css": { 'width': '10em' },
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         "object": "tp",
         "prop": "tp_descr",
         "id": String(row_data['tp_id']),
       })
     )
   )
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append( $(INPUT)
       .prop("type", "hidden")
       .val(row_data['fields'])
       .addClass("fields")
       .saveable({
         "object": "tp",
         "prop": "fields",
         "id": String(row_data['tp_id']),
       })
     )
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-bullets"])
       .addClass("off_btn")
       .click(function() {
         if($(this).hasClass("off_btn")) return;
         let input = $(this).closest(".tr").find(".fields");
         select_net_cols( String(input.val()).split(","), function(new_list) {
           input.val(new_list.join(",")).trigger("input_stop");
         });
       })
     )
   )
   .append( $(SPAN).addClass("td")
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-edit", "edit_btn"])
       .click(function() {
         let row = $(this).closest(".tr");
         let tp_id = row.data("row_data")['tp_id'];
         if((row.find(".editable_view,.off_btn").length) > 0) {
           row.find(".editable_view").trigger("editable_toggle");
           row.find(".off_btn").removeClass("off_btn").addClass("on_btn");
         } else if(row.find(".editable_edit,.on_btn").length > 0) {
           row.find(".editable_edit").trigger("editable_toggle");
           row.find(".on_btn").removeClass("on_btn").addClass("off_btn");
           row.find(".fields").val(g_data['tps'][tp_id]['fields']).trigger("input_stop");
         };
       })
     )
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
       .css("margin-left", "0.5em")
       .click(function() {
         if(g_autosave_changes > 0) {
           show_dialog("На странице есть несохраненные поля.\nСперва сохраните изменения.");
           return;
         };
         let row = $(this).closest(".tr");
         let tp_id = row.data("row_data")['tp_id'];

         show_confirm("Подтвердите удаление шаблона.\nВнимание: отмена будет невозможна", function() {
           run_query({"action": "del_tp", "tp_id": String(tp_id)}, function(res) {
             row.remove();
             delete(g_data['tps'][tp_id]);
           });
         });
       })
     )
   )
  ;

  ret
   .on("click dblclick", function(e) {
     if ((e.type == "click" && e.ctrlKey) ||
         e.type == "dblclick"
     ) {
       e.stopPropagation();
       if( $(e.target).hasClass("td")) {
         $(e.target).find(".editable_view").trigger("editable_toggle");
         $(e.target).find(".off_btn").removeClass("off_btn").addClass("on_btn");
       };
     };
   })
  ;

  return ret;
};

function select_net_cols(presel, donefunc) {
  run_query({"action": "get_netcols"}, function(res) {

    let dialog = $(DIV).addClass("dialog_start")
     .data("donefunc", donefunc)
     .title("Выбор полей")
    ;

    let table = $(DIV).addClass("table")
     .append( $(DIV).addClass("thead")
       .append( $(SPAN).addClass("th").text("Поле") )
       .append( $(SPAN).addClass("th").text("Вкл") )
       .append( $(SPAN).addClass("th").text("Тип") )
       .append( $(SPAN).addClass("th").text("RegExp") )
     )
     .appendTo(dialog)
    ;

    for(let i in res['ok']['netcols']) {
      let ic_id = res['ok']['netcols'][i]['ic_id'];

      let is_on = in_array(presel, String(ic_id));

      let tr = $(DIV).addClass("tr")
       .append( $(SPAN).addClass("td")
         .append( $(SPAN)
           .text(res['ok']['netcols'][i]['ic_name'])
           .title(res['ok']['netcols'][i]['ic_descr']+"\n"+"API name: "+res['ok']['netcols'][i]['ic_api_name'])
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(INPUT)
           .data("ic_id", ic_id)
           .data("initial", is_on)
           .prop({"type": "checkbox", "checked": is_on})
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(SPAN)
           .text(res['ok']['netcols'][i]['ic_type'])
         )
       )
       .append( $(SPAN).addClass("td")
         .append( $(SPAN)
           .text(res['ok']['netcols'][i]['ic_regexp'])
         )
       )
       .appendTo(table)
      ;
    };

    let buttons = [];
    buttons.push({
      'text': 'Сохранить',
      'click': function() {
        let dlg = $(this);
        let donefunc = dlg.data("donefunc");

        let ret = [];

        dlg.find("INPUT[type=checkbox]").each(function() {
          let ic_id = $(this).data("ic_id");
          if($(this).is(":checked")) ret.push(String(ic_id));
        });

        ret.sort(function(a, b) { return Number(a) - Number(b); });

        dlg.dialog( "close" );
        if(donefunc !== undefined) donefunc(ret);
      },
    });

    buttons.push({
      'text': 'Отмена',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      //maxHeight:1000,
      //maxWidth:1800,
      minWidth: 600,
      width: 600,
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );
     
  });
};

function select_rights_row(object, group_data, allow_edit) {
  let ret = $(DIV).addClass("tr").addClass("rights_row")
   .data("object", object)
   .data("group", group_data)
  ;

  let title = group_data['g_descr'];
  if(group_data['fk_u_id'] !== undefined && group_data['fk_u_id'] !== null &&
     g_data['aux_userinfo'][ group_data['fk_u_id'] ] !== undefined
  ) {
    title += "\nДоступ добавлен: "+from_unix_time(group_data['ts'], false, "н.д.");
    title += "\nПользователем: "+g_data['aux_userinfo'][ group_data['fk_u_id'] ]['u_name']+" ("+
             g_data['aux_userinfo'][ group_data['fk_u_id'] ]['u_login']+")";
  } else if (group_data['_new'] !== undefined) {
    title += "\nДоступ добавлен: "+from_unix_time(unix_timestamp());
    title += "\nВами, только что";
  };

  ret
   .append( $(SPAN).addClass("td")
     .append( $(SPAN)
       .text(group_data['g_name'])
       .title(title)
     )
   )
  ;

  ret.append( rights_tds(object, group_data['rights'], allow_edit) );

  if(allow_edit) {
    ret
     .append( $(SPAN).addClass("td")
       .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-minus"])
         .click(function() {
           let dlg = $(this).closest(".dialog_start");
           let group = $(this).closest(".tr").data("group");
           let select = dlg.find("SELECT");
           select
            .append( $(OPTION)
              .text( group['g_name'] )
              .title( group['g_descr'] )
              .val( group['g_id'] )
            )
           ;
           $(this).closest(".tr").remove();
         })
       )
     )
    ;
  };

  return ret;
};

function select_rights(object, current, allow_edit, on_done) {
  run_query({'action': 'get_groups'}, function(res) {

    if(res['ok']['users'] !== undefined) {
      if(g_data['aux_userinfo'] === undefined) g_data['aux_userinfo'] = {};
      for(let u_id in res['ok']['users']) {
        g_data['aux_userinfo'][u_id] = res['ok']['users'][u_id];
      };
    };

    let current_index = {};

    for(let i in current) {
      current_index[ current[i]['g_id'] ] = current[i];
    };

    let dialog = $(DIV).addClass("dialog_start")
     .data('object', object)
     .data('on_done', on_done)
     .data('allow_edit', allow_edit)
    ;

    dialog.title("Права доступа");

    let table = $(DIV).addClass("table")
     .appendTo(dialog)
    ;

    let groups_indexed = {};
    let not_in_list = [];

    for(let i in res['ok']['gs']) {
      let g_id = res['ok']['gs'][i]['g_id'];
      groups_indexed[g_id] = res['ok']['gs'][i];
      if(current_index[g_id] === undefined) {
        not_in_list.push(g_id);
        continue;
      };
      let group_data = {};
      group_data['g_id'] = g_id;
      group_data['g_name'] = res['ok']['gs'][i]['g_name'];
      group_data['g_descr'] = res['ok']['gs'][i]['g_descr'];
      group_data['fk_u_id'] = current_index[g_id]['fk_u_id'];
      group_data['ts'] = current_index[g_id]['ts'];
      group_data['rights'] = current_index[g_id]['rights'];

      table.append( select_rights_row(object, group_data, allow_edit) );
    };

    dialog
     .data('groups', groups_indexed)
    ;

    if(allow_edit) {
      let last_row = $(DIV).addClass("tr").addClass("new_rights_row")
      ;

      let select = $(SELECT)
       .append( $(OPTION).text("Выберете группу...").val(0) )
       .val(0)
       .tooltip({
         classes: { "ui-tooltip": "ui-corner-all ui-widget-shadow wsp tooltip" },
         items: "SELECT",
         content: function() {
           return $(this).find("OPTION:selected").prop("title");
         }
       })
      ;

      for(let i in not_in_list) {
        let g_id = not_in_list[i];
        select
         .append( $(OPTION)
           .text(groups_indexed[g_id]['g_name'])
           .title(groups_indexed[g_id]['g_descr'])
           .val(g_id)
         )
        ;
      };

      last_row
       .append( $(SPAN).addClass("td")
         .append( select )
       )
      ;

      last_row
       .append( rights_tds(object, 0, true) )
      ;

      last_row
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .click(function() {
             let dialog = $(this).closest(".dialog_start");
             let select = dialog.find("SELECT");
             let option = select.find(":selected");
             let tr = $(this).closest(".tr");
             let g_id = select.val();
             if(g_id == 0) return;

             let this_rights = 0;

             tr.find(".right").each(function() {
               if( $(this).hasClass("right_on") ) {
                 this_rights = this_rights | $(this).data("right");
                 $(this).removeClass("right_on").addClass("right_off");
               };
             });

             if(this_rights == 0) return;

             let new_g_data = {};
             new_g_data['g_id'] = g_id;
             new_g_data['g_name'] = dialog.data("groups")[g_id]['g_name'];
             new_g_data['g_descr'] = dialog.data("groups")[g_id]['g_descr'];
             new_g_data['fk_u_id'] = user_self_id;
             new_g_data['ts'] = unix_timestamp();
             new_g_data['rights'] = this_rights;

             let new_row = select_rights_row(dialog.data("object"), new_g_data, true);
             new_row.insertBefore(tr);
             option.remove();
           })
         )
       )
      ;

      table.append( last_row );
    };

    let buttons = [];

    if(allow_edit) {
      buttons.push({
        'text': 'Сохранить',
        'click': function() {
          let dlg = $(this);

          let rights = [];

          let empty_rows = $([]);

          let new_rights_row_rights = 0;

          dlg.find(".new_rights_row").find(".right").each(function() {
            if($(this).hasClass("right_on")) {
              let right = $(this).data("right");
              new_rights_row_rights |= right;
            };
          });

          if(new_rights_row_rights != 0) {
            empty_rows = empty_rows.add(dlg.find(".new_rights_row"));
          };

          dlg.find(".rights_row").each(function() {
            let this_rights = 0;
            $(this).find(".right").each(function() {
              if($(this).hasClass("right_on")) {
                let right = $(this).data("right");
                this_rights |= right;
              };
            });
            if(this_rights > 0) {
              let group = $(this).data("group");
              rights.push({'fk_u_id': group['fk_u_id'], 'g_id': String(group['g_id']), 'rights': String(this_rights),
                           'ts': group['ts']
              });
            } else {
              empty_rows = empty_rows.add( $(this) );
            };
          });

          if(empty_rows.length != 0) {
            empty_rows.animateHighlight("red", 300);
            return;
          };

          rights.sort(function(a, b) { return Number(a['g_id']) - Number(b['g_id']) });

          let done_func = dlg.data("on_done");
          dlg.dialog( "close" );
          if(done_func !== undefined) done_func(rights);
        },
      });
    };

    buttons.push({
      'text': allow_edit?'Отмена':'Закрыть',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      maxHeight:1000,
      maxWidth:1800,
      minWidth:1200,
      width: "auto",
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dialog.appendTo("BODY");
    dialog.dialog( dialog_options );
  });
};

$.jstree.plugins.myplugin = function (options, parent) {
  this.redraw_node = function(obj, deep, callback, force_draw) {
    obj = parent.redraw_node.call(this, obj, deep, callback, force_draw);
    if (obj) {
      var node = this.get_node($(obj).attr('id'));
      if (node && 
          node.data
      ) {
        let tag_label = $(obj).find("a").first();
        tag_label.title("Id:"+node['id']+" "+node['data']['descr']);
        let labels  = $([]);
        if(node['data']['groups_rights'] !== undefined && node['data']['groups_rights'].length > 0) {
          labels = labels.add( $(LABEL)
            .addClass(["ui-icon", "ui-icon-users"]).css({"margin-left": "0.5em", "color": "darkblue"})
            .title("Заданы права")
          );
        };
        if((node['data']['flags'] & F_ALLOW_LEAFS) > 0) {
          labels = labels.add( $(LABEL)
            .addClass(["ui-icon", "ui-icon-structure"]).css({"margin-left": "0.5em", "color": "darkgreen"})
            .title(g_tag_flags[F_ALLOW_LEAFS]['descr'])
          );
        };
        if((node['data']['flags'] & F_DENY_SELECT) > 0) {
          labels = labels.add( $(LABEL)
            .addClass("flag_"+F_DENY_SELECT)
            .addClass(["ui-icon", "ui-icon-forbidden"]).css({"margin-left": "0.5em", "color": "darkorange"})
            .title(g_tag_flags[F_DENY_SELECT]['descr'])
          );
        };
        if((node['data']['flags'] & F_DISPLAY) > 0) {
          labels = labels.add( $(LABEL)
            .addClass(["ui-icon", "ui-icon-flag"]).css({"margin-left": "0.5em", "color": "darkgreen"})
            .title(g_tag_flags[F_DISPLAY]['descr'])
          );
        };
        if((node['data']['flags'] & F_IN_LABEL) > 0) {
          labels = labels.add( $(LABEL)
            .addClass(["ui-icon", "ui-icon-tag"]).css({"margin-left": "0.5em", "color": "darkgreen"})
            .title(g_tag_flags[F_IN_LABEL]['descr'])
          );
        };
        if(node['data']['used'] > 0 || node['data']['used_children'] > 0) {
          labels = labels.add( $(LABEL).text(String(node['data']['used'])+":"+String(node['data']['used_children']))
            .title("Используется в "+node['data']['used']+" объектах\n"+
                   "Дочерние теги используются в "+node['data']['used_children']+" объектах"
            )
            .css({"margin-left": "0.5em", "color": "black", "font-size": "x-small", "vertical-align": "top"})
          );
        };
        labels.insertAfter( tag_label );
      };
    };
    return obj;
  };
};

$.jstree.defaults.myplugin = {};

function select_tag(root_api_name, preselect, donefunc, any=false) {
  run_query({"action": "get_tags_subtree", "root_api_name": root_api_name}, function(res) {

    let can_add_root = false;

    if(res['ok']['tags']['id'] === undefined &&
       (res['ok']['tags']['data']['rights'] & R_EDIT_IP_VLAN) > 0
    ) {
      can_add_root = true;
    };

    let dlg = $(DIV).addClass("dialog_start")
     .data("dlg_data", res["ok"])
     .data("preselect", preselect)
     .data("donefunc", donefunc)
     .data("any", any)
     .title(donefunc !== undefined?"Выбор тега":"Управление тегами")
     .css({
       "display": "flex",
       "flex-direction": "column",
     })
    ;

    dlg
     .append( $(DIV)
       .append( $(DIV)
         .css({"font-size": "larger"})
         .append( $(SPAN).html("&nbsp;").css({"display": "inline-block"}) )
         .append( $(SPAN).addClass("tag_info")
           .append( $(SPAN).text("Тег: ") )
           .append( $(SPAN).addClass("tag_name") )
           .append( $(SPAN).text(" API имя: ")
             .title("Чтобы задать API имя, переименуйте тег и задайте имя в скобках")
           )
           .append( $(SPAN).addClass("tag_api_name")
             .title("Чтобы задать API имя, переименуйте тег и задайте имя в скобках")
           )
           .hide()
         )
       )
       .append( $(DIV)
         .css({"margin-top": "0.5em", "min-height": "1.8em"})
         .append( $(SPAN).html("&nbsp;").css({"display": "inline-block"}) )
         .append( $(SPAN).addClass("tag_info")
           .append( $(SPAN).text("Описание: ") )
           .append( $(INPUT).addClass("tag_descr").css({"width": "40em"})
             .enterKey(function() { $(".save_descr_btn").trigger("click"); })
           )
           .append( $(LABEL)
             .addClass(["button", "ui-icon", "ui-icon-save save_descr_btn"])
             .click(function() {
               let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);
               let nodes = instance.get_selected(true);
               if(nodes.length != 1) return;
               let node = nodes[0];

               let parent_node = instance.get_node(node['parent']);

               if((parent_node['data']['rights'] & R_EDIT_IP_VLAN) == 0) return;

               let new_descr = String($(".tag_descr").val()).trim();
               node['data']['descr'] = new_descr;
               if(new_descr === node['data']['orig_descr']) return;

               run_query({"action": "set_tag_descr", "id": String(node['id']), "descr": new_descr}, function(res) {
                 node['data']['orig_descr'] = new_descr;
                 instance.redraw_node(node, false, false, false);
                 if(g_data['tags'] !== undefined && g_data['tags'][ node['id'] ] !== undefined) {
                   g_data['tags'][ node['id'] ]['tag_descr'] = new_descr;
                 };
               });

             })
           )
           .hide()
         )
       )
       .append( $(DIV)
         .css({"margin-top": "0.5em", "min-height": "1.8em"})
         .append( $(SPAN).html("&nbsp;").css({"display": "inline-block"}) )
         .append( $(SPAN).addClass("tag_info")
           .append( $(SPAN).text("Опции: ")
             .title("Опции для использования во внешних системах")
           )
           .append( $(INPUT).addClass("tag_options").css({"width": "40em"})
             .enterKey(function() { $(".save_options_btn").trigger("click"); })
           )
           .append( $(LABEL)
             .addClass(["button", "ui-icon", "ui-icon-save save_options_btn"])
             .click(function() {
               let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);
               let nodes = instance.get_selected(true);
               if(nodes.length != 1) return;
               let node = nodes[0];

               if((node['data']['rights'] & R_MANAGE_NET) == 0) return;

               let new_options = String($(".tag_options").val()).trim();
               node['data']['options'] = new_options;
               if(new_options === node['data']['orig_options']) return;

               run_query({"action": "set_tag_options", "id": String(node['id']), "options": new_options}, function(res) {
                 node['data']['orig_options'] = new_options;
                 instance.redraw_node(node, false, false, false);
                 if(g_data['tags'] !== undefined && g_data['tags'][ node['id'] ] !== undefined) {
                   g_data['tags'][ node['id'] ]['tag_options'] = new_options;
                 };
               });
             })
           )
           .hide()
         )
       )
       .append( $(DIV)
         .css({"margin-top": "0.5em", "min-height": "1.8em"})
         .append( $(SPAN).html("&nbsp;").css({"display": "inline-block"}) )
         .append( $(SPAN).addClass("tag_info")
           .append( $(SPAN).text("Флаги: ") )
           .append( $(SPAN).addClass("tag_flags") )
           .append( $(SPAN).text(" Права доступа: ") )
           .append( $(SPAN).addClass("tag_rights") )
           .append( $(SPAN).addClass("min1em") )
           .append( $(LABEL)
             .addClass("button")
             .addClass("rights_btn")
             .text("Права групп")
             .click(function() {
               let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);
               let nodes = instance.get_selected(true);
               if(nodes.length != 1) return;

               let node = nodes[0];
               if((node['data']['rights'] & R_MANAGE_NET) == 0) return;

               select_rights('tag', node['data']['groups_rights'], true, function(new_rights) {

                 let rights_index = {};
                 for(let i in new_rights) {
                   rights_index[ String(new_rights[i]['g_id']) ] = String(new_rights[i]['rights']);
                 };

                 var has_changes = false;
                 let prev_rights_index = {};
                 for(let i in node['data']['groups_rights']) {
                   let g_id = String(node['data']['groups_rights'][i]['g_id']);
                   let rights = String(node['data']['groups_rights'][i]['rights']);
                   if(rights_index[ g_id ] !== rights) {
                     has_changes = true;
                     break;
                   };
                   prev_rights_index[ g_id ] = rights;
                 };

                 if(!has_changes) {
                   for(let i in rights_index) {
                     let g_id = i;
                     let rights = rights_index[i];
                     if(prev_rights_index[g_id] !== rights) {
                       has_changes = true;
                       break;
                     };
                   };
                 };

                 if(has_changes) {
                   node['data']['groups_rights'] = new_rights;

                   run_query({"action": "set_tag_rights", "rights": rights_index, "id": String(node['id'])}, function(res) {
                     node['data']['orig_groups_rights'] = new_rights;
                     instance.redraw_node(node, false, false, false);
                   });
                 };
   
               });
             })
           )
           .hide()
         )
       )
       .append( $(DIV)
         .css({"margin-top": "0.5em"})
         .append( $(SPAN).text("Поиск: ") )
         .append( $(INPUT).prop("type", "search")
           .inputStop(500)
           .on("input_stop", function() {
             $(this).closest(".dialog_start").find(".tree").jstree(true).search($(this).val());
           })
         )
       )
       .append( $(DIV)
         .append( !can_add_root ? $(LABEL):$(LABEL)
           .addClass("add_root_btn")
           .addClass(["button"])
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-plus"]) )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-folder"]) )
           .title("Добавить коллекцию")
           .click(function() {
             let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);

             let parent_node = instance.get_node("#");

             if((parent_node['data']['rights'] & R_EDIT_IP_VLAN) == 0) return;
             if((parent_node['data']['flags'] & F_ALLOW_LEAFS) == 0) return;

             let parent_children = parent_node['children'];
             let new_name = "Новая коллекция";

             let counter = 1;
             let found = false;
             do {
               found = false;
               for(let i in parent_children) {
                 let child = instance.get_node(parent_children[i]);
                 if(child['data']['name'] === new_name) {
                   found = true;
                   break;
                 };
               };
               if(found) {
                 new_name = "Новая коллекция #"+counter;
                 counter++;
               };
             } while(found);

             let new_data = {"text": new_name,
                             "children": [],
                             "data": { "flags": 0, "api_name": null, "descr": "",
                                       "used": 0, "used_children": 0, "name": new_name,
                                       "orig_name": new_name, "orig_api_name": null, "orig_flags": 0,
                                       "rights": parent_node['data']['rights'],
                                       "groups_rights": [], "orig_groups_rights": [],
                                     },
             };
             instance.create_node("#", new_data, "last");
           })
         )
         .css({"margin-top": "0.5em", "min-height": "1.6em"})
         .append( $(LABEL)
           .addClass("add_sibling_btn")
           .addClass(["button"])
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-plus"]) )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-1-s"]) )
           .title("Добавить следующий тег (можно также нажать + или Ins)")
           .click(function() {
             let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);

             let nodes = instance.get_selected(true);
             if(nodes.length != 1) return;
             let node = nodes[0];

             let parent_node = instance.get_node(node['parent']);

             if((parent_node['data']['rights'] & R_EDIT_IP_VLAN) == 0) return;
             if((parent_node['data']['flags'] & F_ALLOW_LEAFS) == 0) return;

             let parent_children = parent_node['children'];
             let new_name = "Новый тег";

             let counter = 1;
             let found = false;
             do {
               found = false;
               for(let i in parent_children) {
                 let child = instance.get_node(parent_children[i]);
                 if(child['data']['name'] === new_name) {
                   found = true;
                   break;
                 };
               };
               if(found) {
                 new_name = "Новый тег #"+counter;
                 counter++;
               };
             } while(found);

             let node_index = undefined;

             for(let i in parent_children) {
               if(parent_children[i] == node['id']) {
                 node_index = i;
                 break;
               };
             };


             let new_data = {"text": new_name,
                             "children": [],
                             "data": { "flags": 0, "api_name": null, "descr": "",
                                       "used": 0, "used_children": 0, "name": new_name,
                                       "orig_name": new_name, "orig_api_name": null, "orig_flags": 0,
                                       "rights": parent_node['data']['rights'],
                                       "groups_rights": [], "orig_groups_rights": [],
                                     },
             };
             instance.create_node(node['parent'], new_data, Number(node_index)+1);
           })
           .hide()
         )
         .append( $(LABEL)
           .addClass("add_child_btn")
           .addClass(["button"])
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-plus"]) )
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-arrow-1-se"]) )
           .title("Добавить дочерний тег")
           .click(function() {
             let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);

             let nodes = instance.get_selected(true);
             if(nodes.length != 1) return;
             let node = nodes[0];

             if((node['data']['flags'] & F_ALLOW_LEAFS) == 0) return;
             if((node['data']['rights'] & R_EDIT_IP_VLAN) == 0) return;

             let new_name = "Новый тег";

             let counter = 1;
             let found = false;
             do {
               found = false;
               for(let i in node['children']) {
                 let child = instance.get_node(node['children'][i]);
                 if(child['data']['name'] === new_name) {
                   found = true;
                   break;
                 };
               };
               if(found) {
                 new_name = "Новый тег #"+counter;
                 counter++;
               };
             } while(found);


             let new_data = {"text": new_name,
                             "children": [],
                             "data": {"flags": 0, "api_name": null, "descr": "",
                                       "used": 0, "used_children": 0, "name": new_name,
                                       "orig_name": new_name, "orig_api_name": null, "orig_flags": 0,
                                       "rights": node['data']['rights'],
                                       "groups_rights": [], "orig_groups_rights": [],
                                     },
             };
             instance.create_node(node['id'], new_data, "last");
           })
           .hide()
         )
         .append( $(LABEL)
           .addClass("del_tag_btn")
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-trash"]) )
           .addClass(["button", "min2em"])
           .css({"text-align": "center"})
           .title("Удалить тег (можно также нажать - или Del")
           .click(function() {
             if(!$(this).is(":visible")) return;
             let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);

             let nodes = instance.get_selected(true);
             if(nodes.length != 1) return;
             let node = nodes[0];

             let parent_node = instance.get_node(node['parent']);

             if((parent_node['data']['rights'] & R_EDIT_IP_VLAN) == 0) return;

             if((node['data']['used'] > 0 || node['data']['used_children'] > 0) &&
                (node['data']['rights'] & R_MANAGE_NET) == 0
             ) {
               return;
             };


             let warn_message = "Подтвердите удаление тега.\n";
             if(node['data']['used'] > 0) {
               warn_message += "Он используется в "+node['data']['used']+" объектах.\n";
             };
             if(node['data']['used_children'] > 0) {
               warn_message += "В "+node['data']['used_children']+
                               " объектах используются дочерние теги.\n";
             };
             if(node['children'].length > 0 ) {
               warn_message += "У него "+node['children'].length+
                               " дочерних тегов.\n";
             };
             if(g_autosave) {
               warn_message += "Внимание! Отмена будет невозможна!";
             } else {
               warn_message += "Внимание! После сохранения отмена будет невозможна!";
             };
             show_confirm_checkbox(warn_message, function() {
               instance.delete_node(node);
             }, {}, (Number(node['data']['used']) + Number(node['data']['used_children']) + node['children'].length) == 0);
           })
           .hide()
         )
         .append( $(LABEL)
           .addClass("edit_tag_btn")
           .append( $(LABEL).addClass(["ui-icon", "ui-icon-edit"]) )
           .addClass(["button", "min2em"])
           .css({"text-align": "center"})
           .title("Редактировать (можно также нажать F2")
           .click(function() {
             let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);

             let nodes = instance.get_selected(true);
             if(nodes.length != 1) return;
             let node = nodes[0];

             instance.edit(node);
           })
           .hide()
         )
         .append( $(SPAN)
           .css({"float": "right"})
           .addClass("wsp")
           .append( $(SPAN).text("Образец: ") )
           .append( $(SPAN).addClass("tag_preview") )
         )
         .css({"margin-top": "0.5em"})
       )
     )
    ;

    let tree_cont = $(DIV).appendTo( dlg )
     .css({
       "overflow": "auto",
       "flex": "1 1 0%",
     })
    ;

    let tree = $(DIV).addClass("tree")
     .appendTo( tree_cont )
    ;

    let tree_plugins = [ "state", "search", "dnd", "types", "unique", "myplugin" ];

    tree.jstree({
      "core": {
        "multiple" : false,
        "animation" : 0,
        "data": (res['ok']['tags']['id'] === undefined)?res['ok']["tags"]["children"]:res['ok']["tags"],
        "themes" : {
          "variant" : "large"
        },
        "dblclick_toggle": true,
        "force_text": true,
        "check_callback" : function (operation, node, parent_node, node_position, more) {
          let instance = this;

          if((parent_node['data']['rights'] & R_EDIT_IP_VLAN) == 0) return false;

          if(operation === "move_node") {
            let current_parent = instance.get_node(node['parent']);
            if((current_parent['data']['rights'] & R_EDIT_IP_VLAN) == 0) return false;

            if((node['parent'] == '#' && parent_node['id'] != '#') ||
               (node['parent'] != '#' && parent_node['id'] == '#')
            ) {
              return false;
            };

            if(node['parent'] != parent_node['id']) {
              if((current_parent['data']['rights'] & R_MANAGE_NET) == 0) return false;
              if((parent_node['data']['rights'] & R_MANAGE_NET) == 0) return false;

              if((parent_node['data']['flags'] & F_ALLOW_LEAFS) == 0) return false;

              let node_root = node['id'];
              if(node['parents'].length > 1) {
                node_root = node['parents'][ node['parents'].length - 2];
              };

              let parent_root = parent_node['id'];
              if(parent_node['parents'].length > 1) {
                parent_root = parent_node['parents'][ parent_node['parents'].length - 2 ];
              };

              if(node_root != parent_root) return false;

            };

            return true;
          } else if(operation === "create_node") {

            return ((parent_node['data']['flags'] & F_ALLOW_LEAFS) > 0);
          } else if(operation === "rename_node" || operation === "edit" || operation === "delete_node") {
            if((Number(node['data']['used']) + Number(node['data']['used_children'])) > 0 &&
               (node['data']['rights'] & R_MANAGE_NET) == 0
            ) {
              return false;
            };

            if(operation === "rename_node") {

              let matches = String(node_position).match(g_node_name_reg);
              if(matches === null) {
                //this.get_node(node, true).find("a").first().find("i").animateHighlight("red", 300);
                return false;
              };
              let new_name = String(matches[1]).trim();
              let new_api_name = null;

              if(matches[2] !== undefined) {
                let trimmed = String(matches[2]).trim().toLowerCase();
                if(trimmed != "") new_api_name = trimmed;
              };

              if(node['data']['api_name'] !== new_api_name &&
                 (node['data']['rights'] & R_MANAGE_NET) == 0
              ) {
                show_dialog("Для изменения API имени нужны права \""+g_rights[R_MANAGE_NET]['label']+"\"");
                return false;
              };

              let found = false;
              let found_node;
              for(let i in parent_node['children']) {
                let child_node = this.get_node(parent_node['children'][i]);
                if(child_node['id'] != node['id']) {
                  if(String(child_node['data']['name']).trim() == new_name ||
                     (new_api_name !== null &&
                      child_node['data']['api_name'] !== null &&
                      String(child_node['data']['api_name']).trim().toLowerCase() === new_api_name
                     )
                  ) {
                    found = true;
                    found_node = this.get_node(child_node['id']);
                    break;
                  };
                };
              };

              if(!found && new_api_name !== null) {
                found = false;
                let full_list = this.get_json("#", {"no_state": true,
                                                    "no_a_attr": true,
                                                    "no_li_attr": true,
                                                    "flat": true,
                                                    "no_icon": true,
                                                   }
                );
                for(let i in full_list) {
                  if(full_list[i]['id'] != node['id']) {
                    if(full_list[i]['data']['api_name'] !== null &&
                       String(full_list[i]['data']['api_name']).trim().toLowerCase() === new_api_name
                    ) {
                      found = true;
                      found_node = this.get_node(full_list[i]['id']);
                      break;
                    };
                  };
                };
              };
              if(found) {
                for(let i in found_node['parents']) {
                  if(found_node['parents'][i]['id'] != "#") {
                    this.open_node(found_node['parents'][i]);
                  };
                };
                this.get_node(found_node, true).find("a").first().find("i").animateHighlight("red", 300);
                return false;
              };
            };

            return true;
          } else {
            debugLog(operation);
            return false;
          };
        },
      },
      "state" : { "key" : "jstree"+user_self_sub },
      "types": {
        "default": {
          "icon": "ui-icon ui-icon-tag tag-color"
        },
        "root": {
          "icon": true
        }
      },
      "unique": {
        "trim_whitespace": true,
      },
      "dnd": {
        "copy": false,
        "is_draggable": function(data) {
          if(data.length == 0)  return false;

          let parent_node = this.get_node(data[0]['parent']);

          return (parent_node['data']['rights'] & R_EDIT_IP_VLAN) > 0;
        },
      },
      "plugins" : tree_plugins,
    });

    tree
     .on("deselect_node.jstree", function(e, data) {
       dlg.find(".add_sibling_btn,.add_child_btn,.del_tag_btn").hide();
       dlg.find(".tag_info").hide();
     })
     .on("select_node.jstree", function(e, data) {
       let dlg = $(this).closest(".dialog_start");
       dlg.find(".tag_preview").empty();
       let instance = dlg.find(".tree").jstree(true);
       let dlg_data = dlg.data("dlg_data");
       let any = dlg.data("any");
       let nodes = instance.get_selected(true);
       if(nodes.length == 0) {
         dlg.find(".tag_info").hide();
         return;
       };
       let node = nodes[0];

       dlg.find(".tag_preview").append( get_tag_elm(node['id'], false) );

       let parent_node = instance.get_node(node['parent']);

       if(parent_node['id'] === "#" && parent_node['data'] === undefined) parent_node['data'] = dlg_data['tags']['data'];

       dlg.find(".rights_btn").toggle((node['data']['rights'] & R_MANAGE_NET) > 0);

       let rights_elms = rights_tds("tag", node['data']['rights'], false, "tag_right", "tag_rights");
       dlg.find(".tag_rights").empty().append(rights_elms);

       dlg.find(".tag_name").text(node['data']['name']);
       dlg.find(".tag_api_name").text(node['data']['api_name'] !== null?node['data']['api_name']:'не задан.');
       dlg.find(".tag_descr").val(node['data']['descr']);
       dlg.find(".tag_options").val(node['data']['options']);
       dlg.find(".tag_options").prop("readonly", (node['data']['rights'] & R_MANAGE_NET) == 0);

       let flags_elms = $([]);
       let flags = (node['data']['flags'] !== undefined)?node['data']['flags']:0;

       let flags_keys = keys(g_tag_flags);
       flags_keys.sort(function(a, b) { return Number(a) - Number(b); });

       let can_edit = ((node['data']['rights'] & R_MANAGE_NET) > 0 ||
                       ((Number(node['data']['used']) + Number(node['data']['used_children'])) == 0 &&
                        (parent_node['data']['rights'] & R_EDIT_IP_VLAN) > 0
                       )
       );

       let can_manage = ((node['data']['rights'] & R_MANAGE_NET) > 0);

       dlg.find(".edit_tag_btn").toggle(can_edit);

       dlg.find(".tag_descr").prop("readonly", !can_edit);

       for(let i in flags_keys) {
         let flag = flags_keys[i];
         let elm = $(LABEL)
          .addClass(["flag", "flag_"+flag, ((flags & flag) > 0)?"flag_on":"flag_off", "ns",
                     can_manage?"can_edit":"cannot_edit"
                    ]
          )
          .text(g_tag_flags[flag]['label'])
          .title(g_tag_flags[flag]['descr'])
         ;

         if(can_manage) {
           elm
            .data("flag", flag)
            .data("node", node['id'])
            .click(function() {
              let row = $(this).closest(".tag_flags");
              let node_id = $(this).data("node");
              let flag = $(this).data("flag");
              if($(this).hasClass("flag_on")) {
                $(this).removeClass("flag_on").addClass("flag_off");

                for(let i in g_tag_flags[flag]['required_by']) {
                  let rr = g_tag_flags[flag]['required_by'][i];
                  row.find(".flag_"+rr).removeClass("flag_on").addClass("flag_off");
                };
              } else {
                $(this).removeClass("flag_off").addClass("flag_on");
                for(let i in g_tag_flags) {
                  if(in_array(g_tag_flags[i]['required_by'], flag)) {
                    row.find(".flag_"+i).removeClass("flag_off").addClass("flag_on");
                  };
                };
                for(let i in g_tag_flags[flag]['conflict_with']) {
                  let rr = g_tag_flags[flag]['conflict_with'][i];
                  row.find(".flag_"+rr).removeClass("flag_on").addClass("flag_off");
                };
              };

              let flags = 0;
              row.find(".flag").each(function() {
                if($(this).hasClass("flag_on")) flags |= Number($(this).data("flag"));
              });
              let instance = $(this).closest(".dialog_start").find(".tree").jstree(true);
              let node = instance.get_node(node_id);
              node['data']['flags'] = flags;
              instance.trigger("select_node.jstree");

              if(node['data']['orig_flags'] != flags) {
                run_query({"action": "set_tag_flags", "id": String(node['id']), "flags": String(flags)}, function(res) {
                  node['data']['orig_flags'] = flags;
                  if(g_data['tags'] !== undefined && g_data['tags'][ node['id'] ] !== undefined) {
                    g_data['tags'][ node['id'] ]['tag_flags'] = flags;
                  };
                  instance.redraw_node(node, false, false, false);
                });
              };
            })
           ;
         };

         flags_elms = flags_elms.add(elm);
       };

       dlg.find(".tag_flags").empty().append(flags_elms);

       dlg.find(".tag_info").show();

       dlg.find(".del_tag_btn").toggle(can_edit && node['children'].length === 0);

       let allow_sibling = node['parent'] != "#" && (parent_node['data']['flags'] & F_ALLOW_LEAFS) > 0 &&
                           (parent_node['data']['rights'] & R_EDIT_IP_VLAN) > 0;
       dlg.find(".add_sibling_btn").toggle(allow_sibling);

       let allow_child = (node['data']['flags'] & F_ALLOW_LEAFS) > 0 && (node['data']['rights'] & R_EDIT_IP_VLAN) > 0;
       dlg.find(".add_child_btn").toggle(allow_child);
       
     })
     /*.on("dblclick.jstree", function (e) {
       let instance = $.jstree.reference(this);
       let node = instance.get_node(e.target);
       instance.edit(node);
     })*/
     .on("move_node.jstree", function (e, data) {
       let instance = data.instance;
       let node = data['node'];

       for(let i in node['parents']) {
         if(node['parents'][i] != "#") {
           let pn = instance.get_node(node['parents'][i]);
           pn['data']['used_children'] += (Number(node['data']['used']) + Number(node['data']['used_children']));
         };
       };

       if(data['old_parent'] != "#") {
         let old_parent = instance.get_node(data['old_parent']);
         old_parent['data']['used_children'] -= (Number(node['data']['used']) + Number(node['data']['used_children']));
         for(let i in old_parent['parents']) {
           if(old_parent['parents'][i] != "#") {
             let pn = instance.get_node(old_parent['parents'][i]);
             pn['data']['used_children'] -= (Number(node['data']['used']) + Number(node['data']['used_children']));
           };
         };
       };

       let parent_node = instance.get_node(node['parent']);
       let nodes_index = {};

       for(let i in parent_node["children"]) {
         nodes_index[ String(parent_node["children"][i]) ] = String(i);
       };

       run_query({"action": "move_tag", "id": String(node['id']),
                  "new_parent": String(node['parent']), "sort": nodes_index,
                 }, function(res) {
         if(g_data['tags'] !== undefined && g_data['tags'][ node['id'] ] !== undefined) {
           g_data['tags'][ node['id'] ]['tag_fk_tag_id'] = (node['parent'] === "#")?null:node['parent'];
           g_data['tags'][ node['id'] ]['tag_parent_id'] = (node['parent'] === "#")?"0":node['parent'];
         };
         instance.redraw(true);
       });
     })
     .on("rename_node.jstree", function (e, data) {
       let instance = data.instance;
       let node = data['node'];

       let matches = String(data.text).match(g_node_name_reg);
       if(matches === null) {
         error_at();
         return;
       };
       let new_name = String(matches[1]).trim();
       let new_api_name = null;
       if(matches[2] !== undefined) {
         let trimmed = String(matches[2]).trim().toLowerCase();
         if(trimmed != "") new_api_name = trimmed;
       };

       node['data']['name'] = new_name;
       node['data']['api_name'] = new_api_name;

       node['text'] = new_name;
       if(new_api_name !== null) node['text'] += " ("+new_api_name+")"

       instance.get_node(node, true).find("a").first().contents().last().replaceWith(node['text']);
       instance.trigger("select_node.jstree");

       if(node['data']['name'] != node['data']['orig_name'] || node['data']['api_name'] != node['data']['orig_api_name']) {
         run_query({"action": "rename_tag", "id": String(node['id']), "name": node['data']['name'],
                    "api_name": node['data']['api_name']}, function(res) {

           node['data']['orig_name'] = node['data']['name'];
           node['data']['orig_api_name'] = node['data']['api_name'];

           $(".value_tag_"+node['id']).text(node['data']['name']);

           if(g_data['tags'] !== undefined && g_data['tags'][ node['id'] ] !== undefined) {
             g_data['tags'][ node['id'] ]['tag_name'] = node['data']['name'];
             g_data['tags'][ node['id'] ]['tag_api_name'] = node['data']['api_name'];
           };

           instance.get_node(node, true).find("a").first().contents().last().replaceWith(node['text']);
           instance.trigger("select_node.jstree");

         });
       };
     })
     .on("create_node.jstree", function (e, data) {
       let instance = data.instance;
       let node = data['node'];

       let parent_node = instance.get_node(node['parent']);
       let nodes_index = {};

       for(let i in parent_node["children"]) {
         nodes_index[ String(parent_node["children"][i]) ] = String(i);
       };

       run_query({"action": "add_tag", "parent_id": String(node['parent']), "name": node['data']['name'],
                  "api_name": node['data']['api_name'],
                  "descr": "", "temp_id": String(node['id']), "sort": nodes_index,
       }, function(res) {
         instance.set_id(node['id'], res['ok']['new_id']);
         node = instance.get_node(res['ok']['new_id']);
         node['data']['flags'] = res['ok']['flags'];
         node['data']['orig_flags'] = res['ok']['flags'];
         node['data']['orig_name'] = node['data']['name'];
         node['data']['orig_descr'] = node['data']['descr'];
         node['data']['orig_api_name'] = node['data']['api_name'];
         node['data']['orig_flags'] = node['data']['flags'];

         if(g_data['tags'] !== undefined) {
           g_data['tags'][res['ok']['new_id']] = {
             'tag_id': res['ok']['new_id'],
             'tag_name': node['data']['name'],
             'tag_descr': node['data']['descr'],
             'tag_options': node['data']['options'],
             'tag_api_name': node['data']['api_name'],
             'tag_flags': node['data']['flags'],
             'tag_fk_tag_id': node['parent'] === "#"?null:node['parent'],
             'tag_parent_id': node['parent'] === "#"?"0":node['parent'],
             'ts': unix_timestamp(),
             'fk_u_id': user_self_id,
             'rights': node['data']['rights'],
           };
         };

         instance.deselect_all(true);
         instance.select_node(res['ok']['new_id']);
         instance.trigger("select_node.jstree");
         instance.edit(res['ok']['new_id']);
       })
     })
     .on("delete_node.jstree", function (e, data) {
       let instance = data.instance;
       let node = data['node'];

       run_query({"action": "del_tag", "id": String(node['id'])}, function(res) {
         for(let i in node['parents']) {
           if(node['parents'][i] != "#") {
             let pn = instance.get_node(node['parents'][i]);
             pn['data']['used_children'] -= (Number(node['data']['used']) + Number(node['data']['used_children']));
           };
         };

         if(g_data['tags'] !== undefined && g_data['tags'][node['id']] !== undefined) {
           delete(g_data['tags'][node['id']]);
         };

         $(".value_tag_"+node['id']).text("DELETED").css("color", "red");

         instance.redraw(true);
         $(this).closest(".dialog_start").find(".tree").trigger("select_node.jstree");

       });
     })
     .on("keyup", function(e) {
       if($(e.originalEvent.target).is("INPUT")) return;
       if (e.key === "+" || e.key === "Insert") {
         dlg.find(".add_sibling_btn").trigger("click");
       } else if(e.key === "-" || e.key === "Delete") {
         dlg.find(".del_tag_btn").trigger("click");
       };
     })
     .on("ready.jstree", function(e, data) {
       let instance = data.instance;
       let root = instance.get_node("#");
       if(root['data'] === undefined) {
         let dlg = $(this).closest(".dialog_start");
         let dlg_data = dlg.data("dlg_data");
         root['data'] = dlg_data['tags']['data'];
       };
       let dlg = $(this).closest(".dialog_start");
       let presel = dlg.data("preselect");
       if(presel !== null && presel !== undefined) {
         instance.deselect_all(false);
         instance.select_node(presel);
       } else {
         instance.deselect_all(true);
       };
       instance.trigger("select_node.jstree");
       dlg.dialog("option", "position", {"my": "center", "at": "center", "of": $("BODY")});
     })
    ;

    let buttons = [];
    if(donefunc !== undefined && preselect !== null && preselect !== undefined) {
      buttons.push({
        'class': 'left_dlg_button',
        'text': 'Снять выбор',
        'click': function() {
          let dlg = $(this);
          let donefunc = dlg.data("donefunc");
          dlg.dialog("close");
          if(donefunc !== undefined) {
            donefunc(null);
          };
        },
      });
    };

    if(donefunc !== undefined) {
      buttons.push({
        'text': 'Выбрать',
        'click': function() {
          let dlg = $(this);
          let donefunc = dlg.data("donefunc");
          let any = dlg.data("any");
          let instance = dlg.find(".tree").jstree(true);
          let nodes = instance.get_selected(true);

          if(nodes.length != 1) return;
          let node = nodes[0];
          if(!any && (node['data']['flags'] & F_DENY_SELECT) > 0) {
            instance.get_node(node, true).find(".flag_"+F_DENY_SELECT).first().animateHighlight("red", 300);
            return;
          };

          dlg.dialog("close");

          if(donefunc !== undefined) {
            donefunc(node['id']);
          };
        },
      });
    };

    buttons.push({
      'text': 'Закрыть',
      'click': function() {$(this).dialog( "close" );},
    });

    let dialog_options = {
      modal:true,
      maxHeight:980,
      maxWidth:1800,
      minWidth:1000,
      width: 1000,
      height: "auto",
      buttons: buttons,
      close: function() {
        $(this).dialog("destroy");
        $(this).remove();
      }
    };

    dlg.appendTo("BODY");
    dlg.dialog( dialog_options );
  });
};

function oob_row4(row_data, focuson) {
  let ret = $(DIV).addClass("row").addClass("tr")
   .prop("id", "v4oob_"+row_data['v4oob_id'])
   .data("row_data", row_data)
  ;

  if((row_data['v4oob_id']+"v4") === focuson) {
    ret.addClass("focuson");
  };

  let can_edit = ((userinfo['g_oobs_rights'] & R_EDIT_IP_VLAN) > 0);

  ret
   .append( $(SPAN).addClass("td")
     .append( $(SPAN).text( v4long2ip(row_data['v4oob_addr'])+"/"+row_data['v4oob_mask'] ) )
     .append( !can_edit?$(LABEL):$(LABEL)
       .css({"float": "right", "margin-left": "0.5em"})
       .addClass(["button", "ui-icon", "ui-icon-trash"])
       .click(function() {
         let row = $(this).closest(".tr");
         let id = row.data("row_data")['v4oob_id'];
         show_confirm_checkbox("Подтвердите удаление данных.\nВнимание! Отмена будет невозможна!", function() {
           run_query({"action": "del_oob", "id": String(id), "v": "4"}, function(res) {
             row.find(".autosave").each(function() {
               if($(this).data("autosave_changed")) {
                 g_autosave_changes--;
               };
             });
             if(g_autosave_changes < 0) {
               error_at();
               return;
             } else if(g_autosave_changes == 0) {
               $("#autosave_btn").css({"color": "gray"});
             } else {
               $("#autosave_btn").css({"color": "yellow"});
             };
             row.remove();
           });
         });
       })
     )
     .append( !can_edit?$(LABEL):$(LABEL)
       .css({"float": "right", "margin-left": "0.5em"})
       .addClass(["button", "ui-icon", "ui-icon-edit"])
       .click(function() {
         let row = $(this).closest(".tr");
         if(row.find(".editable_view").length > 0) {
           row.find(".editable_view").trigger("editable_toggle");
         } else if(row.find(".editable_edit").length > 0) {
           row.find(".editable_edit").trigger("editable_toggle");
         };
       })
     )
   )
  ;

  ret
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         'object': 'oob',
         'v': '4',
         'id': row_data['v4oob_id'],
         'prop': 'descr',
         'value': row_data['v4oob_descr'],
         '_edit_css': {"width": "30em"},
         '_after_save': function(elm, new_val) {
           let ed = elm.closest(".editable");
           let elm_data = ed.data("editable_data");
           let id = elm_data['id'];
           let oob_data = $("#v4oob_"+id).data("row_data");
           oob_data['v4oob_descr'] = new_val;
           $("#v4oob_"+id).data("row_data", oob_data);
         },
       })
     )
   )
  ;

  ret
   .append( $(SPAN).addClass("td").addClass("unsaved_elm")
     .append(
       editable_elm({
         'object': 'oob',
         'v': '4',
         'id': row_data['v4oob_id'],
         'prop': 'tags',
         'value': row_data['v4oob_tags'],
         '_after_save': function(elm, new_val) {
           let ed = elm.closest(".editable");
           let elm_data = ed.data("editable_data");
           let id = elm_data['id'];

           let oob_data = $("#v4oob_"+id).data("row_data");
           oob_data['v4oob_tags'] = new_val;
           $("#v4oob_"+id).data("row_data", oob_data);
         },
       })
     )
   )
  ;

  return ret;
};

function actionViewOobs() {
  workarea.empty();
  fixed_div.empty();

  let focuson = getUrlParameter("focuson", undefined);

  run_query({"action": "get_oobs"}, function(res) {
    g_data = res['ok'];

    for(let v in g_data['oobs']) {

      workarea.append( $(DIV).css({"font-size": "large"}).text("ipv"+v+" внешние сети") );

      let table = $(DIV).addClass("table")
       .data("v", v)
       .appendTo(workarea)
      ;

      $(DIV).addClass("thead")
       .append( $(SPAN).addClass("th").text("Адрес") )
       .append( $(SPAN).addClass("th").text("Коментарий") )
       .append( $(SPAN).addClass("th").text("Теги") )
       .appendTo(table)
      ;

      let tbody = $(DIV).addClass("tbody")
       .appendTo(table)
      ;

      for(let i in g_data['oobs'][v]) {
        let row_data = g_data['oobs'][v][i];

        if(v == "4") {
          tbody.append( oob_row4(row_data, focuson) );
        } else {
        };
      };

      if((userinfo['g_oobs_rights'] & R_EDIT_IP_VLAN) > 0) {
        table
         .append( $(DIV).addClass("tfoot")
           .append( $(SPAN).addClass("td")
             .append( $(INPUT).addClass("oob_addr")
               .css({"width": v === "4"?"10em":"20em"})
               .prop("placeholder", v === "4"?"x.x.x.x/m":"xxxx::xxxx/m")
               .enterKey(function() {
                 $(this).closest(".td").find(".ui-icon-plus").trigger("click");
               })
             )
             .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
               .css({"margin-right": "0.5em"})
               .click(function() {
                 let tbody = $(this).closest(".table").find(".tbody");
                 let row = $(this).closest(".tfoot");
                 let v = $(this).closest(".table").data("v");
                 let addr_mask = $(this).closest(".tfoot").find(".oob_addr").val();
                 let descr = $(this).closest(".tfoot").find(".oob_descr").val().trim();
                 let tags = $(this).closest(".tfoot").find(".oob_tags").val().trim();
                 if(v === "4") {
                   let m = String(addr_mask).match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
                   if(m === null) { $(this).closest(".tfoot").find(".oob_addr").animateHighlight("red", 300); return; };
                   if(m[1] > 255 || m[2] > 255 || m[3] > 255 || m[4] > 255 || m[5] > 32) {
                     $(this).closest(".tfoot").find(".oob_addr").animateHighlight("red", 300);
                     return;
                   };

                   let masklen = m[5];
                   let mask = v4len2mask[m[5]];
                   let ip=v4oct2long(m[1], m[2], m[3], m[4]);
                   let net = (ip & mask) >>> 0;

                   if(ip != net) {
                     $(this).closest(".tfoot").find(".oob_addr").animateHighlight("red", 300);
                     return;
                   };

                   let found = undefined;

                   $(this).closest(".table").find(".tbody").find(".tr").each(function() {
                     let row_data = $(this).data("row_data");
                     if(row_data['v'+v+'oob_addr'] == ip && row_data['v'+v+'oob_mask'] == Number(masklen)) {
                       found = $(this);
                       return false;
                     };
                   });

                   if(found !== undefined) {
                     found[0].scrollIntoView();
                     found.animateHighlight("red", 300);
                     return;
                   };

                   run_query({"action": "add_oob", "v": v, "addr": String(ip), "masklen": String(masklen),
                              "descr": String(descr), "tags": String(tags)}, function(res) {

                     oob_row4(res['ok']['oob']).appendTo(tbody);

                     row.find(".oob_addr").val("");
                     row.find(".oob_descr").val("");
                     row.find(".tagset").find(".tag").remove();
                     row.find(".tagset").trigger("recalc");
                   });
                 } else {
                   return;
                 };
               })
             )
           )
           .append( $(SPAN).addClass("td")
             .append( $(INPUT).addClass("oob_descr")
               .css({"width": "30em"})
             )
           )
           .append( $(SPAN).addClass("td")
             .append( $(SPAN).addClass("tagset")
               .append( $(INPUT).prop("type", "hidden").addClass("oob_tags") )
               .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
                 .css({"margin-right": "0.5em"})
                 .click(function() {
                   let before = $(this);
                   select_tag(null, null, function(tag_id) {
                     if(tag_id !== null) {
                       get_tag_elm(tag_id, true).insertBefore(before);
                       before.closest(".tagset").trigger("recalc");
                     };
                   });
                 })
               )
               .on("recalc", function() {
                 let list = [];
                 $(this).find(".tag").each(function() {
                   list.push( $(this).data("tag_id") );
                 });
                 $(this).find("INPUT[type=hidden].oob_tags").val(list.join(","));
               })
             )
           )
         )
        ;
      };
      workarea.append( $(BR) );
    };
  });
};

function show_search_results(results) {
  let res_div = $("#searchresult");
  res_div.empty();

  if(results["rows"].length == 0) {
    res_div.append( $(DIV).text("Ничего не найдено").css("color", "orange") );
    return;
  };

  res_div
   .append( $(DIV).addClass("thead")
     .append( $(SPAN).addClass("th").text("Тип") )
     .append( $(SPAN).addClass("th").text("Адрес") )
     .append( $(SPAN).addClass("th").text("Сеть") )
     .append( $(SPAN).addClass("th").text("Дополнительные данные") )
   )
  ;

  let tbody = $(DIV).addClass("tbody").appendTo(res_div);

  for(let i in results["rows"]) {
    let row = results["rows"][i];

    let table_row = $(DIV).addClass("tr")
     .data("data", row['data'])
     .data("type", row['type'])
     .data("v", row['v'])
    ;

    let type_td = $(SPAN).addClass("td")
     .appendTo(table_row);
    ;

    let addr_td = $(SPAN).addClass("td")
     .appendTo(table_row);
    ;

    let name_td = $(SPAN).addClass("td")
     .appendTo(table_row);
    ;

    let data_td = $(SPAN).addClass("td")
     .appendTo(table_row);
    ;

    if(row["type"] == "net") {
      type_td.text("Сеть");
      let addr_str;
      if(row["v"] == "4") {
        addr_str = v4long2ip(row['data'][ 'v'+row['v']+'net_addr'])+"/"+row['data'][ 'v'+row['v']+'net_mask' ];
      } else {
        addr_str = "v6addr";
      };

      addr_td
       .append( $(A)
         .prop({"href": "?action=view_v"+row['v']+"&net="+row['data'][ 'v'+row['v']+'net_addr' ]+"&masklen="+
                        row['data'][ 'v'+row['v']+'net_mask' ]+(DEBUG?"&debug":""),
                "target": "_blank",
         })
         .text( addr_str )
         .title( row['data'][ 'v'+row['v']+'net_name' ] )
       )
      ;

      if(row['data'][ 'v'+row['v']+'net_fk_vlan_id' ] !== null) {
        name_td.append( get_vlan_elm(row['data']['net_vlan_data']) );
      };

      name_td
       .append( $(SPAN)
         .text(row['data'][ 'v'+row['v']+'net_name' ])
         .title(row['data'][ 'v'+row['v']+'net_descr' ])
       )
      ;

      if(row['data'][ 'v'+row['v']+'net_tags' ] !== "") {
        let tags = String(row['data'][ 'v'+row['v']+'net_tags' ]).split(",");
        for(let i in tags) {
          data_td.append( get_tag_elm(tags[i], false) );
        };
      };
    } else if(row["type"] == "ip") {
      type_td.text("IP");
      let addr_str;
      if(row["v"] == "4") {
        addr_str = v4long2ip(row['data'][ 'v'+row['v']+'ip_addr']); //+"/"+row['data'][ 'v'+row['v']+'net_mask' ];
      } else {
        addr_str = "v6addr";
      };

      addr_td
       .append( $(A)
         .prop({"href": "?action=view_v"+row['v']+"&net="+row['data'][ 'v'+row['v']+'net_addr' ]+"&masklen="+
                        row['data'][ 'v'+row['v']+'net_mask' ]+"&focuson="+row['data'][ 'v'+row['v']+'ip_addr']+(DEBUG?"&debug":""),
                "target": "_blank",
         })
         .text( addr_str )
         .title( row['data'][ 'v'+row['v']+'net_name' ] )
       )
      ;

      if(row['data'][ 'v'+row['v']+'net_fk_vlan_id' ] !== null) {
        name_td.append( get_vlan_elm(row['data']['net_vlan_data']) );
      };

      name_td
       .append( $(SPAN)
         .text(row['data'][ 'v'+row['v']+'net_name' ])
         .title(row['data'][ 'v'+row['v']+'net_descr' ])
       )
      ;

      if(row['data'][ 'v'+row['v']+'ip_fk_vlan_id' ] !== null) {
        data_td.append( get_vlan_elm(row['data']['ip_vlan_data']) );
      };

      for(let vi in row['data']['values']) {
        let val_row = row['data']['values'][vi];
        if(val_row['iv_value'] !== "") {
          let val_span = $(SPAN).addClass("search_val_span")
           .append( $(SPAN).text(val_row['ic_name']+":").addClass("search_val_name") )
          ;
          if(val_row['ic_type'] == "text") {
            val_span.append( $(SPAN).text(val_row['iv_value']).addClass("search_val_value") );
          } else if(val_row['ic_type'] == "textarea") {
            val_span.append( $(SPAN).text(String(val_row['iv_value']).split("\n")[0]).addClass("search_val_value") );
          } else if(val_row['ic_type'] == "tag" || val_row['ic_type'] == "multitag") {
            let list = String(val_row['iv_value']).split(",");
            for(let ti in list) {
              val_span.append( get_tag_elm(list[ti], false).addClass("search_val_value") );
            };
          };
          data_td.append( val_span );
        };
      };
    } else if(row["type"] == "oob") {
      type_td.text("Внеш. сеть");
      let addr_str;
      if(row["v"] == "4") {
        addr_str = v4long2ip(row['data'][ 'v'+row['v']+'oob_addr'])+"/"+row['data'][ 'v'+row['v']+'oob_mask' ];
      } else {
        addr_str = "v6addr";
      };

      addr_td
       .append( $(A)
         .prop({"href": "?action=oobs&focuson="+row['data'][ 'v'+row['v']+'oob_id' ]+"v"+row['v']+(DEBUG?"&debug":""),
                "target": "_blank",
         })
         .text( addr_str )
         .title( row['data'][ 'v'+row['v']+'oob_name' ] )
       )
      ;

      name_td
       .append( $(SPAN)
         .text(row['data'][ 'v'+row['v']+'oob_descr' ])
       )
      ;

      if(row['data'][ 'v'+row['v']+'oob_tags' ] !== "") {
        let tags = String(row['data'][ 'v'+row['v']+'oob_tags' ]).split(",");
        for(let i in tags) {
          data_td.append( get_tag_elm(tags[i], false) );
        };
      };
    };

    table_row.appendTo(tbody);
  };
};

function get_global_right_row(object, g_id, rights) {
  let ret = $(DIV).addClass("tr")
   .data("g_id", g_id)
   .data("object", object)
   .on("recalc", function() { $("#global_rights").trigger("recalc"); })
   .append( $(SPAN).addClass("td")
     .text(g_data['groups'][g_id]['g_name'])
     .title(g_data['groups'][g_id]['g_descr'])
   )
   .append( $(SPAN).addClass("td")
     .append( rights_tds(object, rights, true, "ignore") )
   )
   .append( $(SPAN).addClass("td")
     .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-trash"])
       .click(function() {
         let elm = $(this);
         show_confirm_checkbox("Подтвердите удаление.\nВнимание, отмена будет невозможна!", function() {
           let g_id = elm.closest(".tr").data("g_id");
           elm.closest(".table").find("SELECT")
            .append( $(OPTION)
              .val(String(g_id))
              .text(g_data['groups'][g_id]['g_name'])
              .title(g_data['groups'][g_id]['g_descr'])
            )
           ;
           elm.closest(".tr").remove();
           $("#global_rights").trigger("recalc");
         });
       })
     )
   )
  ;

  return ret;
};

function actionGlobalRights() {
  workarea.empty();
  fixed_div.empty();

  let obj_list = keys(g_rights_obj);
  obj_list.sort();

  fixed_div
   .append( $(LABEL).html("&nbsp;") )
   .append( $(LABEL).text("Есть несохраненные изменения").addClass("unsaved")
     .prop("id", "global_rights_unsaved")
     .hide()
   )
  ;

  run_query({"action": "get_global_rights"}, function(res) {
    g_data = res['ok'];

    let gids = keys(g_data['groups']);
    sort_by_string_key(gids, g_data['groups'], 'g_name');

    workarea
     .append( $(INPUT).prop("type", "hidden")
       .prop("id", "global_rights")
       .val("")
       .saveable({"object": "global_rights", "_changed_show": $("#global_rights_unsaved")})
       .on("recalc", function(e, data) {
         e.stopPropagation();

         let save_data = {};
         let obj_list = keys(g_rights_obj);
         obj_list.sort();

         for(let i in obj_list) {
           let object = obj_list[i];
           save_data[object] = {};
           $(".global_rights_"+object).find(".tr").each(function() {
             let g_id = $(this).data("g_id");
             let this_rights = 0;
             $(this).find(".right").each(function() {
               if( $(this).hasClass("right_on") ) {
                 this_rights = this_rights | $(this).data("right");
               };
             });

             if(this_rights != 0) {
               save_data[object][g_id] = String(this_rights);
             };
           });
         };

         let val = JSON.stringify(save_data);
         $(this).val(val);
         if(data !== 'init') {
           $(this).trigger("input_stop");
         } else {
           $(this).data("autosave_prev", val);
           $(this).data("autosave_saved", val);
         };
       })
     )
    ;

    for(let i in obj_list) {
      let object = obj_list[i];

      workarea
       .append( $(DIV).text(g_rights_obj[object])
         .css({"font-size": "large", "margin-top": "1em"})
       )
      ;

      let table = $(DIV).addClass("table").appendTo(workarea)
       .data("object", object)
      ;

      let thead = $(DIV).addClass("thead")
       .append( $(SPAN).addClass("th").text("Группа") )
       .append( $(SPAN).addClass("th").text("Права") )
       .append( $(SPAN).addClass("th").text("") )
       .appendTo(table)
      ;

      let tbody = $(DIV).addClass("tbody").appendTo(table)
       .addClass("global_rights_"+object)
      ;

      let added_groups = [];

      if(g_data['objects'][object] !== undefined) {
        for(let g_i in gids) {
          let g_id = gids[g_i];
          if(g_data['objects'][object][g_id] !== undefined) {
            tbody.append( get_global_right_row(object, g_id, g_data['objects'][object][g_id]['rights']) );
            added_groups.push( g_id );
          };
        };
      };

      let tfoot = $(DIV).addClass("tfoot").appendTo(table);

      let sel = $(SELECT).addClass("g_id")
       .append( $(OPTION).text("Выберете группу").val("") )
      ;

      for(let g_i in gids) {
        let g_id = gids[g_i];
        if(!in_array(added_groups, g_id)) {
          sel
           .append( $(OPTION).text(g_data['groups'][g_id]['g_name'])
             .title( g_data['groups'][g_id]['g_descr'] )
             .val(String(g_id))
           )
          ;
        };
      };

      tfoot
       .append( $(SPAN).addClass("td")
         .append( sel )
       )
       .append( $(SPAN).addClass("td")
         .append( rights_tds(object, 0, true, "ignore", "tfoot") )
       )
       .append( $(SPAN).addClass("td")
         .append( $(LABEL).addClass(["button", "ui-icon", "ui-icon-plus"])
           .click(function() {
             let sel = $(this).closest(".tfoot").find("SELECT");
             let g_id = sel.val();
             if(g_id === "") return;

             let rights = 0;
             $(this).closest(".tfoot").find(".right").each(function() {
               if( $(this).hasClass("right_on") ) {
                 rights = rights | $(this).data("right");
               };
             });

             if(rights == 0) return;

             $(this).closest(".table").find(".tbody")
              .append( get_global_right_row( $(this).closest(".table").data("object"), g_id, rights ) )
             ;

             sel.find("OPTION:selected").remove();
             sel.val("");

             $(this).closest(".tfoot").find(".right_on").addClass("right_off").removeClass("right_on");

             $("#global_rights").trigger("recalc");
           })
         )
       )
      ;
    };

    $("#global_rights").trigger("recalc", "init");
  });
};

function ic_options_help() {
  let dlg = $(DIV).addClass("dialog_start")
   .title("Справка")
  ;

  dlg
   .append( $(DIV)
     .css({"margin-top": "1em", "font-size": "large"})
     .text("Для поля типа Тег:")
   )
   .append( $(DIV)
     .text("Если оставить пустым, то пользователь сможет выбрать любой допустимый тег (без флага запрета выбора) к которому есть доступ на просмотр.")
   )
   .append( $(DIV)
     .text("Если ввести API имя тега (отображается в скобках в списке тегов), то выбор будет ограничен только этим тегом и его дочерними (без флага запрета выбора), к которому есть доступ на просмотр.")
   )
   .append( $(DIV) )
   .append( $(DIV)
     .css({"margin-top": "1em", "font-size": "large"})
     .text("Для поля типа Текст:")
   )
   .append( $(DIV)
     .text("Можно оставить пустым, либо заполнить в виде JSON текста с опциями. Поддерживаемые опции:")
   )
   .append( $(DIV)
     .text("val_css: Разные стили отображения в зависимости от значения ячейки. Содержит массив из элементов, проверяются по очереди, применяется стиль из первого совпадения. Примеры:")
   )
   .append( $(DIV)
     .css({"white-space": "pre", "font-family": "monospace"})
     .text('{"val_css": ['+"\n"+
'  {"type": "regexp",'+"\n"+
'   "regexp": "a",'+"\n"+
'   "css": {"color": "blue"}'+"\n"+
'  },'+"\n"+
'  {"type": ">",'+"\n"+
'   "than": 15,'+"\n"+
'   "css": {"color": "green"}'+"\n"+
'  },'+"\n"+
'  {"type": "default",'+"\n"+
'   "css": {"color": "red"}'+"\n"+
'  }'+"\n"+
']}')
   )
   .append( $(DIV)
     .text("Допустимые типы: \"regexp\", \"default\", \"==\", \"===\", \">\", \">=\", \"<\", \"<=\"")
   )
  ;

  let dialog_options = {
    modal:true,
    maxHeight:1000,
    maxWidth:1800,
    minWidth:1200,
    width: "auto",
    height: "auto",
    buttons: [
      {
        'text': 'Закрыть',
        'click': function() {$(this).dialog( "close" );},
      }
    ],
    close: function() {
      $(this).dialog("destroy");
      $(this).remove();
    }
  };

  dlg.appendTo("BODY");
  dlg.dialog( dialog_options );
};

