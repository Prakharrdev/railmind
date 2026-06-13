import os
import sys
import json
import time
import sqlite3
import random
import subprocess
import argparse
import dataclasses
from datetime import datetime

# Adjust path to import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from simulator.env import TrainNetworkSimulator, Action
from simulator.conflict_detector import Conflict, ConflictDetector
from simulator.disruption_injector import Disruption
from optimizer.scorer import StateScorer
from optimizer.csp_checker import ConstraintChecker
from optimizer.greedy_policy import GreedyPolicy
from optimizer.beam_search import BeamSearchPlanner
from evaluation.scenario_validation import get_train_movement_history, validate_scenario

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"
REGISTRY_PATH = "experiments/index.json"

def get_git_commit():
    try:
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
        nodes_generated         INTEGER DEFAULT 0,
        nodes_expanded          INTEGER DEFAULT 0,
        nodes_pruned            INTEGER DEFAULT 0,
        timestamp               TEXT
    );
    """)
    conn.commit()
    conn.close()

def save_result(db_path, scen_id, dtype, train_id, mag, unique_conflicts_fcfs, unique_conflicts_greedy,
                conflict_records_fcfs, conflict_records_greedy, planner_invocations, actions_applied,
                delay_cost_before, delay_cost_after, conflict_cost_before, conflict_cost_after,
                fcfs_total_cost, greedy_total_cost, improvement_pct, avg_plan_time_ms,
                nodes_generated=0, nodes_expanded=0, nodes_pruned=0):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO episodes (
        episode_id, disruption_type, disruption_train, disruption_mag_min,
        unique_conflicts_fcfs, unique_conflicts_greedy, conflict_records_fcfs, conflict_records_greedy,
        planner_invocations, actions_applied, delay_cost_before, delay_cost_after,
        conflict_cost_before, conflict_cost_after, fcfs_total_cost, greedy_total_cost,
        improvement_pct, avg_plan_time_ms, nodes_generated, nodes_expanded, nodes_pruned, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scen_id, dtype, train_id, mag, unique_conflicts_fcfs, unique_conflicts_greedy,
        conflict_records_fcfs, conflict_records_greedy, planner_invocations, actions_applied,
        delay_cost_before, delay_cost_after, conflict_cost_before, conflict_cost_after,
        fcfs_total_cost, greedy_total_cost, improvement_pct, avg_plan_time_ms,
        nodes_generated, nodes_expanded, nodes_pruned, datetime.now().isoformat()
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

def run_beam_search(disruptions_dict, depth, beam_width):
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    for d in disruptions_dict:
        sim.inject_disruption(Disruption(**d))

    checker = ConstraintChecker(sim.graph)
    scorer = StateScorer(sim.graph, sim.timetable_data)
    planner = BeamSearchPlanner(sim, scorer, checker, depth=depth, beam_width=beam_width)
    detector = ConflictDetector(sim.graph, sim.timetable_data)

    conflict_records = 0
    unique_conflicts_set = set()
    plan_times = []
    actions_applied = 0
    planner_invocations = 0
    decisions = []

    total_nodes_generated = 0
    total_nodes_expanded = 0
    total_nodes_pruned = 0
    all_traces = []

    for _ in range(240):
        state = sim.current_state()
        conflicts = detector.detect_conflicts(state, [])
        conflict_records += len(conflicts)
        for c in conflicts:
            unique_conflicts_set.add((c.train_a_id, c.train_b_id, c.block_id))

        start_time = time.perf_counter()
        action, breakdown = planner.select_action(state)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        plan_times.append(latency_ms)
        planner_invocations += 1

        if planner.last_sequence:
            seq = planner.last_sequence
            total_nodes_generated += seq.stats.nodes_generated
            total_nodes_expanded += seq.stats.nodes_expanded
            total_nodes_pruned += seq.stats.nodes_pruned
            
            all_traces.append({
                "time": state.sim_time,
                "latency_ms": latency_ms,
                "stats": dataclasses.asdict(seq.stats),
                "trace_tree": dataclasses.asdict(seq.decision_trace)
            })

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
    return (
        final_breakdown,
        len(unique_conflicts_set),
        conflict_records,
        avg_plan_time,
        planner_invocations,
        actions_applied,
        decisions,
        total_nodes_generated,
        total_nodes_expanded,
        total_nodes_pruned,
        all_traces
    )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=str, default=None, help="Experiment ID (auto-generates if not specified)")
    parser.add_argument("--name", type=str, required=True, help="Short description name (e.g. baseline_fcfs, greedy_validated)")
    parser.add_argument("--planner", type=str, choices=["fcfs", "greedy", "beam_search"], required=True, help="Planner to evaluate")
    parser.add_argument("--search_depth", type=int, default=None, help="Depth for beam search")
    parser.add_argument("--beam_width", type=int, default=None, help="Beam width for beam search")
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
        "beam_width": 0 if args.planner != "beam_search" else (args.beam_width or 8),
        "search_depth": (args.search_depth or 4) if args.planner == "beam_search" else (1 if args.planner == "greedy" else 0),
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
    global_traces = {}
    
    # Aggregated metrics for metrics.json
    total_latencies = []
    tot_generated = 0
    tot_expanded = 0
    tot_pruned = 0
    fcfs_costs_all = []
    eval_costs_all = []

    for idx, scen in enumerate(scenarios):
        scen_id = scen["scenario_id"]
        disruptions = scen["disruptions"]
        d = disruptions[0]
        dtype = d["disruption_type"]
        train_id = d["train_id"]
        mag = d["magnitude_minutes"]

        # Always run FCFS Baseline to calculate improvements
        fcfs_breakdown, fcfs_unique, fcfs_records = run_fcfs(disruptions)
        fcfs_costs_all.append(fcfs_breakdown.total_cost)

        nodes_gen, nodes_exp, nodes_pru = 0, 0, 0
        scenario_traces = []

        # Run evaluated planner
        if args.planner == "fcfs":
            eval_breakdown = fcfs_breakdown
            eval_unique = fcfs_unique
            eval_records = fcfs_records
            avg_plan_time = 0.0
            planner_invocs = 0
            actions_app = 0
            decisions = []
        elif args.planner == "greedy":
            eval_breakdown, eval_unique, eval_records, avg_plan_time, planner_invocs, actions_app, decisions = run_greedy(disruptions)
        elif args.planner == "beam_search":
            eval_breakdown, eval_unique, eval_records, avg_plan_time, planner_invocs, actions_app, decisions, nodes_gen, nodes_exp, nodes_pru, scenario_traces = run_beam_search(
                disruptions, args.search_depth or 4, args.beam_width or 8
            )

        eval_costs_all.append(eval_breakdown.total_cost)
        total_latencies.append(avg_plan_time)
        tot_generated += nodes_gen
        tot_expanded += nodes_exp
        tot_pruned += nodes_pru

        fcfs_cost = fcfs_breakdown.total_cost
        eval_cost = eval_breakdown.total_cost

        improvement_pct = 0.0
        if fcfs_cost > 0.0:
            improvement_pct = (fcfs_cost - eval_cost) / fcfs_cost * 100.0
        improvements.append(improvement_pct)

        # Save decision trace log for this scenario
        trace_data = {
            "scenario_id": scen_id.split("_")[1],
            "planner_decisions": decisions,
            "search_traces": scenario_traces
        }
        with open(os.path.join(logs_dir, f"scenario_{scen_id.split('_')[1]}_trace.json"), "w") as f:
            json.dump(trace_data, f, indent=2)

        # Append to global traces compilation
        global_traces[scen_id] = trace_data

        # Save metrics to local SQLite database
        save_result(
            db_path=db_path,
            scen_id=scen_id,
            dtype=dtype,
            train_id=train_id,
            mag=mag,
            unique_conflicts_fcfs=fcfs_unique,
            unique_conflicts_greedy=eval_unique,
            conflict_records_fcfs=fcfs_records,
            conflict_records_greedy=eval_records,
            planner_invocations=planner_invocs,
            actions_applied=actions_app,
            delay_cost_before=fcfs_breakdown.delay_cost,
            delay_cost_after=eval_breakdown.delay_cost,
            conflict_cost_before=fcfs_breakdown.conflict_cost,
            conflict_cost_after=eval_breakdown.conflict_cost,
            fcfs_total_cost=fcfs_cost,
            greedy_total_cost=eval_cost,
            improvement_pct=improvement_pct,
            avg_plan_time_ms=avg_plan_time,
            nodes_generated=nodes_gen,
            nodes_expanded=nodes_exp,
            nodes_pruned=nodes_pru
        )

    # 6. Save experiment-level trace.json and metrics.json files
    with open(os.path.join(exp_dir, "trace.json"), "w") as f:
        json.dump(global_traces, f, indent=2)

    mean_improvement = sum(improvements) / len(improvements) if improvements else 0.0
    mean_latency = sum(total_latencies) / len(total_latencies) if total_latencies else 0.0
    
    metrics_summary = {
        "mean_latency_ms": round(mean_latency, 4),
        "total_nodes_generated": tot_generated,
        "total_nodes_expanded": tot_expanded,
        "total_nodes_pruned": tot_pruned,
        "mean_fcfs_cost": round(sum(fcfs_costs_all) / len(fcfs_costs_all), 2) if fcfs_costs_all else 0.0,
        "mean_evaluated_cost": round(sum(eval_costs_all) / len(eval_costs_all), 2) if eval_costs_all else 0.0,
        "mean_improvement_pct": round(mean_improvement, 2)
    }
    with open(os.path.join(exp_dir, "metrics.json"), "w") as f:
        json.dump(metrics_summary, f, indent=2)

    # 7. Generate Scoped Reports
    print("Generating report.md and report.html inside experiment directory...")
    # Invoke scoped analyze_results.py
    subprocess.run(["venv/bin/python", "evaluation/analyze_results.py", "--experiment_dir", exp_dir])
    # Invoke scoped generate_html_report.py
    subprocess.run(["venv/bin/python", "evaluation/generate_html_report.py", "--experiment_dir", exp_dir])

    # 8. Update index.json registry
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
