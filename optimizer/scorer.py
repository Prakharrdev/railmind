import os
import json
from dataclasses import dataclass
from typing import Dict, Optional
from simulator.train_state import NetworkState
from simulator.corridor import RailwayGraph
from simulator.conflict_detector import ConflictDetector

@dataclass
class StateScoreBreakdown:
    delay_cost: float
    conflict_cost: float
    congestion_cost: float
    starvation_cost: float
    total_cost: float

class StateScorer:
    def __init__(self, graph: RailwayGraph, timetable_data: Dict, config_path: Optional[str] = None):
        self.graph = graph
        self.timetable_data = timetable_data
        self.detector = ConflictDetector(graph, timetable_data)

        if config_path is None:
            # Find config/scoring.json relative to the root directory
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            config_path = os.path.join(base_dir, "config", "scoring.json")

        with open(config_path, "r") as f:
            config = json.load(f)

        self.class_weights = config.get("class_weights", {})
        self.conflict_penalty_multiplier = config.get("conflict_penalty_multiplier", 10000.0)

    def score(self, state: NetworkState) -> StateScoreBreakdown:
        # 1. Passenger Delay Cost
        # effective_passengers = passengers * class_weight
        # delay_cost += effective_passengers * delay_minutes
        delay_cost = 0.0
        for train in state.trains.values():
            weight = self.class_weights.get(train.train_class, 1.0)
            effective_passengers = train.typical_passengers * weight
            delay_cost += effective_passengers * train.delay_minutes

        # 2. Conflict Cost
        # conflict_cost = num_active_conflicts * 10000
        conflicts = self.detector.detect_conflicts(state, [])
        conflict_cost = len(conflicts) * self.conflict_penalty_multiplier

        # 3. Congestion Cost (Initially 0.0, to be implemented later)
        congestion_cost = 0.0

        # 4. Starvation Cost (Initially 0.0, to be implemented later)
        starvation_cost = 0.0

        # 5. Total Cost
        total_cost = delay_cost + conflict_cost + congestion_cost + starvation_cost

        return StateScoreBreakdown(
            delay_cost=delay_cost,
            conflict_cost=conflict_cost,
            congestion_cost=congestion_cost,
            starvation_cost=starvation_cost,
            total_cost=total_cost
        )

    def cost(self, state: NetworkState) -> float:
        return self.score(state).total_cost

