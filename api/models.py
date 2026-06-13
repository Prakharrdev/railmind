from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class DisruptionRequest(BaseModel):
    disruption_id: str
    train_id: str
    disruption_type: str  # "engine_slow" | "platform_block" | "signal_hold"
    magnitude_minutes: float
    start_time: float
    end_time: float
    target_id: Optional[str] = None

class PlannerConfigRequest(BaseModel):
    depth: int
    beam_width: int
    step_minutes: Optional[int] = 5

class ActionRequest(BaseModel):
    train_id: str
    action_type: str  # "hold" | "noop"
    hold_minutes: float = 0.0
