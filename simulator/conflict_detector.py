from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import math
from simulator.train_state import NetworkState, TrainState
from simulator.corridor import RailwayGraph

@dataclass
class Conflict:
    train_a_id: str
    train_b_id: str
    block_id: str
    conflict_start_sim_time: float
    overlap_minutes: float
    urgency_score: float

class ConflictDetector:
    def __init__(self, graph: RailwayGraph, timetable_data: Dict):
        self.graph = graph
        self.timetable_data = timetable_data
        # Map train_id -> scheduled stops info
        self.train_schedules = {}
        for train in timetable_data.get("trains", []):
            self.train_schedules[train["id"]] = train

    def get_train_speed(self, train: TrainState, section_id: str, active_disruptions: List) -> float:
        """Calculate effective speed of a train on a section considering max speeds and disruptions."""
        sec = self.graph.get_section(section_id)
        if not sec:
            return 80.0 # Default speed
        
        # Max speed allowed on this section
        sec_max = sec["max_speed"]
        
        # Max speed of the train class
        # (Rajdhani: 130, Shatabdi: 120, Premium/Superfast: 110, Express: 100, Passenger: 80, Freight: 60)
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
        
        effective_speed = min(sec_max, train_max)
        
        # Apply engine_slow disruptions if active
        for d in active_disruptions:
            if d.train_id == train.train_id and d.disruption_type == "engine_slow":
                effective_speed *= 0.40
                
        return max(effective_speed, 10.0) # Lower bound speed to avoid division by zero

    def parse_time_to_minutes(self, time_str: str) -> float:
        """Convert HH:MM to minutes since midnight."""
        parts = time_str.split(":")
        return int(parts[0]) * 60.0 + int(parts[1])

    def get_stop_duration(self, train_id: str, station_id: str) -> float:
        """Get scheduled stop duration at a station in minutes."""
        schedule = self.train_schedules.get(train_id)
        if not schedule:
            return 2.0 # Default
        
        stops = schedule.get("stops", [])
        for stop in stops:
            if stop["station_id"] == station_id:
                arr = stop.get("scheduled_arrival")
                dep = stop.get("scheduled_departure")
                if arr and dep:
                    return max(self.parse_time_to_minutes(dep) - self.parse_time_to_minutes(arr), 2.0)
                return 2.0
        return 0.0 # No stop

    def project_train_occupancies(self, train: TrainState, start_time: float, active_disruptions: List) -> List[Tuple[str, float, float]]:
        """Project block occupancy intervals (block_id, start_time, end_time) over next 30 minutes."""
        intervals = []
        t = start_time
        lookahead_limit = start_time + 30.0

        # Account for remaining hold time
        if train.is_held:
            t += train.hold_remaining_minutes

        # Get route details
        route = train.route
        curr_idx = train.current_route_index
        
        direction = train.direction
        current_section = train.current_section

        if current_section:
            # Train is currently in a section
            sec_id = current_section
            sec = self.graph.get_section(sec_id)
            if not sec:
                return intervals
            
            blocks_list = sec.get("blocks", [])
            num_blocks = len(blocks_list)
            
            # Find remaining blocks in this section
            b_idx = train.current_block_index
            if b_idx is None:
                # Approximate based on section progress
                progress = train.section_progress
                dist = sec["distance_km"]
                pos = (1.0 - progress) * dist if direction == "DOWN" else progress * dist
                cum_dist = 0.0
                b_idx = num_blocks - 1
                for idx, b in enumerate(blocks_list):
                    cum_dist += b["length_km"]
                    if pos <= cum_dist + 1e-5:
                        b_idx = idx
                        break

            # Calculate remaining length in current block
            dist = sec["distance_km"]
            pos = (1.0 - train.section_progress) * dist if direction == "DOWN" else train.section_progress * dist
            cum_blocks_before = sum(b["length_km"] for b in blocks_list[:b_idx])
            cum_blocks_end = sum(b["length_km"] for b in blocks_list[:b_idx+1])
            
            if direction == "DOWN":
                remaining_dist = pos - cum_blocks_before
            else:
                remaining_dist = cum_blocks_end - pos
                
            speed = self.get_train_speed(train, sec_id, active_disruptions)
            
            # Occupy current block
            block_id = blocks_list[b_idx]["id"]
            if direction == "DOWN":
                block_id = f"{block_id}_DOWN"
            
            traversal_time = (remaining_dist / speed) * 60.0
            intervals.append((block_id, t, t + traversal_time))
            t += traversal_time
            
            # Occupy remaining blocks in the section
            if direction == "DOWN":
                remaining_block_indices = range(b_idx - 1, -1, -1)
            else:
                remaining_block_indices = range(b_idx + 1, num_blocks)
                
            for idx in remaining_block_indices:
                if t >= lookahead_limit:
                    break
                b = blocks_list[idx]
                b_id = f"{b['id']}_DOWN" if direction == "DOWN" else b["id"]
                traversal_time = (b["length_km"] / speed) * 60.0
                intervals.append((b_id, t, t + traversal_time))
                t += traversal_time

            # Move route index to the next station
            curr_idx += 1

        # Project subsequent route sections and stations
        while curr_idx < len(route) - 1 and t < lookahead_limit:
            st_from = route[curr_idx]
            st_to = route[curr_idx + 1]
            
            # Station dwell time (if scheduled stop)
            stop_dur = self.get_stop_duration(train.train_id, st_from)
            if stop_dur > 0:
                # Train occupies station loops during dwell.
                # In our block model, stations are represented by station loops.
                # For conflict detection on sections, we don't strictly flag station overlaps as conflicts
                # unless capacity is exceeded. We'll bypass adding station loop occupancy to the section conflicts,
                # but we advance time by stop duration.
                t += stop_dur
                
            if t >= lookahead_limit:
                break
                
            sec_meta = self.graph.get_section_by_endpoints(st_from, st_to)
            if not sec_meta:
                break
            
            sec_id = sec_meta["id"]
            sec = self.graph.get_section(sec_id)
            blocks_list = sec.get("blocks", [])
            speed = self.get_train_speed(train, sec_id, active_disruptions)
            
            for b in blocks_list:
                if t >= lookahead_limit:
                    break
                b_id = f"{b['id']}_DOWN" if direction == "DOWN" else b["id"]
                traversal_time = (b["length_km"] / speed) * 60.0
                intervals.append((b_id, t, t + traversal_time))
                t += traversal_time
                
            curr_idx += 1
            
        return intervals

    def detect_conflicts(self, state: NetworkState, active_disruptions: List) -> List[Conflict]:
        """Scan projected occupancy windows and return list of Conflict objects sorted by urgency."""
        all_projections: Dict[str, List[Tuple[str, float, float]]] = {}
        for train_id, train in state.trains.items():
            # If train has reached its destination, skip
            if train.current_route_index >= len(train.route) - 1 and train.current_section is None:
                continue
            all_projections[train_id] = self.project_train_occupancies(train, state.sim_time, active_disruptions)

        # Map block_id -> list of (train_id, start_time, end_time)
        block_occupancies: Dict[str, List[Tuple[str, float, float]]] = {}
        for train_id, projections in all_projections.items():
            for block_id, start, end in projections:
                if block_id not in block_occupancies:
                    block_occupancies[block_id] = []
                block_occupancies[block_id].append((train_id, start, end))

        conflicts = []
        # Find overlaps per block
        for block_id, occupancies in block_occupancies.items():
            n = len(occupancies)
            if n < 2:
                continue
            # Compare all pairs of occupancy intervals in the block
            for i in range(n):
                for j in range(i + 1, n):
                    t1_id, start_1, end_1 = occupancies[i]
                    t2_id, start_2, end_2 = occupancies[j]
                    
                    # Check overlap
                    overlap_start = max(start_1, start_2)
                    overlap_end = min(end_1, end_2)
                    
                    if overlap_start < overlap_end:
                        overlap_duration = overlap_end - overlap_start
                        
                        # Generate unique ordered pair of trains to avoid duplicates
                        t_a, t_b = sorted([t1_id, t2_id])
                        
                        # Calculate urgency score (higher = starts sooner)
                        # We add 1.0 to prevent division by zero
                        time_to_conflict = overlap_start - state.sim_time
                        urgency = 100.0 / (max(time_to_conflict, 0.0) + 1.0)
                        
                        # Check if duplicate conflict exists in the list for this block and pair
                        exists = False
                        for c in conflicts:
                            if c.train_a_id == t_a and c.train_b_id == t_b and c.block_id == block_id:
                                # Update to be the most comprehensive overlap
                                c.conflict_start_sim_time = min(c.conflict_start_sim_time, overlap_start)
                                c.overlap_minutes = max(c.overlap_minutes, overlap_duration)
                                c.urgency_score = max(c.urgency_score, urgency)
                                exists = True
                                break
                                
                        if not exists:
                            conflicts.append(Conflict(
                                train_a_id=t_a,
                                train_b_id=t_b,
                                block_id=block_id,
                                conflict_start_sim_time=overlap_start,
                                overlap_minutes=overlap_duration,
                                urgency_score=urgency
                            ))

        # Sort descending by urgency score
        conflicts.sort(key=lambda x: x.urgency_score, reverse=True)
        return conflicts
