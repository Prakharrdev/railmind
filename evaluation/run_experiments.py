import subprocess
import os
import sys
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("run_experiments")

def run_experiment(planner: str, name: str, exp_id: int, depth: int = None, beam_width: int = None):
    cmd = [
        "venv/bin/python",
        "evaluation/experiment_runner.py",
        "--planner", planner,
        "--name", name,
        "--id", str(exp_id)
    ]
    if depth is not None:
        cmd.extend(["--search_depth", str(depth)])
    if beam_width is not None:
        cmd.extend(["--beam_width", str(beam_width)])

    logger.info(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"Experiment failed: {result.stderr}")
    else:
        logger.info(f"Experiment succeeded: {result.stdout.strip().splitlines()[-1]}")

def main():
    logger.info("Starting batch experiment runs for Phase 5...")
    
    # Define experiment configurations
    configs = [
        {"planner": "fcfs", "name": "baseline_fcfs", "id": 51},
        {"planner": "greedy", "name": "greedy", "id": 52},
        {"planner": "beam_search", "name": "beam_d2_w4", "id": 53, "depth": 2, "beam_width": 4}
    ]

    for cfg in configs:
        run_experiment(
            planner=cfg["planner"],
            name=cfg["name"],
            exp_id=cfg["id"],
            depth=cfg.get("depth"),
            beam_width=cfg.get("beam_width")
        )
        
    logger.info("Batch experiments execution completed.")

    # Run global benchmark reporting
    logger.info("Invoking comparative ReportGenerator...")
    subprocess.run(["venv/bin/python", "evaluation/report_generator.py"])

if __name__ == "__main__":
    main()
