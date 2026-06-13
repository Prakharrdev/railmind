import os
import sys
import json
import pytest
from typing import Dict

# Adjust path to import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from simulator.train_state import TrainState, NetworkState, BlockState, StationState
from simulator.corridor import RailwayGraph
from optimizer.scorer import StateScorer, StateScoreBreakdown

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"

@pytest.fixture
def graph():
    return RailwayGraph(CORRIDOR_PATH)

@pytest.fixture
def timetable():
    with open(TIMETABLE_PATH, "r") as f:
        return json.load(f)

@pytest.fixture
def scorer(graph, timetable):
    return StateScorer(graph, timetable)

def create_base_state() -> NetworkState:
    """Helper to construct a basic empty NetworkState."""
    return NetworkState(
        sim_time=840.0,
        trains={},
        blocks={},
        stations={}
    )

def create_mock_train(train_id: str, train_class: str, passengers: int, delay: float) -> TrainState:
    """Helper to construct a TrainState snapshot."""
    return TrainState(
        train_id=train_id,
        name=f"Train_{train_id}",
        train_class=train_class,
        direction="UP",
        typical_passengers=passengers,
        current_section=None,
        section_progress=0.0,
        current_speed_kmph=0.0,
        delay_minutes=delay,
        is_held=False,
        hold_remaining_minutes=0.0,
        last_station="NDLS",
        next_station="GZB",
        route=["NDLS", "GZB"],
        current_route_index=0,
        station_arrival_times={},
        station_departure_times={},
        current_block_index=None
    )

# Scenario 1: Rajdhani (VVIP) vs Freight
def test_scenario_1_rajdhani_vs_freight(scorer):
    # State A: Rajdhani delayed 5 min, Freight delayed 0 min
    state_a = create_base_state()
    state_a.trains["R1"] = create_mock_train("R1", "rajdhani_vande_bharat", 1200, 5.0)
    state_a.trains["F1"] = create_mock_train("F1", "freight", 0, 0.0)

    # State B: Rajdhani delayed 0 min, Freight delayed 20 min
    state_b = create_base_state()
    state_b.trains["R1"] = create_mock_train("R1", "rajdhani_vande_bharat", 1200, 0.0)
    state_b.trains["F1"] = create_mock_train("F1", "freight", 0, 20.0)

    score_a = scorer.score(state_a)
    score_b = scorer.score(state_b)

    # State B (delaying freight) should be preferred (lower total cost)
    assert score_b.total_cost < score_a.total_cost
    assert score_b.delay_cost == 0.0
    assert score_a.delay_cost > 0.0

# Scenario 2: Shatabdi vs Superfast
def test_scenario_2_shatabdi_vs_superfast(scorer):
    # State A: Shatabdi (1.15 mult) delayed 10 min, Superfast on time
    state_a = create_base_state()
    state_a.trains["T1"] = create_mock_train("T1", "shatabdi", 1000, 10.0)
    state_a.trains["T2"] = create_mock_train("T2", "superfast", 1000, 0.0)

    # State B: Shatabdi on time, Superfast (1.05 mult) delayed 10 min
    state_b = create_base_state()
    state_b.trains["T1"] = create_mock_train("T1", "shatabdi", 1000, 0.0)
    state_b.trains["T2"] = create_mock_train("T2", "superfast", 1000, 10.0)

    score_a = scorer.score(state_a)
    score_b = scorer.score(state_b)

    # Delaying Superfast (B) has lower cost than Shatabdi (A)
    assert score_b.total_cost < score_a.total_cost

# Scenario 3: MEMU vs Shatabdi
def test_scenario_3_memu_vs_shatabdi(scorer):
    # State A: Shatabdi delayed 5 min
    state_a = create_base_state()
    state_a.trains["T1"] = create_mock_train("T1", "shatabdi", 800, 5.0)
    state_a.trains["T2"] = create_mock_train("T2", "passenger_memu", 800, 0.0)

    # State B: MEMU delayed 5 min
    state_b = create_base_state()
    state_b.trains["T1"] = create_mock_train("T1", "shatabdi", 800, 0.0)
    state_b.trains["T2"] = create_mock_train("T2", "passenger_memu", 800, 5.0)

    assert scorer.score(state_b).total_cost < scorer.score(state_a).total_cost

