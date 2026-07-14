#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$PROJECT_ROOT/.local/runtime/admin-local"
API_PID_FILE="$RUNTIME_DIR/api.pid"
ADMIN_WEB_PID_FILE="$RUNTIME_DIR/admin-web.pid"

cd "$PROJECT_ROOT"
mkdir -p "$RUNTIME_DIR"

get_pid_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

get_pid_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

is_project_process() {
  local pid="$1"
  local command
  local cwd

  command="$(get_pid_command "$pid")"
  cwd="$(get_pid_cwd "$pid")"

  [[ "$cwd" == "$PROJECT_ROOT"* ]] || [[ "$command" == *"@seafood/api"* ]] || [[ "$command" == *"admin-web"* ]] || [[ "$command" == *"next-server"* ]]
}

stop_pid_file() {
  local pid_file="$1"
  local label="$2"

  if [ ! -f "$pid_file" ]; then
    echo "${label} 没有记录 PID。"
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "${label} 进程已不在运行。"
    rm -f "$pid_file"
    return 1
  fi

  if ! is_project_process "$pid"; then
    echo "${label} PID ${pid} 不是本项目进程，已跳过，不会关闭。"
    return 1
  fi

  echo "正在停止 ${label}，PID：${pid}"
  kill "$pid" 2>/dev/null || true

  local i
  for i in $(seq 1 10); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      echo "${label} 已停止。"
      return 0
    fi
    sleep 1
  done

  echo "${label} 暂未退出，请稍后再检查。"
  return 1
}

stop_project_process_on_port() {
  local port="$1"
  local label="$2"
  local process_ids
  local pid
  local stopped_any_on_port=0

  process_ids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -z "$process_ids" ]; then
    return 0
  fi

  for pid in $process_ids; do
    if is_project_process "$pid"; then
      echo "${label} 端口 ${port} 被本项目旧服务占用，正在温和停止 PID：$pid"
      kill "$pid" 2>/dev/null || true
      stopped_any_on_port=1
    fi
  done

  if [ "$stopped_any_on_port" = "1" ]; then
    local i
    for i in $(seq 1 10); do
      if ! lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
        echo "${label} 端口 ${port} 已释放。"
        return 0
      fi
      sleep 1
    done
    echo "${label} 端口 ${port} 暂未释放，请稍后再检查。"
    return 0
  fi

  echo "${label} 端口 ${port} 仍被占用，但不是本项目进程。"
  echo "端口被其他程序占用，请不要随便关闭。"
  lsof -iTCP:"$port" -sTCP:LISTEN -n -P || true
}

stopped_any=0
if stop_pid_file "$ADMIN_WEB_PID_FILE" "admin-web"; then
  stopped_any=1
fi

if stop_pid_file "$API_PID_FILE" "API"; then
  stopped_any=1
fi

if [ "$stopped_any" = "0" ]; then
  echo "后台当前没有运行。"
fi

stop_project_process_on_port 3001 "admin-web"
stop_project_process_on_port 3000 "API"

echo "停止检查完成。"
