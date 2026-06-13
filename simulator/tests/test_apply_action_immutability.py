import pytest
from simulator.env import TrainNetworkSimulator, Action

def test_apply_action_immutability():
    sim = TrainNetworkSimulator(
        corridor_json_path="data/processed/corridor.json",
        timetable_json_path="data/processed/timetable.json",
        delay_distributions_path="data/processed/delay_distributions.json"
    )
    
    state_before = sim.current_state()
    
    # Select first active train to hold
    train_id = list(state_before.trains.keys())[0]
    
    # Apply hold action
    action = Action(train_id=train_id, action_type="hold", hold_minutes=15.0)
    state_after = sim.apply_action(state_before, action)
    
    # Ensure clone and values are independent
    assert state_after is not state_before
    assert state_after.trains[train_id].is_held is True
    assert state_after.trains[train_id].hold_remaining_minutes == 15.0
    
    # Ensure original state was not mutated
    assert state_before.trains[train_id].is_held is False
    assert state_before.trains[train_id].hold_remaining_minutes == 0.0
