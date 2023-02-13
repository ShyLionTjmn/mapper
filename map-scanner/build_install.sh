#!/bin/sh
go build && sudo install map-scanner /usr/local/sbin/ && sudo systemctl restart map-scanner && sleep 1 && sudo systemctl --no-pager status map-scanner
