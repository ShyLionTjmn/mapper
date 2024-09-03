package mapaux

const DEFAULT_OIDS_FILE="/etc/mapper/oids"

const DEFAULT_REDIS_SOCKET="/tmp/redis.sock"
const DEFAULT_REDIS_DB="0"
const DEFAULT_REDIS_ERR_SLEEP=5

const DEFAULT_RRD_ROOT="/data/rrdcached/db/mapper"
const DEFAULT_RRD_SOCKET = "/var/run/rrdcached.sock"
const DEFAULT_RRD_TOOL = "/usr/bin/rrdtool"
const DEFAULT_PNG_CACHE = "/data/mapper/png_cache"
const DEFAULT_SAFE_INT_REGEX = `^[a-zA-Z0-9\._\-]+$`

const DEFAULT_BROKER_PORT = 8181
const DEFAULT_WWW_ROOT = "/opt/mapper/www"
const DEFAULT_BROKER_UNIX_SOCKET = "/tmp/map-broker.sock"

const DEFAULT_IPDB_DSN="mapper_ajax:@unix(/var/lib/mysql/mysql.sock)/ipdb"
const DEFAULT_IPDB_SITES_ROOT_API_NAME = "location"
const DEFAULT_IPDB_PROJECTS_ROOT_API_NAME = "is"

const DEFAULT_DEVS_CONFIGS_DIR = "/data/configs"
