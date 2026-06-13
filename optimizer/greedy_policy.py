from typing import List, Tuple
from simulator.env import Action, TrainNetworkSimulator
from simulator.train_state import NetworkState
from simulator.conflict_detector import Conflict, ConflictDetector
from optimizer.scorer import StateScorer, StateScoreBreakdown
from optimizer.csp_checker import ConstraintChecker

class GreedyPolicy:
    def __init__(self, simulator: TrainNetworkSimulator, scorer: StateScorer, csp_checker: ConstraintChecker):
        self.simulator = simulator
        self.scorer = scorer
        self.csp_checker = csp_checker
        self.detector = ConflictDetector(simulator.graph, simulator.timetable_data)

    def get_candidate_actions(self, state: NetworkState, conflicts: List[Conflict]) -> List[Action]:
        """Generates candidate hold actions (2, 5, 10, 20 mins) for trains involved in conflicts."""
        actions = [Action(train_id="noop", action_type="noop")]
        seen_train_holds = set()

        for conflict in conflicts:
            for train_id in [conflict.train_a_id, conflict.train_b_id]:
                # Skip if train_id is None or generic disruption identifiers
                if not train_id or train_id in ["DISRUPTED_SIGNAL", "DISRUPTED_PLATFORM"]:
                    continue
                for mins in [2.0, 5.0, 10.0, 20.0]:
                    key = (train_id, mins)
                    if key not in seen_train_holds:
                        seen_train_holds.add(key)
                        actions.append(Action(train_id=train_id, action_type="hold", hold_minutes=mins))
        return actions

    def select_action(self, state: NetworkState) -> Tuple[Action, StateScoreBreakdown]:
        """Selects the best legal action at depth-1 using the state scorer."""
        conflicts = self.detector.detect_conflicts(state, [])
        candidates = self.get_candidate_actions(state, conflicts)
        legal_candidates = self.csp_checker.filter(candidates, state)

        if not legal_candidates:
            noop = Action(train_id="noop", action_type="noop")
            return noop, self.scorer.score(state)

        best_action = None
        best_breakdown = None

        for action in legal_candidates:
            if action.action_type == "noop":
                # Evaluating noop is equivalent to evaluating the current state
                breakdown = self.scorer.score(state)
            else:
                # Apply action to state snapshot immutably
                next_state = self.simulator.apply_action(state, action)
                breakdown = self.scorer.score(next_state)

            if best_breakdown is None or breakdown.total_cost < best_breakdown.total_cost:
                best_breakdown = breakdown
                best_action = action

        # If somehow no action was selected (should not happen since noop is always evaluated)
        if best_action is None:
            best_action = Action(train_id="noop", action_type="noop")
            best_breakdown = self.scorer.score(state)

        # Log decision explainability
        before_breakdown = self.scorer.score(state)
        net_improvement = before_breakdown.total_cost - best_breakdown.total_cost

        action_desc = "Do nothing (noop)"
        if best_action.action_type == "hold":
            action_desc = f"Hold Train {best_action.train_id} for {best_action.hold_minutes} min"

        import logging
        logger = logging.getLogger("greedy_policy")
        logger.info(f"Action: {action_desc}")
        logger.info("Before:")
        logger.info(f"  Delay Cost = {before_breakdown.delay_cost:.0f}")
        logger.info(f"  Conflict Cost = {before_breakdown.conflict_cost:.0f}")
        logger.info("After:")
        logger.info(f"  Delay Cost = {best_breakdown.delay_cost:.0f}")
        logger.info(f"  Conflict Cost = {best_breakdown.conflict_cost:.0f}")
        logger.info(f"Net Improvement = {net_improvement:.0f}\n")

        return best_action, best_breakdown
