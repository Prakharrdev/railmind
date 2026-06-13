import os
import sys
import pytest

# Adjust path to import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from simulator.train_state import TrainState, NetworkState, BlockState, StationState
from simulator.corridor import RailwayGraph
from simulator.env import Action
from optimizer.csp_checker import ConstraintChecker

CORRIDOR_PATH = "data/processed/corridor.json"

@pytest.fixture
def graph():
    return RailwayGraph(CORRIDOR_PATH)

@pytest.fixture
def checker(graph):
    return ConstraintChecker(graph)

def test_check_block_clearance(checker):
    # Train traveling mid-section: current_section is not None
    train_mid = TrainState(
        train_id="T1", name="Train_1", train_class="shatabdi", direction="UP",
        typical_passengers=800, current_section="NDLS_GZB", section_progress=0.5,
        current_speed_kmph=100.0, delay_minutes=0.0, is_held=False, hold_remaining_minutes=0.0,
        last_station="NDLS", next_station="GZB", route=["NDLS", "GZB"], current_route_index=0,
        station_arrival_times={}, station_departure_times={}, current_block_index=1
    )
    # Train at station: current_section is None
    train_at_st = TrainState(
        train_id="T2", name="Train_2", train_class="shatabdi", direction="UP",
        typical_passengers=800, current_section=None, section_progress=0.0,
        current_speed_kmph=0.0, delay_minutes=0.0, is_held=False, hold_remaining_minutes=0.0,
        last_station="NDLS", next_station="GZB", route=["NDLS", "GZB"], current_route_index=0,
        station_arrival_times={}, station_departure_times={}, current_block_index=None
    )

    state = NetworkState(sim_time=840.0, trains={}, blocks={}, stations={})

    # Cannot hold mid-section
    assert checker.check_block_clearance(train_mid, state) is False
    # Can hold at station
    assert checker.check_block_clearance(train_at_st, state) is True

def test_check_hold_duration(checker):
    train = TrainState(
        train_id="T1", name="Train_1", train_class="shatabdi", direction="UP",
        typical_passengers=800, current_section=None, section_progress=0.0,
        current_speed_kmph=0.0, delay_minutes=0.0, is_held=False, hold_remaining_minutes=0.0,
        last_station="NDLS", next_station="GZB", route=["NDLS", "GZB"], current_route_index=0,
        station_arrival_times={}, station_departure_times={}, current_block_index=None
    )

    # 10 min is legal
    assert checker.check_hold_duration(train, 10.0) is True
    # 30 min is legal
    assert checker.check_hold_duration(train, 30.0) is True
    # 35 min is illegal
    assert checker.check_hold_duration(train, 35.0) is False

def test_check_platform_capacity(checker):
    # Setup state where GZB station has some platforms occupied
    # GZB has 6 platforms in the graph
    state = NetworkState(
        sim_time=840.0,
        trains={},
        blocks={},
        stations={
            "GZB": StationState(station_id="GZB", occupied_platforms=6, train_ids=["1", "2", "3", "4", "5", "6"])
        }
    )

    # We know the platforms capacity of GZB is 6 (from corridor.json)
    # Since occupied platforms (6) >= capacity (6), platform check should return False
    assert checker.check_platform_capacity("GZB", state) is False

    # NDLS has 16 platforms. If occupied is 5, it should return True
    state.stations["NDLS"] = StationState(station_id="NDLS", occupied_platforms=5, train_ids=["1", "2"])
    assert checker.check_platform_capacity("NDLS", state) is True

def test_filter_actions(checker):
    train_ok = TrainState(
        train_id="T1", name="Train_1", train_class="shatabdi", direction="UP",
        typical_passengers=800, current_section=None, section_progress=0.0,
        current_speed_kmph=0.0, delay_minutes=0.0, is_held=False, hold_remaining_minutes=0.0,
        last_station="NDLS", next_station="GZB", route=["NDLS", "GZB"], current_route_index=0,
        station_arrival_times={}, station_departure_times={}, current_block_index=None
    )
    train_mid = TrainState(
        train_id="T2", name="Train_2", train_class="shatabdi", direction="UP",
        typical_passengers=800, current_section="NDLS_GZB", section_progress=0.5,
        current_speed_kmph=100.0, delay_minutes=0.0, is_held=False, hold_remaining_minutes=0.0,
        last_station="NDLS", next_station="GZB", route=["NDLS", "GZB"], current_route_index=0,
        station_arrival_times={}, station_departure_times={}, current_block_index=1
    )

    state = NetworkState(
        sim_time=840.0,
        trains={"T1": train_ok, "T2": train_mid},
        blocks={},
        stations={
            "NDLS": StationState(station_id="NDLS", occupied_platforms=2, train_ids=["T1"])
        }
    )

    actions = [
        Action(train_id="noop", action_type="noop"),
        Action(train_id="T1", action_type="hold", hold_minutes=10.0), # Legal
        Action(train_id="T2", action_type="hold", hold_minutes=10.0), # Illegal: mid-section
        Action(train_id="T1", action_type="hold", hold_minutes=40.0), # Illegal: too long
    ]

    filtered = checker.filter(actions, state)
    assert len(filtered) == 2
    assert filtered[0].action_type == "noop"
    assert filtered[1].train_id == "T1" and filtered[1].hold_minutes == 10.0
