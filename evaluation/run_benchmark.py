import os
import sys
import json
import time
import sqlite3
import random
from datetime import datetime

# Adjust path to import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from simulator.env import TrainNetworkSimulator, Action
from simulator.conflict_detector import Conflict, ConflictDetector
from simulator.disruption_injector import Disruption
from optimizer.scorer import StateScorer, StateScoreBreakdown
from optimizer.csp_checker import ConstraintChecker
from optimizer.greedy_policy import GreedyPolicy
from evaluation.scenario_validation import get_train_movement_history, validate_scenario

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"
SCENARIOS_PATH = "data/evaluation/benchmark_scenarios.json"
DB_PATH = "data/evaluation/results.db"

def generate_scenarios(force_regenerate=True):
    """Generates 50 validated scenarios and saves them to benchmark_scenarios.json."""
    if not force_regenerate and os.path.exists(SCENARIOS_PATH) and os.path.getsize(SCENARIOS_PATH) > 0:
        print(f"Loading existing scenarios from {SCENARIOS_PATH}")
        with open(SCENARIOS_PATH, "r") as f:
            return json.load(f)

    print("Generating 50 validated, active scenarios...")
    with open(TIMETABLE_PATH, "r") as f:
        timetable_data = json.load(f)
    train_ids = [t["id"] for t in timetable_data.get("trains", [])]

    # Instantiate simulator to access graph attributes
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    block_ids = list(sim.graph.blocks.keys())
    station_ids = list(sim.graph.stations.keys())

    # Obtain movement history once
    active_spans, block_spans, station_spans = get_train_movement_history(
        CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH
    )

    # 20 engine-slow, 15 platform-block, 15 signal-hold
    disruption_types = (
        ["engine_slow"] * 20 +
        ["platform_block"] * 15 +
        ["signal_hold"] * 15
    )

    random.seed(42)
    scenarios = []

    for i, dtype in enumerate(disruption_types):
        scen_id = f"scenario_{i+1}"
        
        valid = False
        attempts = 0
        while not valid:
            attempts += 1
            train_id = random.choice(train_ids)
            mag = round(random.uniform(10.0, 30.0), 1)
            start = round(random.uniform(840.0, 900.0), 1)
            end = start + mag

            target = None
            if dtype == "signal_hold":
                # Find a block that matches this train's route direction (or try random)
                target = random.choice(block_ids)
            elif dtype == "platform_block":
                target = random.choice(station_ids)

            disruption_dict = {
                "disruption_id": f"scen_{i+1}_disp",
                "train_id": train_id,
                "disruption_type": dtype,
                "magnitude_minutes": mag,
                "start_time": start,
                "end_time": end,
                "target_id": target
            }

            candidate = {
                "scenario_id": scen_id,
                "disruptions": [disruption_dict]
            }

            if validate_scenario(candidate, CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH,
                                 active_spans, block_spans, station_spans):
                scenarios.append(candidate)
                valid = True
                print(f"Generated valid {scen_id} ({dtype}) after {attempts} attempts")
            else:
                if attempts > 2000:
                    print(f"Warning: Failed to find valid candidate for {scen_id} ({dtype}) after 2000 attempts. Proceeding with last candidate.")
                    scenarios.append(candidate)
                    break

    os.makedirs(os.path.dirname(SCENARIOS_PATH), exist_ok=True)
    with open(SCENARIOS_PATH, "w") as f:
        json.dump(scenarios, f, indent=2)

    return scenarios

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Schema check: Drop database table if old columns are detected
    try:
        cursor.execute("SELECT unique_conflicts_fcfs FROM episodes LIMIT 1")
    except sqlite3.OperationalError:
        print("Upgrading database schema to include unique conflicts and conflict records...")
        cursor.execute("DROP TABLE IF EXISTS episodes")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS episodes (
        episode_id              TEXT PRIMARY KEY,
        disruption_type         TEXT,
        disruption_train        TEXT,
        disruption_mag_min      REAL,
        unique_conflicts_fcfs   INTEGER,
        unique_conflicts_greedy INTEGER,
        conflict_records_fcfs   INTEGER,
        conflict_records_greedy INTEGER,
        planner_invocations     INTEGER,
        actions_applied         INTEGER,
        delay_cost_before       REAL,
        delay_cost_after        REAL,
        conflict_cost_before    REAL,
        conflict_cost_after     REAL,
        fcfs_total_cost         REAL,
        greedy_total_cost       REAL,
        improvement_pct         REAL,
        avg_plan_time_ms        REAL,
        timestamp               TEXT
    );
    """)
    conn.commit()
    conn.close()

def save_result(scen_id, dtype, train_id, mag, unique_conflicts_fcfs, unique_conflicts_greedy,
                conflict_records_fcfs, conflict_records_greedy, planner_invocations, actions_applied,
                delay_cost_before, delay_cost_after, conflict_cost_before, conflict_cost_after,
                fcfs_total_cost, greedy_total_cost, improvement_pct, avg_plan_time_ms):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO episodes (
        episode_id, disruption_type, disruption_train, disruption_mag_min,
        unique_conflicts_fcfs, unique_conflicts_greedy, conflict_records_fcfs, conflict_records_greedy,
        planner_invocations, actions_applied, delay_cost_before, delay_cost_after,
        conflict_cost_before, conflict_cost_after, fcfs_total_cost, greedy_total_cost,
        improvement_pct, avg_plan_time_ms, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scen_id, dtype, train_id, mag, unique_conflicts_fcfs, unique_conflicts_greedy,
        conflict_records_fcfs, conflict_records_greedy, planner_invocations, actions_applied,
        delay_cost_before, delay_cost_after, conflict_cost_before, conflict_cost_after,
        fcfs_total_cost, greedy_total_cost, improvement_pct, avg_plan_time_ms, datetime.now().isoformat()
    ))
    conn.commit()
    conn.close()

def run_scenario_fcfs(disruptions_dict):
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    for d in disruptions_dict:
        sim.inject_disruption(Disruption(**d))

    detector = ConflictDetector(sim.graph, sim.timetable_data)
    conflict_records = 0
    unique_conflicts_set = set()

    # Run for 120 minutes (240 ticks)
    for _ in range(240):
        state = sim.current_state()
        conflicts = detector.detect_conflicts(state, [])
        conflict_records += len(conflicts)
        for c in conflicts:
            unique_conflicts_set.add((c.train_a_id, c.train_b_id, c.block_id))
        sim.tick()

    scorer = StateScorer(sim.graph, sim.timetable_data)
    final_breakdown = scorer.score(sim.current_state())
    return final_breakdown, len(unique_conflicts_set), conflict_records

def run_scenario_greedy(disruptions_dict):
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    for d in disruptions_dict:
        sim.inject_disruption(Disruption(**d))

    checker = ConstraintChecker(sim.graph)
    scorer = StateScorer(sim.graph, sim.timetable_data)
    policy = GreedyPolicy(sim, scorer, checker)
    detector = ConflictDetector(sim.graph, sim.timetable_data)

    conflict_records = 0
    unique_conflicts_set = set()
    plan_times = []
    actions_applied = 0
    planner_invocations = 0

    # Run for 120 minutes (240 ticks)
    for _ in range(240):
        state = sim.current_state()
        conflicts = detector.detect_conflicts(state, [])
        conflict_records += len(conflicts)
        for c in conflicts:
            unique_conflicts_set.add((c.train_a_id, c.train_b_id, c.block_id))

        # Measure planning time for greedy decision
        start_time = time.perf_counter()
        action, breakdown = policy.select_action(state)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        plan_times.append(latency_ms)
        planner_invocations += 1

        if action.action_type != "noop":
            sim.state = sim.apply_action(state, action)
            actions_applied += 1

        sim.tick()

    final_breakdown = scorer.score(sim.current_state())
    avg_plan_time = sum(plan_times) / len(plan_times) if plan_times else 0.0
    return final_breakdown, len(unique_conflicts_set), conflict_records, avg_plan_time, planner_invocations, actions_applied

def main():
    import logging
    # Suppress internal logger outputs in benchmark run to keep console clear for breakdowns
    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    
    init_db()
    scenarios = generate_scenarios(force_regenerate=True)

    print("=" * 60)
    print("RAILMIND PHASE 3 BENCHMARK RUNNER")
    print("=" * 60)

    for idx, scen in enumerate(scenarios):
        scen_id = scen["scenario_id"]
        disruptions = scen["disruptions"]
        d = disruptions[0]
        dtype = d["disruption_type"]
        train_id = d["train_id"]
        mag = d["magnitude_minutes"]

        # 1. Run FCFS (None)
        fcfs_breakdown, fcfs_unique, fcfs_records = run_scenario_fcfs(disruptions)
        
        # 2. Run Greedy
        greedy_breakdown, greedy_unique, greedy_records, avg_plan_time, planner_invocs, actions_app = run_scenario_greedy(disruptions)

        fcfs_cost = fcfs_breakdown.total_cost
        greedy_cost = greedy_breakdown.total_cost

        # Compute improvement percentage
        improvement_pct = 0.0
        if fcfs_cost > 0.0:
            improvement_pct = (fcfs_cost - greedy_cost) / fcfs_cost * 100.0

        # Print FCFS and Greedy score breakdowns in required console format
        scen_num = scen_id.split("_")[1]
        print(f"\nScenario {scen_num} (Disruption: {dtype} on Train {train_id}, Mag: {mag} min)")
        print("\nFCFS")
        print(f"Delay Cost:       {fcfs_breakdown.delay_cost:.0f}")
        print(f"Conflict Cost:     {fcfs_breakdown.conflict_cost:.0f}")
        print(f"Total Cost:       {fcfs_breakdown.total_cost:.0f}")
        print(f"Unique Conflicts:  {fcfs_unique}")
        print(f"Conflict Records:  {fcfs_records}")
        print("\nGreedy")
        print(f"Delay Cost:       {greedy_breakdown.delay_cost:.0f}")
        print(f"Conflict Cost:     {greedy_breakdown.conflict_cost:.0f}")
        print(f"Total Cost:       {greedy_breakdown.total_cost:.0f}")
        print(f"Unique Conflicts:  {greedy_unique}")
        print(f"Conflict Records:  {greedy_records}")
        print(f"Actions Applied:   {actions_app}")
        print(f"Improvement:      {improvement_pct:.2f}%")
        print("-" * 30)

        # Save to database
        save_result(
            scen_id=scen_id,
            dtype=dtype,
            train_id=train_id,
            mag=mag,
            unique_conflicts_fcfs=fcfs_unique,
            unique_conflicts_greedy=greedy_unique,
            conflict_records_fcfs=fcfs_records,
            conflict_records_greedy=greedy_records,
            planner_invocations=planner_invocs,
            actions_applied=actions_app,
            delay_cost_before=fcfs_breakdown.delay_cost,
            delay_cost_after=greedy_breakdown.delay_cost,
            conflict_cost_before=fcfs_breakdown.conflict_cost,
            conflict_cost_after=greedy_breakdown.conflict_cost,
            fcfs_total_cost=fcfs_cost,
            greedy_total_cost=greedy_cost,
            improvement_pct=improvement_pct,
            avg_plan_time_ms=avg_plan_time
        )

    print("\nBenchmark run completed successfully. Results saved to SQLite.")

if __name__ == "__main__":
    main()
