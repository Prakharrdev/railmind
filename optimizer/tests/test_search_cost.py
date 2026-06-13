import os
import json
import pytest
from simulator.env import TrainNetworkSimulator
from optimizer.scorer import StateScorer
from optimizer.search_cost import compute_g_cost, compute_h_cost, compute_f_cost

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"

@pytest.fixture
def simulator():
    return TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)

@pytest.fixture
def scorer(simulator):
    return StateScorer(simulator.graph, simulator.timetable_data)

def test_g_cost_calculation(simulator, scorer):
    parent_state = simulator.current_state()
    child_state = parent_state.clone()
    
    # Introduce some delay to a train in the child state to increase cost
    train_id = list(child_state.trains.keys())[0]
    child_state.trains[train_id].delay_minutes += 10.0
    
    g_cost = compute_g_cost(scorer, parent_state, child_state)
    
    # Scorer cost should be higher for child_state because of delay
    expected_diff = scorer.cost(child_state) - scorer.cost(parent_state)
    assert g_cost == expected_diff
    assert g_cost > 0.0

def test_h_cost_and_f_cost(simulator, scorer):
    state = simulator.current_state()
    
    h_cost = compute_h_cost(scorer, simulator, state, lookahead_minutes=20)
    
    # Verify projecting forward works and cost is computed
    # By default, state projected forward for 20 minutes should have some cost
    assert h_cost >= 0.0
    
    # Test f_cost
    g_cost = 50.0
    f_cost = compute_f_cost(g_cost, h_cost)
    assert f_cost == g_cost + h_cost
