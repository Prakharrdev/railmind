#!/usr/bin/env bash
# stop.sh - Stop running RailMind backend and frontend stacks

# Resolve the project root directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

# Function to stop a process by PID file
stop_process() {
    local pid_file="$1"
    local name="$2"

    if [ ! -f "$pid_file" ]; then
        echo "$name is not running (no PID file found)."
        return 0
    fi

    local pid
    pid=$(cat "$pid_file")

    if [ -z "$pid" ]; then
        echo "$name PID file is empty. Cleaning up file..."
        rm -f "$pid_file"
        return 0
    fi

    if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping $name (PID $pid)..."
        kill "$pid" 2>/dev/null

        # Wait up to 5 seconds for the process to exit
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ "$count" -lt 10 ]; do
            sleep 0.5
            count=$((count + 1))
        done

        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            echo "Warning: $name did not stop gracefully. Force killing..."
            kill -9 "$pid" 2>/dev/null
        fi
    else
        echo "$name (PID $pid) was already stopped or crashed."
    fi

    rm -f "$pid_file"
}

# Stop the services
stop_process "$BACKEND_PID_FILE" "Backend"
stop_process "$FRONTEND_PID_FILE" "Frontend"

echo ""
echo "RailMind Stopped"
