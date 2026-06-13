import asyncio
import uuid
import time
import os
import dataclasses
from typing import Dict, List, Any, Optional
from datetime import datetime

from simulator.env import TrainNetworkSimulator, Action
from simulator.conflict_detector import ConflictDetector, Conflict
from simulator.disruption_injector import Disruption
from optimizer.scorer import StateScorer
from optimizer.csp_checker import ConstraintChecker
from optimizer.beam_search import BeamSearchPlanner
from simulator.event_logger import (
    EventLogger, TrainMoved, TrainHeld, ConflictDetected,
    PlannerInvoked, RecommendationGenerated, RecommendationAccepted,
    RecommendationRejected, DisruptionInjected
)
from evaluation.metrics_engine import MetricsEngine
from api.ws_manager import ws_manager

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"

class SimulationRunner:
    def __init__(self):
        self.simulator = TrainNetworkSimulator(
            CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH
        )
        self.scorer = StateScorer(self.simulator.graph, self.simulator.timetable_data)
        self.checker = ConstraintChecker(self.simulator.graph)
        self.planner = BeamSearchPlanner(
            self.simulator, self.scorer, self.checker, depth=4, beam_width=8
        )
        self.detector = ConflictDetector(self.simulator.graph, self.simulator.timetable_data)
        self.logger = EventLogger()
        self.metrics_engine = MetricsEngine()

        self.auto_plan = True
        self.auto_apply = True  # Automatically apply the first recommended action
        self.tick_interval_seconds = 1.0  # Real-time wall clock time per tick

        self.is_running = False
        self.task: Optional[asyncio.Task] = None

        self.recommendations: Dict[str, Any] = {}
        self.latest_recommendation: Optional[Dict[str, Any]] = None
        self.run_id = f"run_{int(time.time())}"
        self.timestamp = datetime.now().isoformat()

    def configure_planner(self, depth: int, beam_width: int, step_minutes: int = 5) -> None:
        self.planner.depth = depth
        self.planner.beam_width = beam_width
        self.planner.step_minutes = step_minutes

    def inject_disruption(self, disruption: Disruption) -> None:
        self.simulator.inject_disruption(disruption)
        # Log event
        self.logger.log_event(
            DisruptionInjected(
                disruption_id=disruption.disruption_id,
                train_id=disruption.train_id,
                disruption_type=disruption.disruption_type,
                magnitude_minutes=disruption.magnitude_minutes,
                start_time=disruption.start_time,
                end_time=disruption.end_time,
                target_id=disruption.target_id,
                sim_time=self.simulator.state.sim_time
            )
        )

    def apply_action(self, action: Action) -> None:
        self.simulator.state = self.simulator.apply_action(self.simulator.state, action)
        # Log event
        self.logger.log_event(
            TrainHeld(
                train_id=action.train_id,
                hold_minutes=action.hold_minutes,
                sim_time=self.simulator.state.sim_time
            )
        )

    async def start(self) -> None:
        if self.is_running:
            return
        self.is_running = True
        self.task = asyncio.create_task(self.run_loop())

    async def stop(self) -> None:
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def run_loop(self) -> None:
        tick_count = 0
        while self.is_running and tick_count < 240:
            start_time = time.perf_counter()
            
            # 1. Advance simulation
            state = self.simulator.tick()
            tick_count += 1
            sim_time = state.sim_time

            # 2. Log TrainMoved events
            for train_id, train in state.trains.items():
                self.logger.log_event(
                    TrainMoved(
                        train_id=train_id,
                        section_id=train.current_section,
                        block_index=train.current_block_index,
                        speed_kmph=train.current_speed_kmph,
                        progress=train.section_progress,
                        delay_minutes=train.delay_minutes,
                        sim_time=sim_time
                    )
                )

            # 3. Detect conflicts
            conflicts = self.detector.detect_conflicts(state, [])
            for c in conflicts:
                self.logger.log_event(
                    ConflictDetected(
                        train_a_id=c.train_a_id,
                        train_b_id=c.train_b_id,
                        block_id=c.block_id,
                        conflict_start_sim_time=c.conflict_start_sim_time,
                        overlap_minutes=c.overlap_minutes,
                        sim_time=sim_time
                    )
                )

            # 4. Run planner if conflicts exist and auto_plan is enabled
            rec_to_send = {}
            if conflicts and self.auto_plan:
                self.logger.log_event(PlannerInvoked(self.planner.depth, self.planner.beam_width, sim_time))
                
                # Run planning
                action_seq = self.planner.plan(state, self.planner.depth, self.planner.beam_width)
                
                rec_id = f"rec_{uuid.uuid4().hex[:8]}"
                actions_list = [
                    {"train_id": a.train_id, "action_type": a.action_type, "hold_minutes": a.hold_minutes}
                    for a in action_seq.actions
                ]
                
                rec_data = {
                    "recommendation_id": rec_id,
                    "actions": actions_list,
                    "projected_cost": action_seq.projected_cost,
                    "improvement_pct": action_seq.improvement_pct,
                    "decision_trace": dataclasses.asdict(action_seq.decision_trace),
                    "stats": dataclasses.asdict(action_seq.stats),
                    "sim_time": sim_time
                }
                
                self.recommendations[rec_id] = rec_data
                self.latest_recommendation = rec_data
                rec_to_send = {
                    "recommendation_id": rec_id,
                    "actions": actions_list,
                    "projected_cost": action_seq.projected_cost,
                    "improvement_pct": action_seq.improvement_pct,
                    "stats": dataclasses.asdict(action_seq.stats),
                    "sim_time": sim_time
                }
                
                # Log event
                self.logger.log_event(
                    RecommendationGenerated(
                        recommendation_id=rec_id,
                        actions=actions_list,
                        projected_cost=action_seq.projected_cost,
                        improvement_pct=action_seq.improvement_pct,
                        sim_time=sim_time
                    )
                )
                
                # Auto-apply if configured
                if self.auto_apply and action_seq.actions:
                    first_action = action_seq.actions[0]
                    if first_action.action_type != "noop":
                        self.apply_action(first_action)
                        self.logger.log_event(RecommendationAccepted(rec_id, sim_time))
                    else:
                        self.logger.log_event(RecommendationRejected(rec_id, sim_time))

            # 5. Calculate current metrics
            metrics = self.metrics_engine.calculate_run_metrics(
                state, self.logger.events, {"depth": self.planner.depth, "beam_width": self.planner.beam_width}
            )

            # 6. Broadcast updates to WebSockets
            trains_list = [
                {
                    "train_id": t.train_id,
                    "name": t.name,
                    "train_class": t.train_class,
                    "direction": t.direction,
                    "speed_kmph": t.current_speed_kmph,
                    "delay_minutes": round(t.delay_minutes, 2),
                    "progress": round(t.section_progress, 4),
                    "section_id": t.current_section,
                    "last_station": t.last_station,
                    "next_station": t.next_station,
                    "is_held": t.is_held,
                    "hold_remaining_minutes": round(t.hold_remaining_minutes, 2)
                }
                for t in state.trains.values()
            ]
            
            conflicts_list = [
                {
                    "train_a_id": c.train_a_id,
                    "train_b_id": c.train_b_id,
                    "block_id": c.block_id,
                    "conflict_start_sim_time": round(c.conflict_start_sim_time, 2),
                    "overlap_minutes": round(c.overlap_minutes, 2),
                    "urgency_score": round(c.urgency_score, 2)
                }
                for c in conflicts
            ]

            payload = {
                "sim_time": sim_time,
                "trains": trains_list,
                "conflicts": conflicts_list,
                "recommendation": rec_to_send,
                "metrics": metrics
            }
            
            await ws_manager.broadcast(payload)

            # 7. Sleep to maintain real-time tick interval
            elapsed = time.perf_counter() - start_time
            sleep_time = max(0.01, self.tick_interval_seconds - elapsed)
            await asyncio.sleep(sleep_time)

        # Simulation complete! Save results
        self.save_run_results()

    def save_run_results(self) -> None:
        """Create standard results archive run_XXXX/ under results/."""
        run_dir = os.path.join("results", self.run_id)
        os.makedirs(run_dir, exist_ok=True)

        # 1. Save metadata
        metadata = {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "planner_version": "v0.5.0",
            "beam_width": self.planner.beam_width,
            "depth": self.planner.depth,
            "git_commit": "abc123"
        }
        with open(os.path.join(run_dir, "run_metadata.json"), "w") as f:
            import json
            json.dump(metadata, f, indent=2)

        # 2. Save scenario
        scenario = {
            "scenario_id": self.run_id,
            "disruptions": [
                {
                    "disruption_id": getattr(d, "disruption_id", ""),
                    "train_id": getattr(d, "train_id", ""),
                    "disruption_type": getattr(d, "disruption_type", ""),
                    "magnitude_minutes": getattr(d, "magnitude_minutes", 0.0),
                    "start_time": getattr(d, "start_time", 0.0),
                    "end_time": getattr(d, "end_time", 0.0),
                    "target_id": getattr(d, "target_id", None)
                }
                for d in self.simulator.disruption_injector.disruptions
            ]
        }
        with open(os.path.join(run_dir, "scenario.json"), "w") as f:
            import json
            json.dump(scenario, f, indent=2)

        # 3. Save events
        self.logger.save_events(os.path.join(run_dir, "events.json"))

        # 4. Save metrics
        metrics = self.metrics_engine.calculate_run_metrics(
            self.simulator.current_state(),
            self.logger.events,
            {"depth": self.planner.depth, "beam_width": self.planner.beam_width}
        )
        with open(os.path.join(run_dir, "metrics.json"), "w") as f:
            import json
            json.dump(metrics, f, indent=2)

        # 5. Save recent planner config
        planner_config = {
            "depth": self.planner.depth,
            "beam_width": self.planner.beam_width,
            "step_minutes": self.planner.step_minutes
        }
        with open(os.path.join(run_dir, "planner_config.json"), "w") as f:
            import json
            json.dump(planner_config, f, indent=2)

        # 6. Save visual traces compiled
        with open(os.path.join(run_dir, "trace.json"), "w") as f:
            import json
            json.dump(self.recommendations, f, indent=2)

# Global simulation runner instance
sim_runner = SimulationRunner()
