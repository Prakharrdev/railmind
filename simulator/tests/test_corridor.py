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
