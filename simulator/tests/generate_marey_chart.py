import sys
import os
import json

# Adjust path to import simulator modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from simulator.env import TrainNetworkSimulator, Action
from simulator.conflict_detector import ConflictDetector
from simulator.disruption_injector import Disruption

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"

def main():
    print("Initializing simulation to generate real Marey chart data...")
    sim = TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)
    detector = ConflictDetector(sim.graph, sim.timetable_data)
    
    # Let's inject a couple of disruptions to create conflicts:
    # 1. Slow down the leading train 22435 (Vande Bharat) from 14:05 (845.0) to 14:35 (875.0)
    sim.inject_disruption(Disruption(
        disruption_id="slow_vande",
        train_id="22435",
        disruption_type="engine_slow",
        magnitude_minutes=30.0,
        start_time=845.0,
        end_time=875.0
    ))
    
    # 2. Block block GZB_ALJN_05 from 14:10 (850.0) to 14:25 (865.0)
    # Wait, we want real conflicts. Let's block a section:
    sim.inject_disruption(Disruption(
        disruption_id="signal_failure",
        train_id="SYSTEM",
        disruption_type="signal_hold",
        magnitude_minutes=20.0,
        start_time=850.0,
        end_time=870.0,
        target_id="GZB_ALJN_05"
    ))

    # We will compute station absolute distances from NDLS
    station_distances = {}
    current_dist = 0.0
    route = ["NDLS", "GZB", "ALJN", "HRS", "TDL", "FZD", "SKB", "ETW", "PHD", "CNB"]
    
    for i, s_id in enumerate(route):
        if i == 0:
            station_distances[s_id] = 0.0
        else:
            prev = route[i-1]
            edge_data = sim.graph.graph.get_edge_data(prev, s_id)
            current_dist += edge_data["distance_km"]
            station_distances[s_id] = current_dist

    total_distance = current_dist
    print(f"Stations cumulative distances: {station_distances}")
    
    # Run simulation for 120 minutes (240 ticks)
    # We log data every 1 minute (2 ticks)
    time_series = []
    conflict_history = []
    conflict_seen_keys = set()  # Dedup conflicts across ticks
    MAX_CONFLICTS = 200  # Cap to keep HTML file size sane
    
    sim_duration_minutes = 120
    for tick in range(sim_duration_minutes * 2):
        state = sim.current_state()
        sim_time = state.sim_time
        
        # Calculate metrics for print
        active_disruptions = sim.disruption_injector.get_active_disruptions(sim_time)
        conflicts = detector.detect_conflicts(state, active_disruptions)
        active_trains = [
            t for t in state.trains.values()
            if (len(t.station_departure_times) > 0 or t.current_section is not None)
            and not (t.current_route_index >= len(t.route) - 1 and t.current_section is None)
        ]
        n_delayed = sum(1 for t in state.trains.values() if t.delay_minutes > 0)
        total_delay = sum(t.delay_minutes for t in state.trains.values())
        
        print(
            f"""
    Sim Time: {state.sim_time}

    Trains Running:
    {len(active_trains)}

    Active Conflicts:
    {len(conflicts)}

    Delayed Trains:
    {n_delayed}

    Total Delay:
    {total_delay}
    """
        )
        
        # Detect conflicts only every 10 ticks (5 minutes) to avoid data explosion
        if tick % 10 == 0 and len(conflict_history) < MAX_CONFLICTS:
            
            # Log conflicts (deduplicated across ticks)
            for c in conflicts:
                # Dedup key: same train pair + block + time rounded to 5-min bucket
                dedup_key = (c.train_a_id, c.train_b_id, c.block_id, round(c.conflict_start_sim_time / 5.0))
                if dedup_key in conflict_seen_keys:
                    continue
                conflict_seen_keys.add(dedup_key)
                
                # We estimate the conflict location (NDLS distance) by looking at its block ID
                # Let's find the section containing this block
                block_base = c.block_id[:-5] if c.block_id.endswith("_DOWN") else c.block_id
                block_section_id = None
                for sec_id, sec in sim.graph.sections.items():
                    for b in sec.get("blocks", []):
                        if b["id"] == block_base:
                            block_section_id = sec_id
                            break
                
                conflict_loc = 0.0
                if block_section_id:
                    sec = sim.graph.get_section(block_section_id)
                    last_st = sec["from"]
                    # Cumulative block offset
                    block_offset = 0.0
                    for b in sec.get("blocks", []):
                        if b["id"] == block_base:
                            block_offset += b["length_km"] / 2.0 # Mid-point of block
                            break
                        block_offset += b["length_km"]
                    conflict_loc = station_distances[last_st] + block_offset

                conflict_history.append({
                    "time": sim_time,
                    "train_a": c.train_a_id,
                    "train_b": c.train_b_id,
                    "block": c.block_id,
                    "location": conflict_loc,
                    "overlap": c.overlap_minutes,
                    "urgency": c.urgency_score
                })
                
                if len(conflict_history) >= MAX_CONFLICTS:
                    break
            
        # Log train positions every 1 minute
        if tick % 2 == 0:
            train_snapshots = {}
            for tid, train in state.trains.items():
                # Compute absolute location from NDLS
                if train.current_section is None:
                    loc = station_distances[train.last_station]
                else:
                    sec = sim.graph.get_section(train.current_section)
                    sec_dist = sec["distance_km"]
                    if train.direction == "DOWN":
                        # Starts at last_station and moves towards NDLS (decreasing distance)
                        loc = station_distances[train.last_station] - train.section_progress * sec_dist
                    else:
                        # Starts at last_station and moves towards CNB (increasing distance)
                        loc = station_distances[train.last_station] + train.section_progress * sec_dist
                
                train_snapshots[tid] = {
                    "loc": loc,
                    "speed": train.current_speed_kmph,
                    "delay": train.delay_minutes,
                    "held": train.is_held,
                    "section": train.current_section or "Station",
                    "last_st": train.last_station,
                    "name": train.name,
                    "class": train.train_class
                }
            time_series.append({
                "time": sim_time,
                "trains": train_snapshots
            })
            
        sim.tick()
        
    print(f"Simulation completed. Collected {len(time_series)} snapshots and {len(conflict_history)} conflict samples.")
    
    # Compile HTML page with embedded JS for visualization
    generate_html(time_series, conflict_history, station_distances, total_distance)

