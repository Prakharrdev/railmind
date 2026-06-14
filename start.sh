#!/usr/bin/env bash
# start.sh - Developer Launcher for the RailMind stack

# Exit on any error during validation
set -e

# Resolve the project root directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Ensure the logs directory exists
mkdir -p "$SCRIPT_DIR/logs"

# Increase WebSocket header line limit to support large auth/Supabase cookies
export WEBSOCKETS_MAX_LINE_LENGTH=32768

echo "========================================"
echo "Initializing RailMind Stack..."
echo "========================================"

# Determine Backend Directory (support both "backend" or the repository default "api")
if [ -d "$SCRIPT_DIR/backend" ]; then
    BACKEND_DIR="$SCRIPT_DIR/backend"
elif [ -d "$SCRIPT_DIR/api" ]; then
    BACKEND_DIR="$SCRIPT_DIR/api"
else
    echo "Error: Backend directory (backend/ or api/) not found." >&2
    exit 1
fi

# Determine Frontend Directory
FRONTEND_DIR="$SCRIPT_DIR/frontend"
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Error: Frontend directory (frontend/) not found." >&2
    exit 1
fi

# Detect and activate Python virtual environment if present
if [ -d "$SCRIPT_DIR/venv" ]; then
    echo "Detected virtual environment. Activating..."
    source "$SCRIPT_DIR/venv/bin/activate"
fi

# Validate command-line tool availability
if ! command -v uvicorn &> /dev/null; then
    echo "Error: 'uvicorn' command not found. Please activate your virtual environment or install FastAPI dependencies." >&2
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: 'npm' command not found. Please ensure Node.js and npm are installed." >&2
    exit 1
fi

# PID file paths
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

# Check if Backend is already running
BACKEND_RUNNING=false
BPID=""
if [ -f "$BACKEND_PID_FILE" ]; then
    BPID=$(cat "$BACKEND_PID_FILE")
    if [ -n "$BPID" ] && kill -0 "$BPID" 2>/dev/null; then
        BACKEND_RUNNING=true
    fi
fi

# Check if Frontend is already running
FRONTEND_RUNNING=false
FPID=""
if [ -f "$FRONTEND_PID_FILE" ]; then
    FPID=$(cat "$FRONTEND_PID_FILE")
    if [ -n "$FPID" ] && kill -0 "$FPID" 2>/dev/null; then
        FRONTEND_RUNNING=true
    fi
fi

# Disable exit on error for execution stage so we can handle start failures gracefully
set +e

# Start Backend
if [ "$BACKEND_RUNNING" = true ]; then
    echo "Backend is already running (PID $BPID)."
else
    echo "Starting Backend (uvicorn)..."
    # Run uvicorn from the project root so relative paths (like data/processed/corridor.json) resolve correctly.
    PYTHONPATH="$SCRIPT_DIR" uvicorn api.main:app --reload --log-level info > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
    BPID=$!
    echo "$BPID" > "$BACKEND_PID_FILE"

    # Wait a moment to ensure it didn't fail immediately (e.g. Port 8000 already in use)
    sleep 1.5
    if ! kill -0 "$BPID" 2>/dev/null; then
        echo "Error: Backend failed to start. See logs/backend.log for details." >&2
        rm -f "$BACKEND_PID_FILE"
        exit 1
    fi
fi

# Start Frontend
if [ "$FRONTEND_RUNNING" = true ]; then
    echo "Frontend is already running (PID $FPID)."
else
    echo "Starting Frontend (Vite)..."
    cd "$FRONTEND_DIR"
    npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
    FPID=$!
    echo "$FPID" > "$FRONTEND_PID_FILE"
    cd "$SCRIPT_DIR"

    # Wait a moment to ensure it didn't fail immediately
    sleep 1.5
    if ! kill -0 "$FPID" 2>/dev/null; then
        echo "Error: Frontend failed to start. See logs/frontend.log for details." >&2
        rm -f "$FRONTEND_PID_FILE"
        exit 1
    fi
fi

# Success Feedback
echo ""
echo "================================"
echo "RailMind Started Successfully"
echo "================================"
echo ""
echo "Backend:"
echo "http://localhost:8000"
echo ""
echo "Frontend:"
echo "http://localhost:5173"
echo ""
echo "Backend PID: $BPID"
echo "Frontend PID: $FPID"
echo ""

# Auto-open browser if supported
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Opening dashboard in browser..."
    open "http://localhost:5173" &>/dev/null &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xdg-open &>/dev/null; then
        echo "Opening dashboard in browser..."
        xdg-open "http://localhost:5173" &>/dev/null &
    fi
fi
