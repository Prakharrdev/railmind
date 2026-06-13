from fastapi import APIRouter
from api.sim_runner import sim_runner

router = APIRouter(prefix="", tags=["Simulation"])

@router.get("/trains")
def get_trains():
    """Retrieve the current states of all trains in the simulation."""
    state = sim_runner.simulator.current_state()
    return [
        {
            "train_id": t.train_id,
            "name": t.name,
            "train_class": t.train_class,
            "direction": t.direction,
            "speed_kmph": t.current_speed_kmph,
            "delay_minutes": round(t.delay_minutes, 2),
            "progress": round(t.section_progress, 4),
            "current_section": t.current_section,
            "last_station": t.last_station,
            "next_station": t.next_station,
            "is_held": t.is_held,
            "hold_remaining_minutes": round(t.hold_remaining_minutes, 2)
        }
        for t in state.trains.values()
    ]

@router.get("/conflicts")
def get_conflicts():
    """Retrieve currently active and projected conflicts."""
    state = sim_runner.simulator.current_state()
    conflicts = sim_runner.detector.detect_conflicts(state, [])
    return [
        {
            "train_a_id": c.train_a_id,
            "train_b_id": c.train_b_id,
            "block_id": c.block_id,
            "conflict_start_sim_time": round(c.conflict_start_sim_time, 2),
            "overlap_minutes": round(c.overlap_minutes, 2),
            "urgency_score": round(c.urgency_score, 2)
        }
        for c in conflicts
    ]

@router.get("/metrics")
def get_metrics():
    """Retrieve current passenger and train delay performance metrics."""
    state = sim_runner.simulator.current_state()
    metrics = sim_runner.metrics_engine.calculate_run_metrics(
        state,
        sim_runner.logger.events,
        {"depth": sim_runner.planner.depth, "beam_width": sim_runner.planner.beam_width}
    )
    return metrics

@router.get("/network")
def get_network():
    """Retrieve the raw corridor network layout (stations, sections, blocks)."""
    return sim_runner.simulator.graph.data

@router.get("/metrics/episode")
def get_episode_metrics():
    """Retrieve current episode performance metrics."""
    return get_metrics()

@router.get("/metrics/benchmark")
def get_benchmark_metrics():
    """Retrieve historical benchmark runs comparison."""
    return sim_runner.metrics_engine.get_historical_comparison(sim_runner.run_id)

