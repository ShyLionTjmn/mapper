package mapaux

const OIDS_FILE="/etc/mapper/oids"

const REDIS_SOCKET="/tmp/redis.sock"
const REDIS_DB="0"
const REDIS_ERR_SLEEP=5

const RRD_ROOT="/data/rrdcached/db/mapper"
const RRD_SOCKET = "/var/run/rrdcached.sock"
const RRD_TOOL = "/usr/bin/rrdtool"
const PNG_CACHE = "/data/mapper/png_cache"

const BROKER_PORT = 8181
const WWW_ROOT = "/opt/mapper/www"

const MYSQL_DSN="mapper_ajax:PASS(/var/lib/mysql/mysql.sock)/ipdb"
const SITES_ROOT_API_NAME = "location"
const PROJECTS_ROOT_API_NAME = "is"
