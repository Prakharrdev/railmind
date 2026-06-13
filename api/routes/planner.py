from fastapi import APIRouter, HTTPException
from api.sim_runner import sim_runner

router = APIRouter(prefix="/recommendations", tags=["Planner"])

@router.get("")
def get_recommendations():
    """Retrieve all recommendations generated during the current simulation run."""
    # Return recommendations without the full decision traces to keep payload light
    summary = {}
    for rec_id, rec in sim_runner.recommendations.items():
        summary[rec_id] = {
            "recommendation_id": rec["recommendation_id"],
            "actions": rec["actions"],
            "projected_cost": rec["projected_cost"],
            "improvement_pct": rec["improvement_pct"],
            "sim_time": rec["sim_time"]
        }
    return summary

@router.get("/{rec_id}")
def get_recommendation_by_id(rec_id: str):
    """Retrieve specific recommendation details by recommendation ID."""
    if rec_id not in sim_runner.recommendations:
        raise HTTPException(status_code=404, detail=f"Recommendation with ID '{rec_id}' not found.")
    rec = sim_runner.recommendations[rec_id]
    return {
        "recommendation_id": rec["recommendation_id"],
        "actions": rec["actions"],
        "projected_cost": rec["projected_cost"],
        "improvement_pct": rec["improvement_pct"],
        "stats": rec["stats"],
        "sim_time": rec["sim_time"]
    }

@router.get("/{rec_id}/trace")
def get_recommendation_trace(rec_id: str):
    """Retrieve the search node decision trace tree for visual debugging."""
    if rec_id not in sim_runner.recommendations:
        raise HTTPException(status_code=404, detail=f"Recommendation with ID '{rec_id}' not found.")
    return sim_runner.recommendations[rec_id]["decision_trace"]
