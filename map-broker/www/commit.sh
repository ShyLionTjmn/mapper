#!/bin/sh

cd /devel/go/src/github.com/ShyLionTjmn/mapper/map-broker/www
cp mapper.js local_mapper.js.`date +%Y-%m-%d.%H:%M:%S`
cp mapper_dev.js mapper.js

DELLIST=`ls -t local_mapper.js.* | tail -n +7`
if [ ! -z "$DELLIST" ]
then
  rm $DELLIST
fi
