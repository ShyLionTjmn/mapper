#!/bin/sh
go build && sudo install map-broker /usr/local/sbin/ && sudo systemctl restart map-broker && sleep 1 && sudo systemctl --no-pager status map-broker
