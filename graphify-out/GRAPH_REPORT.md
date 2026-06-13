# Graph Report - railmind  (2026-06-13)

## Corpus Check
- 616 files · ~29,417,640 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 745 nodes · 1380 edges · 87 communities (84 shown, 3 thin omitted)
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 288 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80d595ca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `TrainNetworkSimulator` - 75 edges
2. `NetworkState` - 75 edges
3. `Action` - 56 edges
4. `ConflictDetector` - 48 edges
5. `RailwayGraph` - 44 edges
6. `StateScorer` - 41 edges
7. `ConstraintChecker` - 40 edges
8. `TrainState` - 35 edges
9. `StateScoreBreakdown` - 26 edges
10. `BlockState` - 24 edges

## Surprising Connections (you probably didn't know these)
- `BeamSearchPlanner` --uses--> `TrainNetworkSimulator`  [INFERRED]
  optimizer/beam_search.py → simulator/env.py
- `TrainNetworkSimulator` --uses--> `TrainNetworkSimulator`  [INFERRED]
  optimizer/beam_search.py → simulator/env.py
- `StateScorer` --uses--> `TrainNetworkSimulator`  [INFERRED]
  optimizer/beam_search.py → simulator/env.py
- `ConstraintChecker` --uses--> `TrainNetworkSimulator`  [INFERRED]
  optimizer/beam_search.py → simulator/env.py
- `NetworkState` --uses--> `TrainNetworkSimulator`  [INFERRED]
  optimizer/beam_search.py → simulator/env.py

## Import Cycles
- None detected.

