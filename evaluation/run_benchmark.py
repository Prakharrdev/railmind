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

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"
SCENARIOS_PATH = "data/evaluation/benchmark_scenarios.json"
DB_PATH = "data/evaluation/results.db"

def generate_scenarios():
    """Generates 50 fixed-seed scenarios and saves to benchmark_scenarios.json."""
    if os.path.exists(SCENARIOS_PATH) and os.path.getsize(SCENARIOS_PATH) > 0:
        print(f"Loading existing scenarios from {SCENARIOS_PATH}")
        with open(SCENARIOS_PATH, "r") as f:
            return json.load(f)

    print("Generating 50 pre-defined scenarios...")
    with open(TIMETABLE_PATH, "r") as f:
        timetable_data = json.load(f)
    train_ids = [t["id"] for t in timetable_data.get("trains", [])]

    # Temporarily instantiate simulator to access graph attributes
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    block_ids = list(sim.graph.blocks.keys())
    station_ids = list(sim.graph.stations.keys())

    random.seed(42)
    scenarios = []

    # 20 engine-slow, 15 platform-block, 15 signal-hold
    disruption_types = (
        ["engine_slow"] * 20 +
        ["platform_block"] * 15 +
        ["signal_hold"] * 15
    )

    for i, dtype in enumerate(disruption_types):
        scen_id = f"scenario_{i+1}"
        train_id = random.choice(train_ids)
        mag = round(random.uniform(10.0, 30.0), 1)
        start = round(random.uniform(840.0, 900.0), 1)
        end = start + mag

        target = None
        if dtype == "signal_hold":
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

        scenarios.append({
            "scenario_id": scen_id,
            "disruptions": [disruption_dict]
        })

    os.makedirs(os.path.dirname(SCENARIOS_PATH), exist_ok=True)
    with open(SCENARIOS_PATH, "w") as f:
        json.dump(scenarios, f, indent=2)

    return scenarios

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS episodes (
        episode_id        TEXT,
        disruption_type   TEXT,
        disruption_train  TEXT,
        disruption_mag_min REAL,
        planner_config    TEXT,
        total_pax_delay   REAL,
        baseline_delay    REAL,
        improvement_pct   REAL,
        n_conflicts       INTEGER,
        avg_plan_time_ms  REAL,
        timestamp         TEXT,
        PRIMARY KEY (episode_id, planner_config)
    );
    """)
    conn.commit()
    conn.close()

def save_result(scen_id, dtype, train_id, mag, config_name, total_pax_delay, baseline_delay, improvement_pct, n_conflicts, avg_plan_time_ms):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO episodes (
        episode_id, disruption_type, disruption_train, disruption_mag_min,
        planner_config, total_pax_delay, baseline_delay, improvement_pct,
        n_conflicts, avg_plan_time_ms, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scen_id, dtype, train_id, mag, config_name, total_pax_delay,
        baseline_delay, improvement_pct, n_conflicts, avg_plan_time_ms,
        datetime.now().isoformat()
    ))
    conn.commit()
    conn.close()

def run_scenario_fcfs(disruptions_dict):
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    for d in disruptions_dict:
        sim.inject_disruption(Disruption(**d))

    detector = ConflictDetector(sim.graph, sim.timetable_data)
    conflict_count = 0

    # Run for 120 minutes (240 ticks)
    for _ in range(240):
        state = sim.current_state()
        conflicts = detector.detect_conflicts(state, [])
        conflict_count += len(conflicts)
        sim.tick()

    scorer = StateScorer(sim.graph, sim.timetable_data)
    final_breakdown = scorer.score(sim.current_state())
    return final_breakdown, conflict_count

def run_scenario_greedy(disruptions_dict):
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    for d in disruptions_dict:
        sim.inject_disruption(Disruption(**d))

    checker = ConstraintChecker(sim.graph)
    scorer = StateScorer(sim.graph, sim.timetable_data)
    policy = GreedyPolicy(sim, scorer, checker)
    detector = ConflictDetector(sim.graph, sim.timetable_data)

    conflict_count = 0
    plan_times = []

    # Run for 120 minutes (240 ticks)
    for _ in range(240):
        state = sim.current_state()
        conflicts = detector.detect_conflicts(state, [])
        conflict_count += len(conflicts)

        # Measure planning time for greedy decision
        start_time = time.perf_counter()
        action, breakdown = policy.select_action(state)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        plan_times.append(latency_ms)

        if action.action_type != "noop":
            sim.state = sim.apply_action(state, action)

        sim.tick()

    final_breakdown = scorer.score(sim.current_state())
    avg_plan_time = sum(plan_times) / len(plan_times) if plan_times else 0.0
    return final_breakdown, conflict_count, avg_plan_time

def main():
    init_db()
    scenarios = generate_scenarios()

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

        print(f"[{idx+1}/50] Scenario {scen_id} ({dtype} on {train_id}, mag: {mag}m)...")

        # 1. Run FCFS (None)
        fcfs_breakdown, fcfs_conflicts = run_scenario_fcfs(disruptions)
        fcfs_cost = fcfs_breakdown.total_cost

        # 2. Run Greedy
        greedy_breakdown, greedy_conflicts, avg_plan_time = run_scenario_greedy(disruptions)
        greedy_cost = greedy_breakdown.total_cost

        # Compute improvement percentage
        improvement_pct = 0.0
        if fcfs_cost > 0.0:
            improvement_pct = (fcfs_cost - greedy_cost) / fcfs_cost * 100.0

        # Save to database
        save_result(
            scen_id=scen_id,
            dtype=dtype,
            train_id=train_id,
            mag=mag,
            config_name="none",
            total_pax_delay=fcfs_cost,
            baseline_delay=fcfs_cost,
            improvement_pct=0.0,
            n_conflicts=fcfs_conflicts,
            avg_plan_time_ms=0.0
        )

        save_result(
            scen_id=scen_id,
            dtype=dtype,
            train_id=train_id,
            mag=mag,
            config_name="greedy",
            total_pax_delay=greedy_cost,
            baseline_delay=fcfs_cost,
            improvement_pct=improvement_pct,
            n_conflicts=greedy_conflicts,
            avg_plan_time_ms=avg_plan_time
        )

        print(f"   FCFS Cost: {fcfs_cost:.2f} | Greedy Cost: {greedy_cost:.2f} | Improvement: {improvement_pct:.2f}% | Latency: {avg_plan_time:.2f}ms")

    print("\nBenchmark run completed successfully. Results saved to SQLite.")

if __name__ == "__main__":
    main()
