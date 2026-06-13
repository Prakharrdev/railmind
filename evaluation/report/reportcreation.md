i want would build:

experiments/
│
├── experiment_001_baseline_fcfs/
│
├── experiment_002_greedy_v1/
│
├── experiment_003_greedy_validated/
│
├── experiment_004_beam_depth_2/
│
├── experiment_005_beam_depth_4/
│
└── index.json

Inside each experiment

Example:

experiment_004_beam_depth_2/
│
├── metadata.json
│
├── scenarios.json
│
├── results.db
│
├── report.html
│
├── report.md
│
├── charts/
│   ├── improvement.png
│   ├── latency.png
│   └── conflicts.png
│
└── logs/


Most important file
metadata.json

Example:

{
  "experiment_id": "004",
  "planner": "beam_search",
  "beam_width": 10,
  "search_depth": 2,
  "date": "2026-06-13",
  "git_commit": "a7f82d9",
  "scenario_count": 50,
  "simulation_duration": 120,
  "random_seed": 42
}
Add Git Commit Hash

This is something most students never do.

Store:

git rev-parse HEAD

inside:

{
  "git_commit": "a7f82d9"
}

Then every result is linked to exact code.
Create an Experiment Registry
experiments/index.json

Example:

[
  {
    "id": "001",
    "name": "FCFS Baseline",
    "improvement": 0
  },
  {
    "id": "002",
    "name": "Greedy Initial",
    "improvement": 2.32
  },
  {
    "id": "003",
    "name": "Greedy Validated",
    "improvement": 5.41
  }
]

This becomes your project timeline.

HTML report is a MUST

Not optional.

Generate:

report.html

with:

Overview
Planner
Date
Commit
Scenario Count
Metrics
Mean Improvement
Median Improvement
Max Improvement
Latency
Charts
Improvement Distribution
Conflict Distribution
Latency Distribution
Top 10 Scenarios
Scenario 42
Beam Search: +12.4%

This becomes portfolio material.
One thing I would add

Store the actual decision trace.

Example:

{
  "scenario_id": "42",

  "planner_decisions": [

    {
      "time": 891.0,
      "action": "hold_train",
      "train_id": "12345",
      "duration": 5
    },

    {
      "time": 894.0,
      "action": "hold_train",
      "train_id": "54321",
      "duration": 10
    }
  ]
}

This is incredibly valuable.

Later you can literally replay planner behavior.

If this were my project

I'd create:

railmind/
│
├── experiments/
│
├── reports/
│
├── benchmarks/
│
└── artifacts/

and treat every benchmark run as a research experiment.