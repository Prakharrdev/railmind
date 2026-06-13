import pytest
from simulator.train_state import TrainState, BlockState, NetworkState
from simulator.corridor import RailwayGraph
from simulator.conflict_detector import ConflictDetector

def test_conflict_detection_overlap():
    graph = RailwayGraph("data/processed/corridor.json")
    timetable_data = {
        "trains": [
            {
                "id": "12301",
                "name": "Train A",
                "class": "rajdhani_vande_bharat",
                "direction": "UP",
                "typical_passengers": 1200,
                "stops": []
            },
            {
                "id": "12302",
                "name": "Train B",
                "class": "shatabdi",
                "direction": "UP",
                "typical_passengers": 1000,
                "stops": []
            }
        ]
    }
    detector = ConflictDetector(graph, timetable_data)
    
    # Set up state: two trains occupying and moving through the same block NDLS_GZB_01
    train_a = TrainState(
        train_id="12301",
        name="Train A",
        train_class="rajdhani_vande_bharat",
        direction="UP",
        typical_passengers=1200,
        current_section="NDLS_GZB",
        section_progress=0.01,
        current_speed_kmph=120.0,
        delay_minutes=0.0,
        is_held=False,
        hold_remaining_minutes=0.0,
        last_station="NDLS",
        next_station="GZB",
        route=["NDLS", "GZB"],
        current_route_index=0,
        station_arrival_times={},
        station_departure_times={},
        current_block_index=0
    )
    
    train_b = TrainState(
        train_id="12302",
        name="Train B",
        train_class="shatabdi",
        direction="UP",
        typical_passengers=1000,
        current_section="NDLS_GZB",
        section_progress=0.02,
        current_speed_kmph=120.0,
        delay_minutes=0.0,
        is_held=False,
        hold_remaining_minutes=0.0,
        last_station="NDLS",
        next_station="GZB",
        route=["NDLS", "GZB"],
        current_route_index=0,
        station_arrival_times={},
        station_departure_times={},
        current_block_index=0
    )
    
    state = NetworkState(
        sim_time=840.0,
        trains={"12301": train_a, "12302": train_b},
        blocks={"NDLS_GZB_01": BlockState("NDLS_GZB_01", occupied_by="12302")},
        stations={}
    )
    
    conflicts = detector.detect_conflicts(state, [])
    
    # Conflict must be detected on NDLS_GZB_01
    assert len(conflicts) >= 1
    assert any(c.block_id == "NDLS_GZB_01" for c in conflicts)
    
    # Check that sorting orders earlier/more urgent conflicts first
    assert conflicts[0].urgency_score > 0.0
