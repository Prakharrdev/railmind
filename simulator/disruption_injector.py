from dataclasses import dataclass
from typing import Optional, List, Dict
import json

@dataclass
class Disruption:
    disruption_id: str
    train_id: str
    disruption_type: str  # "engine_slow" | "platform_block" | "signal_hold"
    magnitude_minutes: float
    start_time: float  # sim_time in minutes
    end_time: float  # sim_time in minutes
    target_id: Optional[str] = None  # block_id for signal_hold, station_id for platform_block

    def is_active(self, sim_time_minutes: float) -> bool:
        return self.start_time <= sim_time_minutes <= self.end_time

class DisruptionInjector:
    def __init__(self, delay_distributions_path: Optional[str] = None):
        self.delay_distributions = {}
        if delay_distributions_path:
            with open(delay_distributions_path, "r") as f:
                self.delay_distributions = json.load(f)
        self.disruptions: List[Disruption] = []

    def inject_disruption(self, disruption: Disruption):
        self.disruptions.append(disruption)

    def get_active_disruptions(self, sim_time_minutes: float) -> List[Disruption]:
        return [d for d in self.disruptions if d.is_active(sim_time_minutes)]