def generate_html(time_series, conflicts, station_distances, total_distance):
    # Prepare JSON variables
    time_series_json = json.dumps(time_series)
    conflicts_json = json.dumps(conflicts)
    stations_json = json.dumps(station_distances)
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>RailMind Simulation Visualizer</title>
    <style>
        body {{
            font-family: 'Outfit', -apple-system, sans-serif;
            background-color: #0b0f19;
            color: #f3f4f6;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        h1 {{
            margin-bottom: 5px;
            background: linear-gradient(135deg, #60a5fa, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 800;
        }}
        .subtitle {{
            color: #9ca3af;
            margin-bottom: 30px;
            font-size: 0.95rem;
        }}
        .container {{
            display: flex;
            width: 1200px;
            gap: 20px;
            background: rgba(17, 24, 39, 0.7);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 24px;
            backdrop-filter: blur(12px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }}
        .chart-panel {{
            flex: 2;
            position: relative;
        }}
        .sidebar {{
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 20px;
            background: rgba(31, 41, 55, 0.5);
            border-radius: 12px;
            padding: 16px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            max-height: 600px;
            overflow-y: auto;
        }}
        svg {{
            background-color: #030712;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }}
        .station-label {{
            font-size: 10px;
            fill: #9ca3af;
            font-weight: 500;
        }}
        .station-line {{
            stroke: rgba(255, 255, 255, 0.1);
            stroke-dasharray: 2 2;
        }}
        .train-line {{
            fill: none;
            stroke-width: 2.5;
            stroke-linecap: round;
            opacity: 0.85;
            transition: stroke-width 0.2s, opacity 0.2s;
            cursor: pointer;
        }}
        .train-line:hover {{
            stroke-width: 4;
            opacity: 1;
        }}
        .conflict-dot {{
            fill: #ef4444;
            stroke: #fee2e2;
            stroke-width: 1.5;
            cursor: pointer;
            filter: drop-shadow(0 0 6px #ef4444);
            transition: r 0.2s;
        }}
        .conflict-dot:hover {{
            r: 8px;
        }}
        .legend {{
            display: flex;
            gap: 15px;
            margin-top: 15px;
            justify-content: center;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        }}
        .legend-color {{
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }}
        .conflict-card {{
            background: rgba(239, 68, 68, 0.1);
            border-left: 4px solid #ef4444;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 8px;
            font-size: 13px;
        }}
        .conflict-card h4 {{
            margin: 0 0 4px 0;
            color: #fca5a5;
        }}
        .conflict-card p {{
            margin: 2px 0;
            color: #d1d5db;
        }}
        .tooltip {{
            position: absolute;
            background: rgba(17, 24, 39, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 10px;
            border-radius: 6px;
            pointer-events: none;
            display: none;
            font-size: 12px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            z-index: 100;
        }}
        .sidebar h3 {{
            margin-top: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 8px;
            font-size: 1.1rem;
        }}
    </style>
</head>
<body>
    <h1>RailMind Simulation Visualizer</h1>
    <div class="subtitle">Time-Distance (Marey) Diagram generated from real simulator execution logs</div>
    
    <div class="container">
        <div class="chart-panel">
            <svg id="mareySvg" width="750" height="600"></svg>
            <div id="tooltip" class="tooltip"></div>
            
            <div class="legend">
                <div class="legend-item"><div class="legend-color" style="background-color: #a78bfa;"></div>Rajdhani</div>
                <div class="legend-item"><div class="legend-color" style="background-color: #3b82f6;"></div>Shatabdi</div>
                <div class="legend-item"><div class="legend-color" style="background-color: #10b981;"></div>Express</div>
                <div class="legend-item"><div class="legend-color" style="background-color: #f59e0b;"></div>Passenger</div>
                <div class="legend-item"><div class="legend-color" style="background-color: #6b7280;"></div>Freight</div>
                <div class="legend-item"><div class="legend-color" style="background-color: #ef4444; border-radius: 50%;"></div>Conflict Point</div>
            </div>
        </div>
        
        <div class="sidebar">
            <h3>Detected Conflicts Log</h3>
            <div id="conflictsList"></div>
        </div>
    </div>

    <script>
        const timeSeries = {time_series_json};
        const conflicts = {conflicts_json};
        const stations = {stations_json};
        const totalDistance = {total_distance};
        
        const svg = document.getElementById("mareySvg");
        const tooltip = document.getElementById("tooltip");
        const conflictsList = document.getElementById("conflictsList");
        
        // Svg dimensions
        const width = 750;
        const height = 600;
        const paddingLeft = 80;
        const paddingRight = 30;
        const paddingTop = 30;
        const paddingBottom = 40;
        
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;
        
        // Time range: 14:00 (840) to 16:00 (960)
        const startTime = 840;
        const endTime = 960;
        
        // Color mapping
        const classColors = {{
            "rajdhani_vande_bharat": "#a78bfa",
            "shatabdi": "#3b82f6",
            "premium_mail_express": "#10b981",
            "superfast": "#10b981",
            "ordinary_express": "#10b981",
            "passenger_memu": "#f59e0b",
            "freight": "#6b7280"
        }};
        
        // 1. Draw Gridlines for stations
        for (const [st, dist] of Object.entries(stations)) {{
            const y = paddingTop + (dist / totalDistance) * chartHeight;
            
            // Grid line
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", paddingLeft);
            line.setAttribute("y1", y);
            line.setAttribute("x2", width - paddingRight);
            line.setAttribute("y2", y);
            line.setAttribute("class", "station-line");
            svg.appendChild(line);
            
            // Label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", paddingLeft - 8);
            text.setAttribute("y", y + 3);
            text.setAttribute("text-anchor", "end");
            text.setAttribute("class", "station-label");
            text.textContent = st;
            svg.appendChild(text);
        }}
        
        // 2. Draw vertical time lines (every 20 minutes)
        for (let t = startTime; t <= endTime; t += 20) {{
            const x = paddingLeft + ((t - startTime) / (endTime - startTime)) * chartWidth;
            
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x);
            line.setAttribute("y1", paddingTop);
            line.setAttribute("x2", x);
            line.setAttribute("y2", height - paddingBottom);
            line.setAttribute("class", "station-line");
            svg.appendChild(line);
            
            // Hour:Min label
            const hour = Math.floor(t / 60);
            const min = Math.round(t % 60);
            const timeStr = `${{hour}}:${{min.toString().padStart(2, '0')}}`;
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x);
            text.setAttribute("y", height - paddingBottom + 16);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("class", "station-label");
            text.textContent = timeStr;
            svg.appendChild(text);
        }}
        
        // 3. Reconstruct train trajectories from timeSeries
        const trainTrajectories = {{}};
        timeSeries.forEach(snap => {{
            const t = snap.time;
            Object.entries(snap.trains).forEach(([tid, info]) => {{
                if (!trainTrajectories[tid]) {{
                    trainTrajectories[tid] = {{
                        points: [],
                        class: info.class,
                        name: info.name
                    }};
                }}
                trainTrajectories[tid].points.push({{
                    t: t,
                    loc: info.loc,
                    speed: info.speed,
                    delay: info.delay,
                    held: info.held,
                    section: info.section
                }});
            }});
        }});
        
        // 4. Draw Train Trajectories
        Object.entries(trainTrajectories).forEach(([tid, traj]) => {{
            let dAttr = "";
            let segments = [];
            let currentSegment = [];
            
            // Filter points in our time window
            const validPoints = traj.points.filter(p => p.t >= startTime && p.t <= endTime);
            
            validPoints.forEach((p, idx) => {{
                const x = paddingLeft + ((p.t - startTime) / (endTime - startTime)) * chartWidth;
                const y = paddingTop + (p.loc / totalDistance) * chartHeight;
                
                if (idx === 0) {{
                    dAttr += `M ${{x}} ${{y}}`;
                }} else {{
                    dAttr += ` L ${{x}} ${{y}}`;
                }}
            }});
            
            if (validPoints.length > 0) {{
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", dAttr);
                path.setAttribute("class", "train-line");
                path.setAttribute("stroke", classColors[traj.class] || "#ffffff");
                svg.appendChild(path);
                
                // Mouse interactive event
                path.addEventListener("mousemove", (e) => {{
                    tooltip.style.display = "block";
                    tooltip.style.left = (e.pageX + 10) + "px";
                    tooltip.style.top = (e.pageY + 10) + "px";
                    tooltip.innerHTML = `
                        <strong>Train:</strong> ${{traj.name}} (${{tid}})<br>
                        <strong>Class:</strong> ${{traj.class}}<br>
                        <strong>Status:</strong> ${{validPoints[validPoints.length-1].section}}
                    `;
                }});
                
                path.addEventListener("mouseout", () => {{
                    tooltip.style.display = "none";
                }});
            }}
        }});
        
        // 5. Plot Conflict points
        // Group conflicts by block and pair to avoid duplicate dots on identical times
        const uniqueConflicts = [];
        const seen = new Set();
        conflicts.forEach(c => {{
            // Keep conflicts within bounds
            if (c.time >= startTime && c.time <= endTime) {{
                const key = `${{Math.round(c.time)}}_${{c.train_a}}_${{c.train_b}}`;
                if (!seen.has(key)) {{
                    seen.add(key);
                    uniqueConflicts.push(c);
                }}
            }}
        }});
        
        uniqueConflicts.forEach(c => {{
            const x = paddingLeft + ((c.time - startTime) / (endTime - startTime)) * chartWidth;
            const y = paddingTop + (c.location / totalDistance) * chartHeight;
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", 5);
            circle.setAttribute("class", "conflict-dot");
            svg.appendChild(circle);
            
            circle.addEventListener("mousemove", (e) => {{
                tooltip.style.display = "block";
                tooltip.style.left = (e.pageX + 10) + "px";
                tooltip.style.top = (e.pageY + 10) + "px";
                tooltip.innerHTML = `
                    <strong style="color: #f87171;">CONFLICT</strong><br>
                    <strong>Trains:</strong> ${{c.train_a}} & ${{c.train_b}}<br>
                    <strong>Block:</strong> ${{c.block}}<br>
                    <strong>Time:</strong> ${{Math.floor(c.time/60)}}:${{Math.round(c.time%60).toString().padStart(2, '0')}}<br>
                    <strong>Overlap:</strong> ${{c.overlap.toFixed(1)}} min<br>
                    <strong>Urgency:</strong> ${{c.urgency.toFixed(1)}}
                `;
            }});
            
            circle.addEventListener("mouseout", () => {{
                tooltip.style.display = "none";
            }});
        }});
        
        // 6. Populates Sidebar
        if (uniqueConflicts.length === 0) {{
            conflictsList.innerHTML = "<p style='color: #9ca3af;'>No conflicts detected in this time slice.</p>";
        }} else {{
            uniqueConflicts.sort((a,b) => b.urgency - a.urgency).slice(0, 15).forEach(c => {{
                const card = document.createElement("div");
                card.className = "conflict-card";
                const hr = Math.floor(c.time/60);
                const mn = Math.round(c.time%60).toString().padStart(2, '0');
                card.innerHTML = `
                    <h4>Block ${{c.block}} (${{hr}}:${{mn}})</h4>
                    <p><strong>Trains:</strong> ${{c.train_a}} & ${{c.train_b}}</p>
                    <p><strong>Overlap:</strong> ${{c.overlap.toFixed(1)}} mins</p>
                    <p><strong>Urgency Score:</strong> ${{c.urgency.toFixed(1)}}</p>
                `;
                conflictsList.appendChild(card);
            }});
        }}
    </script>
</body>
</html>
"""
    
    # Save the output HTML file
    os.makedirs("simulator/tests", exist_ok=True)
    html_path = "simulator/tests/marey_chart.html"
    with open(html_path, "w") as f:
        f.write(html_content)
    print(f"Marey chart HTML successfully generated and saved to {html_path}")

if __name__ == "__main__":
    main()
