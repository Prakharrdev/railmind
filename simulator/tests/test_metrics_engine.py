import pytest
from evaluation.metrics_engine import MetricsEngine
from simulator.event_logger import TrainMoved, ConflictDetected, RecommendationGenerated
from optimizer.search_node import SearchStats

class MockTrain:
    def __init__(self, delay, pax):
        self.delay_minutes = delay
        self.typical_passengers = pax

class MockState:
    def __init__(self, trains):
        self.trains = trains

def test_metrics_engine_calculations():
    engine = MetricsEngine()
    
    # 1. Mock final state
    trains = {
        "T1": MockTrain(5.0, 100),
        "T2": MockTrain(10.0, 200)
    }
    state = MockState(trains)
    
    # 2. Mock events
    events = [
        ConflictDetected("T1", "T2", "B1", 845.0, 5.0, 840.0),
        RecommendationGenerated(
            recommendation_id="rec_1",
            actions=[],
            projected_cost=100.0,
            improvement_pct=10.0,
            sim_time=840.0
        ),
        # Attach custom latency and stats as dict for event simulated loader
        {
            "event_type": "RecommendationGenerated",
            "latency_ms": 150.0,
            "stats": {
                "nodes_generated": 10,
                "nodes_expanded": 5,
                "nodes_pruned": 5,
                "depth": 4
            },
            "sim_time": 845.0
        }
    ]
    
    planner_configs = {"depth": 4}
    
    # Calculate metrics without baseline
    metrics = engine.calculate_run_metrics(state, events, planner_configs)
    
    assert metrics["total_train_delay_minutes"] == 15.0
    assert metrics["total_passenger_delay_minutes"] == 2500.0
    assert metrics["conflicts_detected"] == 1
    assert metrics["avg_planner_latency_ms"] == 75.0  # 150 / 2 (one has 0, one has 150)
    assert metrics["beam_efficiency"] == 0.5  # 5 pruned / 10 generated
    assert metrics["search_depth_utilization"] == 1.0  # 4 searched / 4 planned
    
    # Test with baseline
    baseline = {
        "conflicts_detected": 3,
        "total_train_delay_minutes": 20.0
    }
    metrics_with_base = engine.calculate_run_metrics(state, events, planner_configs, baseline)
    assert metrics_with_base["conflicts_resolved"] == 2
    assert metrics_with_base["delay_reduction_pct"] == 25.0  # (20 - 15) / 20 * 100
