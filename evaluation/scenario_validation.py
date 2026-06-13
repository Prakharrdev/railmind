import os
import json
from typing import Dict, List, Tuple
from simulator.env import TrainNetworkSimulator
from simulator.disruption_injector import Disruption

def parse_time_to_minutes(time_str: str) -> float:
    """Convert HH:MM to minutes since midnight."""
    parts = time_str.split(":")
    return int(parts[0]) * 60.0 + int(parts[1])

def get_train_movement_history(corridor_path: str, timetable_path: str, distributions_path: str) -> Tuple[dict, dict, dict]:
    """
    Simulates a default FCFS run without any disruptions.
    Returns:
      active_spans: train_id -> list of sim_time minutes when train was active on the network.
      block_spans: (train_id, block_id) -> list of sim_time minutes when train occupies the block.
      station_spans: (train_id, station_id) -> list of sim_time minutes when train occupies a platform at the station.
    """
    sim = TrainNetworkSimulator(corridor_path, timetable_path, distributions_path)
    
    active_spans = {}
    block_spans = {}
    station_spans = {}

    for train_id, train in sim.state.trains.items():
        active_spans[train_id] = []
        # Origin station is occupied at the start
        station_spans[(train_id, train.last_station)] = [sim.state.sim_time]

    for _ in range(240): # 120 minutes (240 ticks of 0.5 minutes)
        state = sim.state
        sim_time = state.sim_time

        # 1. Track block occupancy
        for block_id, b_state in state.blocks.items():
            if b_state.occupied_by:
                tid = b_state.occupied_by
                key = (tid, block_id)
                if key not in block_spans:
                    block_spans[key] = []
                block_spans[key].append(sim_time)

        # 2. Track station occupancy
        for station_id, s_state in state.stations.items():
            for tid in s_state.train_ids:
                key = (tid, station_id)
                if key not in station_spans:
                    station_spans[key] = []
                station_spans[key].append(sim_time)

        # 3. Track active spans (departed origin, not yet finished destination)
        for train_id, train in state.trains.items():
            origin = train.route[0]
            has_departed = origin in train.station_departure_times
            has_finished = train.current_route_index >= len(train.route) - 1 and train.current_section is None
            if has_departed and not has_finished:
                active_spans[train_id].append(sim_time)

        sim.tick()

    return active_spans, block_spans, station_spans


def validate_scenario(
    scenario_dict: dict,
    corridor_path: str,
    timetable_path: str,
    distributions_path: str,
    active_spans: dict,
    block_spans: dict,
    station_spans: dict
) -> bool:
    """
    Validates a generated scenario using 3 checks:
    1. Disrupted train must be active in simulation window [840, 960].
    2. Disruption time overlaps the train's actual occupation of the resource or active movement time.
    3. Applying the disruption alters the simulator state compared to the default state.
    """
    disruptions = scenario_dict.get("disruptions", [])
    if not disruptions:
        return False
    
    # We only care about the primary disruption for now
    d_dict = disruptions[0]
    dtype = d_dict["disruption_type"]
    train_id = d_dict["train_id"]
    start_time = d_dict["start_time"]
    end_time = d_dict["end_time"]
    target_id = d_dict.get("target_id")

    # Check 1: Train active during simulation window (has any active spans or movement ticks)
    # If a train has no recorded active ticks, it means it doesn't move during 14:00 - 16:00
    if train_id not in active_spans or not active_spans[train_id]:
        return False

    # Check 2: Disruption time overlaps train's actual movement time at the target resource
    if dtype == "engine_slow":
        # Check overlap with train active spans
        times = active_spans[train_id]
        t_min, t_max = min(times), max(times)
        if max(t_min, start_time) > min(t_max, end_time):
            return False
    elif dtype == "signal_hold":
        # Check overlap with block occupation
        key = (train_id, target_id)
        if key not in block_spans:
            return False
        times = block_spans[key]
        t_min, t_max = min(times), max(times)
        if max(t_min, start_time) > min(t_max, end_time):
            return False
    elif dtype == "platform_block":
        # Check overlap with station occupancy
        key = (train_id, target_id)
        if key not in station_spans:
            return False
        times = station_spans[key]
        t_min, t_max = min(times), max(times)
        if max(t_min, start_time) > min(t_max, end_time):
            return False

    # Check 3: State-changing impact verification
    # Run a simulation WITH the disruption
    sim_disrupted = TrainNetworkSimulator(corridor_path, timetable_path, distributions_path)
    for d in disruptions:
        sim_disrupted.inject_disruption(Disruption(**d))
    
    for _ in range(240):
        sim_disrupted.tick()
    final_disrupted_state = sim_disrupted.current_state()

    # Run a simulation WITHOUT any disruption (default)
    # We can just check it against a simulated baseline run
    sim_baseline = TrainNetworkSimulator(corridor_path, timetable_path, distributions_path)
    for _ in range(240):
        sim_baseline.tick()
    final_baseline_state = sim_baseline.current_state()

    # Compare final states of both simulations
    # If the disruption didn't change any train's position or delay, it has no impact!
    states_differ = False
    for tid, t_disrupted in final_disrupted_state.trains.items():
        t_base = final_baseline_state.trains.get(tid)
        if not t_base:
            states_differ = True
            break
        # Check position and delays
        if t_disrupted.current_section != t_base.current_section:
            states_differ = True
            break
        if abs(t_disrupted.section_progress - t_base.section_progress) > 1e-4:
            states_differ = True
            break
        if abs(t_disrupted.delay_minutes - t_base.delay_minutes) > 1e-3:
            states_differ = True
            break
        if t_disrupted.current_route_index != t_base.current_route_index:
            states_differ = True
            break
            
    if not states_differ:
        return False

    return True
