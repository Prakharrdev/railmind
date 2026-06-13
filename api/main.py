from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from api.routes import simulation, planner, control
from api.sim_runner import sim_runner
from api.ws_manager import ws_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background simulation worker
    logger.info("Starting background SimulationRunner...")
    await sim_runner.start()
    yield
    # Shutdown: Clean up worker tasks
    logger.info("Stopping background SimulationRunner...")
    await sim_runner.stop()

app = FastAPI(
    title="RailMind Operations Platform Backend",
    description="REST API and WebSocket Server for RailMind live operations, dispatch advisory, and scenario replay.",
    version="0.5.0",
    lifespan=lifespan
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(simulation.router)
app.include_router(planner.router)
app.include_router(control.router)

@app.get("/")
def read_root():
    return {
        "project": "RailMind Operations Platform Backend",
        "version": "0.5.0",
        "status": "running"
    }

async def handle_websocket(websocket: WebSocket):
    """WebSocket handler for real-time train positions, conflicts, and metrics."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Maintain connection alive, ignore incoming messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(websocket)

@app.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    await handle_websocket(websocket)

@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await handle_websocket(websocket)

