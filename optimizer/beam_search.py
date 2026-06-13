import time
from typing import List, Tuple, Optional, Set
from simulator.env import Action, TrainNetworkSimulator
from simulator.train_state import NetworkState
from simulator.conflict_detector import ConflictDetector
from optimizer.scorer import StateScorer, StateScoreBreakdown
from optimizer.csp_checker import ConstraintChecker
from optimizer.search_node import SearchNode, SearchStats, ActionSequence
from optimizer.search_cost import compute_g_cost, compute_h_cost, compute_f_cost
from optimizer.trace_builder import build_trace_tree

class BeamSearchPlanner:
    def __init__(self, simulator: TrainNetworkSimulator, scorer: StateScorer, csp_checker: ConstraintChecker, depth: int = 4, beam_width: int = 8):
        self.simulator = simulator
        self.scorer = scorer
        self.csp_checker = csp_checker
        self.depth = depth
        self.beam_width = beam_width
        self.detector = ConflictDetector(simulator.graph, simulator.timetable_data)
        self.last_sequence: Optional[ActionSequence] = None

    def generate_actions(self, state: NetworkState) -> List[Action]:
        """Generates candidate hold actions (2, 5, 10, 20 mins) for trains involved in active conflicts."""
        conflicts = self.detector.detect_conflicts(state, [])
        actions = [Action(train_id="noop", action_type="noop")]
        seen_train_holds = set()

        for conflict in conflicts:
            for train_id in [conflict.train_a_id, conflict.train_b_id]:
                if not train_id or train_id in ["DISRUPTED_SIGNAL", "DISRUPTED_PLATFORM"]:
                    continue
                for mins in [2.0, 5.0, 10.0, 20.0]:
                    key = (train_id, mins)
                    if key not in seen_train_holds:
                        seen_train_holds.add(key)
                        actions.append(Action(train_id=train_id, action_type="hold", hold_minutes=mins))
        return actions

    def plan(self, state: NetworkState, depth: int, beam_width: int) -> ActionSequence:
        """Executes the Conflict-based Beam Search algorithm to plan a sequence of hold actions."""
        start_time = time.perf_counter()

        node_counter = 0
        def next_id() -> str:
            nonlocal node_counter
            nid = f"node_{node_counter}"
            node_counter += 1
            return nid

        # 1. Initialize root node
        root_h = compute_h_cost(self.scorer, self.simulator, state, lookahead_minutes=20)
        root = SearchNode(
            node_id=next_id(),
            state=state,
            parent=None,
            action=None,
            depth=0,
            g_cost=0.0,
            h_cost=root_h,
            f_cost=root_h
        )

        nodes_generated = 1
        nodes_expanded = 0
        nodes_pruned = 0
        
        beam_node_ids: Set[str] = {root.node_id}
        beam: List[SearchNode] = [root]

        for d in range(1, depth + 1):
            candidates: List[SearchNode] = []
            if not beam:
                break

            for parent in beam:
                # Generate candidate actions
                actions = self.generate_actions(parent.state)
                # Filter legal actions using CSP checker
                legal_actions = self.csp_checker.filter(actions, parent.state)

                if legal_actions:
                    nodes_expanded += 1

                for action in legal_actions:
                    if action.action_type == "noop":
                        # Optimization: child state is identical to parent state
                        child_state = parent.state.clone()
                        g_cost = 0.0
                        h_cost = parent.h_cost
                        f_cost = parent.f_cost
                    else:
                        child_state = self.simulator.apply_action(parent.state, action)
                        # Immediate cost difference g_cost = scorer.cost(child) - scorer.cost(parent)
                        g_cost = compute_g_cost(self.scorer, parent.state, child_state)
                        # Heuristic lookahead cost
                        h_cost = compute_h_cost(self.scorer, self.simulator, child_state, lookahead_minutes=20)
                        # Cumulative g_cost + h_cost
                        f_cost = compute_f_cost(parent.g_cost + g_cost, h_cost)

                    child_node = SearchNode(
                        node_id=next_id(),
                        state=child_state,
                        parent=parent,
                        action=action,
                        depth=d,
                        g_cost=parent.g_cost + g_cost,
                        h_cost=h_cost,
                        f_cost=f_cost
                    )
                    parent.children.append(child_node)
                    candidates.append(child_node)
                    nodes_generated += 1

            if not candidates:
                break

            # Rank candidates by f_cost (ascending)
            candidates.sort(key=lambda x: x.f_cost)

            # Prune candidates to fit within beam width
            if len(candidates) > beam_width:
                beam = candidates[:beam_width]
                nodes_pruned += (len(candidates) - beam_width)
            else:
                beam = candidates

            # Track which nodes were kept in the beam
            for node in beam:
                beam_node_ids.add(node.node_id)

        # 2. Extract best leaf node from the final beam
        if beam:
            # Beam is sorted, so index 0 has the lowest cost
            best_node = beam[0]
        else:
            best_node = root

        # 3. Trace back path to collect action sequence
        actions_path: List[Action] = []
        curr = best_node
        while curr.parent is not None:
            if curr.action:
                actions_path.append(curr.action)
            curr = curr.parent
        actions_path.reverse()

        # If no actions were planned, default to noop
        if not actions_path:
            actions_path = [Action(train_id="noop", action_type="noop")]

        # 4. Compute metrics and build explainability trace
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        
        stats = SearchStats(
            nodes_generated=nodes_generated,
            nodes_expanded=nodes_expanded,
            nodes_pruned=nodes_pruned,
            beam_width=beam_width,
            depth=depth,
            latency_ms=latency_ms
        )

        trace_root = build_trace_tree(root, beam_node_ids, state)

        # Calculate improvement percentage
        baseline_cost = root.f_cost
        projected_cost = best_node.f_cost
        improvement_pct = 0.0
        if baseline_cost > 0.0:
            improvement_pct = (baseline_cost - projected_cost) / baseline_cost * 100.0

        return ActionSequence(
            actions=actions_path,
            projected_cost=projected_cost,
            baseline_cost=baseline_cost,
            improvement_pct=improvement_pct,
            decision_trace=trace_root,
            stats=stats
        )

    def select_action(self, state: NetworkState) -> Tuple[Action, StateScoreBreakdown]:
        """Policy interface: plans a sequence and returns the first action and its immediate state score breakdown."""
        action_seq = self.plan(state, self.depth, self.beam_width)
        self.last_sequence = action_seq

        action = action_seq.actions[0] if action_seq.actions else Action(train_id="noop", action_type="noop")
        
        # Evaluate immediate state score breakdown
        if action.action_type == "noop":
            breakdown = self.scorer.score(state)
        else:
            next_state = self.simulator.apply_action(state, action)
            breakdown = self.scorer.score(next_state)

        return action, breakdown
