#!/usr/bin/env bash
#
# setup.sh — 清和居 · 配置向导（Linux / macOS）
#
# 用法：
#     ./setup.sh              交互式填写数据库 / JWT / AI 配置
#     ./setup.sh --check      只检查 server/.env 是否完整（0=可以启动）
#     ./setup.sh --yes        非交互：保留已有值，缺的用默认值并自动生成 JWT
#     ./setup.sh -h           查看帮助
#
# 实际逻辑在 setup.js（Node 实现，Windows / macOS / Linux 通用），
# 本脚本只负责检查 Node 并转发参数。
#
# 如果克隆后提示没有执行权限：chmod +x setup.sh

# 被 `sh setup.sh` 调用时切回 bash
if [ -z "${BASH_VERSION:-}" ]; then
    exec bash "$0" "$@"
fi

set -u

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd) || {
    echo '[错误] 无法定位脚本目录' >&2
    exit 1
}
SETUP_JS="$SCRIPT_DIR/setup.js"

printf '\n'
printf '\033[33m  ============================================\033[0m\n'
printf '\033[33m        清 和 居 · 配置向导\033[0m\n'
printf '\033[33m  ============================================\033[0m\n'
printf '\n'

command -v node >/dev/null 2>&1 || {
    printf '\033[31m[错误]\033[0m 没有找到 node，请先安装 Node.js 18+：https://nodejs.org/\n' >&2
    exit 1
}
[ -f "$SETUP_JS" ] || {
    printf '\033[31m[错误]\033[0m 找不到 %s\n' "$SETUP_JS" >&2
    exit 1
}

exec node "$SETUP_JS" "$@"
