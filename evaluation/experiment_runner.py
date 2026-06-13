import os
import sys
import json
import time
import sqlite3
import random
import subprocess
import argparse
from datetime import datetime

# Adjust path to import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from simulator.env import TrainNetworkSimulator, Action
from simulator.conflict_detector import Conflict, ConflictDetector
from simulator.disruption_injector import Disruption
from optimizer.scorer import StateScorer
from optimizer.csp_checker import ConstraintChecker
from optimizer.greedy_policy import GreedyPolicy
from evaluation.scenario_validation import get_train_movement_history, validate_scenario

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"
REGISTRY_PATH = "experiments/index.json"

def get_git_commit():
    try:
        # Get short git commit hash
        commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"]).decode("utf-8").strip()
        return commit
    except Exception:
        return "unknown"

def generate_experiment_id():
    if not os.path.exists(REGISTRY_PATH):
        return "001"
    try:
        with open(REGISTRY_PATH, "r") as f:
            registry = json.load(f)
        if not registry:
            return "001"
        ids = []
        for entry in registry:
            try:
                ids.append(int(entry["id"]))
            except ValueError:
                pass
        if not ids:
            return "001"
        next_id = max(ids) + 1
        return f"{next_id:03d}"
    except Exception:
        return "001"

def check_id_collision(exp_id):
    if not os.path.exists(REGISTRY_PATH):
        return
    with open(REGISTRY_PATH, "r") as f:
        registry = json.load(f)
    for entry in registry:
        if entry["id"] == exp_id:
            raise ValueError(f"Experiment ID '{exp_id}' already exists in registry and cannot be overwritten.")

def init_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
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

def save_result(db_path, scen_id, dtype, train_id, mag, unique_conflicts_fcfs, unique_conflicts_greedy,
                conflict_records_fcfs, conflict_records_greedy, planner_invocations, actions_applied,
                delay_cost_before, delay_cost_after, conflict_cost_before, conflict_cost_after,
                fcfs_total_cost, greedy_total_cost, improvement_pct, avg_plan_time_ms):
    conn = sqlite3.connect(db_path)
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

def generate_scenarios(use_validation=True):
    with open(TIMETABLE_PATH, "r") as f:
        timetable_data = json.load(f)
    train_ids = [t["id"] for t in timetable_data.get("trains", [])]

    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    block_ids = list(sim.graph.blocks.keys())
    station_ids = list(sim.graph.stations.keys())

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

            if not use_validation:
                scenarios.append(candidate)
                valid = True
            else:
                if validate_scenario(candidate, CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH,
                                     active_spans, block_spans, station_spans):
                    scenarios.append(candidate)
                    valid = True
                else:
                    if attempts > 2000:
                        scenarios.append(candidate)
                        break
    return scenarios

def run_fcfs(disruptions_dict):
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    for d in disruptions_dict:
        sim.inject_disruption(Disruption(**d))

    detector = ConflictDetector(sim.graph, sim.timetable_data)
    conflict_records = 0
    unique_conflicts_set = set()

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

