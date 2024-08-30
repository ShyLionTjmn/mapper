#!/bin/sh

if [ -z "$1" ]
then
  echo "usage: $0 path/.dropbox_uploader"
  exit 1
fi

if [ ! -f "$1" ]
then
  echo "No file $1 found"
  exit 1
fi

dropbox_uploader.sh -f "$1" upload /var/opt/offline-map /

