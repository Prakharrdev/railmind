import json
import os
from dataclasses import dataclass, asdict, is_dataclass
from typing import List, Optional, Union, Dict, Any

@dataclass
class TrainMoved:
    train_id: str
    section_id: Optional[str]
    block_index: Optional[int]
    speed_kmph: float
    progress: float
    delay_minutes: float
    sim_time: float

@dataclass
class TrainHeld:
    train_id: str
    hold_minutes: float
    sim_time: float

@dataclass
class ConflictDetected:
    train_a_id: str
    train_b_id: str
    block_id: str
    conflict_start_sim_time: float
    overlap_minutes: float
    sim_time: float

@dataclass
class PlannerInvoked:
    depth: int
    beam_width: int
    sim_time: float

@dataclass
class RecommendationGenerated:
    recommendation_id: str
    actions: List[Dict[str, Any]]
    projected_cost: float
    improvement_pct: float
    sim_time: float

@dataclass
class RecommendationAccepted:
    recommendation_id: str
    sim_time: float

@dataclass
class RecommendationRejected:
    recommendation_id: str
    sim_time: float

@dataclass
class DisruptionInjected:
    disruption_id: str
    train_id: str
    disruption_type: str
    magnitude_minutes: float
    start_time: float
    end_time: float
    target_id: Optional[str]
    sim_time: float

EVENT_CLASS_MAP = {
    "TrainMoved": TrainMoved,
    "TrainHeld": TrainHeld,
    "ConflictDetected": ConflictDetected,
    "PlannerInvoked": PlannerInvoked,
    "RecommendationGenerated": RecommendationGenerated,
    "RecommendationAccepted": RecommendationAccepted,
    "RecommendationRejected": RecommendationRejected,
    "DisruptionInjected": DisruptionInjected
}

class EventLogger:
    def __init__(self):
        self.events: List[Any] = []

    def log_event(self, event: Any) -> None:
        """Add an event to the log."""
        self.events.append(event)

    def clear(self) -> None:
        """Clear all logged events."""
        self.events = []

    def save_events(self, filepath: str) -> None:
        """Save all events to a JSON file."""
        serialized = []
        for event in self.events:
            if is_dataclass(event):
                event_dict = asdict(event)
                event_dict["event_type"] = event.__class__.__name__
                serialized.append(event_dict)
            elif isinstance(event, dict):
                serialized.append(event)
            else:
                raise ValueError(f"Unknown event type format: {event}")
        
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w") as f:
            json.dump(serialized, f, indent=2)

    def load_events(self, filepath: str) -> List[Any]:
        """Load events from a JSON file and return them as dataclass instances."""
        if not os.path.exists(filepath):
            return []
        
        with open(filepath, "r") as f:
            data = json.load(f)
            
        self.events = []
        for item in data:
            if "event_type" in item:
                event_type = item["event_type"]
                if event_type in EVENT_CLASS_MAP:
                    cls = EVENT_CLASS_MAP[event_type]
                    # Filter out event_type from constructor arguments
                    args = {k: v for k, v in item.items() if k != "event_type"}
                    self.events.append(cls(**args))
                else:
                    self.events.append(item)
            else:
                self.events.append(item)
                
        return self.events
