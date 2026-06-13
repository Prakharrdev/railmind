import pytest
from simulator.replay_runner import ReplayRunner
from simulator.event_logger import TrainHeld

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"

def test_replay_runner_loading_and_controls():
    runner = ReplayRunner(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    
    # Define a simple mock scenario and events
    scenario = {
        "scenario_id": "test_scen",
        "disruptions": [
            {
                "disruption_id": "disp_1",
                "train_id": "22436_UP",
                "disruption_type": "engine_slow",
                "magnitude_minutes": 15.0,
                "start_time": 840.0,
                "end_time": 855.0,
                "target_id": None
            }
        ]
    }
    
    events = [
        TrainHeld(train_id="22436_UP", hold_minutes=5.0, sim_time=840.0)
    ]
    
    # Load run
    runner.load_run(scenario, events)
    
    assert len(runner.states) == 241  # 240 ticks + 1 initial
    assert runner.current_idx == 0
    
    # Test step_forward
    state = runner.step_forward()
    assert runner.current_idx == 1
    assert state.sim_time == 840.5
    
    # Test step_backward
    state = runner.step_backward()
    assert runner.current_idx == 0
    assert state.sim_time == 840.0
    
    # Test jump_to
    state = runner.jump_to(850.0)
    assert abs(state.sim_time - 850.0) < 0.1
    
    # Test play/pause toggle
    assert not runner.is_playing
    runner.play()
    assert runner.is_playing
    runner.pause()
    assert not runner.is_playing
