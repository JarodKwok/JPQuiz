#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"

MODE="${JPQUIZ_SERVICE_MODE:-preview}"
if [[ -n "${JPQUIZ_PORT:-}" ]]; then
  PORT="$JPQUIZ_PORT"
elif [[ "$MODE" == "dev" ]]; then
  PORT="3007"
else
  PORT="3006"
fi

PID_FILE="$RUNTIME_DIR/jpquiz-${MODE}-${PORT}.pid"
LOG_FILE="$RUNTIME_DIR/jpquiz-${MODE}-${PORT}.log"

ensure_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

read_pid() {
  if [[ -f "$PID_FILE" ]]; then
    tr -d '[:space:]' < "$PID_FILE"
  fi
}

is_running_pid() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

cleanup_stale_pid() {
  local pid
  pid="$(read_pid || true)"
  if [[ -n "$pid" ]] && ! is_running_pid "$pid"; then
    rm -f "$PID_FILE"
  fi
}

is_port_listening() {
  lsof -ti "tcp:${PORT}" >/dev/null 2>&1
}

get_listener_pid() {
  lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

print_port_owner() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
}

service_label() {
  if [[ "$MODE" == "dev" ]]; then
    echo "开发服务"
  else
    echo "预览服务"
  fi
}

service_url() {
  echo "http://localhost:${PORT}"
}

run_build() {
  echo "==> 构建应用"
  (cd "$ROOT_DIR" && npm run build)
}

start_service() {
  ensure_runtime_dir
  cleanup_stale_pid

  local pid
  pid="$(read_pid || true)"
  if is_running_pid "$pid"; then
    echo "==> $(service_label)已在运行"
    echo "PID: $pid"
    echo "URL: $(service_url)"
    echo "日志: $LOG_FILE"
    return 0
  fi

  if is_port_listening; then
    echo "==> 端口 ${PORT} 已被占用，无法启动 $(service_label)"
    print_port_owner
    echo "可改用 JPQUIZ_PORT=其他端口，或先停止当前占用进程。"
    return 1
  fi

  local cmd=("npm" "run")
  if [[ "$MODE" == "dev" ]]; then
    cmd+=("dev" "--" "--port" "$PORT")
  else
    cmd+=("start" "--" "--port" "$PORT")
  fi

  echo "==> 启动$(service_label)：$(service_url)"
  (
    cd "$ROOT_DIR"
    nohup "${cmd[@]}" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  pid="$(read_pid || true)"
  sleep 2

  if is_port_listening; then
    local listener_pid
    listener_pid="$(get_listener_pid)"
    if [[ -n "$listener_pid" ]]; then
      echo "$listener_pid" > "$PID_FILE"
      pid="$listener_pid"
    fi
    echo "==> 启动成功"
    echo "PID: $pid"
    echo "URL: $(service_url)"
    echo "日志: $LOG_FILE"
    return 0
  fi

  rm -f "$PID_FILE"
  echo "==> 启动失败，最近日志："
  tail -n 40 "$LOG_FILE" || true
  return 1
}

stop_service() {
  cleanup_stale_pid

  local pid
  pid="$(read_pid || true)"
  if [[ -z "$pid" ]]; then
    echo "==> 当前没有受管的$(service_label)"
    return 0
  fi

  if ! is_running_pid "$pid"; then
    rm -f "$PID_FILE"
    echo "==> $(service_label)已停止"
    return 0
  fi

  echo "==> 停止$(service_label) (PID: $pid)"
  if ! kill "$pid" 2>/dev/null; then
    echo "==> 无法停止 PID $pid，请手动处理。"
    return 1
  fi

  for _ in {1..20}; do
    if ! is_running_pid "$pid"; then
      rm -f "$PID_FILE"
      echo "==> 已停止"
      return 0
    fi
    sleep 0.5
  done

  echo "==> 仍未退出，尝试强制停止"
  if ! kill -9 "$pid" 2>/dev/null; then
    echo "==> 强制停止失败，请手动处理。"
    return 1
  fi

  sleep 1
  if is_running_pid "$pid"; then
    echo "==> 进程仍在运行，请手动处理。"
    return 1
  fi

  rm -f "$PID_FILE"
  echo "==> 已强制停止"
}

show_status() {
  cleanup_stale_pid

  local pid
  pid="$(read_pid || true)"
  if is_running_pid "$pid"; then
    echo "==> $(service_label)运行中"
    echo "PID: $pid"
    echo "URL: $(service_url)"
    echo "日志: $LOG_FILE"
  else
    echo "==> $(service_label)未运行"
  fi

  if is_port_listening; then
    echo "--- 端口占用 ---"
    print_port_owner
  fi
}

show_logs() {
  ensure_runtime_dir
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "==> 暂无日志文件：$LOG_FILE"
    return 0
  fi

  tail -n 80 -f "$LOG_FILE"
}

stop_all_managed_services() {
  ensure_runtime_dir
  shopt -s nullglob
  local found=0

  for file in "$RUNTIME_DIR"/jpquiz-*.pid; do
    found=1
    local pid
    pid="$(tr -d '[:space:]' < "$file")"
    local name
    name="$(basename "$file" .pid)"

    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "==> 停止 $name (PID: $pid)"
      kill "$pid" 2>/dev/null || true
    fi

    rm -f "$file"
  done

  if [[ "$found" -eq 0 ]]; then
    echo "==> 没有找到受管服务 PID 文件"
  else
    echo "==> 已清理受管服务 PID 文件"
  fi
}

print_help() {
  cat <<EOF
JPQuiz 服务管理

用法:
  bash scripts/service.sh <command>

命令:
  up         构建并启动预览服务
  start      直接启动当前构建
  stop       停止当前受管服务
  restart    停止后重建并启动
  status     查看运行状态
  logs       查看实时日志
  stop-all   停止所有受管服务

环境变量:
  JPQUIZ_SERVICE_MODE=preview|dev
  JPQUIZ_PORT=<端口>

默认值:
  preview 模式端口: 3006
  dev 模式端口: 3007
EOF
}

COMMAND="${1:-status}"

case "$COMMAND" in
  up)
    if [[ "$MODE" != "dev" ]]; then
      run_build
    fi
    start_service
    ;;
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service || true
    if [[ "$MODE" != "dev" ]]; then
      run_build
    fi
    start_service
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  stop-all)
    stop_all_managed_services
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo "未知命令: $COMMAND"
    print_help
    exit 1
    ;;
esac