## Communities (87 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (36): Disruption, NetworkState, TrainState, RailwayGraph, BlockSection, RailwayGraph, Allows dictionary-like subscripting for backward compatibility with existing tes, Get properties of a station by ID. (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (50): check_id_collision(), generate_experiment_id(), generate_scenarios(), get_git_commit(), init_db(), main(), run_beam_search(), run_fcfs() (+42 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (26): dependencies, axios, leaflet, react, react-dom, react-leaflet, recharts, devDependencies (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): **Algorithmic & Mathematical Foundation**, **Backend Setup**, **Beam Search with Forward Simulation**, **Configuration Matrix**, **Core Features**, **Developer & Author**, **Evaluation & Benchmarking Methodology**, **Formal State & Action Space** (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (16): Algorithm, Configurations, Default, Deliverables, Evaluate, Expand, Files, Goal (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (11): **1.1 Single-Corridor Graph Model**, **1.2 20-Minute Forward Projection Horizon**, **1.3 Deterministic Transitions (No Uncertainty)**, **1.4 Absence of Mechanical/Civil Failure Modelling**, **1. Known Limitations**, **2.1 Live Data & Sensor Integration**, **2.2 Network-Scale Simulator Expansion**, **2.3 Safety Certification & Regulatory Compliance** (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (13): 10.1 Dashboard Layout, 10.2 Demo Flow, 10. Frontend Specifications, 14. Folder Structure, 15. Technology Stack, 16. Risks and Mitigations, 1. Executive Summary, 5.1 Data Flow (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (12): **12.1  Corridor: Delhi–Kanpur**, **12.2  Train Population and Disruption Types**, **12  Simulation Environment**, **15  Technology Stack**, **18  References and Data Sources**, **1  Executive Summary**, Intelligent Train Conflict Resolution System, Key Project Parameters at a Glance (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (10): 4.1 Python Foundations (Prerequisite), 4.2 NumPy and Data Manipulation, 4.3 Graph Theory and NetworkX, 4.4 Tree Data Structures and Search Algorithms, 4.5 State Space Modeling, 4.6 Constraint Satisfaction (Light Version), 4.7 FastAPI, 4.8 React (Frontend) (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (8): Action, NetworkState, TrainState, Verifies safety margin between two trains.         Since the simulator handles p, Deadlock check: returns False if the station platforms are completely full., Verifies if the train is at a station or loop (i.e. not mid-section) to be held., Enforces that holds are within the maximum limit (e.g. 30 minutes)., Filters a list of candidate actions, returning only those that satisfy all CSP c

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (9): **6.1  High-Level Architecture**, **6.2  Data Flow**, **6.3  Key Design Decisions**, **6  System Architecture**, **Advisory posture.**, **Immutable state transitions.**, **No Gymnasium dependency.**, **SQLite for evaluation data.** (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (8): 13. Development Phases, Phase 1 — Data and Graph (Weeks 1–2), Phase 2 — Simulator (Weeks 3–4), Phase 3 — Scorer and Greedy Baseline (Weeks 5–6), Phase 4 — Search Engine (Weeks 7–8), Phase 5 — Backend (Week 9), Phase 6 — Frontend (Weeks 10–11), Phase 7 — Documentation and Polish (Week 12)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (7): **9.1  Static Data Schemas**, **9.2  Runtime State Objects**, **9.3  Evaluation Log Schema**, **9.4  Data Sources and Provenance**, **9  Data Architecture**, corridor.json, delay_distributions.json

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (6): **13.1  Benchmark Design**, **13.2  Metrics Definition**, **13.3  Statistical Validity**, **13.4  Expected Results and Visualisation**, **13.5  Honest Reporting Requirements**, **13  Evaluation and Benchmarking**

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (6): **17.1  README Lead**, **17.2  Three Interview Questions and Answers**, **17  Presentation Strategy**, **Q: How do you know the depth-4 search actually helps?**, **Q: What would it take to deploy this for real?**, **Q: Why search-based and not RL?**

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (6): **5.1  Formal Problem Definition**, **5.2  Search-Based Planning: Rationale**, **5.3  Algorithm Complexity Analysis**, **5.4  Heuristic Admissibility**, **5.5  Comparison with Alternative Approaches**, **5  Theoretical Foundation**

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (6): **8.1  Beam Search with Forward Simulation**, **8.2  Formal Pseudocode**, **8.3  Depth and Beam Width Sensitivity Analysis**, **8.4  Decision Trace Format**, **8.5  No Training Required**, **8  Search Engine Specification**

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (6): 6.1 TrainNetworkSimulator, 6.2 Conflict Detector, 6.3 Priority Scorer / State Evaluator, 6.4 Search Planning Engine (Core Component), 6.5 CSP Safety Layer, 6. Component Specifications

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (6): 8.1 Algorithm Choice: Beam Search with Forward Simulation, 8.2 Depth and Beam Width: Sensitivity Analysis, 8.3 Heuristic Function, 8.4 Decision Trace Format, 8.5 No Training Required, 8. Search Engine Specification

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (5): **2.1  Indian Railways: Operational Context**, **2.2  The Priority Inversion Failure Mode**, **2.3  Economic Cost of Controllable Delays**, **2.4  Existing Systems and Their Limitations**, **2  Problem Statement**

### Community 22 - "Community 22"
Cohesion: 0.40
Nodes (5): **7.1  TrainNetworkSimulator**, **7.2  Conflict Detector**, **7.3  Priority Scorer / State Evaluator**, **7.4  CSP Safety Layer**, **7  Component Specifications**

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (5): 11.1 Corridor: Delhi to Kanpur (8 Stations), 11.2 Train Population, 11.3 Disruption Types, 11.4 Simulation Speed, 11. Simulation Environment

### Community 24 - "Community 24"
Cohesion: 0.40
Nodes (5): 12.1 Benchmark Suite, 12.2 Metrics, 12.3 Evaluation Matrix, 12.4 Honest Reporting Standard, 12. Evaluation & Benchmarking

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (4): **11.1  Dashboard Layout**, **11.2  The Decision Tree View**, **11.3  Demo Flow**, **11  Frontend Specifications**

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (4): **14.1  Phase Breakdown**, **14.2  Critical Dependency Chain**, **14.3  Risk Register**, **14  Development Plan**

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (4): **16.1  Known Limitations**, **16.2  Deployment Prerequisites**, **16.3  Future Extensions**, **16  Limitations and Future Work**

### Community 29 - "Community 29"
Cohesion: 0.50
Nodes (4): **3.1  International Railway Conflict Management Systems**, **3.2  AI and Search in Train Scheduling Literature**, **3.3  Gap Analysis**, **3  Related Work**

### Community 30 - "Community 30"
Cohesion: 0.50
Nodes (4): **4.1  Goals**, **4.2  Non-Goals**, **4.3  Success Metrics**, **4  Goals, Non-Goals, and Success Metrics**

### Community 31 - "Community 31"
Cohesion: 0.50
Nodes (4): 2.1 The Real-World Problem, 2.2 Why Search-Based Planning Is the Right Model, 2.3 Scope Boundary, 2. Problem Statement

### Community 32 - "Community 32"
Cohesion: 0.50
Nodes (4): 7.1 Static Data (Loaded Once at Startup), 7.2 Runtime State, 7.3 Evaluation Log Schema, 7. Data Design

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (4): 9.1 Base URL, 9.2 REST Endpoints, 9.3 WebSocket Endpoint, 9. API Specifications

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (24): create_base_state(), create_mock_train(), Helper to construct a basic empty NetworkState., Helper to construct a TrainState snapshot., scorer(), test_scenario_10_no_conflict_state(), test_scenario_11_single_vs_multiple_conflicts(), test_scenario_12_hold_effect_on_delay_cost() (+16 more)

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (3): 17. How to Present This Project, In a README, In an Interview

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (3): 3.1 Goals, 3.2 Non-Goals, 3. Goals and Non-Goals

### Community 57 - "Community 57"
Cohesion: 0.16
Nodes (8): NetworkState, TrainState, Get scheduled departure time in minutes since midnight., Scan projected occupancy windows and return list of Conflict objects sorted by u, Calculate effective speed of a train on a section considering max speeds and dis, Convert HH:MM to minutes since midnight., Get scheduled stop duration at a station in minutes., Project block occupancy intervals (block_id, start_time, end_time) over next 30

### Community 62 - "Community 62"
Cohesion: 0.09
Nodes (64): ActionSequence, Conflict, BeamSearchPlanner, Action, ConstraintChecker, NetworkState, StateScoreBreakdown, StateScorer (+56 more)

### Community 63 - "Community 63"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 66 - "Community 66"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 78 - "Community 78"
Cohesion: 0.17
Nodes (11): 1. Distribution of Scenario Disruptions, 2. Distribution of Conflicts, 3. Distribution of Planner Interventions, Analysis & Findings, Detailed Results Ledger, Disruption Type Performance Summary, Diversity Statistics, Improvement Distribution (Histogram Buckets) (+3 more)

### Community 79 - "Community 79"
Cohesion: 0.20
Nodes (10): Experiment 004, Experiment 005, Experiment 006, Experiment 007, Experiment IDs, Files, Goal, Metrics (+2 more)

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (9): ActionSequence Extension, Deliverables, Files, Goal, Phase 4.1 — Search Infrastructure, SearchNode, SearchStats, Tasks (+1 more)

### Community 81 - "Community 81"
Cohesion: 0.22
Nodes (9): Best Path Extraction, Build Trace Tree, Deliverables, Files, Goal, Human Explanation, Phase 4.5 — Explainability Layer, Preserve Pruned Nodes (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.22
Nodes (9): Create Child States, Deliverables, Files, Generate Actions, Goal, Phase 4.3 — Single Node Expansion, Run CSP Filter, Score Child Nodes (+1 more)

### Community 83 - "Community 83"
Cohesion: 0.25
Nodes (8): Deliverables, Files, Goal, Heuristic Cost (h), Immediate Cost (g), Phase 4.2 — Cost Evaluation Layer, Tasks, Total Cost

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (5): Architecture Overview, Future Phase 5 — Network-Aware Search, Objective, RailMind Phase 4 — Beam Search Planner Implementation Plan, Success Criteria

### Community 85 - "Community 85"
Cohesion: 0.33
Nodes (6): Example, Features, Files, Goal, Output, Phase 4.7 — Search Replay System (Optional)

### Community 86 - "Community 86"
Cohesion: 0.67
Nodes (3): **10.1  REST Endpoints**, **10.2  WebSocket Protocol**, **10  API Specifications**

## Knowledge Gaps
- **314 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+309 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrainNetworkSimulator` connect `Community 1` to `Community 0`, `Community 36`, `Community 62`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `RailwayGraph` connect `Community 0` to `Community 1`, `Community 36`, `Community 10`, `Community 57`, `Community 62`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `NetworkState` connect `Community 62` to `Community 0`, `Community 1`, `Community 36`, `Community 10`, `Community 57`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `TrainNetworkSimulator` (e.g. with `ActionSequence` and `Conflict`) actually correct?**
  _`TrainNetworkSimulator` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 49 inferred relationships involving `NetworkState` (e.g. with `ActionSequence` and `Conflict`) actually correct?**
  _`NetworkState` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 37 inferred relationships involving `Action` (e.g. with `ActionSequence` and `Conflict`) actually correct?**
  _`Action` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `ConflictDetector` (e.g. with `ActionSequence` and `Conflict`) actually correct?**
  _`ConflictDetector` has 24 INFERRED edges - model-reasoned connections that need verification._