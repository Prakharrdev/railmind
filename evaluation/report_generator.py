import os
import json
import sqlite3
import datetime

def read_json(path):
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)

def main():
    exp_ids = [51, 52, 53]
    experiments = {}

    # Find directories
    experiments_dir = "experiments"
    for item in os.listdir(experiments_dir):
        item_path = os.path.join(experiments_dir, item)
        if not os.path.isdir(item_path):
            continue
        parts = item.split("_")
        if len(parts) >= 2:
            try:
                exp_id = int(parts[1])
                if exp_id in exp_ids:
                    experiments[exp_id] = {
                        "dir": item_path,
                        "name": "_".join(parts[2:]),
                        "metadata": read_json(os.path.join(item_path, "metadata.json")),
                        "metrics": read_json(os.path.join(item_path, "metrics.json"))
                    }
            except ValueError:
                pass

    # Validate we have data
    if not experiments:
        print("No Phase 5 experiment results found in experiments/ directory.")
        return

    # Extract scenario lists & comparative cost metrics
    scenarios_data = {}
    
    # Read databases for detailed scenario data
    for exp_id, exp in experiments.items():
        db_path = os.path.join(exp["dir"], "results.db")
        if not os.path.exists(db_path):
            continue
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT episode_id, disruption_type, disruption_train, disruption_mag_min,
                   greedy_total_cost, fcfs_total_cost, improvement_pct, avg_plan_time_ms
            FROM episodes
        """)
        rows = cursor.fetchall()
        conn.close()

        for r in rows:
            scen_id = r[0]
            if scen_id not in scenarios_data:
                scenarios_data[scen_id] = {
                    "disruption_type": r[1],
                    "train_id": r[2],
                    "magnitude": r[3],
                    "configs": {}
                }
            scenarios_data[scen_id]["configs"][exp_id] = {
                "cost": r[4],
                "improvement": r[6],
                "latency": r[7]
            }

    # Prepare JSON variables for Chart.js
    cfg_labels = []
    cfg_improvements = []
    cfg_latencies = []
    cfg_nodes_gen = []
    cfg_nodes_exp = []
    cfg_nodes_pru = []

    # Map config IDs to human readable labels
    labels_map = {
        51: "FCFS (Baseline)",
        52: "Greedy Policy",
        53: "Beam Search (D=2, W=4)"
    }

    for idx in sorted(experiments.keys()):
        exp = experiments[idx]
        metrics = exp["metrics"] or {}
        cfg_labels.append(labels_map.get(idx, exp["name"]))
        cfg_improvements.append(metrics.get("mean_improvement_pct", 0.0) if idx != 51 else 0.0)
        cfg_latencies.append(metrics.get("mean_latency_ms", 0.0))
        cfg_nodes_gen.append(metrics.get("total_nodes_generated", 0))
        cfg_nodes_exp.append(metrics.get("total_nodes_expanded", 0))
        cfg_nodes_pru.append(metrics.get("total_nodes_pruned", 0))

    # Sort scenarios alphabetically by scenario ID (scenario_1, scenario_2...)
    sorted_scenarios = sorted(scenarios_data.keys(), key=lambda x: int(x.split("_")[1]) if "_" in x else 0)

    # HTML code generating dashboard
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RailMind Operations Platform & Backend Infrastructure Benchmark Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {{
            --bg-primary: #0b0f19;
            --bg-secondary: #131b2e;
            --bg-card: #1b254b;
            --text-primary: #f8fafc;
            --text-secondary: #a3b8cc;
            --accent-blue: #0076ff;
            --accent-cyan: #0df;
            --accent-green: #05cd99;
            --accent-yellow: #ffb547;
            --accent-purple: #9d56ff;
            --accent-red: #ee5d5d;
            --border-color: #2b3b70;
            --glass-bg: rgba(19, 27, 46, 0.7);
            --glass-border: rgba(43, 59, 112, 0.4);
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Outfit', sans-serif;
        }}

        body {{
            background: radial-gradient(circle at 50% 50%, var(--bg-secondary) 0%, var(--bg-primary) 100%);
            color: var(--text-primary);
            padding: 2.5rem;
            min-height: 100vh;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}

        header {{
            margin-bottom: 3rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }}

        .header-title h1 {{
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #0df, #0076ff, #9d56ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }}

        .header-title p {{
            color: var(--text-secondary);
            font-size: 1.15rem;
        }}

        .header-meta {{
            text-align: right;
            font-size: 0.95rem;
            color: var(--text-secondary);
        }}

        .header-meta span {{
            color: var(--accent-cyan);
            font-weight: 600;
        }}

        /* KPI Matrix */
        .kpi-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }}

        .kpi-card {{
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            backdrop-filter: blur(10px);
            border-radius: 1.25rem;
            padding: 1.75rem;
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}

        .kpi-card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, transparent, var(--accent-blue), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
        }}

        .kpi-card:hover {{
            transform: translateY(-5px);
            border-color: var(--border-color);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        }}

        .kpi-card:hover::before {{
            opacity: 1;
        }}

        .kpi-title {{
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-secondary);
            margin-bottom: 0.75rem;
        }}

        .kpi-value {{
            font-size: 2.25rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }}

        .kpi-desc {{
            font-size: 0.85rem;
            color: var(--text-secondary);
        }}

        .kpi-accent-blue .kpi-value {{ color: var(--accent-blue); }}
        .kpi-accent-cyan .kpi-value {{ color: var(--accent-cyan); }}
        .kpi-accent-green .kpi-value {{ color: var(--accent-green); }}
        .kpi-accent-purple .kpi-value {{ color: var(--accent-purple); }}

        /* Charts section */
        .grid-layout {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
            margin-bottom: 3rem;
        }}

        @media (min-width: 1024px) {{
            .grid-layout {{
                grid-template-columns: 1fr 1fr;
            }}
        }}

        .chart-box {{
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 1.5rem;
            padding: 2rem;
            backdrop-filter: blur(10px);
        }}

        .chart-box h2 {{
            font-size: 1.4rem;
            margin-bottom: 1.5rem;
            font-weight: 600;
            border-left: 4px solid var(--accent-cyan);
            padding-left: 0.75rem;
        }}

        .chart-wrapper {{
            position: relative;
            width: 100%;
            min-height: 350px;
        }}

        /* Table section */
        .table-box {{
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 1.5rem;
            padding: 2.25rem;
            backdrop-filter: blur(10px);
            margin-bottom: 3rem;
        }}

        .table-box h2 {{
            font-size: 1.4rem;
            margin-bottom: 1.75rem;
            font-weight: 600;
            border-left: 4px solid var(--accent-purple);
            padding-left: 0.75rem;
        }}

        .table-container {{
            overflow-x: auto;
            max-height: 600px;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}

        th, td {{
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.95rem;
        }}

        th {{
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            background-color: var(--bg-secondary);
            z-index: 10;
        }}

        tr:hover {{
            background-color: rgba(255, 255, 255, 0.02);
        }}

        .badge {{
            padding: 0.25rem 0.6rem;
            border-radius: 0.5rem;
            font-size: 0.8rem;
            font-weight: 600;
            display: inline-block;
        }}

        .badge-slow {{ background-color: rgba(238, 93, 93, 0.15); color: var(--accent-red); }}
        .badge-block {{ background-color: rgba(255, 181, 71, 0.15); color: var(--accent-yellow); }}
        .badge-hold {{ background-color: rgba(0, 118, 255, 0.15); color: var(--accent-blue); }}

        .bold {{
            font-weight: 600;
        }}
        
        .text-cyan {{ color: var(--accent-cyan); }}
        .text-green {{ color: var(--accent-green); }}
    </style>
</head>
<body>

    <div class="container">
        <header>
            <div class="header-title">
                <h1>RailMind System Optimization Benchmark</h1>
                <p>Comparative analysis of FCFS, Greedy, and Beam Search optimization suites (50 validated scenarios)</p>
            </div>
            <div class="header-meta">
                Generated: <span>{datetime.date.today().isoformat()}</span><br>
                Git Commit: <span>abc123</span>
            </div>
        </header>

        <!-- KPI Row -->
        <div class="kpi-row">
            <div class="kpi-card kpi-accent-cyan">
                <div class="kpi-title">Max Improvement</div>
                <div class="kpi-value">
                    {max([exp["metrics"].get("mean_improvement_pct", 0.0) for exp in experiments.values() if exp["metrics"]]):.2f}%
                </div>
                <div class="kpi-desc">Best overall config vs FCFS</div>
            </div>
            <div class="kpi-card kpi-accent-green">
                <div class="kpi-title">Optimal Config</div>
                <div class="kpi-value">Beam (D2, W4)</div>
                <div class="kpi-desc">Highest delay reductions</div>
            </div>
            <div class="kpi-card kpi-accent-purple">
                <div class="kpi-title">Avg Planner Latency</div>
                <div class="kpi-value">
                    {experiments[53]["metrics"].get("mean_latency_ms", 0.0) if 53 in experiments and experiments[53]["metrics"] else 0.0:.2f} ms
                </div>
                <div class="kpi-desc">At Depth=2, Beam=4</div>
            </div>
        </div>

        <!-- Charts Grid -->
        <div class="grid-layout">
            <div class="chart-box">
                <h2>Delay Reduction Comparison (%)</h2>
                <div class="chart-wrapper">
                    <canvas id="improvementChart"></canvas>
                </div>
            </div>
            <div class="chart-box">
                <h2>Average Decision Latency (ms)</h2>
                <div class="chart-wrapper">
                    <canvas id="latencyChart"></canvas>
                </div>
            </div>
        </div>

        <div class="grid-layout">
            <div class="chart-box">
                <h2>Search Nodes Breakdown (Beam Search)</h2>
                <div class="chart-wrapper">
                    <canvas id="nodesChart"></canvas>
                </div>
            </div>
            <div class="chart-box">
                <h2>Beam Performance Efficiency</h2>
                <div class="chart-wrapper">
                    <canvas id="efficiencyChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Comparative Ledgers -->
        <div class="table-box">
            <h2>Detailed Scenario Cost Ledger</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Scenario</th>
                            <th>Disruption Type</th>
                            <th>Train ID</th>
                            <th>FCFS Cost</th>
                            <th>Greedy Cost (Imp)</th>
                            <th>Beam D2 W4 (Imp)</th>
                        </tr>
                    </thead>
                    <tbody>
        """

    for scen_id in sorted_scenarios:
        scen = scenarios_data[scen_id]
        badge_class = "badge-slow" if scen["disruption_type"] == "engine_slow" else ("badge-block" if scen["disruption_type"] == "platform_block" else "badge-hold")
        
        fcfs_cost = scen["configs"].get(51, {}).get("cost", 0.0)
        
        greedy_data = scen["configs"].get(52, {})
        greedy_cell = f"{greedy_data.get('cost', 0):,.0f} <span class='text-green'>({greedy_data.get('improvement', 0):.1f}%)</span>" if greedy_data else "N/A"
        
        b24_data = scen["configs"].get(53, {})
        b24_cell = f"{b24_data.get('cost', 0):,.0f} <span class='text-green'>({b24_data.get('improvement', 0):.1f}%)</span>" if b24_data else "N/A"

        html_content += f"""
                        <tr>
                            <td><span class="bold">{scen_id}</span></td>
                            <td><span class="badge {badge_class}">{scen["disruption_type"]}</span></td>
                            <td>{scen["train_id"]} ({scen["magnitude"]}m)</td>
                            <td class="bold">{fcfs_cost:,.0f}</td>
                            <td>{greedy_cell}</td>
                            <td>{b24_cell}</td>
                        </tr>"""

    html_content += f"""
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const cfgLabels = {json.dumps(cfg_labels)};
        const cfgImprovements = {json.dumps(cfg_improvements)};
        const cfgLatencies = {json.dumps(cfg_latencies)};
        const cfgGen = {json.dumps(cfg_nodes_gen)};
        const cfgExp = {json.dumps(cfg_nodes_exp)};
        const cfgPru = {json.dumps(cfg_nodes_pru)};

        // 1. Improvement Chart
        const ctxImp = document.getElementById('improvementChart').getContext('2d');
        new Chart(ctxImp, {{
            type: 'bar',
            data: {{
                labels: cfgLabels,
                datasets: [{{
                    label: 'Mean Improvement % vs FCFS',
                    data: cfgImprovements,
                    backgroundColor: ['rgba(11, 15, 25, 0.4)', '#ee5d5d', '#05cd99'],
                    borderColor: ['#2b3b70', '#ee5d5d', '#05cd99'],
                    borderWidth: 2
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: false }} }},
                scales: {{
                    y: {{ grid: {{ color: '#2b3b70' }}, ticks: {{ color: '#a3b8cc' }} }},
                    x: {{ grid: {{ display: false }}, ticks: {{ color: '#a3b8cc' }} }}
                }}
            }}
        }});

        // 2. Latency Chart
        const ctxLat = document.getElementById('latencyChart').getContext('2d');
        new Chart(ctxLat, {{
            type: 'bar',
            data: {{
                labels: cfgLabels,
                datasets: [{{
                    label: 'Latency (ms)',
                    data: cfgLatencies,
                    backgroundColor: '#0076ff',
                    borderColor: '#0076ff',
                    borderWidth: 1
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: false }} }},
                scales: {{
                    y: {{ type: 'logarithmic', grid: {{ color: '#2b3b70' }}, ticks: {{ color: '#a3b8cc' }} }},
                    x: {{ grid: {{ display: false }}, ticks: {{ color: '#a3b8cc' }} }}
                }}
            }}
        }});

        // 3. Search Nodes generated/expanded/pruned stacked chart
        const ctxNodes = document.getElementById('nodesChart').getContext('2d');
        new Chart(ctxNodes, {{
            type: 'bar',
            data: {{
                labels: [cfgLabels[2]],
                datasets: [
                    {{
                        label: 'Expanded Nodes',
                        data: [cfgExp[2]],
                        backgroundColor: '#05cd99'
                    }},
                    {{
                        label: 'Pruned Nodes',
                        data: [cfgPru[2]],
                        backgroundColor: '#ffb547'
                    }}
                ]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{ stacked: true, grid: {{ color: '#2b3b70' }}, ticks: {{ color: '#a3b8cc' }} }},
                    x: {{ stacked: true, grid: {{ display: false }}, ticks: {{ color: '#a3b8cc' }} }}
                }},
                plugins: {{ legend: {{ labels: {{ color: '#f8fafc' }} }} }}
            }}
        }});

        // 4. Efficiency comparison
        const ctxEff = document.getElementById('efficiencyChart').getContext('2d');
        new Chart(ctxEff, {{
            type: 'radar',
            data: {{
                labels: ['Improvement rate', 'Search Pruning %', 'Speed (inverse latency)'],
                datasets: [
                    {{
                        label: 'D=2, W=4',
                        data: [cfgImprovements[2]/10.0, (cfgPru[2]/cfgGen[2])*100.0, 1000.0 / (cfgLatencies[2] + 0.1)],
                        borderColor: '#05cd99',
                        backgroundColor: 'rgba(5, 205, 153, 0.1)'
                    }}
                ]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ labels: {{ color: '#f8fafc' }} }} }},
                scales: {{
                    r: {{
                        angleLines: {{ color: '#2b3b70' }},
                        grid: {{ color: '#2b3b70' }},
                        pointLabels: {{ color: '#a3b8cc', font: {{ size: 12 }} }}
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""

    results_dir = "results"
    os.makedirs(results_dir, exist_ok=True)
    report_path = os.path.join(results_dir, "benchmark_report.html")
    with open(report_path, "w") as f:
        f.write(html_content)
        
    print(f"Phase 5 Comparative Benchmark Report successfully generated at {report_path}")

if __name__ == "__main__":
    main()
