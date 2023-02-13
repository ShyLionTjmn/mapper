#!/bin/sh
go build && sudo install map-grapher /usr/local/sbin/ && sudo systemctl restart map-grapher && sleep 1 && sudo systemctl --no-pager status map-grapher
