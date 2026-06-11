import pytest
from simulator.train_state import TrainState, BlockState, StationState, NetworkState

def test_dataclasses_instantiation_and_print():
    # Instantiate TrainState
    train = TrainState(
        train_id="12301",
        name="Howrah Rajdhani",
        train_class="rajdhani_vande_bharat",
        direction="UP",
        typical_passengers=1200,
        current_section=None,
        section_progress=0.0,
        current_speed_kmph=0.0,
        delay_minutes=0.0,
        is_held=False,
        hold_remaining_minutes=0.0,
        last_station="NDLS",
        next_station="GZB",
        route=["NDLS", "GZB", "TDL", "CNB"],
        current_route_index=0,
        station_arrival_times={},
        station_departure_times={},
        current_block_index=None
    )
    
    # Instantiate BlockState
    block = BlockState(block_id="NDLS_GZB_01", occupied_by=None)
    
    # Instantiate StationState
    station = StationState(station_id="NDLS", occupied_platforms=0, train_ids=[])
    
    # Instantiate NetworkState
    state = NetworkState(
        sim_time=840.0,
        trains={"12301": train},
        blocks={"NDLS_GZB_01": block},
        stations={"NDLS": station}
    )
    
    # Verify print/repr works
    state_repr = repr(state)
    assert "NetworkState" in state_repr
    assert "12301" in state_repr
    assert "NDLS_GZB_01" in state_repr
    print("\nState Representation:")
    print(state)

def test_network_state_clone():
    train = TrainState(
        train_id="12301",
        name="Howrah Rajdhani",
        train_class="rajdhani_vande_bharat",
        direction="UP",
        typical_passengers=1200,
        current_section=None,
        section_progress=0.0,
        current_speed_kmph=0.0,
        delay_minutes=0.0,
        is_held=False,
        hold_remaining_minutes=0.0,
        last_station="NDLS",
        next_station="GZB",
        route=["NDLS", "GZB"],
        current_route_index=0,
        station_arrival_times={"NDLS": 840.0},
        station_departure_times={},
        current_block_index=None
    )
    block = BlockState(block_id="NDLS_GZB_01", occupied_by="12301")
    station = StationState(station_id="NDLS", occupied_platforms=1, train_ids=["12301"])
    
    state = NetworkState(
        sim_time=840.0,
        trains={"12301": train},
        blocks={"NDLS_GZB_01": block},
        stations={"NDLS": station}
    )
    
    # Clone state
    cloned = state.clone()
    
    # Verify it is equal in value but a different object
    assert cloned is not state
    assert cloned.sim_time == state.sim_time
    assert cloned.trains["12301"].train_id == "12301"
    
    # Verify mutations on clone do not affect original
    cloned.sim_time = 850.0
    assert state.sim_time == 840.0
    
    cloned.trains["12301"].station_arrival_times["GZB"] = 855.0
    assert "GZB" not in state.trains["12301"].station_arrival_times
    
    cloned.trains["12301"].route.append("TDL")
    assert "TDL" not in state.trains["12301"].route
    
    cloned.blocks["NDLS_GZB_01"].occupied_by = None
    assert state.blocks["NDLS_GZB_01"].occupied_by == "12301"
    
    cloned.stations["NDLS"].train_ids.remove("12301")
    assert "12301" in state.stations["NDLS"].train_ids
