from typing import List, Dict, Any, Optional
from simulator.env import TrainNetworkSimulator, Action
from simulator.train_state import NetworkState
from simulator.disruption_injector import Disruption
from simulator.event_logger import TrainHeld, DisruptionInjected

class ReplayRunner:
    def __init__(self, corridor_path: str, timetable_path: str, delay_distributions_path: str):
        self.corridor_path = corridor_path
        self.timetable_path = timetable_path
        self.delay_distributions_path = delay_distributions_path
        self.states: List[NetworkState] = []
        self.current_idx = 0
        self.is_playing = False

    def load_run(self, scenario_dict: Dict[str, Any], events: List[Any]) -> None:
        """Reconstruct the sequence of simulation states by re-simulating with logged actions."""
        self.states = []
        self.current_idx = 0
        self.is_playing = False

        # Initialize a new simulator instance
        sim = TrainNetworkSimulator(
            self.corridor_path,
            self.timetable_path,
            self.delay_distributions_path
        )

        # Inject disruptions from the scenario dict
        disruptions = scenario_dict.get("disruptions", [])
        for d_dict in disruptions:
            sim.inject_disruption(Disruption(**d_dict))

        # Extract hold actions from events
        # Map sim_time (rounded to 2 decimal places to avoid float precision issues) -> list of Action
        holds_by_time: Dict[float, List[Action]] = {}
        for event in events:
            # Handle both dataclass and dictionary formats
            if isinstance(event, dict):
                event_type = event.get("event_type")
                if event_type == "TrainHeld":
                    sim_time = round(event["sim_time"], 2)
                    action = Action(
                        train_id=event["train_id"],
                        action_type="hold",
                        hold_minutes=event["hold_minutes"]
                    )
                    holds_by_time.setdefault(sim_time, []).append(action)
            elif isinstance(event, TrainHeld):
                sim_time = round(event.sim_time, 2)
                action = Action(
                    train_id=event.train_id,
                    action_type="hold",
                    hold_minutes=event.hold_minutes
                )
                holds_by_time.setdefault(sim_time, []).append(action)

        # Run the simulator step-by-step for 240 ticks (120 minutes)
        for _ in range(240):
            state = sim.current_state()
            self.states.append(state.clone())

            # Apply any hold actions logged for this specific timestamp
            sim_time_key = round(state.sim_time, 2)
            if sim_time_key in holds_by_time:
                for action in holds_by_time[sim_time_key]:
                    sim.state = sim.apply_action(sim.state, action)

            # Advance simulation time by 0.5 minutes
            sim.tick()

        # Add the final state
        self.states.append(sim.current_state().clone())

    def play(self) -> None:
        """Start/resume replay playback."""
        self.is_playing = True

    def pause(self) -> None:
        """Pause replay playback."""
        self.is_playing = False

    def step_forward(self) -> Optional[NetworkState]:
        """Advance replay by one step (0.5 minutes)."""
        if self.current_idx < len(self.states) - 1:
            self.current_idx += 1
        return self.get_current_state()

    def step_backward(self) -> Optional[NetworkState]:
        """Move replay back by one step (0.5 minutes)."""
        if self.current_idx > 0:
            self.current_idx -= 1
        return self.get_current_state()

    def jump_to(self, timestamp: float) -> Optional[NetworkState]:
        """Jump to the state closest to the target simulation time timestamp."""
        if not self.states:
            return None
        # Find index with closest sim_time
        closest_idx = 0
        min_diff = float("inf")
        for idx, state in enumerate(self.states):
            diff = abs(state.sim_time - timestamp)
            if diff < min_diff:
                min_diff = diff
                closest_idx = idx
        self.current_idx = closest_idx
        return self.get_current_state()

    def get_current_state(self) -> Optional[NetworkState]:
        """Retrieve the state at the current replay pointer."""
        if 0 <= self.current_idx < len(self.states):
            return self.states[self.current_idx]
        return None
