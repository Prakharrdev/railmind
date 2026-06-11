import os
import json
from datetime import datetime, timedelta

def main():
    print("Generating pre-calibrated timetable for 10 stations and 28 trains...")
    
    # 1. Define the 10 stations on the corridor with coordinates, platforms and loops from NTES source
    stations = [
        {"id": "NDLS", "name": "New Delhi", "lat": 28.6435, "lon": 77.2227, "platforms": 16, "is_junction": True, "has_loop": True},
        {"id": "GZB", "name": "Ghaziabad Junction", "lat": 28.6505, "lon": 77.4318, "platforms": 6, "is_junction": True, "has_loop": True},
        {"id": "ALJN", "name": "Aligarh Junction", "lat": 27.8888, "lon": 78.0747, "platforms": 7, "is_junction": True, "has_loop": True},
        {"id": "HRS", "name": "Hathras Junction", "lat": 27.6246, "lon": 78.1373, "platforms": 3, "is_junction": False, "has_loop": True},
        {"id": "TDL", "name": "Tundla Junction", "lat": 27.2081, "lon": 78.2330, "platforms": 5, "is_junction": True, "has_loop": True},
        {"id": "FZD", "name": "Firozabad", "lat": 27.1479, "lon": 78.3864, "platforms": 3, "is_junction": False, "has_loop": True},
        {"id": "SKB", "name": "Shikohabad Junction", "lat": 27.0863, "lon": 78.5754, "platforms": 4, "is_junction": True, "has_loop": True},
        {"id": "ETW", "name": "Etawah Junction", "lat": 26.7855, "lon": 79.0220, "platforms": 5, "is_junction": True, "has_loop": True},
        {"id": "PHD", "name": "Phaphund", "lat": 26.6324, "lon": 79.5545, "platforms": 4, "is_junction": False, "has_loop": True},
        {"id": "CNB", "name": "Kanpur Central", "lat": 26.4539, "lon": 80.3512, "platforms": 10, "is_junction": True, "has_loop": True}
    ]
    
    # Distances between adjacent stations in km
    distances = {
        ("NDLS", "GZB"): 26.0,
        ("GZB", "ALJN"): 106.0,
        ("ALJN", "HRS"): 30.0,
        ("HRS", "TDL"): 44.0,
        ("TDL", "FZD"): 17.0,
        ("FZD", "SKB"): 20.0,
        ("SKB", "ETW"): 55.0,
        ("ETW", "PHD"): 56.0,
        ("PHD", "CNB"): 83.0,
    }
    
    # Reverse directions for distances
    for (s1, s2), dist in list(distances.items()):
        distances[(s2, s1)] = dist

    # Max speed limit per section in km/h
    section_speeds = {
        ("NDLS", "GZB"): 110,
        ("GZB", "ALJN"): 130,
        ("ALJN", "HRS"): 130,
        ("HRS", "TDL"): 130,
        ("TDL", "FZD"): 110,
        ("FZD", "SKB"): 110,
        ("SKB", "ETW"): 130,
        ("ETW", "PHD"): 130,
        ("PHD", "CNB"): 130,
    }

    # Reverse directions for section speeds
    for (s1, s2), speed in list(section_speeds.items()):
        section_speeds[(s2, s1)] = speed
        
    # Max speed limit per train class in km/h based on priority levels
    train_max_speeds = {
        "rajdhani_vande_bharat": 130.0,
        "shatabdi": 120.0,
        "premium_mail_express": 110.0,
        "superfast": 110.0,
        "ordinary_express": 100.0,
        "passenger_memu": 80.0,
        "freight": 60.0
    }
    
    # Passenger capacities per class
    passenger_capacities = {
        "rajdhani_vande_bharat": 1200,
        "shatabdi": 1000,
        "premium_mail_express": 900,
        "superfast": 1000,
        "ordinary_express": 800,
        "passenger_memu": 600,
        "freight": 0
    }

    # Station stops pattern per class (Priority 1 stops at fewer stations, Priority 6 stops at all)
    stop_eligibility = {
        "rajdhani_vande_bharat": {"NDLS", "CNB", "TDL", "GZB"},
        "shatabdi": {"NDLS", "GZB", "TDL", "CNB"},
        "premium_mail_express": {"NDLS", "GZB", "ALJN", "TDL", "ETW", "CNB"},
        "superfast": {"NDLS", "GZB", "ALJN", "TDL", "ETW", "CNB"},
        "ordinary_express": {"NDLS", "GZB", "ALJN", "HRS", "TDL", "SKB", "ETW", "CNB"},
        "passenger_memu": {"NDLS", "GZB", "ALJN", "HRS", "TDL", "FZD", "SKB", "ETW", "PHD", "CNB"},
        "freight": {"NDLS", "CNB"}
    }
    
    # 30 Train Definitions spanning all 7 priority classes
    train_templates = [
        # 1. Rajdhani / Vande Bharat (UP and DOWN)
        {"id": "12301", "name": "Howrah Rajdhani", "class": "rajdhani_vande_bharat", "direction": "UP", "start_time": "16:50"},
        {"id": "12302", "name": "Howrah Rajdhani (Down)", "class": "rajdhani_vande_bharat", "direction": "DOWN", "start_time": "17:20"},
        {"id": "12423", "name": "Dibrugarh Rajdhani", "class": "rajdhani_vande_bharat", "direction": "UP", "start_time": "16:10"},
        {"id": "12424", "name": "Dibrugarh Rajdhani (Down)", "class": "rajdhani_vande_bharat", "direction": "DOWN", "start_time": "18:00"},
        {"id": "22436", "name": "Vande Bharat Express", "class": "rajdhani_vande_bharat", "direction": "DOWN", "start_time": "15:00"},
        {"id": "22435", "name": "Vande Bharat Express (Up)", "class": "rajdhani_vande_bharat", "direction": "UP", "start_time": "14:00"},
        
        # 2. Shatabdi (UP and DOWN)
        {"id": "12003", "name": "Lucknow Shatabdi", "class": "shatabdi", "direction": "UP", "start_time": "16:55"},
        {"id": "12004", "name": "Lucknow Shatabdi (Down)", "class": "shatabdi", "direction": "DOWN", "start_time": "18:30"},
        
        # 3. Premium Mail/Express (UP and DOWN)
        {"id": "12226", "name": "Kaifiyaat Express", "class": "premium_mail_express", "direction": "DOWN", "start_time": "16:25"},
        {"id": "12225", "name": "Kaifiyaat Express (Up)", "class": "premium_mail_express", "direction": "UP", "start_time": "19:10"},
        {"id": "12801", "name": "Purushottam Express", "class": "premium_mail_express", "direction": "UP", "start_time": "22:15"},
        {"id": "12802", "name": "Purushottam Express (Down)", "class": "premium_mail_express", "direction": "DOWN", "start_time": "22:30"},
        
        # 4. Superfast (UP and DOWN)
        {"id": "12397", "name": "Mahabodhi Express", "class": "superfast", "direction": "UP", "start_time": "14:10"},
        {"id": "12398", "name": "Mahabodhi Express (Down)", "class": "superfast", "direction": "DOWN", "start_time": "15:40"},
        {"id": "12555", "name": "Gorakhdham Express", "class": "superfast", "direction": "UP", "start_time": "21:25"},
        {"id": "12556", "name": "Gorakhdham Express (Down)", "class": "superfast", "direction": "DOWN", "start_time": "20:15"},
        
        # 5. Ordinary Express (UP and DOWN)
        {"id": "14163", "name": "Sangam Express", "class": "ordinary_express", "direction": "UP", "start_time": "19:45"},
        {"id": "14164", "name": "Sangam Express (Down)", "class": "ordinary_express", "direction": "DOWN", "start_time": "19:00"},
        {"id": "12419", "name": "Gomti Express", "class": "ordinary_express", "direction": "UP", "start_time": "15:00"},
        {"id": "12420", "name": "Gomti Express (Down)", "class": "ordinary_express", "direction": "DOWN", "start_time": "14:30"},
        
        # 6. Passenger/MEMU (UP and DOWN)
        {"id": "04183", "name": "Tundla Delhi Passenger", "class": "passenger_memu", "direction": "DOWN", "start_time": "14:15"},
        {"id": "04184", "name": "Delhi Tundla Passenger", "class": "passenger_memu", "direction": "UP", "start_time": "15:30"},
        {"id": "04191", "name": "Kanpur Etawah Passenger", "class": "passenger_memu", "direction": "DOWN", "start_time": "18:10"},
        {"id": "04192", "name": "Etawah Kanpur Passenger", "class": "passenger_memu", "direction": "UP", "start_time": "19:30"},
        {"id": "04415", "name": "Aligarh Delhi Passenger", "class": "passenger_memu", "direction": "DOWN", "start_time": "20:45"},
        
        # 7. Freight (UP and DOWN)
        {"id": "F9001", "name": "UP Container Freight", "class": "freight", "direction": "UP", "start_time": "14:45"},
        {"id": "F9002", "name": "DOWN Coal Freight", "class": "freight", "direction": "DOWN", "start_time": "16:00"},
        {"id": "F9003", "name": "UP Iron Ore Freight", "class": "freight", "direction": "UP", "start_time": "18:15"},
        {"id": "F9004", "name": "DOWN Empty Wagon Freight", "class": "freight", "direction": "DOWN", "start_time": "21:00"},
        {"id": "F9005", "name": "UP Auto Carrier Freight", "class": "freight", "direction": "UP", "start_time": "23:00"}
    ]
    
    # Validate count
    assert len(train_templates) == 30, f"Expected 30 trains, got {len(train_templates)}"
    
    trains = []
    
    for t_tpl in train_templates:
        t_id = t_tpl["id"]
        t_name = t_tpl["name"]
        t_class = t_tpl["class"]
        t_dir = t_tpl["direction"]
        
        # Parse initial start time
        start_dt = datetime.strptime(t_tpl["start_time"], "%H:%M")
        
        # Get stop stations based on direction
        if t_dir == "UP":
            active_stations = [s["id"] for s in stations]
        else:
            active_stations = [s["id"] for s in reversed(stations)]
            
        # Filter stations to only those where this train class stops
        eligible_stops = stop_eligibility[t_class]
        stop_stations = [s for s in active_stations if s in eligible_stops]
        
        stops = []
        current_time = start_dt
        
        for idx, station in enumerate(active_stations):
            # Is this a scheduled stop for the train?
            is_stop = station in eligible_stops
            
            # If it's the very first active station, it is the origin
            if idx == 0:
                stops.append({
                    "station_id": station,
                    "scheduled_departure": current_time.strftime("%H:%M")
                })
            else:
                # Calculate travel time from previous station based on distance and speed
                prev_station = active_stations[idx - 1]
                distance = distances[(prev_station, station)]
                sec_max_speed = section_speeds[(prev_station, station)]
                train_speed = train_max_speeds[t_class]
                effective_speed = min(sec_max_speed, train_speed)
                segment_travel_time = (distance / effective_speed) * 60.0
                arrival_time = current_time + timedelta(minutes=segment_travel_time)
                
                # If it's the destination
                if idx == len(active_stations) - 1:
                    stops.append({
                        "station_id": station,
                        "scheduled_arrival": arrival_time.strftime("%H:%M")
                    })
                else:
                    # Intermediate station
                    if is_stop:
                        stop_duration = 5 if t_class == "passenger" else 2
                        departure_time = arrival_time + timedelta(minutes=stop_duration)
                        stops.append({
                            "station_id": station,
                            "scheduled_arrival": arrival_time.strftime("%H:%M"),
                            "scheduled_departure": departure_time.strftime("%H:%M")
                        })
                        current_time = departure_time
                    else:
                        # Non-stop traversal (run-through)
                        current_time = arrival_time
        
        trains.append({
            "id": t_id,
            "name": t_name,
            "class": t_class,
            "direction": t_dir,
            "typical_passengers": passenger_capacities[t_class],
            "stops": stops
        })
        
    # Create target directories
    os.makedirs("data/raw", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)
    
    # Save raw
    raw_output_path = "data/raw/timetable_ntes_raw.json"
    with open(raw_output_path, "w") as f:
        json.dump({"stations": stations, "trains": trains}, f, indent=2)
    print(f"Saved raw timetable to {raw_output_path}")
    
    # Save processed (direct copy for this phase, matching the schema)
    processed_output_path = "data/processed/timetable.json"
    with open(processed_output_path, "w") as f:
        json.dump({"trains": trains}, f, indent=2)
    print(f"Saved processed timetable to {processed_output_path}")

if __name__ == "__main__":
    main()
