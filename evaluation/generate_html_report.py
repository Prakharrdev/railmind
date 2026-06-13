import os
import sqlite3
import json

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment_dir", type=str, required=True, help="Directory of the experiment (e.g. experiments/experiment_001_...)")
    args = parser.parse_args()

    db_path = os.path.join(args.experiment_dir, "results.db")
    html_path = os.path.join(args.experiment_dir, "report.html")

    if not os.path.exists(db_path):
        print(f"Results database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Query columns in episodes table to handle backward compatibility
    cursor.execute("PRAGMA table_info(episodes)")
    cols = [col[1] for col in cursor.fetchall()]

    select_cols = [
        "episode_id", "disruption_type", "disruption_train", "disruption_mag_min",
        "unique_conflicts_fcfs", "unique_conflicts_greedy", "conflict_records_fcfs",
        "conflict_records_greedy", "planner_invocations", "actions_applied",
        "delay_cost_before", "delay_cost_after", "conflict_cost_before",
        "conflict_cost_after", "fcfs_total_cost", "greedy_total_cost",
        "improvement_pct", "avg_plan_time_ms"
    ]
    has_search = "nodes_generated" in cols
    if has_search:
        select_cols.extend(["nodes_generated", "nodes_expanded", "nodes_pruned"])

    query = f"SELECT {', '.join(select_cols)} FROM episodes ORDER BY CAST(SUBSTR(episode_id, 10) AS INTEGER)"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    scenarios = []
    fcfs_costs = []
    greedy_costs = []
    labels = []
    latencies = []
    improvements = []
    
    unique_conf_fcfs = []
    unique_conf_greedy = []
    records_conf_fcfs = []
    records_conf_greedy = []
    actions_applied_list = []
    
    total_fcfs = 0.0
    total_greedy = 0.0
    max_imp = 0.0

    tot_nodes_gen = 0
    tot_nodes_exp = 0
    tot_nodes_pru = 0
    
    # Group by type
    by_type = {}
    disruption_counts = {"engine_slow": 0, "platform_block": 0, "signal_hold": 0}
    
    for r in rows:
        scen_dict = {
            "id": r[0],
            "type": r[1],
            "train": r[2],
            "magnitude": r[3],
            "unique_conf_fcfs": r[4],
            "unique_conf_greedy": r[5],
            "records_fcfs": r[6],
            "records_greedy": r[7],
            "invocations": r[8],
            "actions": r[9],
            "delay_before": r[10],
            "delay_after": r[11],
            "conflict_before": r[12],
            "conflict_after": r[13],
            "fcfs_cost": r[14],
            "greedy_cost": r[15],
            "improvement": r[16],
            "latency": r[17],
            "nodes_gen": 0,
            "nodes_exp": 0,
            "nodes_pru": 0
        }
        if has_search:
            scen_dict["nodes_gen"] = r[18]
            scen_dict["nodes_exp"] = r[19]
            scen_dict["nodes_pru"] = r[20]

            tot_nodes_gen += r[18]
            tot_nodes_exp += r[19]
            tot_nodes_pru += r[20]

        scenarios.append(scen_dict)
        labels.append(r[0])
        fcfs_costs.append(r[14])
        greedy_costs.append(r[15])
        latencies.append(r[17])
        improvements.append(r[16])
        
        unique_conf_fcfs.append(r[4])
        unique_conf_greedy.append(r[5])
        records_conf_fcfs.append(r[6])
        records_conf_greedy.append(r[7])
        actions_applied_list.append(r[9])
        
        total_fcfs += r[14]
        total_greedy += r[15]
        max_imp = max(max_imp, r[16])
        
        if r[1] not in by_type:
            by_type[r[1]] = []
        by_type[r[1]].append(r[16])
        
        if r[1] in disruption_counts:
            disruption_counts[r[1]] += 1

    n_scens = len(scenarios)
    mean_fcfs = total_fcfs / n_scens if n_scens > 0 else 0
    mean_greedy = total_greedy / n_scens if n_scens > 0 else 0
    mean_imp = (total_fcfs - total_greedy) / total_fcfs * 100.0 if total_fcfs > 0 else 0
    avg_latency = sum(latencies) / len(latencies) if latencies else 0

    avg_nodes_gen = tot_nodes_gen / n_scens if n_scens > 0 else 0
    avg_nodes_exp = tot_nodes_exp / n_scens if n_scens > 0 else 0
    avg_nodes_pru = tot_nodes_pru / n_scens if n_scens > 0 else 0

    # Type Averages
    avg_engine = sum(by_type.get("engine_slow", [0])) / len(by_type.get("engine_slow", [1]))
    avg_platform = sum(by_type.get("platform_block", [0])) / len(by_type.get("platform_block", [1]))
    avg_signal = sum(by_type.get("signal_hold", [0])) / len(by_type.get("signal_hold", [1]))

    # Histogram buckets for improvement
    bucket_0_1 = len([x for x in improvements if 0.0 <= x < 1.0])
    bucket_1_3 = len([x for x in improvements if 1.0 <= x < 3.0])
    bucket_3_5 = len([x for x in improvements if 3.0 <= x < 5.0])
    bucket_5_plus = len([x for x in improvements if x >= 5.0])

    # Interventions Distribution Buckets
    int_0 = len([x for x in actions_applied_list if x == 0])
    int_1_3 = len([x for x in actions_applied_list if 1 <= x <= 3])
    int_4_6 = len([x for x in actions_applied_list if 4 <= x <= 6])
    int_7_9 = len([x for x in actions_applied_list if 7 <= x <= 9])
    int_10_plus = len([x for x in actions_applied_list if x >= 10])

    # Unique conflicts statistics
    avg_unique_fcfs = sum(unique_conf_fcfs) / len(unique_conf_fcfs) if unique_conf_fcfs else 0
    avg_unique_greedy = sum(unique_conf_greedy) / len(unique_conf_greedy) if unique_conf_greedy else 0
    avg_records_fcfs = sum(records_conf_fcfs) / len(records_conf_fcfs) if records_conf_fcfs else 0
    avg_records_greedy = sum(records_conf_greedy) / len(records_conf_greedy) if records_conf_greedy else 0

    import datetime
    date_str = datetime.date.today().isoformat()
    improvements_desc = "Implemented Conflict-based Beam Search Planner with customizable depth and beam width parameters. Recorded search complexity and latency distribution."

    # HTML Content
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RailMind Planner Benchmark Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {{
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-card: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-blue: #3b82f6;
            --accent-green: #10b981;
            --accent-yellow: #f59e0b;
            --accent-purple: #8b5cf6;
            --accent-red: #ef4444;
            --border-color: #334155;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Outfit', sans-serif;
        }}

        body {{
            background-color: var(--bg-primary);
            color: var(--text-primary);
            padding: 2rem;
            min-height: 100vh;
        }}

        header {{
            margin-bottom: 2.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }}

        header h1 {{
            font-size: 2.2rem;
            font-weight: 700;
            background: linear-gradient(to right, #60a5fa, #34d399, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }}

        header p {{
            color: var(--text-secondary);
            font-size: 1.1rem;
        }}

        /* KPI Container */
        .kpi-container {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }}

        .kpi-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 1rem;
            padding: 1.5rem;
            transition: transform 0.2s ease, border-color 0.2s ease;
        }}

        .kpi-card:hover {{
            transform: translateY(-2px);
            border-color: var(--accent-blue);
        }}

        .kpi-title {{
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            margin-bottom: 0.75rem;
        }}

        .kpi-value {{
            font-size: 2rem;
            font-weight: 700;
        }}

        .kpi-desc {{
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
        }}

        .kpi-blue .kpi-value {{ color: var(--accent-blue); }}
        .kpi-green .kpi-value {{ color: var(--accent-green); }}
        .kpi-purple .kpi-value {{ color: var(--accent-purple); }}
        .kpi-yellow .kpi-value {{ color: var(--accent-yellow); }}

        /* Main Grid */
        .grid-charts {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
            margin-bottom: 2.5rem;
        }}

        @media (min-width: 1024px) {{
            .grid-charts {{
                grid-template-columns: 1fr 1fr;
            }}
        }}

        .chart-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 1rem;
            padding: 2rem;
        }}

        .chart-card h2 {{
            font-size: 1.3rem;
            margin-bottom: 1.5rem;
            font-weight: 600;
        }}

        .chart-container {{
            position: relative;
            width: 100%;
            min-height: 350px;
        }}

        /* Table Section */
        .table-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 1rem;
            padding: 2rem;
            margin-bottom: 2.5rem;
        }}

        .table-card h2 {{
            font-size: 1.3rem;
            margin-bottom: 1.5rem;
        }}

        .table-wrapper {{
            overflow-x: auto;
            max-height: 500px;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}

        th, td {{
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.95rem;
        }}

        th {{
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            background-color: var(--bg-secondary);
        }}

        tr:hover {{
            background-color: rgba(255, 255, 255, 0.02);
        }}

        .badge {{
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.8rem;
            font-weight: 600;
        }}

        .badge-slow {{ background-color: rgba(239, 68, 68, 0.15); color: #f87171; }}
        .badge-block {{ background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; }}
        .badge-hold {{ background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; }}

        .text-green {{ color: var(--accent-green); font-weight: 600; }}
        .text-secondary {{ color: var(--text-secondary); }}
    </style>
</head>
<body>

    <header>
        <h1>RailMind Planner Benchmark Dashboard — {date_str}</h1>
        <p style="margin-bottom: 0.5rem;"><strong>Improvements</strong>: {improvements_desc}</p>
        <p style="font-size: 0.95rem; color: var(--text-secondary);">Interactive evaluation of Planner vs FCFS on validated active scenarios (50 Scenarios)</p>
    </header>

    <!-- KPI Row -->
    <div class="kpi-container">
        <div class="kpi-card kpi-blue">
            <div class="kpi-title">Avg FCFS Delay Cost</div>
            <div class="kpi-value">{mean_fcfs:,.0f}</div>
            <div class="kpi-desc">First-come-first-served baseline</div>
        </div>
        <div class="kpi-card kpi-green">
            <div class="kpi-title">Avg Planner Delay Cost</div>
            <div class="kpi-value">{mean_greedy:,.0f}</div>
            <div class="kpi-desc">With Dispatch Optimizer</div>
        </div>
        <div class="kpi-card kpi-green">
            <div class="kpi-title">Mean Improvement %</div>
            <div class="kpi-value">{mean_imp:.2f}%</div>
            <div class="kpi-desc">Average cost reduction</div>
        </div>
        <div class="kpi-card kpi-yellow">
            <div class="kpi-title">Max Improvement %</div>
            <div class="kpi-value">{max_imp:.2f}%</div>
            <div class="kpi-desc">Best resolving scenario</div>
        </div>
        <div class="kpi-card kpi-purple">
            <div class="kpi-title">Avg Latency</div>
            <div class="kpi-value">{avg_latency:.2f} ms</div>
            <div class="kpi-desc">Mean planning step time</div>
        </div>
    </div>
    """

    if has_search:
        html_content += f"""
    <!-- Search Complexity KPI Row -->
    <div class="kpi-container">
        <div class="kpi-card kpi-blue">
            <div class="kpi-title">Avg Nodes Generated</div>
            <div class="kpi-value">{avg_nodes_gen:,.1f}</div>
            <div class="kpi-desc">Total search nodes created</div>
        </div>
        <div class="kpi-card kpi-purple">
            <div class="kpi-title">Avg Nodes Expanded</div>
            <div class="kpi-value">{avg_nodes_exp:,.1f}</div>
            <div class="kpi-desc">Nodes selected for expansion</div>
        </div>
        <div class="kpi-card kpi-yellow">
            <div class="kpi-title">Avg Nodes Pruned</div>
            <div class="kpi-value">{avg_nodes_pru:,.1f}</div>
            <div class="kpi-desc">Nodes cut by beam width</div>
        </div>
    </div>"""

    # Build Charts and Table
    html_content += f"""
    <!-- Diversity Statistics Section -->
    <div class="grid-charts" style="margin-bottom: 2rem;">
        <div class="chart-card">
            <h2>Distribution of Scenario Disruptions</h2>
            <div class="chart-container" style="min-height: 300px;">
                <canvas id="disruptionDistributionChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h2>Distribution of Conflicts (FCFS vs Planner)</h2>
            <div class="chart-container" style="min-height: 300px;">
                <canvas id="conflictDistributionChart"></canvas>
            </div>
        </div>
    </div>

    <div class="grid-charts" style="margin-bottom: 2rem;">
        <div class="chart-card">
            <h2>Planner Interventions (Actions Applied)</h2>
            <div class="chart-container" style="min-height: 300px;">
                <canvas id="interventionsChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h2>Avg Improvement by Disruption Type</h2>
            <div class="chart-container" style="min-height: 300px;">
                <canvas id="disruptionTypeChart"></canvas>
            </div>
        </div>
    </div>

    <!-- Detailed Cost Comparison -->
    <div class="chart-card" style="margin-bottom: 2.5rem;">
        <h2>Cost Comparison by Scenario (FCFS vs Planner)</h2>
        <div class="chart-container" style="min-height: 400px;">
            <canvas id="costComparisonChart"></canvas>
        </div>
    </div>

    <!-- Data Table Card -->
    <div class="table-card">
        <h2>Benchmark Execution Ledger</h2>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Scenario</th>
                        <th>Disrupted Train</th>
                        <th>Disruption</th>
                        <th>FCFS Delay / Conflict / Total</th>
                        <th>Planner Delay / Conflict / Total</th>
                        <th>Unique Conflicts (F/P)</th>
                        <th>Conflict Records (F/P)</th>
                        <th>Actions Applied</th>
                        {"<th>Nodes Gen/Exp/Pru</th>" if has_search else ""}
                        <th>Improvement</th>
                        <th>Avg Latency</th>
                    </tr>
                </thead>
                <tbody>
    """

    for scen in scenarios:
        badge_class = "badge-slow" if scen["type"] == "engine_slow" else ("badge-block" if scen["type"] == "platform_block" else "badge-hold")
        fcfs_break = f"{scen['delay_before']:,.0f} / {scen['conflict_before']:,.0f} / {scen['fcfs_cost']:,.0f}"
        greedy_break = f"{scen['delay_after']:,.0f} / {scen['conflict_after']:,.0f} / {scen['greedy_cost']:,.0f}"
        search_col = f"<td>{scen['nodes_gen']} / {scen['nodes_exp']} / {scen['nodes_pru']}</td>" if has_search else ""
        
        html_content += f"""
                    <tr>
                        <td><strong>{scen["id"]}</strong></td>
                        <td>{scen["train"]} ({scen["magnitude"]}m)</td>
                        <td><span class="badge {badge_class}">{scen["type"]}</span></td>
                        <td class="text-secondary">{fcfs_break}</td>
                        <td class="text-secondary">{greedy_break}</td>
                        <td>{scen["unique_conf_fcfs"]} / {scen["unique_conf_greedy"]}</td>
                        <td>{scen["records_fcfs"]} / {scen["records_greedy"]}</td>
                        <td><strong>{scen["actions"]}</strong></td>
                        {search_col}
                        <td class="text-green">{scen["improvement"]:.2f}%</td>
                        <td>{scen["latency"]:.4f} ms</td>
                    </tr>"""

    html_content += f"""
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const labels = {json.dumps(labels)};
        const fcfsCosts = {json.dumps(fcfs_costs)};
        const greedyCosts = {json.dumps(greedy_costs)};
        const latencies = {json.dumps(latencies)};

        // 1. Cost Comparison Bar Chart
        const ctxCost = document.getElementById('costComparisonChart').getContext('2d');
        new Chart(ctxCost, {{
            type: 'bar',
            data: {{
                labels: labels,
                datasets: [
                    {{
                        label: 'FCFS Cost (Baseline)',
                        data: fcfsCosts,
                        backgroundColor: '#3b82f6',
                        borderColor: '#2563eb',
                        borderWidth: 1
                    }},
                    {{
                        label: 'Planner Cost',
                        data: greedyCosts,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    }}
                ]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        beginAtZero: true,
                        grid: {{ color: '#334155' }},
                        ticks: {{ color: '#94a3b8' }}
                    }},
                    x: {{
                        grid: {{ display: false }},
                        ticks: {{ color: '#94a3b8', maxRotation: 90, minRotation: 90 }}
                    }}
                }},
                plugins: {{
                    legend: {{ labels: {{ color: '#f8fafc' }} }}
                }}
            }}
        }});

        // 2. Disruption Distribution (Pie Chart)
        const ctxDispDist = document.getElementById('disruptionDistributionChart').getContext('2d');
        new Chart(ctxDispDist, {{
            type: 'pie',
            data: {{
                labels: ['Engine Slow', 'Platform Block', 'Signal Hold'],
                datasets: [{{
                    data: [{disruption_counts["engine_slow"]}, {disruption_counts["platform_block"]}, {disruption_counts["signal_hold"]}],
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'],
                    borderWidth: 1
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ 
                        position: 'right',
                        labels: {{ color: '#f8fafc' }} 
                    }}
                }}
            }}
        }});

        // 3. Conflict Distribution (Unique Conflicts FCFS vs Planner)
        const ctxConfDist = document.getElementById('conflictDistributionChart').getContext('2d');
        new Chart(ctxConfDist, {{
            type: 'bar',
            data: {{
                labels: labels,
                datasets: [
                    {{
                        label: 'FCFS Unique Conflicts',
                        data: {json.dumps(unique_conf_fcfs)},
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: '#ef4444',
                        borderWidth: 1
                    }},
                    {{
                        label: 'Planner Unique Conflicts',
                        data: {json.dumps(unique_conf_greedy)},
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: '#10b981',
                        borderWidth: 1
                    }}
                ]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        beginAtZero: true,
                        grid: {{ color: '#334155' }},
                        ticks: {{ color: '#94a3b8' }}
                    }},
                    x: {{
                        grid: {{ display: false }},
                        ticks: {{ color: '#94a3b8', maxRotation: 90, minRotation: 90 }}
                    }}
                }},
                plugins: {{
                    legend: {{ labels: {{ color: '#f8fafc' }} }}
                }}
            }}
        }});

        // 4. Planner Interventions Distribution
        const ctxInt = document.getElementById('interventionsChart').getContext('2d');
        new Chart(ctxInt, {{
            type: 'bar',
            data: {{
                labels: ['0 holds', '1-3 holds', '4-6 holds', '7-9 holds', '10+ holds'],
                datasets: [{{
                    label: 'Scenario Count',
                    data: [{int_0}, {int_1_3}, {int_4_6}, {int_7_9}, {int_10_plus}],
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        beginAtZero: true,
                        grid: {{ color: '#334155' }},
                        ticks: {{ color: '#94a3b8', stepSize: 1 }}
                    }},
                    x: {{
                        grid: {{ display: false }},
                        ticks: {{ color: '#94a3b8' }}
                    }}
                }},
                plugins: {{
                    legend: {{ display: false }}
                }}
            }}
        }});

        // 5. Disruption Type Averages Bar Chart
        const ctxType = document.getElementById('disruptionTypeChart').getContext('2d');
        new Chart(ctxType, {{
            type: 'bar',
            data: {{
                labels: ['Engine Slow', 'Platform Block', 'Signal Hold'],
                datasets: [{{
                    label: 'Avg Improvement %',
                    data: [{avg_engine:.2f}, {avg_platform:.2f}, {avg_signal:.2f}],
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'],
                    borderWidth: 1
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        beginAtZero: true,
                        grid: {{ color: '#334155' }},
                        ticks: {{ color: '#94a3b8' }}
                    }},
                    x: {{
                        grid: {{ display: false }},
                        ticks: {{ color: '#94a3b8' }}
                    }}
                }},
                plugins: {{
                    legend: {{ display: false }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""

    os.makedirs(os.path.dirname(html_path), exist_ok=True)
    with open(html_path, "w") as f:
        f.write(html_content)

    print(f"Interactive dashboard successfully written to {html_path}")

if __name__ == "__main__":
    main()