# Scenario 4: Vande Bharat vs Mail Express
def test_scenario_4_vande_bharat_vs_mail(scorer):
    state_a = create_base_state()
    state_a.trains["VB"] = create_mock_train("VB", "rajdhani_vande_bharat", 1000, 10.0)
    state_a.trains["ME"] = create_mock_train("ME", "premium_mail_express", 1000, 0.0)

    state_b = create_base_state()
    state_b.trains["VB"] = create_mock_train("VB", "rajdhani_vande_bharat", 1000, 0.0)
    state_b.trains["ME"] = create_mock_train("ME", "premium_mail_express", 1000, 10.0)

    assert scorer.score(state_b).total_cost < scorer.score(state_a).total_cost

# Scenario 5: Superfast vs Ordinary Express
def test_scenario_5_superfast_vs_express(scorer):
    state_a = create_base_state()
    state_a.trains["SF"] = create_mock_train("SF", "superfast", 900, 10.0)
    state_a.trains["EX"] = create_mock_train("EX", "ordinary_express", 900, 0.0)

    state_b = create_base_state()
    state_b.trains["SF"] = create_mock_train("SF", "superfast", 900, 0.0)
    state_b.trains["EX"] = create_mock_train("EX", "ordinary_express", 900, 10.0)

    assert scorer.score(state_b).total_cost < scorer.score(state_a).total_cost

# Scenario 6: Express vs MEMU
def test_scenario_6_express_vs_memu(scorer):
    state_a = create_base_state()
    state_a.trains["EX"] = create_mock_train("EX", "ordinary_express", 800, 10.0)
    state_a.trains["MU"] = create_mock_train("MU", "passenger_memu", 800, 0.0)

    state_b = create_base_state()
    state_b.trains["EX"] = create_mock_train("EX", "ordinary_express", 800, 0.0)
    state_b.trains["MU"] = create_mock_train("MU", "passenger_memu", 800, 10.0)

    assert scorer.score(state_b).total_cost < scorer.score(state_a).total_cost

# Scenario 7: Freight vs Express
def test_scenario_7_freight_vs_express(scorer):
    state_a = create_base_state()
    state_a.trains["FR"] = create_mock_train("FR", "freight", 0, 100.0)
    state_a.trains["EX"] = create_mock_train("EX", "ordinary_express", 600, 5.0)

    state_b = create_base_state()
    state_b.trains["FR"] = create_mock_train("FR", "freight", 0, 0.0)
    state_b.trains["EX"] = create_mock_train("EX", "ordinary_express", 600, 0.0)

    # Delay on freight is 0 cost, so B is preferred
    assert scorer.score(state_b).total_cost < scorer.score(state_a).total_cost

# Scenario 8: No Delay State
def test_scenario_8_no_delay_state(scorer):
    state = create_base_state()
    state.trains["T1"] = create_mock_train("T1", "shatabdi", 800, 0.0)
    score = scorer.score(state)
    assert score.delay_cost == 0.0
    assert score.total_cost == 0.0

# Scenario 9: High Conflict State
def test_scenario_9_high_conflict_state(scorer):
    # State with active conflicts should penalize conflict cost
    state = create_base_state()
    # Construct two trains traveling in the same section NDLS_GZB on the same block
    t1 = create_mock_train("T1", "shatabdi", 800, 0.0)
    t1.current_section = "NDLS_GZB"
    t1.current_block_index = 1
    t1.section_progress = 0.2
    
    t2 = create_mock_train("T2", "shatabdi", 800, 0.0)
    t2.current_section = "NDLS_GZB"
    t2.current_block_index = 1
    t2.section_progress = 0.21

    state.trains = {"T1": t1, "T2": t2}
    state.blocks = {"NDLS_GZB_01": BlockState("NDLS_GZB_01", occupied_by="T1")}

    score = scorer.score(state)
    # Conflict cost should be positive since they overlap
    assert score.conflict_cost >= 10000.0

