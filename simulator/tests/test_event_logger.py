import os
import pytest
from simulator.event_logger import (
    EventLogger, TrainMoved, TrainHeld, ConflictDetected,
    PlannerInvoked, RecommendationGenerated, RecommendationAccepted,
    RecommendationRejected, DisruptionInjected
)

def test_event_logging_and_serialization(tmp_path):
    logger = EventLogger()
    
    # Create events
    e1 = TrainMoved(
        train_id="T1", section_id="SEC1", block_index=0,
        speed_kmph=80.0, progress=0.2, delay_minutes=2.5, sim_time=845.0
    )
    e2 = TrainHeld(train_id="T2", hold_minutes=5.0, sim_time=846.5)
    e3 = ConflictDetected(
        train_a_id="T1", train_b_id="T2", block_id="B1",
        conflict_start_sim_time=850.0, overlap_minutes=10.0, sim_time=847.0
    )
    e4 = PlannerInvoked(depth=4, beam_width=8, sim_time=847.0)
    e5 = RecommendationGenerated(
        recommendation_id="rec_1",
        actions=[{"train_id": "T2", "action_type": "hold", "hold_minutes": 5.0}],
        projected_cost=120.0, improvement_pct=25.5, sim_time=847.0
    )
    e6 = RecommendationAccepted(recommendation_id="rec_1", sim_time=847.5)
    e7 = RecommendationRejected(recommendation_id="rec_2", sim_time=848.0)
    e8 = DisruptionInjected(
        disruption_id="disp_1", train_id="T1", disruption_type="engine_slow",
        magnitude_minutes=15.0, start_time=840.0, end_time=855.0, target_id=None, sim_time=840.0
    )
    
    # Log events
    logger.log_event(e1)
    logger.log_event(e2)
    logger.log_event(e3)
    logger.log_event(e4)
    logger.log_event(e5)
    logger.log_event(e6)
    logger.log_event(e7)
    logger.log_event(e8)
    
    assert len(logger.events) == 8
    
    # Save events to tmp file
    filepath = os.path.join(tmp_path, "events.json")
    logger.save_events(filepath)
    
    # Create a new logger and load events
    new_logger = EventLogger()
    loaded_events = new_logger.load_events(filepath)
    
    assert len(loaded_events) == 8
    assert isinstance(loaded_events[0], TrainMoved)
    assert loaded_events[0].train_id == "T1"
    assert loaded_events[0].speed_kmph == 80.0
    assert isinstance(loaded_events[1], TrainHeld)
    assert loaded_events[1].hold_minutes == 5.0
    assert isinstance(loaded_events[2], ConflictDetected)
    assert loaded_events[2].block_id == "B1"
    assert isinstance(loaded_events[3], PlannerInvoked)
    assert loaded_events[3].depth == 4
    assert isinstance(loaded_events[4], RecommendationGenerated)
    assert loaded_events[4].recommendation_id == "rec_1"
    assert loaded_events[4].actions == [{"train_id": "T2", "action_type": "hold", "hold_minutes": 5.0}]
    assert isinstance(loaded_events[5], RecommendationAccepted)
    assert loaded_events[5].recommendation_id == "rec_1"
    assert isinstance(loaded_events[6], RecommendationRejected)
    assert loaded_events[6].recommendation_id == "rec_2"
    assert isinstance(loaded_events[7], DisruptionInjected)
    assert loaded_events[7].disruption_id == "disp_1"
