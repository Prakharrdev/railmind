import pytest
import os
from simulator.corridor import RailwayGraph

@pytest.fixture
def graph():
    corridor_path = "data/processed/corridor.json"
    # Ensure file exists before running tests
    assert os.path.exists(corridor_path), f"Please run parse_osm.py first to generate {corridor_path}"
    return RailwayGraph(corridor_path)

def test_load_stations(graph):
    # Verify we loaded all 10 stations
    assert len(graph.stations) == 10
    
    # Verify properties of NDLS (origin)
    ndls = graph.get_station("NDLS")
    assert ndls is not None
    assert ndls["name"] == "New Delhi"
    assert ndls["platforms"] == 16
    assert ndls["is_junction"] is True
    assert ndls["has_loop"] is True
    
    # Verify properties of a intermediate station (HRS)
    hrs = graph.get_station("HRS")
    assert hrs is not None
    assert hrs["name"] == "Hathras Junction"
    assert hrs["platforms"] == 3
    assert hrs["is_junction"] is False

def test_load_sections(graph):
    # Verify we loaded 9 sections in raw config
    assert len(graph.sections) == 9
    
    # Verify endpoints and distance of NDLS_GZB section
    sec = graph.get_section("NDLS_GZB")
    assert sec is not None
    assert sec["from"] == "NDLS"
    assert sec["to"] == "GZB"
    assert sec["distance_km"] == 26.0
    assert sec["tracks"] == 4
    assert sec["max_speed"] == 110
    assert sec["electrified"] is True
    assert sec["section_capacity"] == 15
    
    # Verify reversed section retrieval
    sec_down = graph.get_section("NDLS_GZB_DOWN")
    assert sec_down is not None
    assert sec_down["from"] == "GZB"
    assert sec_down["to"] == "NDLS"
    assert sec_down["distance_km"] == 26.0

def test_get_section_by_endpoints(graph):
    sec = graph.get_section_by_endpoints("NDLS", "GZB")
    assert sec is not None
    assert sec["id"] == "NDLS_GZB"
    assert sec["distance_km"] == 26.0
    assert sec["tracks"] == 4
    assert sec["max_speed"] == 110
    assert sec["electrified"] is True
    assert sec["section_capacity"] == 15

    sec_down = graph.get_section_by_endpoints("GZB", "NDLS")
    assert sec_down is not None
    assert sec_down["id"] == "NDLS_GZB_DOWN"
    assert sec_down["distance_km"] == 26.0
    
    # Non-existent edge
    assert graph.get_section_by_endpoints("NDLS", "CNB") is None

def test_traversal_time(graph):
    # Section NDLS_GZB: distance = 26km, max_speed = 110kmph
    # Train speed = 120kmph, effective speed = 110kmph
    # Traversal time = (26 / 110) * 60 = 14.18 min
    t1 = graph.get_typical_traversal_time("NDLS_GZB", train_max_speed=120)
    assert pytest.approx(t1, rel=1e-3) == 14.1818
    
    # Train speed = 50kmph, effective speed = 50kmph
    # Traversal time = (26 / 50) * 60 = 31.2 min
    t2 = graph.get_typical_traversal_time("NDLS_GZB", train_max_speed=50)
    assert pytest.approx(t2, rel=1e-3) == 31.2

def test_shortest_path(graph):
    # Find shortest path from NDLS to CNB (should contain 10 stations)
    path = graph.get_shortest_path("NDLS", "CNB")
    expected_path = ["NDLS", "GZB", "ALJN", "HRS", "TDL", "FZD", "SKB", "ETW", "PHD", "CNB"]
    assert path == expected_path
    
    # Reversed path
    path_down = graph.get_shortest_path("CNB", "NDLS")
    assert path_down == list(reversed(expected_path))
    
    # Path with invalid stations
    assert graph.get_shortest_path("NDLS", "INVALID") == []

def test_blocks_generation(graph):
    # Verify blocks generated for NDLS_GZB (distance 26 km, should be 6 blocks)
    sec_ndls_gzb = graph.get_section("NDLS_GZB")
    assert "blocks" in sec_ndls_gzb
    blocks = sec_ndls_gzb["blocks"]
    assert len(blocks) == 6
    assert blocks[0]["id"] == "NDLS_GZB_01"
    assert blocks[0]["length_km"] == 5.0
    assert blocks[5]["id"] == "NDLS_GZB_06"
    assert pytest.approx(blocks[5]["length_km"]) == 1.0  # 26 - 5*5 = 1.0 km

    # Verify blocks generated for GZB_ALJN (distance 106 km, should be 22 blocks)
    sec_gzb_aljn = graph.get_section("GZB_ALJN")
    assert len(sec_gzb_aljn["blocks"]) == 22
    assert sec_gzb_aljn["blocks"][21]["id"] == "GZB_ALJN_22"
    assert pytest.approx(sec_gzb_aljn["blocks"][21]["length_km"]) == 1.0  # 106 - 21*5 = 1.0 km


