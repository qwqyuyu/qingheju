#!/usr/bin/env bash
#
# start.sh — 清和居一键启动脚本（Linux / macOS）
#
# 用法：
#     ./start.sh                  # 使用 server/app.js 里的默认端口（当前 3112）
#     ./start.sh -p 3210          # 指定端口
#     ./start.sh --browser        # 启动后顺便打开浏览器（默认不打开）
#     ./start.sh -h               # 查看帮助
#
# 说明：
#     * 会自动安装 server 依赖（仅首次）、读取 server/.env、检查端口和 MySQL。
#     * 没有 MySQL 也能启动：静态页面可正常浏览，登录/发帖/签到等接口会返回 500。
#     * 要配置数据库或 AI Key，在 server 目录下新建 .env，每行一个 KEY=VALUE。
#     * server/.env 里的 PORT 会被本脚本覆盖（与 start.ps1 行为一致）。
#
# 注意：脚本必须在 Linux 上带可执行权限才能直接运行
#     chmod +x start.sh
#   git 里已经记录了可执行位；如果克隆后丢失，执行上面的 chmod 即可。
#

# 被 `sh start.sh` 调用时切回 bash（脚本用到 bash 专有语法）
if [ -z "${BASH_VERSION:-}" ]; then
    exec bash "$0" "$@"
fi

set -u
set -o pipefail

# ---------- 颜色与输出 ----------

if [ -t 1 ]; then
    C_TITLE=$'\033[33m'
    C_STEP=$'\033[36m'
    C_WARN=$'\033[33m'
    C_ERR=$'\033[31m'
    C_OFF=$'\033[0m'
else
    C_TITLE=''
    C_STEP=''
    C_WARN=''
    C_ERR=''
    C_OFF=''
fi

title() { printf '%s%s%s\n' "$C_TITLE" "$*" "$C_OFF"; }
step()  { printf '%s[清和居]%s %s\n' "$C_STEP" "$C_OFF" "$*"; }
warn()  { printf '%s[警告]%s   %s\n' "$C_WARN" "$C_OFF" "$*"; }
die()   { printf '%s[错误]%s   %s\n' "$C_ERR" "$C_OFF" "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
清和居一键启动脚本

用法：
    ./start.sh                  使用 server/app.js 里的默认端口（当前 3112）
    ./start.sh -p 3210          指定端口
    ./start.sh --port 3210      同上
    ./start.sh --browser        启动后打开浏览器（默认不打开）
    ./start.sh --no-browser     明确不打开浏览器（默认行为，兼容旧用法）
    ./start.sh -h               显示本帮助

环境变量：
    可以像 start.ps1 一样用 server/.env 配置数据库、AI、JWT_SECRET。
    系统里已存在的同名环境变量优先，不会被 .env 覆盖。
EOF
}

# ---------- 路径 ----------

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd) || die '无法定位脚本目录'
SERVER_DIR="$SCRIPT_DIR/server"
APP_JS="$SERVER_DIR/app.js"
ENV_FILE="$SERVER_DIR/.env"

# ---------- 参数 ----------

PORT_ARG=''
OPEN_BROWSER=0        # 默认不打开浏览器（服务器/远程环境更常见）

while [ $# -gt 0 ]; do
    case "$1" in
        -p|--port)
            [ $# -ge 2 ] || die '缺少端口号，例如：./start.sh -p 3210'
            PORT_ARG=$2
            shift 2
            ;;
        --port=*)
            PORT_ARG=${1#*=}
            shift
            ;;
        -p[0-9]*)
            PORT_ARG=${1#-p}
            shift
            ;;
        --no-browser)
            OPEN_BROWSER=0
            shift
            ;;
        --browser)
            OPEN_BROWSER=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "未知参数：$1（用 ./start.sh -h 查看用法）"
            ;;
    esac
done

printf '\n'
title '  ============================================'
title '        清 和 居 · 中医文化日常养生'
title '  ============================================'
printf '\n'

# ---------- 1. Node ----------

step '检查运行环境…'

command -v node >/dev/null 2>&1 || die '没有找到 node，请先安装 Node.js 18+：https://nodejs.org/'

NODE_VERSION=$(node -p 'process.versions.node' 2>/dev/null) || die '无法执行 node，请检查安装'
NODE_MAJOR=${NODE_VERSION%%.*}
step "Node.js $NODE_VERSION"

case "$NODE_MAJOR" in
    ''|*[!0-9]*) warn "无法识别 Node.js 版本：$NODE_VERSION" ;;
    *)
        if [ "$NODE_MAJOR" -lt 18 ]; then
            warn "项目要求 Node 18+，当前 $NODE_VERSION 可能无法运行"
        fi
        ;;
esac

[ -f "$APP_JS" ] || die "找不到后端入口：$APP_JS"

# ---------- 2. 端口 ----------

if [ -z "$PORT_ARG" ]; then
    PORT_ARG=3000
    DETECTED=$(grep -oE 'process\.env\.PORT[[:space:]]*\|\|[[:space:]]*[0-9]+' "$APP_JS" 2>/dev/null \
        | head -n 1 | grep -oE '[0-9]+$' || true)
    [ -n "$DETECTED" ] && PORT_ARG=$DETECTED
fi

case "$PORT_ARG" in
    ''|*[!0-9]*) die "端口必须是数字，收到：$PORT_ARG" ;;
esac
if [ "$PORT_ARG" -lt 1 ] || [ "$PORT_ARG" -gt 65535 ]; then
    die "端口超出范围（1-65535）：$PORT_ARG"
fi

# ---------- 3. 依赖 ----------

