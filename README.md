This is network mapper software.
It walks through network using SNMP. It DOES NOT scan whole network. It uses CDP-MIB, LLDP-MIB, EIGRP-MIB, /30, /31 for neigbour discovery.

Closely tied with my ipdb project. It uses it for location and project filtering.

map-scanner - data gathering daemon

map-broker - http server for GUI and backend, also processes scanner data and builds links, add neighbours to scan

map-grapher - gets data from broker and streams it to rrdcached

map-alerter - gets alerts from broker, and using rules sends alerts


Depends on:
an OIDC auth software, which must supply authenticated user headers
 - x-idp-sub - sub claim
 - x-idp-groups - user groups list in form "/group1","/group2" etc...
 i use nginx, Keycloak and vouch-proxy combo for now

redis - key store database, keeps scan results, used for iner-daemons messaging

rrdtool - for graphs

ipdb - github.com/ShyLionTjmn/ipdb - uses IPDB tags system to filter through devices and determine it's location
       you may just show "all"
