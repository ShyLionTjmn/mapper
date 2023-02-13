This is network mapper software.
It walks through network using SNMP. It DOES NOT probe any IP. It uses CDP-MIB, LLDP-MIB, EIGRP-MIB, /30, /31 for neigbour discovery.

Closely tied with my ipdb project. It uses it for location and project filtering.

map-scanner - data gathering daemon

map-broker - http server for GUI and backend, also processes scanner data and builds links, add neighbours to scan

map-grapher - gets data from broker and streams it to rrdcached

map-alerter - gets alerts from broker, and using rules sends alerts

