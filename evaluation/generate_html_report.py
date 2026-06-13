import os
import sqlite3
import json

DB_PATH = "data/evaluation/results.db"
HTML_PATH = "evaluation/report/benchmark_dashboard.html"

def main():
    if not os.path.exists(DB_PATH):
        print(f"Results database {DB_PATH} not found. Please run benchmark first.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Query comparisons
    cursor.execute("""
    SELECT 
        episode_id,
        disruption_type,
        disruption_train,
        disruption_mag_min,
        num_conflicts_fcfs,
        num_conflicts_greedy,
        planner_invocations,
        actions_applied,
        delay_cost_before,
        delay_cost_after,
        conflict_cost_before,
        conflict_cost_after,
        fcfs_total_cost,
        greedy_total_cost,
        improvement_pct,
        avg_plan_time_ms
    FROM episodes
    ORDER BY CAST(SUBSTR(episode_id, 10) AS INTEGER)
    """)
    
    rows = cursor.fetchall()
    conn.close()

    scenarios = []
    fcfs_costs = []
    greedy_costs = []
    labels = []
    latencies = []
    improvements = []
    
    total_fcfs = 0.0
    total_greedy = 0.0
    max_imp = 0.0
    
    # Group by type
    by_type = {}
    
    for r in rows:
        scen_dict = {
            "id": r[0],
            "type": r[1],
            "train": r[2],
            "magnitude": r[3],
            "conflicts_fcfs": r[4],
            "conflicts_greedy": r[5],
            "invocations": r[6],
            "actions": r[7],
            "delay_before": r[8],
            "delay_after": r[9],
            "conflict_before": r[10],
            "conflict_after": r[11],
            "fcfs_cost": r[12],
            "greedy_cost": r[13],
            "improvement": r[14],
            "latency": r[15]
        }
        scenarios.append(scen_dict)
        labels.append(r[0])
        fcfs_costs.append(r[12])
        greedy_costs.append(r[13])
        latencies.append(r[15])
        improvements.append(r[14])
        
        total_fcfs += r[12]
        total_greedy += r[13]
        max_imp = max(max_imp, r[14])
        
        if r[1] not in by_type:
            by_type[r[1]] = []
        by_type[r[1]].append(r[14])

    n_scens = len(scenarios)
    mean_fcfs = total_fcfs / n_scens if n_scens > 0 else 0
    mean_greedy = total_greedy / n_scens if n_scens > 0 else 0
    mean_imp = (total_fcfs - total_greedy) / total_fcfs * 100.0 if total_fcfs > 0 else 0
    avg_latency = sum(latencies) / len(latencies) if latencies else 0

    # Type Averages
    avg_engine = sum(by_type.get("engine_slow", [0])) / len(by_type.get("engine_slow", [1]))
    avg_platform = sum(by_type.get("platform_block", [0])) / len(by_type.get("platform_block", [1]))
    avg_signal = sum(by_type.get("signal_hold", [0])) / len(by_type.get("signal_hold", [1]))

    # Histogram buckets
    bucket_0_1 = len([x for x in improvements if 0.0 <= x < 1.0])
    bucket_1_3 = len([x for x in improvements if 1.0 <= x < 3.0])
    bucket_3_5 = len([x for x in improvements if 3.0 <= x < 5.0])
    bucket_5_plus = len([x for x in improvements if x >= 5.0])

    import datetime
    date_str = datetime.date.today().isoformat()
    date_fn = datetime.date.today().strftime("%Y_%m_%d")
    improvements_desc = "Added detailed metrics tracking (invocations, actions applied, conflicts counts), printed console ScoreBreakdowns, disruption averages, and distribution histogram."

    # HTML Content
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RailMind Phase 3 Benchmark Dashboard</title>
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
            background: linear-gradient(to right, #60a5fa, #34d399);
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
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

        /* Main Grid */
        .grid-charts {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
            margin-bottom: 2.5rem;
        }}

        @media (min-width: 1024px) {{
            .grid-charts {{
                grid-template-columns: 2fr 1fr;
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

        /* Secondary Grid */
        .secondary-grid {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
            margin-bottom: 3rem;
        }}

        @media (min-width: 768px) {{
            .secondary-grid {{
                grid-template-columns: 1fr 1fr;
            }}
        }}

        /* Table Section */
        .table-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 1rem;
            padding: 2rem;
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
        <h1>RailMind Phase 3 Benchmark Dashboard — {date_str}</h1>
        <p style="margin-bottom: 0.5rem;"><strong>Improvements</strong>: {improvements_desc}</p>
        <p style="font-size: 0.95rem; color: var(--text-secondary);">Interactive conflict-resolution evaluation: FCFS vs Greedy Baseline (50 Scenarios)</p>
    </header>

    <!-- KPI Row -->
    <div class="kpi-container">
        <div class="kpi-card kpi-blue">
            <div class="kpi-title">Avg FCFS Delay Cost</div>
            <div class="kpi-value">{mean_fcfs:,.0f}</div>
            <div class="kpi-desc">First-come-first-served schedule baseline</div>
        </div>
        <div class="kpi-card kpi-green">
            <div class="kpi-title">Avg Greedy Delay Cost</div>
            <div class="kpi-value">{mean_greedy:,.0f}</div>
            <div class="kpi-desc">With depth-1 Greedy optimizer</div>
        </div>
        <div class="kpi-card kpi-green">
            <div class="kpi-title">Mean Improvement %</div>
            <div class="kpi-value">{mean_imp:.2f}%</div>
            <div class="kpi-desc">Average delay reduction across runs</div>
        </div>
        <div class="kpi-card kpi-blue">
            <div class="kpi-title">Max Improvement %</div>
            <div class="kpi-value">{max_imp:.2f}%</div>
            <div class="kpi-desc">Best resolving scenario optimization</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Avg Step Latency</div>
            <div class="kpi-value">{avg_latency:.4f} ms</div>
            <div class="kpi-desc">Greedy policy decision step calculation time</div>
        </div>
    </div>

    <!-- Main Charts Grid -->
    <div class="grid-charts">
        <div class="chart-card">
            <h2>FCFS vs Greedy Delay Cost Comparison</h2>
            <div class="chart-container">
                <canvas id="costComparisonChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h2>Improvement Distribution (Histogram)</h2>
            <div class="chart-container">
                <canvas id="histogramChart"></canvas>
            </div>
        </div>
    </div>

    <!-- Secondary Grid -->
    <div class="secondary-grid">
        <!-- Disruption Stats Card -->
        <div class="chart-card">
            <h2>Avg Improvement by Disruption Type</h2>
            <div class="chart-container" style="min-height: 250px;">
                <canvas id="disruptionTypeChart"></canvas>
            </div>
        </div>
        <!-- Decision Latency Card -->
        <div class="chart-card">
            <h2>Decision Latency (ms)</h2>
            <div class="chart-container" style="min-height: 250px;">
                <canvas id="latencyChart"></canvas>
            </div>
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
                        <th>Disruption</th>
                        <th>FCFS Delay/Conflict/Total</th>
                        <th>Greedy Delay/Conflict/Total</th>
                        <th>Invocations</th>
                        <th>Actions Applied</th>
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
        html_content += f"""
                    <tr>
                        <td><strong>{scen["id"]}</strong></td>
                        <td><span class="badge {badge_class}">{scen["type"]}</span></td>
                        <td class="text-secondary">{fcfs_break}</td>
                        <td class="text-secondary">{greedy_break}</td>
                        <td>{scen["invocations"]}</td>
                        <td><strong>{scen["actions"]}</strong></td>
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
                        label: 'Greedy Cost',
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

        // 2. Histogram Pie Chart
        const ctxHist = document.getElementById('histogramChart').getContext('2d');
        new Chart(ctxHist, {{
            type: 'pie',
            data: {{
                labels: ['0-1% (Minimal)', '1-3% (Moderate)', '3-5% (High)', '5%+ (Significant)'],
                datasets: [{{
                    data: [{bucket_0_1}, {bucket_1_3}, {bucket_3_5}, {bucket_5_plus}],
                    backgroundColor: ['#64748b', '#3b82f6', '#f59e0b', '#10b981'],
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

        // 3. Disruption Type Bar Chart
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

        // 4. Latency Line Chart
        const ctxLat = document.getElementById('latencyChart').getContext('2d');
        new Chart(ctxLat, {{
            type: 'line',
            data: {{
                labels: labels,
                datasets: [{{
                    label: 'Latency (ms)',
                    data: latencies,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 1.5
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    y: {{
                        grid: {{ color: '#334155' }},
                        ticks: {{ color: '#94a3b8' }}
                    }},
                    x: {{ display: false }}
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

    os.makedirs(os.path.dirname(HTML_PATH), exist_ok=True)
    with open(HTML_PATH, "w") as f:
        f.write(html_content)

    # Save copy to archive folder
    archive_dir = os.path.join(os.path.dirname(HTML_PATH), "archive")
    os.makedirs(archive_dir, exist_ok=True)
    archive_path = os.path.join(archive_dir, f"benchmark_dashboard_{date_fn}_greedy_explainability.html")
    with open(archive_path, "w") as f:
        f.write(html_content)

    print(f"Interactive dashboard successfully written to {HTML_PATH}")
    print(f"Archived dashboard to {archive_path}")

if __name__ == "__main__":
    main()
