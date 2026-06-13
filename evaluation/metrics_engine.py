import os
import json
import sqlite3
from typing import List, Dict, Any, Optional

class MetricsEngine:
    def __init__(self, results_dir: str = "results"):
        self.results_dir = results_dir

    def calculate_run_metrics(self, 
                              final_state: Any, 
                              events: List[Any], 
                              planner_configs: Dict[str, Any],
                              baseline_fcfs_metrics: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Calculate the standard metrics for a simulation run.
        
        Args:
            final_state: The final NetworkState object from the simulation.
            events: A list of logged events (either dataclasses or dicts).
            planner_configs: Planner configuration dict (depth, beam_width, etc.).
            baseline_fcfs_metrics: Optional baseline metrics to compare against.
        """
        # Calculate Passenger & Train Delay
        total_train_delay = 0.0
        total_passenger_delay = 0.0
        trains_count = 0

        # Handle either dict state or NetworkState object
        trains_dict = final_state.trains if hasattr(final_state, "trains") else final_state.get("trains", {})
        for train in trains_dict.values():
            delay = train.delay_minutes if hasattr(train, "delay_minutes") else train.get("delay_minutes", 0.0)
            pax = train.typical_passengers if hasattr(train, "typical_passengers") else train.get("typical_passengers", 0.0)
            total_train_delay += delay
            total_passenger_delay += delay * pax
            trains_count += 1

        # Extract planner events & count conflicts
        conflicts_count = 0
        planner_latencies = []
        nodes_generated = 0
        nodes_expanded = 0
        nodes_pruned = 0
        depths_searched = []

        for event in events:
            if isinstance(event, dict):
                etype = event.get("event_type")
                if etype == "ConflictDetected":
                    conflicts_count += 1
                elif etype == "PlannerInvoked":
                    pass
                elif etype == "RecommendationGenerated":
                    planner_latencies.append(event.get("latency_ms", 0.0))
                    # Extract search diagnostics if available
                    stats = event.get("stats", {})
                    if stats:
                        nodes_generated += stats.get("nodes_generated", 0)
                        nodes_expanded += stats.get("nodes_expanded", 0)
                        nodes_pruned += stats.get("nodes_pruned", 0)
                        depths_searched.append(stats.get("depth", 0))
            else:
                etype = event.__class__.__name__
                if etype == "ConflictDetected":
                    conflicts_count += 1
                elif etype == "RecommendationGenerated":
                    planner_latencies.append(getattr(event, "latency_ms", 0.0) or 0.0)
                    stats = getattr(event, "stats", {}) or {}
                    if hasattr(event, "stats") and event.stats:
                        stats_dict = event.stats if isinstance(event.stats, dict) else event.stats.__dict__
                        nodes_generated += stats_dict.get("nodes_generated", 0)
                        nodes_expanded += stats_dict.get("nodes_expanded", 0)
                        nodes_pruned += stats_dict.get("nodes_pruned", 0)
                        depths_searched.append(stats_dict.get("depth", 0))

        # Beam efficiency represents proportion of pruning: nodes_pruned / nodes_generated
        beam_efficiency = (nodes_pruned / nodes_generated) if nodes_generated > 0 else 0.0
        
        # Search depth utilization represents depth achieved vs planned
        planned_depth = planner_configs.get("depth", 4)
        avg_depth = (sum(depths_searched) / len(depths_searched)) if depths_searched else 0.0
        depth_utilization = (avg_depth / planned_depth) if planned_depth > 0 else 0.0

        avg_latency = (sum(planner_latencies) / len(planner_latencies)) if planner_latencies else 0.0

        # Calculate conflicts resolved if baseline is present
        conflicts_resolved = 0
        delay_reduction_pct = 0.0
        if baseline_fcfs_metrics:
            base_conflicts = baseline_fcfs_metrics.get("conflicts_detected", 0)
            conflicts_resolved = max(0, base_conflicts - conflicts_count)
            
            base_delay = baseline_fcfs_metrics.get("total_train_delay_minutes", 0.0)
            if base_delay > 0:
                delay_reduction_pct = (base_delay - total_train_delay) / base_delay * 100.0

        return {
            "total_train_delay_minutes": round(total_train_delay, 2),
            "total_passenger_delay_minutes": round(total_passenger_delay, 2),
            "conflicts_detected": conflicts_count,
            "conflicts_resolved": conflicts_resolved,
            "avg_planner_latency_ms": round(avg_latency, 2),
            "beam_efficiency": round(beam_efficiency, 4),
            "search_depth_utilization": round(depth_utilization, 4),
            "delay_reduction_pct": round(delay_reduction_pct, 2)
        }

    def get_historical_comparison(self, current_run_id: str) -> List[Dict[str, Any]]:
        """Compare current run metrics against all other completed runs in results/."""
        comparisons = []
        if not os.path.exists(self.results_dir):
            return comparisons

        for run_name in sorted(os.listdir(self.results_dir)):
            run_path = os.path.join(self.results_dir, run_name)
            if not os.path.isdir(run_path):
                continue
            
            metadata_file = os.path.join(run_path, "run_metadata.json")
            metrics_file = os.path.join(run_path, "metrics.json")
            
            if os.path.exists(metadata_file) and os.path.exists(metrics_file):
                try:
                    with open(metadata_file, "r") as f:
                        meta = json.load(f)
                    with open(metrics_file, "r") as f:
                        metrics = json.load(f)
                    
                    comparisons.append({
                        "run_id": meta.get("run_id", run_name),
                        "timestamp": meta.get("timestamp", ""),
                        "planner_version": meta.get("planner_version", ""),
                        "beam_width": meta.get("beam_width", 0),
                        "depth": meta.get("depth", 0),
                        "metrics": metrics
                    })
                except Exception:
                    pass
        return comparisons