def test_detailed_infrastructure_model(graph):
    # Verify StationNode objects
    ndls_node = graph.stations["NDLS"]
    assert ndls_node.name == "New Delhi"
    assert ndls_node.platforms == 16
    assert ndls_node.loops == 1
    assert ndls_node.has_loop is True
    assert ndls_node.is_junction is True

    # Verify BlockSection objects
    b1_up = graph.blocks["NDLS_GZB_01"]
    assert b1_up.from_node == "NDLS"
    assert b1_up.to_node == "NDLS_GZB_02"
    assert b1_up.length_km == 5.0
    assert b1_up.max_speed == 110
    assert b1_up.occupied_by is None
    assert b1_up.entry_signal_id == "SIG_NDLS_GZB_01_ENTRY"
    assert b1_up.exit_signal_id == "SIG_NDLS_GZB_01_EXIT"
    assert b1_up.track_type == "double"

    # Verify DOWN blocks reversed traversal
    b6_down = graph.blocks["NDLS_GZB_06_DOWN"]
    assert b6_down.from_node == "GZB"
    assert b6_down.to_node == "NDLS_GZB_05_DOWN"
    assert b6_down.length_km == 1.0

    b1_down = graph.blocks["NDLS_GZB_01_DOWN"]
    assert b1_down.from_node == "NDLS_GZB_02_DOWN"
    assert b1_down.to_node == "NDLS"

    # Verify signals dict
    assert "SIG_NDLS_GZB_01_ENTRY" in graph.signals
    sig = graph.signals["SIG_NDLS_GZB_01_ENTRY"]
    assert sig.block_id == "NDLS_GZB_01"
    assert sig.aspect == "green"

    # Verify adjacency
    assert "NDLS_GZB_01" in graph.adjacency["NDLS"]
    assert "NDLS_GZB_02" in graph.adjacency["NDLS_GZB_01"]
    assert "GZB" in graph.adjacency["NDLS_GZB_06"]
    
    assert "NDLS_GZB_06_DOWN" in graph.adjacency["GZB"]
    assert "NDLS_GZB_05_DOWN" in graph.adjacency["NDLS_GZB_06_DOWN"]
    assert "NDLS" in graph.adjacency["NDLS_GZB_01_DOWN"]


def test_infrastructure_queries(graph):
    # Test block_length
    assert graph.block_length("NDLS_GZB_01") == 5.0
    assert graph.block_length("NDLS_GZB_06_DOWN") == 1.0
    assert graph.block_length("INVALID") == 0.0

    # Test free_blocks
    assert len(graph.free_blocks()) == len(graph.blocks)

    # Test next_block for train at station (UP direction)
    train_at_st_up = {
        "train_id": "12301",
        "direction": "UP",
        "current_section": None,
        "last_station": "NDLS",
        "next_station": "GZB",
        "section_progress": 0.0,
        "current_block_index": None
    }
    assert graph.next_block(train_at_st_up) == "NDLS_GZB_01"

    # Test next_block for train at station (DOWN direction)
    train_at_st_down = {
        "train_id": "12302",
        "direction": "DOWN",
        "current_section": None,
        "last_station": "GZB",
        "next_station": "NDLS",
        "section_progress": 0.0,
        "current_block_index": None
    }
    assert graph.next_block(train_at_st_down) == "NDLS_GZB_06_DOWN"

    # Test next_block for train in section (UP direction)
    train_in_sec_up = {
        "train_id": "12301",
        "direction": "UP",
        "current_section": "NDLS_GZB",
        "last_station": "NDLS",
        "next_station": "GZB",
        "section_progress": 0.1,  # in NDLS_GZB_01
        "current_block_index": 0
    }
    assert graph.next_block(train_in_sec_up) == "NDLS_GZB_02"

    # Last block in section (UP) -> next is station, so returns None
    train_in_sec_up["current_block_index"] = 5
    assert graph.next_block(train_in_sec_up) is None

    # Test next_block for train in section (DOWN direction)
    train_in_sec_down = {
        "train_id": "12302",
        "direction": "DOWN",
        "current_section": "NDLS_GZB_DOWN",
        "last_station": "GZB",
        "next_station": "NDLS",
        "section_progress": 0.1,  # distance_traveled from GZB is 2.6 km -> pos_from_base is 23.4 -> block 05 (idx 4)
        "current_block_index": 4  # NDLS_GZB_05_DOWN
    }
    assert graph.next_block(train_in_sec_down) == "NDLS_GZB_04_DOWN"

    # Last block in section (DOWN) -> NDLS_GZB_01_DOWN (idx 0)
    train_in_sec_down["current_block_index"] = 0
    assert graph.next_block(train_in_sec_down) is None