if [ ! -d "$SERVER_DIR/node_modules/express" ]; then
    step '首次运行，安装后端依赖（几分钟）…'
    command -v npm >/dev/null 2>&1 || die '没有找到 npm，请先安装 Node.js 18+（自带 npm）'

    if [ -f "$SERVER_DIR/package-lock.json" ]; then
        ( cd "$SERVER_DIR" && npm ci --no-audit --no-fund ) || die 'npm ci 失败'
    else
        ( cd "$SERVER_DIR" && npm install --no-audit --no-fund ) || die 'npm install 失败'
    fi
fi

# ---------- 4. 读取 server/.env ----------

trim() {
    local s=$1
    s=${s#"${s%%[![:space:]]*}"}
    s=${s%"${s##*[![:space:]]}"}
    printf '%s' "$s"
}

if [ -f "$ENV_FILE" ]; then
    step '读取 server/.env'
    while IFS= read -r line || [ -n "$line" ]; do
        line=${line%$'\r'}                 # 兼容 Windows 换行
        case "$line" in
            ''|'#'*) continue ;;
        esac
        case "$line" in
            *=*) ;;
            *) continue ;;
        esac

        key=$(trim "${line%%=*}")
        val=$(trim "${line#*=}")
        [ -n "$key" ] || continue

        # 变量名必须是合法标识符，否则跳过（避免 export 报错中断）
        case "$key" in
            [A-Za-z_]*)
                case "$key" in
                    *[!A-Za-z0-9_]*) continue ;;
                esac
                ;;
            *) continue ;;
        esac

        # 去掉成对的引号
        if [ ${#val} -ge 2 ]; then
            case "$val" in
                \"*\"|\'*\') val=${val:1:${#val}-2} ;;
            esac
        fi

        # 已存在的系统环境变量优先，不覆盖
        if [ -z "${!key+x}" ]; then
            export "$key=$val"
        fi
    done < "$ENV_FILE"
else
    step '未找到 server/.env，使用代码内默认配置'
fi

# ---------- 5. 端口占用 ----------

export PORT="$PORT_ARG"

# 判断 host:port 是否能连上：优先 nc，没有就用 bash 自带的 /dev/tcp
port_open() {
    local host=$1 port=$2
    if command -v nc >/dev/null 2>&1 && nc -z -w 1 "$host" "$port" >/dev/null 2>&1; then
        return 0
    fi
    ( exec 3<>"/dev/tcp/$host/$port" ) >/dev/null 2>&1
}

if port_open 127.0.0.1 "$PORT_ARG"; then
    die "端口 $PORT_ARG 已被占用。换一个端口：./start.sh -p 3210"
fi

# ---------- 6. 数据库 ----------

DB_HOST=${MYSQLHOST:-${MYSQL_HOST:-localhost}}
DB_PORT=${MYSQLPORT:-${MYSQL_PORT:-3306}}
DB_NAME=${MYSQLDATABASE:-${MYSQL_DATABASE:-qingheju}}

case "$DB_PORT" in
    ''|*[!0-9]*) DB_PORT=3306 ;;
esac

if port_open "$DB_HOST" "$DB_PORT"; then
    step "数据库已连接（MariaDB/MySQL）：$DB_HOST:$DB_PORT / $DB_NAME"
else
    warn "连不上数据库（$DB_HOST:$DB_PORT）。页面可以看，但接口会返回 500。"
    warn '请确认 MariaDB/MySQL 服务已启动，并导入过 server/schema.sql'
    if command -v systemctl >/dev/null 2>&1; then
        warn '查看服务状态：sudo systemctl status mariadb   （或 mysql）'
    fi
fi

# ---------- 7. AI ----------

AI_KEY=${AI_API_KEY:-${DASHSCOPE_API_KEY:-}}

if [ -z "$AI_KEY" ] || [ -z "${AI_BASE_URL:-}" ] || [ -z "${AI_MODEL:-}" ]; then
    warn 'AI 未配置完整（AI_API_KEY / AI_BASE_URL / AI_MODEL），AI 问诊会返回 503'
else
    AI_FORMAT_DISPLAY=${AI_FORMAT:-responses}
    if [ "${AI_STREAM:-true}" = 'false' ]; then
        AI_MODE='JSON'
    else
        AI_MODE='流式'
    fi
    step "AI 已配置：$AI_FORMAT_DISPLAY / $AI_MODEL / $AI_MODE"
fi

# ---------- 8. 鉴权 ----------

if [ -z "${JWT_SECRET:-}" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    die 'JWT_SECRET 未配置或不足 32 位。请在 server/.env 里加一行 JWT_SECRET=<随机字符串>'
fi

# ---------- 9. 启动 ----------

printf '\n'
step "启动后端 → http://localhost:$PORT_ARG/  （首页 pages/index.html）"
step '按 Ctrl+C 停止服务'
printf '\n'

if [ "$OPEN_BROWSER" -eq 1 ]; then
    URL="http://localhost:$PORT_ARG/"
    OPENER=''
    if [ "$(uname -s)" = 'Darwin' ]; then
        OPENER='open'
    elif [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
        # 只有图形会话里才尝试打开浏览器（服务器上通常没有）
        if command -v xdg-open >/dev/null 2>&1; then
            OPENER='xdg-open'
        fi
    fi

    if [ -n "$OPENER" ]; then
        ( sleep 3; "$OPENER" "$URL" >/dev/null 2>&1 ) &
    fi
fi

cd "$SERVER_DIR" || die "无法进入 $SERVER_DIR"

# 用 exec 让 node 直接接管进程，Ctrl+C 能干净地停掉服务
exec node app.js