def run_greedy(disruptions_dict):
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
    decisions = []

    for _ in range(240):
        state = sim.current_state()
        conflicts = detector.detect_conflicts(state, [])
        conflict_records += len(conflicts)
        for c in conflicts:
            unique_conflicts_set.add((c.train_a_id, c.train_b_id, c.block_id))

        start_time = time.perf_counter()
        action, breakdown = policy.select_action(state)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        plan_times.append(latency_ms)
        planner_invocations += 1

        if action.action_type != "noop":
            sim.state = sim.apply_action(state, action)
            actions_applied += 1
            decisions.append({
                "time": state.sim_time,
                "action": "hold_train",
                "train_id": action.train_id,
                "duration": action.hold_minutes
            })

        sim.tick()

    final_breakdown = scorer.score(sim.current_state())
    avg_plan_time = sum(plan_times) / len(plan_times) if plan_times else 0.0
    return final_breakdown, len(unique_conflicts_set), conflict_records, avg_plan_time, planner_invocations, actions_applied, decisions

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=str, default=None, help="Experiment ID (auto-generates if not specified)")
    parser.add_argument("--name", type=str, required=True, help="Short description name (e.g. baseline_fcfs, greedy_validated)")
    parser.add_argument("--planner", type=str, choices=["fcfs", "greedy"], required=True, help="Planner to evaluate")
    parser.add_argument("--unvalidated", action="store_true", help="Generate unvalidated scenarios (recreate experiment 002)")
    args = parser.parse_args()

    # 1. Determine & validate ID
    if args.id is None:
        exp_id = generate_experiment_id()
    else:
        exp_id = f"{int(args.id):03d}"
        check_id_collision(exp_id)

    exp_dir_name = f"experiment_{exp_id}_{args.name}"
    exp_dir = os.path.join("experiments", exp_dir_name)
    logs_dir = os.path.join(exp_dir, "logs")
    charts_dir = os.path.join(exp_dir, "charts")

    print(f"Creating immutable experiment registry under {exp_dir}...")
    os.makedirs(exp_dir, exist_ok=True)
    os.makedirs(logs_dir, exist_ok=True)
    os.makedirs(charts_dir, exist_ok=True)

    # 2. Get Git commit & Write metadata.json
    git_commit = get_git_commit()
    date_str = datetime.date(datetime.now()).isoformat()
    
    metadata = {
        "experiment_id": exp_id,
        "planner": args.planner,
        "beam_width": 0 if args.planner != "beam_search" else 10,  # Placeholder for future beam config
        "search_depth": 1 if args.planner == "greedy" else 0,
        "date": date_str,
        "git_commit": git_commit,
        "scenario_count": 50,
        "simulation_duration": 120,
        "random_seed": 42
    }
    with open(os.path.join(exp_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    # 3. Generate & Save scenarios.json
    use_validation = not args.unvalidated
    scenarios = generate_scenarios(use_validation=use_validation)
    with open(os.path.join(exp_dir, "scenarios.json"), "w") as f:
        json.dump(scenarios, f, indent=2)

    # 4. Initialize result database inside folder
    db_path = os.path.join(exp_dir, "results.db")
    init_db(db_path)

    # 5. Run simulation
    print(f"Running simulation with '{args.planner}' planner...")
    improvements = []
    
    for idx, scen in enumerate(scenarios):
        scen_id = scen["scenario_id"]
        disruptions = scen["disruptions"]
        d = disruptions[0]
        dtype = d["disruption_type"]
        train_id = d["train_id"]
        mag = d["magnitude_minutes"]

        # Always run FCFS Baseline to calculate improvements
        fcfs_breakdown, fcfs_unique, fcfs_records = run_fcfs(disruptions)

        # Run evaluated planner
        if args.planner == "fcfs":
            greedy_breakdown = fcfs_breakdown
            greedy_unique = fcfs_unique
            greedy_records = fcfs_records
            avg_plan_time = 0.0
            planner_invocs = 0
            actions_app = 0
            decisions = []
        elif args.planner == "greedy":
            greedy_breakdown, greedy_unique, greedy_records, avg_plan_time, planner_invocs, actions_app, decisions = run_greedy(disruptions)

        fcfs_cost = fcfs_breakdown.total_cost
        greedy_cost = greedy_breakdown.total_cost

        improvement_pct = 0.0
        if fcfs_cost > 0.0:
            improvement_pct = (fcfs_cost - greedy_cost) / fcfs_cost * 100.0
        improvements.append(improvement_pct)

        # Save decision trace log
        trace_data = {
            "scenario_id": scen_id.split("_")[1],
            "planner_decisions": decisions
        }
        with open(os.path.join(logs_dir, f"scenario_{scen_id.split('_')[1]}_trace.json"), "w") as f:
            json.dump(trace_data, f, indent=2)

        # Save metrics to local SQLite database
        save_result(
            db_path=db_path,
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

    # 6. Generate Scoped Reports
    print("Generating report.md and report.html inside experiment directory...")
    # Invoke scoped analyze_results.py
    subprocess.run(["venv/bin/python", "evaluation/analyze_results.py", "--experiment_dir", exp_dir])
    # Invoke scoped generate_html_report.py
    subprocess.run(["venv/bin/python", "evaluation/generate_html_report.py", "--experiment_dir", exp_dir])

    # 7. Update index.json registry
    mean_improvement = sum(improvements) / len(improvements) if improvements else 0.0
    registry_entry = {
        "id": exp_id,
        "name": exp_dir_name,
        "planner": args.planner,
        "improvement": round(mean_improvement, 2),
        "date": date_str,
        "git_commit": git_commit
    }

    registry = []
    if os.path.exists(REGISTRY_PATH):
        try:
            with open(REGISTRY_PATH, "r") as f:
                registry = json.load(f)
        except Exception:
            pass
            
    # Append or replace matching ID
    replaced = False
    for i, entry in enumerate(registry):
        if entry["id"] == exp_id:
            registry[i] = registry_entry
            replaced = True
            break
    if not replaced:
        registry.append(registry_entry)

    # Sort registry by numeric ID
    registry.sort(key=lambda x: int(x["id"]))

    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"Successfully finished experiment '{exp_dir_name}' (ID: {exp_id}). Mean Improvement: {mean_improvement:.2f}%")

if __name__ == "__main__":
    main()
