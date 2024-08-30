#!/bin/sh

cd /devel/go/src/github.com/ShyLionTjmn/mapper/map-broker/www/
cp -r lib /var/opt/offline-map/
cp -r mylib /var/opt/offline-map/
cp mapper_dev.js /var/opt/offline-map/
cp mapper.js /var/opt/offline-map/
cp offline_dev.html /var/opt/offline-map/
cp offline.html /var/opt/offline-map/
cp styles.css /var/opt/offline-map/
curl -s -o /var/opt/offline-map/consts.js http://localhost:8181/consts.js
curl -s -o /var/opt/offline-map/offline.js http://localhost:8181/offline.js