# Scenario 10: No Conflict State
def test_scenario_10_no_conflict_state(scorer):
    state = create_base_state()
    t1 = create_mock_train("T1", "shatabdi", 800, 0.0)
    t1.current_section = "NDLS_GZB"
    t1.current_block_index = 1
    t1.route = ["NDLS", "GZB"]
    t1.last_station = "NDLS"
    t1.next_station = "GZB"

    t2 = create_mock_train("T2", "shatabdi", 800, 0.0)
    t2.current_section = "PHD_CNB"
    t2.current_block_index = 1
    t2.route = ["PHD", "CNB"]
    t2.last_station = "PHD"
    t2.next_station = "CNB"

    state.trains = {"T1": t1, "T2": t2}
    state.blocks = {
        "NDLS_GZB_01": BlockState("NDLS_GZB_01", occupied_by="T1"),
        "PHD_CNB_01": BlockState("PHD_CNB_01", occupied_by="T2")
    }

    score = scorer.score(state)
    assert score.conflict_cost == 0.0

# Scenario 11: Single vs Multiple Conflicts
def test_scenario_11_single_vs_multiple_conflicts(scorer):
    # State A: 1 conflict
    state_a = create_base_state()
    t1 = create_mock_train("T1", "shatabdi", 500, 0.0)
    t1.current_section = "NDLS_GZB"
    t1.current_block_index = 1
    t2 = create_mock_train("T2", "shatabdi", 500, 0.0)
    t2.current_section = "NDLS_GZB"
    t2.current_block_index = 1
    state_a.trains = {"T1": t1, "T2": t2}
    state_a.blocks = {"NDLS_GZB_01": BlockState("NDLS_GZB_01", occupied_by="T1")}

    # State B: 2 conflicts (3 trains overlapping on same block)
    state_b = create_base_state()
    t1_b = create_mock_train("T1", "shatabdi", 500, 0.0)
    t1_b.current_section = "NDLS_GZB"
    t1_b.current_block_index = 1
    t2_b = create_mock_train("T2", "shatabdi", 500, 0.0)
    t2_b.current_section = "NDLS_GZB"
    t2_b.current_block_index = 1
    t3_b = create_mock_train("T3", "shatabdi", 500, 0.0)
    t3_b.current_section = "NDLS_GZB"
    t3_b.current_block_index = 1
    state_b.trains = {"T1": t1_b, "T2": t2_b, "T3": t3_b}
    state_b.blocks = {"NDLS_GZB_01": BlockState("NDLS_GZB_01", occupied_by="T1")}

    score_a = scorer.score(state_a)
    score_b = scorer.score(state_b)
    assert score_b.conflict_cost > score_a.conflict_cost

# Scenario 12: Hold Effect on Delay Cost
def test_scenario_12_hold_effect_on_delay_cost(scorer):
    # Hold does not immediately affect current delay_minutes directly unless sim time ticks.
    # We verify that a state with higher delay has higher delay cost.
    state_a = create_base_state()
    state_a.trains["T1"] = create_mock_train("T1", "shatabdi", 800, 10.0)

    state_b = create_base_state()
    state_b.trains["T1"] = create_mock_train("T1", "shatabdi", 800, 20.0)

    assert scorer.score(state_a).delay_cost < scorer.score(state_b).delay_cost

# Scenario 13: Passenger Count Scaling
def test_scenario_13_passenger_count_scaling(scorer):
    state_a = create_base_state()
    state_a.trains["T1"] = create_mock_train("T1", "shatabdi", 500, 10.0)

    state_b = create_base_state()
    state_b.trains["T1"] = create_mock_train("T1", "shatabdi", 1000, 10.0)

    # Cost should scale linearly with passenger count
    assert scorer.score(state_b).delay_cost == 2 * scorer.score(state_a).delay_cost

