from fastapi import APIRouter, HTTPException
from api.sim_runner import sim_runner
from api.models import DisruptionRequest, PlannerConfigRequest, ActionRequest
from simulator.disruption_injector import Disruption
from simulator.env import Action

router = APIRouter(prefix="", tags=["Control"])

@router.post("/disrupt")
def inject_disruption(req: DisruptionRequest):
    """Inject a simulated infrastructure disruption (e.g. engine slow, signal failure)."""
    try:
        disruption = Disruption(
            disruption_id=req.disruption_id,
            train_id=req.train_id,
            disruption_type=req.disruption_type,
            magnitude_minutes=req.magnitude_minutes,
            start_time=req.start_time,
            end_time=req.end_time,
            target_id=req.target_id
        )
        sim_runner.inject_disruption(disruption)
        return {"status": "success", "message": f"Disruption '{req.disruption_id}' successfully injected."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/planner/config")
def configure_planner(req: PlannerConfigRequest):
    """Dynamically adjust active planner parameters."""
    try:
        step_minutes = req.step_minutes if req.step_minutes is not None else 5
        sim_runner.configure_planner(
            depth=req.depth,
            beam_width=req.beam_width,
            step_minutes=step_minutes
        )
        return {"status": "success", "message": f"Planner configured: depth={req.depth}, beam_width={req.beam_width}, step_minutes={step_minutes}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/action")
def apply_action(req: ActionRequest):
    """Manually apply a dispatch hold action on a train."""
    try:
        action = Action(
            train_id=req.train_id,
            action_type=req.action_type,
            hold_minutes=req.hold_minutes
        )
        sim_runner.apply_action(action)
        return {"status": "success", "message": f"Action successfully applied: {req.action_type} on train '{req.train_id}'."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/restart")
async def restart_simulation():
    """Restart the simulation from the beginning, reinitializing all state."""
    try:
        await sim_runner.restart()
        return {"status": "success", "message": "Simulation restarted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

