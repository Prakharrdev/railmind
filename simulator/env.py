from dataclasses import dataclass, replace
from typing import Dict, List, Optional
import json
import os
import math
from simulator.train_state import NetworkState, TrainState, BlockState, StationState
from simulator.corridor import RailwayGraph
from simulator.disruption_injector import Disruption, DisruptionInjector

@dataclass
class Action:
    train_id: str
    action_type: str  # "hold" | "noop"
    hold_minutes: float = 0.0

class TrainNetworkSimulator:
    def __init__(self, corridor_json_path: str, timetable_json_path: str, delay_distributions_path: str):
        self.graph = RailwayGraph(corridor_json_path)
        with open(timetable_json_path, "r") as f:
            self.timetable_data = json.load(f)
        
        self.disruption_injector = DisruptionInjector(delay_distributions_path)
        self.train_schedules = {t["id"]: t for t in self.timetable_data.get("trains", [])}
        
        # Initialize simulation state at 14:00 (840.0 minutes since midnight)
        self.state = self._initialize_state()

    def _parse_time_to_minutes(self, time_str: str) -> float:
        """Convert HH:MM to minutes since midnight."""
        parts = time_str.split(":")
        return int(parts[0]) * 60.0 + int(parts[1])

    def _initialize_state(self) -> NetworkState:
        sim_time = 840.0 # 14:00 in minutes
        
        trains = {}
        for train_id, train in self.train_schedules.items():
            stops = train.get("stops", [])
            if not stops:
                continue
            origin = stops[0]["station_id"]
            
            # Find destination and next stop
            destination = stops[-1]["station_id"]
            next_st = stops[1]["station_id"] if len(stops) > 1 else None
            
            # Form full station route
            route = self.graph.get_shortest_path(origin, destination)
            if not route:
                route = [origin]
                if next_st:
                    route.append(next_st)
            
            # Parse typical passenger count
            typical_pax = train.get("typical_passengers", 800)
            
            trains[train_id] = TrainState(
                train_id=train_id,
                name=train["name"],
                train_class=train["class"],
                direction=train["direction"],
                typical_passengers=typical_pax,
                current_section=None,
                section_progress=0.0,
                current_speed_kmph=0.0,
                delay_minutes=0.0,
                is_held=False,
                hold_remaining_minutes=0.0,
                last_station=origin,
                next_station=next_st,
                route=route,
                current_route_index=0,
                station_arrival_times={},
                station_departure_times={},
                current_block_index=None
            )
            
        blocks = {}
        for b_id in self.graph.blocks.keys():
            blocks[b_id] = BlockState(block_id=b_id, occupied_by=None)
            
        stations = {}
        for s_id in self.graph.stations.keys():
            stations[s_id] = StationState(station_id=s_id, occupied_platforms=0, train_ids=[])
            
        # Put trains at their origin stations initially
        for train_id, train in trains.items():
            origin = train.last_station
            if origin in stations:
                stations[origin].train_ids.append(train_id)
                stations[origin].occupied_platforms += 1

        return NetworkState(sim_time=sim_time, trains=trains, blocks=blocks, stations=stations)

    def current_state(self) -> NetworkState:
        return self.state

    def inject_disruption(self, disruption: Disruption):
        self.disruption_injector.inject_disruption(disruption)

    def _get_train_speed(self, train: TrainState, section_id: str, active_disruptions: List[Disruption]) -> float:
        """Calculate the max target speed of a train on a section under active disruptions."""
        sec = self.graph.get_section(section_id)
        if not sec:
            return 80.0
        
        train_max_speeds = {
            "rajdhani_vande_bharat": 130.0,
            "shatabdi": 120.0,
            "premium_mail_express": 110.0,
            "superfast": 110.0,
            "ordinary_express": 100.0,
            "passenger_memu": 80.0,
            "freight": 60.0
        }
        train_max = train_max_speeds.get(train.train_class, 80.0)
        effective_speed = min(sec["max_speed"], train_max)
        
        for d in active_disruptions:
            if d.train_id == train.train_id and d.disruption_type == "engine_slow" and d.is_active(train.delay_minutes):
                # Engine slow operates on cumulative delay minutes or sim_time.
                # The prompt specifies magnitude is 20-40 min, and is active for that duration.
                # We can check active_disruptions at state.sim_time
                pass
        
        # Let's check based on self.state.sim_time
        sim_time_minutes = self.state.sim_time
        for d in active_disruptions:
            if d.train_id == train.train_id and d.disruption_type == "engine_slow" and d.is_active(sim_time_minutes):
                effective_speed *= 0.40
                
        return max(effective_speed, 10.0)

    def _get_scheduled_departure(self, train_id: str, station_id: str) -> Optional[float]:
        schedule = self.train_schedules.get(train_id)
        if not schedule:
            return None
        for stop in schedule.get("stops", []):
            if stop["station_id"] == station_id:
                dep = stop.get("scheduled_departure")
                if dep:
                    return self._parse_time_to_minutes(dep)
        return None

    def _get_scheduled_arrival(self, train_id: str, station_id: str) -> Optional[float]:
        schedule = self.train_schedules.get(train_id)
        if not schedule:
            return None
        for stop in schedule.get("stops", []):
            if stop["station_id"] == station_id:
                arr = stop.get("scheduled_arrival")
                if arr:
                    return self._parse_time_to_minutes(arr)
        return None

    def _get_active_signal_holds(self, sim_time: float) -> List[str]:
        """Get block IDs currently blocked by active signal failures."""
        blocked_blocks = []
        for d in self.disruption_injector.get_active_disruptions(sim_time):
            if d.disruption_type == "signal_hold" and d.target_id:
                blocked_blocks.append(d.target_id)
        return blocked_blocks

    def _get_active_platform_capacity_reductions(self, sim_time: float) -> Dict[str, int]:
        """Get capacity reductions at stations due to platform blockages."""
        reductions = {}
        for d in self.disruption_injector.get_active_disruptions(sim_time):
            if d.disruption_type == "platform_block" and d.target_id:
                reductions[d.target_id] = reductions.get(d.target_id, 0) + 99
        return reductions

    def tick(self) -> NetworkState:
        """Advance the simulation time by 30 seconds (0.5 minutes) and update train states."""
        self.state = self._update_state(self.state, 0.5)
        return self.state

    def apply_action(self, state: NetworkState, action: Action) -> NetworkState:
        """Apply a dispatcher hold action to a state snapshot immutably."""
        new_state = state.clone()
        if action.action_type == "hold":
            train = new_state.trains.get(action.train_id)
            if train:
                train.is_held = True
                train.hold_remaining_minutes = action.hold_minutes
                train.current_speed_kmph = 0.0
        return new_state

    def project_forward(self, state: NetworkState, minutes: int) -> NetworkState:
        """Fast forward a state snapshot by N minutes (using 60-second steps for speed) under FCFS."""
        temp_state = state.clone()
        steps = int(minutes)
        for _ in range(steps):
            temp_state = self._update_state(temp_state, 1.0)
        return temp_state

    def _update_state(self, state: NetworkState, delta_minutes: float) -> NetworkState:
        """Pure function that advances the simulation state by delta_minutes, returning a new state."""
        # 1. Clone state
        new_state = state.clone()
        new_state.sim_time += delta_minutes
        sim_time = new_state.sim_time
        
        # 2. Collect active disruptions
        active_disruptions = self.disruption_injector.get_active_disruptions(sim_time)
        blocked_blocks = self._get_active_signal_holds(sim_time)
        platform_reductions = self._get_active_platform_capacity_reductions(sim_time)

        # 3. Synchronize block occupancy representation with signal disruptions
        for b_id, b_state in new_state.blocks.items():
            if b_id in blocked_blocks:
                b_state.occupied_by = "DISRUPTED_SIGNAL"
            elif b_state.occupied_by == "DISRUPTED_SIGNAL":
                # Disruption has cleared
                b_state.occupied_by = None

        # 4. Handle holds and movement updates for all trains
        for train_id, train in list(new_state.trains.items()):
            # If reached destination, do not update movement
            if train.current_route_index >= len(train.route) - 1 and train.current_section is None:
                train.current_speed_kmph = 0.0
                continue
                
            # Handle hold decrement
            if train.is_held:
                train.hold_remaining_minutes -= delta_minutes
                if train.hold_remaining_minutes <= 0.0:
                    train.is_held = False
                    train.hold_remaining_minutes = 0.0
                else:
                    train.current_speed_kmph = 0.0
                    train.delay_minutes += delta_minutes
                    continue

            # Update train position
            if train.current_section is None:
                # Train is stopped at station `last_station`
                st_id = train.last_station
                
                # Check scheduled departure
                sched_dep = self._get_scheduled_departure(train_id, st_id)
                if sched_dep is None:
                    # Non-stop run-through station that wasn't scheduled.
                    # Or intermediate station. Let's see: if it is ready to depart, check next block.
                    sched_dep = sim_time # Can depart immediately

                if sim_time < sched_dep:
                    # Timetable hold (not departed yet)
                    train.current_speed_kmph = 0.0
                    continue

                # Train wants to depart! Check outgoing block clearance.
                next_st = train.next_station
                if not next_st:
                    # Reached end of route
                    train.current_speed_kmph = 0.0
                    continue
                    
                sec_meta = self.graph.get_section_by_endpoints(st_id, next_st)
                if not sec_meta:
                    # Invalid path
                    train.current_speed_kmph = 0.0
                    continue
                    
                sec_id = sec_meta["id"]
                sec = self.graph.get_section(sec_id)
                blocks_list = sec.get("blocks", [])
                
                # Target block based on direction
                b_idx = len(blocks_list) - 1 if train.direction == "DOWN" else 0
                target_block_id = blocks_list[b_idx]["id"]
                if train.direction == "DOWN":
                    target_block_id = f"{target_block_id}_DOWN"
                
                target_block_state = new_state.blocks.get(target_block_id)
                
                if target_block_state and target_block_state.occupied_by is not None:
                    # Outgoing block is blocked!
                    train.current_speed_kmph = 0.0
                    train.delay_minutes += delta_minutes
                else:
                    # Depart!
                    train.station_departure_times[st_id] = sim_time
                    
                    # Update station occupied status
                    st_state = new_state.stations.get(st_id)
                    if st_state and train_id in st_state.train_ids:
                        st_state.train_ids.remove(train_id)
                        st_state.occupied_platforms = max(0, st_state.occupied_platforms - 1)
                        
                    # Occupy first block
                    if target_block_state:
                        target_block_state.occupied_by = train_id
                        
                    train.current_section = sec_id
                    train.section_progress = 0.0
                    train.current_block_index = b_idx
                    train.current_speed_kmph = self._get_train_speed(train, sec_id, active_disruptions)
            else:
                # Train is currently traveling in a section
                sec_id = train.current_section
                sec = self.graph.get_section(sec_id)
                blocks_list = sec.get("blocks", [])
                num_blocks = len(blocks_list)
                
                speed = self._get_train_speed(train, sec_id, active_disruptions)
                dist_km = sec["distance_km"]
                
                # Distance traveled in delta_minutes
                delta_dist = speed * (delta_minutes / 60.0)
                curr_dist = train.section_progress * dist_km
                new_dist = curr_dist + delta_dist
                
                if new_dist >= dist_km:
                    # Reached end of section (next station)
                    next_st = train.next_station
                    st_state = new_state.stations.get(next_st)
                    st_meta = self.graph.get_station(next_st)
                    
                    # Capacity checks
                    capacity_reduction = platform_reductions.get(next_st, 0)
                    available_platforms = st_meta.platforms - capacity_reduction if st_meta else 0
                    
                    if st_state and st_state.occupied_platforms < available_platforms:
                        # Enter station
                        # Vacate current block
                        curr_block_id = blocks_list[train.current_block_index]["id"]
                        if train.direction == "DOWN":
                            curr_block_id = f"{curr_block_id}_DOWN"
                        old_block_state = new_state.blocks.get(curr_block_id)
                        if old_block_state and old_block_state.occupied_by == train_id:
                            old_block_state.occupied_by = None
                            
                        # Update train state
                        train.last_station = next_st
                        train.current_route_index += 1
                        if train.current_route_index < len(train.route) - 1:
                            train.next_station = train.route[train.current_route_index + 1]
                        else:
                            train.next_station = None
                            
                        train.current_section = None
                        train.section_progress = 0.0
                        train.current_block_index = None
                        train.current_speed_kmph = 0.0
                        
                        # Populate station tracking
                        st_state.train_ids.append(train_id)
                        st_state.occupied_platforms += 1
                        train.station_arrival_times[next_st] = sim_time
                        
                        # Calculate delay
                        sched_arr = self._get_scheduled_arrival(train_id, next_st)
                        if sched_arr is not None:
                            train.delay_minutes = max(0.0, sim_time - sched_arr)
                    else:
                        # Station is full! Hold at signal just before entering
                        train.section_progress = 1.0
                        train.current_speed_kmph = 0.0
                        train.delay_minutes += delta_minutes
                else:
                    # Determine target block for new distance
                    pos = (dist_km - new_dist) if train.direction == "DOWN" else new_dist
                    cum_dist = 0.0
                    new_block_idx = num_blocks - 1
                    for idx, b in enumerate(blocks_list):
                        cum_dist += b["length_km"]
                        if pos <= cum_dist + 1e-5:
                            new_block_idx = idx
                            break
                            
                    if new_block_idx == train.current_block_index:
                        # Remain in current block
                        train.section_progress = new_dist / dist_km
                        train.current_speed_kmph = speed
                    else:
                        # Transitions to new block: check clearance
                        target_block_id = blocks_list[new_block_idx]["id"]
                        if train.direction == "DOWN":
                            target_block_id = f"{target_block_id}_DOWN"
                            
                        target_block_state = new_state.blocks.get(target_block_id)
                        
                        if target_block_state and target_block_state.occupied_by is not None:
                            # Target block is occupied! Stop at boundary
                            train.current_speed_kmph = 0.0
                            train.delay_minutes += delta_minutes
                            
                            # Lock progress to the block boundary
                            cum_blocks_boundary = sum(b["length_km"] for b in blocks_list[:train.current_block_index+1])
                            if train.direction == "DOWN":
                                boundary_progress = (dist_km - sum(b["length_km"] for b in blocks_list[:train.current_block_index])) / dist_km
                            else:
                                boundary_progress = cum_blocks_boundary / dist_km
                            train.section_progress = min(boundary_progress, 0.999)
                        else:
                            # Enter next block!
                            curr_block_id = blocks_list[train.current_block_index]["id"]
                            if train.direction == "DOWN":
                                curr_block_id = f"{curr_block_id}_DOWN"
                            
                            old_block_state = new_state.blocks.get(curr_block_id)
                            if old_block_state and old_block_state.occupied_by == train_id:
                                old_block_state.occupied_by = None
                                
                            if target_block_state:
                                target_block_state.occupied_by = train_id
                                
                            train.current_block_index = new_block_idx
                            train.section_progress = new_dist / dist_km
                            train.current_speed_kmph = speed
                            
        return new_state