# Scenario 14: Freight Pax Does Not Affect
def test_scenario_14_freight_pax_does_not_affect(scorer):
    state = create_base_state()
    state.trains["F1"] = create_mock_train("F1", "freight", 0, 50.0)
    assert scorer.score(state).delay_cost == 0.0

# Scenario 15: Extreme Freight Delay vs Minor Rajdhani Delay
def test_scenario_15_extreme_delay_on_freight_preferred_over_minor_delay_on_rajdhani(scorer):
    state_a = create_base_state()
    state_a.trains["R1"] = create_mock_train("R1", "rajdhani_vande_bharat", 1000, 1.0)
    state_a.trains["F1"] = create_mock_train("F1", "freight", 0, 1000.0)

    state_b = create_base_state()
    state_b.trains["R1"] = create_mock_train("R1", "rajdhani_vande_bharat", 1000, 0.0)
    state_b.trains["F1"] = create_mock_train("F1", "freight", 0, 2000.0)

    # State B has 0 Rajdhani delay and 2000 min Freight delay.
    # Total cost of B should be 0, which is less than A (1000 * 1.2 * 1 = 1200)
    assert scorer.score(state_b).total_cost < scorer.score(state_a).total_cost

# Scenario 16: Equal Passengers Different Classes
def test_scenario_16_equal_passengers_different_classes(scorer):
    state_a = create_base_state()
    state_a.trains["T1"] = create_mock_train("T1", "shatabdi", 500, 10.0) # weight 1.15

    state_b = create_base_state()
    state_b.trains["T1"] = create_mock_train("T1", "superfast", 500, 10.0) # weight 1.05

    assert scorer.score(state_b).delay_cost < scorer.score(state_a).delay_cost

# Scenario 17: Different Passengers Equal Classes
def test_scenario_17_different_passengers_equal_classes(scorer):
    state_a = create_base_state()
    state_a.trains["T1"] = create_mock_train("T1", "shatabdi", 600, 10.0)

    state_b = create_base_state()
    state_b.trains["T1"] = create_mock_train("T1", "shatabdi", 400, 10.0)

    assert scorer.score(state_b).delay_cost < scorer.score(state_a).delay_cost

# Scenario 18: Congestion and Starvation Initially Zero
def test_scenario_18_congestion_and_starvation_initially_zero(scorer):
    state = create_base_state()
    state.trains["T1"] = create_mock_train("T1", "shatabdi", 500, 10.0)
    score = scorer.score(state)
    assert score.congestion_cost == 0.0
    assert score.starvation_cost == 0.0

# Scenario 19: Conflict Penalty Multiplier from Config
def test_scenario_19_conflict_penalty_multiplier_from_config(scorer):
    # Verify the value of conflict_penalty_multiplier matches config
    assert scorer.conflict_penalty_multiplier == 10000.0

# Scenario 20: Total Cost is Sum of Parts
def test_scenario_20_total_cost_is_sum_of_parts(scorer):
    state = create_base_state()
    t1 = create_mock_train("T1", "shatabdi", 500, 10.0)
    t1.current_section = "NDLS_GZB"
    t1.current_block_index = 1
    t2 = create_mock_train("T2", "superfast", 800, 5.0)
    t2.current_section = "NDLS_GZB"
    t2.current_block_index = 1
    state.trains = {"T1": t1, "T2": t2}
    state.blocks = {"NDLS_GZB_01": BlockState("NDLS_GZB_01", occupied_by="T1")}

    score = scorer.score(state)
    expected_total = score.delay_cost + score.conflict_cost + score.congestion_cost + score.starvation_cost
    assert score.total_cost == expected_total

def test_greedy_policy_selection(scorer):
    from optimizer.greedy_policy import GreedyPolicy
    from optimizer.csp_checker import ConstraintChecker
    from simulator.env import TrainNetworkSimulator
    
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, "data/processed/delay_distributions.json")
    checker = ConstraintChecker(sim.graph)
    policy = GreedyPolicy(sim, scorer, checker)
    
    state = sim.current_state()
    act, breakdown = policy.select_action(state)
    assert act is not None
    assert breakdown is not None
