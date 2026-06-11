import os
import json
import urllib.request
import urllib.error

def main():
    print("Parsing OSM railway layer and building corridor graph...")
    
    # Load raw NTES timetable snapshot as the single source of truth
    raw_timetable_path = "data/raw/timetable_ntes_raw.json"
    if not os.path.exists(raw_timetable_path):
        raise FileNotFoundError(f"Raw NTES timetable file not found at {raw_timetable_path}. Please run scrape_ntes.py first.")
        
    with open(raw_timetable_path, "r") as f:
        raw_data = json.load(f)
        
    raw_stations = raw_data.get("stations", [])
    print(f"Loaded {len(raw_stations)} stations from NTES raw data.")
    
    stations_data = []
    for s in raw_stations:
        stations_data.append({
            "id": s["id"],
            "name": s["name"],
            "lat": s["lat"],
            "lon": s["lon"],
            "platforms": s["platforms"],
            "is_junction": s["is_junction"],
            "has_loop": s["has_loop"]
        })

    # Define track sections between stations
    sections = [
        {
            "id": "NDLS_GZB",
            "from": "NDLS",
            "to": "GZB",
            "distance_km": 26.0,
            "max_speed_kmph": 110,
            "track_type": "double",
            "typical_traversal_min": 20
        },
        {
            "id": "GZB_ALJN",
            "from": "GZB",
            "to": "ALJN",
            "distance_km": 106.0,
            "max_speed_kmph": 130,
            "track_type": "double",
            "typical_traversal_min": 70
        },
        {
            "id": "ALJN_HRS",
            "from": "ALJN",
            "to": "HRS",
            "distance_km": 30.0,
            "max_speed_kmph": 130,
            "track_type": "double",
            "typical_traversal_min": 20
        },
        {
            "id": "HRS_TDL",
            "from": "HRS",
            "to": "TDL",
            "distance_km": 44.0,
            "max_speed_kmph": 130,
            "track_type": "double",
            "typical_traversal_min": 30
        },
        {
            "id": "TDL_FZD",
            "from": "TDL",
            "to": "FZD",
            "distance_km": 17.0,
            "max_speed_kmph": 110,
            "track_type": "double",
            "typical_traversal_min": 12
        },
        {
            "id": "FZD_SKB",
            "from": "FZD",
            "to": "SKB",
            "distance_km": 20.0,
            "max_speed_kmph": 110,
            "track_type": "double",
            "typical_traversal_min": 15
        },
        {
            "id": "SKB_ETW",
            "from": "SKB",
            "to": "ETW",
            "distance_km": 55.0,
            "max_speed_kmph": 130,
            "track_type": "double",
            "typical_traversal_min": 35
        },
        {
            "id": "ETW_PHD",
            "from": "ETW",
            "to": "PHD",
            "distance_km": 56.0,
            "max_speed_kmph": 130,
            "track_type": "double",
            "typical_traversal_min": 36
        },
        {
            "id": "PHD_CNB",
            "from": "PHD",
            "to": "CNB",
            "distance_km": 83.0,
            "max_speed_kmph": 130,
            "track_type": "double",
            "typical_traversal_min": 55
        }
    ]
    
    corridor_data = {
        "stations": stations_data,
        "sections": sections
    }
    
    # Save to data/raw/corridor_osm.geojson (raw mock representation)
    os.makedirs("data/raw", exist_ok=True)
    raw_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": s["name"], "id": s["id"]},
                "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]}
            } for s in stations_data
        ]
    }
    
    with open("data/raw/corridor_osm.geojson", "w") as f:
        json.dump(raw_geojson, f, indent=2)
    print("Saved raw GeoJSON to data/raw/corridor_osm.geojson")
    
    # Save processed corridor configuration
    os.makedirs("data/processed", exist_ok=True)
    processed_path = "data/processed/corridor.json"
    with open(processed_path, "w") as f:
        json.dump(corridor_data, f, indent=2)
    print(f"Saved processed corridor data to {processed_path}")

if __name__ == "__main__":
    main()
