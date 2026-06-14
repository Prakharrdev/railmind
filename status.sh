#!/usr/bin/env bash
# status.sh - Report running status of the RailMind stack

# Resolve the project root directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

check_status() {
    local pid_file="$1"
    local name="$2"

    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "$name: Running (PID $pid)"
            return 0
        fi
    fi
    echo "$name: Not Running"
    return 1
}

echo "=== RailMind Status ==="
echo ""

check_status "$BACKEND_PID_FILE" "Backend"
check_status "$FRONTEND_PID_FILE" "Frontend"
echo ""
