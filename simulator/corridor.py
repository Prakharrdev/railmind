import json
import networkx as nx

class RailwayGraph:
    def __init__(self, corridor_json_path: str):
        self.corridor_json_path = corridor_json_path
        with open(corridor_json_path, 'r') as f:
            self.data = json.load(f)
            
        self.stations = {s["id"]: s for s in self.data["stations"]}
        self.sections = {sec["id"]: sec for sec in self.data["sections"]}
        
        # Build directed graph
        self.graph = nx.DiGraph()
        
        # Add stations as nodes
        for s_id, s_info in self.stations.items():
            self.graph.add_node(
                s_id, 
                name=s_info["name"], 
                lat=s_info["lat"], 
                lon=s_info["lon"], 
                platforms=s_info["platforms"],
                is_junction=s_info["is_junction"],
                has_loop=s_info["has_loop"]
            )
            
        # Add sections as edges (both directions)
        for sec_id, sec in self.sections.items():
            u = sec["from"]
            v = sec["to"]
            # UP direction edge
            self.graph.add_edge(
                u, v,
                id=sec_id,
                distance_km=sec["distance_km"],
                tracks=sec["tracks"],
                max_speed=sec["max_speed"],
                electrified=sec["electrified"],
                section_capacity=sec["section_capacity"],
                typical_traversal_min=sec["typical_traversal_min"],
                direction="UP"
            )
            # DOWN direction edge (reversed)
            self.graph.add_edge(
                v, u,
                id=f"{sec_id}_DOWN",
                distance_km=sec["distance_km"],
                tracks=sec["tracks"],
                max_speed=sec["max_speed"],
                electrified=sec["electrified"],
                section_capacity=sec["section_capacity"],
                typical_traversal_min=sec["typical_traversal_min"],
                direction="DOWN"
            )

    def get_station(self, station_id: str) -> dict:
        """Get properties of a station by ID."""
        return self.stations.get(station_id)

    def get_section(self, section_id: str) -> dict:
        """Get details of a section by ID, handling reversed direction IDs as well."""
        if section_id in self.sections:
            return self.sections[section_id]
        
        # Handle the reversed DOWN sections
        if section_id.endswith("_DOWN"):
            base_id = section_id[:-5]
            if base_id in self.sections:
                sec = self.sections[base_id].copy()
                sec["id"] = section_id
                sec["from"], sec["to"] = sec["to"], sec["from"]
                return sec
        return None

    def get_section_by_endpoints(self, from_node: str, to_node: str) -> dict:
        """Get section details by endpoint station IDs."""
        edge_data = self.graph.get_edge_data(from_node, to_node)
        if edge_data:
            return {
                "id": edge_data["id"],
                "from": from_node,
                "to": to_node,
                "distance_km": edge_data["distance_km"],
                "tracks": edge_data["tracks"],
                "max_speed": edge_data["max_speed"],
                "electrified": edge_data["electrified"],
                "section_capacity": edge_data["section_capacity"],
                "typical_traversal_min": edge_data["typical_traversal_min"]
            }
        return None

    def get_typical_traversal_time(self, section_id: str, train_max_speed: float) -> float:
        """
        Calculate typical traversal time in minutes for a section
        based on the section distance and train's max speed limit.
        """
        sec = self.get_section(section_id)
        if not sec:
            raise ValueError(f"Section {section_id} not found in corridor graph.")
        
        effective_speed = min(sec["max_speed"], train_max_speed)
        time_hours = sec["distance_km"] / effective_speed
        return time_hours * 60.0

    def get_shortest_path(self, origin_station: str, destination_station: str) -> list:
        """Find the shortest path of station IDs between two stations."""
        try:
            return nx.shortest_path(self.graph, source=origin_station, target=destination_station)
        except nx.NetworkXNoPath:
            return []
        except nx.NodeNotFound:
            return []
