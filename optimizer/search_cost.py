from simulator.env import TrainNetworkSimulator
from simulator.train_state import NetworkState
from optimizer.scorer import StateScorer

def compute_g_cost(scorer: StateScorer, parent_state: NetworkState, child_state: NetworkState) -> float:
    """Immediate cost (g) represents actual network impact difference:
    g_cost = scorer.cost(child_state) - scorer.cost(parent_state)
    """
    return scorer.cost(child_state) - scorer.cost(parent_state)

def compute_h_cost(scorer: StateScorer, simulator: TrainNetworkSimulator, state: NetworkState, lookahead_minutes: int = 20) -> float:
    """Heuristic cost (h) projects the state 20 minutes forward under FCFS:
    h_cost = scorer.cost(future_state)
    """
    future_state = simulator.project_forward(state, minutes=lookahead_minutes)
    return scorer.cost(future_state)

def compute_f_cost(g_cost: float, h_cost: float) -> float:
    """Total cost f = g + h."""
    return g_cost + h_cost
