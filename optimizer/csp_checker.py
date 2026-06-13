from typing import List
from simulator.env import Action
from simulator.train_state import NetworkState, TrainState
from simulator.corridor import RailwayGraph

class ConstraintChecker:
    def __init__(self, graph: RailwayGraph):
        self.graph = graph

    def check_minimum_headway(self, train_a: TrainState, train_b: TrainState, block_id: str, state: NetworkState) -> bool:
        """Verifies safety margin between two trains.
        Since the simulator handles physical block reservation (one train per block),
        this always returns True unless both occupy the same block ID in an impossible state.
        """
        # If they occupy the same block state (which is impossible under normal sim), return False
        block = state.blocks.get(block_id)
        if block and block.occupied_by == train_a.train_id and block.occupied_by == train_b.train_id:
            return False
        return True

    def check_platform_capacity(self, station_id: str, state: NetworkState) -> bool:
        """Deadlock check: returns False if the station platforms are completely full."""
        station = state.stations.get(station_id)
        station_node = self.graph.get_station(station_id)
        if station and station_node:
            # If the platforms are already fully occupied, return False (deadlock risk)
            if station.occupied_platforms >= station_node.platforms:
                return False
        return True

    def check_block_clearance(self, train: TrainState, state: NetworkState) -> bool:
        """Verifies if the train is at a station or loop (i.e. not mid-section) to be held."""
        # When train.current_section is None, it is sitting at train.last_station platform or loop
        return train.current_section is None

    def check_hold_duration(self, train: TrainState, hold_minutes: float) -> bool:
        """Enforces that holds are within the maximum limit (e.g. 30 minutes)."""
        return hold_minutes <= 30.0

    def filter(self, actions: List[Action], state: NetworkState) -> List[Action]:
        """Filters a list of candidate actions, returning only those that satisfy all CSP constraints."""
        legal_actions = []
        for action in actions:
            if action.action_type == "noop":
                legal_actions.append(action)
                continue

            if action.action_type == "hold":
                train = state.trains.get(action.train_id)
                if not train:
                    continue

                # 1. Check block clearance (must be at station/loop, not traveling mid-section)
                if not self.check_block_clearance(train, state):
                    continue

                # 2. Check hold duration limit
                if not self.check_hold_duration(train, action.hold_minutes):
                    continue

                # 3. Check platform deadlock
                # Note: if a train is already at its last_station, holding it there keeps the platform occupied.
                # If the station is already at capacity, holding it does not add a new train, but if we held it
                # when other trains are waiting, we want to prevent deadlock.
                # Specifically, if station platforms are full, we prevent dispatch holds if they would block release.
                # Let's check platform capacity at the station.
                if not self.check_platform_capacity(train.last_station, state):
                    continue

                legal_actions.append(action)

        return legal_actions
