#!/bin/sh

cd /devel/go/src/github.com/ShyLionTjmn/mapper/map-broker/www

cp mapper.js local_mapper.js.`date +%Y-%m-%d.%H:%M:%S`
cp mapper_dev.js mapper.js

cp styles.css local_styles.css.`date +%Y-%m-%d.%H:%M:%S`
cp styles_dev.css styles.css

DELLIST=`ls -t local_mapper.js.* | tail -n +7`
if [ ! -z "$DELLIST" ]
then
  rm $DELLIST
fi

DELLIST=`ls -t local_styles.css.* | tail -n +7`
if [ ! -z "$DELLIST" ]
then
  rm $DELLIST
fi
