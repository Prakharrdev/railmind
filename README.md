# **RailMind**

### **Intelligent Train Conflict Resolution System (Decision-Support Prototype)**
*Version 2.0 — Search-Based Planning Architecture*

---

[![Python Version](https://img.shields.io/badge/python-3.10-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![Build Status](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#unit-testing)

Indian Railways carries **22 million passengers daily** with an average delay of **36.6 minutes** per train. Crucially, approximately **66% of these delays originate from controllable, internal operational factors** rather than weather or external events.

**RailMind** is a decision-support prototype targeting **priority inversion on single-track lines and siding loops**—operational bottlenecks where passenger services are held for lower-priority trains, cascading delays downstream. By leveraging a **Search-Based Planning Engine** (modeled on chess engine architecture), RailMind looks ahead several steps into the future, evaluates the passenger-welfare cost of different routing options, and recommends real-time actions (such as slot swaps or holds) that reduce cascade delays by **5% to 12%** compared to a standard First-Come-First-Served (FCFS) greedy baseline.

---

## **Table of Contents**
1. [Core Features](#core-features)
2. [Why Search-Based Planning Over Reinforcement Learning?](#why-search-based-planning-over-reinforcement-learning)
3. [Algorithmic & Mathematical Foundation](#algorithmic--mathematical-foundation)
   - [Formal State & Action Space](#formal-state--action-space)
   - [Priority-Weighted Cost Function](#priority-weighted-cost-function)
   - [Beam Search with Forward Simulation](#beam-search-with-forward-simulation)
   - [Safety Layer (CSP Pre-Filtering)](#safety-layer-csp-pre-filtering)
4. [System Architecture & Data Flow](#system-architecture--data-flow)
5. [Repository Directory Layout](#repository-directory-layout)
6. [Installation & Local Setup](#installation--local-setup)
7. [Running the System](#running-the-system)
   - [Running Unit Tests](#running-unit-tests)
   - [Launching the Backend Server](#launching-the-backend-server)
   - [Launching the Frontend Dashboard](#launching-the-frontend-dashboard)
   - [Running the Benchmarking Suite](#running-the-benchmarking-suite)
8. [Evaluation & Benchmarking Methodology](#evaluation--benchmarking-methodology)
9. [Limitations & Deployment Prerequisites](#limitations--deployment-prerequisites)
10. [Developer & Author](#developer--author)

---

## **Core Features**

*   **Delhi–Kanpur Corridor Simulation (Northern Railway):** Simulates an 8-station, ~440 km high-density segment with authentic double-track and single-track sections (Delhi to Agra is double-track, transitioning to single-track from Agra to Kanpur).
*   **Sweep-Line Conflict Detection:** Scans a rolling 30-minute lookahead window to identify overlapping train path allocations and block occupancy overlaps.
*   **Beam Search Optimization:** Explores alternative futures using discrete dispatching actions (e.g., Hold Train A for 2/5/10/20 minutes) up to 4 search steps deep.
*   **100% Explainable Recommendations:** Surfaces recommendations with a complete, human-readable **Decision Trace** (displaying every branch evaluated, pruned, and scored).
*   **Safety Constraints (CSP Layer):** Guarantees that no illegal action (e.g., holding a train mid-block section, violating headway safety, or exceeding platform capacity) is ever evaluated or recommended.
*   **Live Interactive Dashboard:** A three-panel React-based web interface showing a live corridor map, a Gantt-style conflict timeline, ranked recommendations with expandable "Why?" trees, and cumulative optimization metrics.

---

## **Why Search-Based Planning Over Reinforcement Learning?**

Earlier versions of conflict resolution systems often relied on Reinforcement Learning (RL). RailMind purposefully uses a search-based planner for two primary reasons:

1.  **Explainability:** RL policies operate as black-box neural networks where decisions are encoded as numerical weights. A railway dispatcher, railway board auditor, or security reviewer cannot audit *why* the model made a specific suggestion. A search-based planner exposes its entire decision tree. The dispatcher can expand a recommendation and review exactly which alternative futures were evaluated, how they were scored, and why the selected path yields the lowest passenger delay.
2.  **Deterministic Debugging:** Because there is no training loop, behavior is 100% reproducible. If the system makes a suboptimal recommendation, the developer can inspect the exact node in the search tree, correct the evaluation heuristic, or update constraints, immediately verifying the fix.

---

## **Algorithmic & Mathematical Foundation**

### **Formal State & Action Space**
*   **Network State ($S$):** A frozen snapshot of the rail network containing each train's position (section ID + fractional progress $0.0 \rightarrow 1.0$), current speed, last/next station details, accrued delay, and block occupancies.
*   **Action Space ($A$):** For any conflicting pair $(A, B)$, the possible actions are:
    $$\{\text{Hold } A \text{ for } [2, 5, 10, 20] \text{ min}\} \cup \{\text{Hold } B \text{ for } [2, 5, 10, 20] \text{ min}\} \cup \{\text{Do Nothing (noop)}\}$$
    This yields up to 9 possible actions per conflict, pre-filtered by the CSP layer to remove illegal movements.

### **Priority-Weighted Cost Function**
The search planner evaluates states using a passenger-delay minimization metric:

$$\text{Cost}(s) = \sum_{i \in \text{Trains}} p_i \times \max(0, \text{delay}_i^\text{actual} - \text{delay}_i^\text{scheduled}) \times \mu_i \times (1 + \gamma_i)$$

Where:
*   $p_i$: Typical passenger volume (e.g., 1,200 for Rajdhani, 0 for Freight).
*   $\mu_i$: Class multiplier prioritizing premium services ($\mu_{\text{Rajdhani}} = 1.5$, $\mu_{\text{Mail/Express}} = 1.0$, $\mu_{\text{Passenger}} = 0.8$, $\mu_{\text{Freight}} = 0.3$).
*   $\gamma_i$: **Downstream Cascade Factor** penalizing trains that block downstream junctions (computed as $0.15 \times$ the number of downstream trains waiting on train $i$'s slot).

### **Beam Search with Forward Simulation**
To keep planning latency below **200 milliseconds**, the system employs a **Beam Search** algorithm instead of pure A* or Depth-First Search. At each depth step, all child nodes are evaluated using a fast-forward simulation (projecting the network state 20 minutes into the future to see the cascade effect). The search engine ranks the children and retains only the top $K$ nodes (Beam Width, default = 8) to carry over to the next depth level (Search Depth, default = 4).

```
                  [Current Network State] (Root)
                             /  |  \
       Hold A 2m (score: 94) |  |   Hold B 5m (score: 64)
                             |  \
            Hold A 5m (score: 82) \_ No Action (score: 110)
                             |
                     [Keep top K nodes] (Pruning)
```

### **Safety Layer (CSP Pre-Filtering)**
Before a node is expanded in the search tree, it is validated by a **Constraint Satisfaction Problem (CSP) Checker**:
*   *Minimum Headway:* Enforces safe time intervals between successive blocks.
*   *Platform Capacity:* Ensures trains do not exceed station platform availability.
*   *Block Clearance:* Restricts holds to loops and stations (trains cannot halt mid-section).

---

## **System Architecture & Data Flow**

The system follows a strict layered architecture with unidirectional data dependencies.

```
┌────────────────────────────────────────────────────────┐
│              Layer 4: React Dashboard                  │
│  - Live Map (Leaflet)      - Gantt Conflict Timeline   │
│  - Interactive "Why?" Tree - Dynamic Metrics Panel     │
└──────────────────────────┬─────────────────────────────┘
                           │ WebSocket (Ticks) / REST
                           ▼
┌────────────────────────────────────────────────────────┐
│             Layer 3: FastAPI Web Server                │
│  - API Routes             - WebSocket Tick Broadcaster │
└──────────────────────────┬─────────────────────────────┘
                           │ Function Calls
                           ▼
┌────────────────────────────────────────────────────────┐
│             Layer 2: Intelligence Engine               │
│  - Conflict Detector      - Beam Search Optimizer      │
│  - CSP Safety Checker     - State Priority Scorer      │
└──────────────────────────┬─────────────────────────────┘
                           │ Immutable State Snapshots
                           ▼
┌────────────────────────────────────────────────────────┐
│             Layer 1: Network Simulator                 │
│  - Train Positions        - Platform Reservation Maps  │
│  - Disruption Injector    - Fast-Forward Projection    │
└────────────────────────────────────────────────────────┘
```

1.  **Simulator Tick (30s):** Updates train positions and block occupancies.
2.  **Conflict Scan:** The `ConflictDetector` checks the next 30 minutes.
3.  **Beam Search:** If conflicts exist, the `BeamSearchPlanner` evaluates paths.
4.  **Broadcast:** FastAPI pushes state updates and recommendation payloads via WebSockets.
5.  **Operator Interaction:** The React client displays recommendations and logs accept/override responses to SQLite.

---

## **Repository Directory Layout**

```
railmind/
├── api/                   # FastAPI Web Server
│   ├── main.py            # API entry point & routers
│   ├── models.py          # API Pydantic schemas
│   ├── sim_runner.py      # Background simulation tick loops
│   └── ws_manager.py      # WebSocket connection manager
├── assets/                # Static assets (images, maps)
├── data/                  # Static & Config data
│   ├── raw/               # Raw scraped NTES schedules
│   ├── processed/         # Formatted corridor & timetable profiles
│   └── scripts/           # Extraction & distribution-fitting scripts
├── evaluation/            # Performance benchmarking & analysis
│   ├── report/            # Final benchmark summaries
│   ├── analyze_results.py # Statistical test suites (Wilcoxon, Bootstrap)
│   └── run_benchmark.py   # Runs the 50-scenario benchmark suite
├── frontend/              # React + Vite web dashboard
│   ├── src/               # React source files
│   │   ├── components/    # Sub-components (Map, Timeline, Tree)
│   │   └── App.jsx        # Main application layout
│   └── package.json       # Node dependency specification
├── optimizer/             # Intelligence Engine
│   ├── beam_search.py     # Beam search tree-search implementation
│   ├── csp_checker.py     # Safety constraint validations
│   ├── greedy_policy.py   # Greedy (Depth-1) comparison baseline
│   ├── scorer.py          # State priority cost calculator
│   └── search_node.py     # SearchNode and ActionSequence classes
├── simulator/             # Core Train Movement Simulator
│   ├── corridor.py        # RailwayGraph representation (NetworkX)
│   ├── disruption_injector.py # samples and injects delay schedules
│   ├── env.py             # Main simulator runtime and fast-forward loops
│   ├── train_state.py     # State dataclasses (NetworkState, TrainState)
│   └── tests/             # Unit tests for the simulator
└── requirements.txt       # Python package dependencies
```

---

## **Installation & Local Setup**

### **Prerequisites**
*   Python 3.10 strictly
*   Node.js v18+ & npm

### **Backend Setup**
1.  Navigate to the repository root directory.
2.  Create and activate a Python virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
3.  Install the package requirements:
    ```bash
    pip install -r requirements.txt
    ```

### **Frontend Setup**
1.  Navigate to the `frontend` folder:
    ```bash
    cd frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```

---

## **Running the System**

### **Running Unit Tests**
The codebase contains a comprehensive unit test suite to guarantee simulator stability and mathematical correctness. Run the tests using the virtual environment's `pytest` instance:
```bash
./venv/bin/pytest
```

### **Launching the Backend Server**
To run the FastAPI server locally:
```bash
source venv/bin/activate
uvicorn api.main:app --reload --port 8000
```
API endpoints documentation will be available at `http://localhost:8000/docs`.

### **Launching the Frontend Dashboard**
To start the React development server:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser to view the Dispatcher Dashboard.

### **Running the Benchmarking Suite**
To evaluate the search planner configurations against the 50 predefined disruption scenarios:
```bash
source venv/bin/activate
python evaluation/run_benchmark.py
```
This script runs configurations (Baseline, Greedy, Shallow, Default, Wide) across all scenarios, outputs performance metrics, and logs execution runs to `results.db`. To compile and print statistical reports:
```bash
python evaluation/analyze_results.py
```

---

## **Evaluation & Benchmarking Methodology**

The primary claim is that search-based planning with a lookahead outperforms first-come-first-served dispatching. To establish statistical validity, the benchmarking suite implements:
1.  **50 Predefined Scenarios:** Drawn from log-normal distributions fitted to historical NTES data, covering engine bottlenecks, signal holds, and platform blockages.
2.  **Bootstrap Resampling:** Computes 95% confidence intervals on aggregate delay savings.
3.  **Wilcoxon Signed-Rank Test:** Confirms statistical significance (targeting $p < 0.05$) to prove that the optimization gains are not due to random variation.

### **Configuration Matrix**
| Configuration | Search Depth | Beam Width | Target Latency | Optimization Target |
|---|---|---|---|---|
| **No-Optimizer** | - | - | - | Baseline FCFS |
| **Greedy** | 1 | 1 | < 5ms | Local step optimization |
| **Shallow** | 2 | 4 | < 20ms | Shallow lookahead |
| **Default** | 4 | 8 | < 180ms | Primary planning target (5–12% delay savings) |
| **Wide** | 4 | 16 | < 300ms | Performance limit boundary |

---

## **Limitations & Deployment Prerequisites**

RailMind is a decision-support prototype. Transitioning to a production-grade dispatching system requires addressing three primary gaps:
*   **Live Sensor Feed Integration:** Integrating with Indian Railways' live Train Management System (TMS) data feeds instead of simulation replays.
*   **Network-Scale Expansion:** Expanding the single-corridor graph model to support cross-corridor route junctions and boundary conflict management.
*   **Formal Safety Certification:** Subjecting the CSP Checker safety layer to formal verification against IR's General and Subsidiary Rules (G&SR) and seeking CENELEC EN 50128 safety-software certification.

---

## **Developer & Author**

*   **Author:** Prakhar Gupta
*   **Affiliation:** Manipal University Jaipur, B.Tech CSE (Batch 2025–2029)
*   **GitHub:** [@prakharrdev](https://github.com/prakharrdev)
*   **Last Updated:** June 2026

---

## **License**
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
