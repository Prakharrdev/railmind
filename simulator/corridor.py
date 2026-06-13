import json
import networkx as nx
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class StationNode:
    id: str
    name: str
    platforms: int
    loops: int
    is_junction: bool = False
    has_loop: bool = True

    def __getitem__(self, key):
        """Allows dictionary-like subscripting for backward compatibility with existing tests."""
        return getattr(self, key)

@dataclass
class Signal:
    id: str
    block_id: str
    aspect: str  # "green" | "yellow" | "red"

@dataclass
class BlockSection:
    id: str
    from_node: str
    to_node: str
    length_km: float
    max_speed: float
    occupied_by: Optional[str]
    entry_signal_id: str
    exit_signal_id: str
    track_type: str

    def __getitem__(self, key):
        """Allows dictionary-like subscripting for compatibility."""
        return getattr(self, key)

class RailwayGraph:
    def __init__(self, corridor_json_path: str):
        self.corridor_json_path = corridor_json_path
        with open(corridor_json_path, 'r') as f:
            self.data = json.load(f)
            
        # 1. Existing backward compatible dicts
        self.raw_stations = {s["id"]: s for s in self.data["stations"]}
        self.sections = {sec["id"]: sec for sec in self.data["sections"]}
        
        # 2. Build station-level directed graph
        self.graph = nx.DiGraph()
        for s_id, s_info in self.raw_stations.items():
            self.graph.add_node(
                s_id, 
                name=s_info["name"], 
                lat=s_info["lat"], 
                lon=s_info["lon"], 
                platforms=s_info["platforms"],
                is_junction=s_info["is_junction"],
                has_loop=s_info["has_loop"]
            )
            
        for sec_id, sec in self.sections.items():
            u = sec["from"]
            v = sec["to"]
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

        # 3. New Infrastructure Model Dataclasses
        self.stations: Dict[str, StationNode] = {}
        self.blocks: Dict[str, BlockSection] = {}
        self.signals: Dict[str, Signal] = {}
        self.adjacency: Dict[str, List[str]] = {}

        # Populate StationNodes
        for s_id, s in self.raw_stations.items():
            loops = 1 if s["has_loop"] else 0
            self.stations[s_id] = StationNode(
                id=s_id,
                name=s["name"],
                platforms=s["platforms"],
                loops=loops,
                is_junction=s["is_junction"],
                has_loop=s["has_loop"]
            )

        # Build blocks, signals, and adjacency list
        for sec_id, sec in self.sections.items():
            u = sec["from"]
            v = sec["to"]
            tracks = sec["tracks"]
            max_speed = sec["max_speed"]
            track_type = "double" if tracks >= 2 else "single"
            blocks_list = sec["blocks"]
            num_blocks = len(blocks_list)

            # Generate UP blocks
            for i, b in enumerate(blocks_list):
                block_id = b["id"]
                from_node = u if i == 0 else blocks_list[i-1]["id"]
                to_node = v if i == num_blocks - 1 else blocks_list[i+1]["id"]
                entry_sig = f"SIG_{block_id}_ENTRY"
                exit_sig = f"SIG_{block_id}_EXIT"

                self.blocks[block_id] = BlockSection(
                    id=block_id,
                    from_node=from_node,
                    to_node=to_node,
                    length_km=b["length_km"],
                    max_speed=max_speed,
                    occupied_by=None,
                    entry_signal_id=entry_sig,
                    exit_signal_id=exit_sig,
                    track_type=track_type
                )
                self.signals[entry_sig] = Signal(id=entry_sig, block_id=block_id, aspect="green")
                self.signals[exit_sig] = Signal(id=exit_sig, block_id=block_id, aspect="green")

                # Add station-to-block connection
                if i == 0:
                    if u not in self.adjacency:
                        self.adjacency[u] = []
                    self.adjacency[u].append(block_id)

                # Add block connection
                if block_id not in self.adjacency:
                    self.adjacency[block_id] = []
                self.adjacency[block_id].append(to_node)

            # Generate DOWN blocks (reversed traversal order)
            for i in range(num_blocks - 1, -1, -1):
                b = blocks_list[i]
                block_id = f"{b['id']}_DOWN"
                from_node = v if i == num_blocks - 1 else f"{blocks_list[i+1]['id']}_DOWN"
                to_node = u if i == 0 else f"{blocks_list[i-1]['id']}_DOWN"
                entry_sig = f"SIG_{block_id}_ENTRY"
                exit_sig = f"SIG_{block_id}_EXIT"

                self.blocks[block_id] = BlockSection(
                    id=block_id,
                    from_node=from_node,
                    to_node=to_node,
                    length_km=b["length_km"],
                    max_speed=max_speed,
                    occupied_by=None,
                    entry_signal_id=entry_sig,
                    exit_signal_id=exit_sig,
                    track_type=track_type
                )
                self.signals[entry_sig] = Signal(id=entry_sig, block_id=block_id, aspect="green")
                self.signals[exit_sig] = Signal(id=exit_sig, block_id=block_id, aspect="green")

                # Add station-to-block connection for DOWN
                if i == num_blocks - 1:
                    if v not in self.adjacency:
                        self.adjacency[v] = []
                    self.adjacency[v].append(block_id)

                # Add block connection
                if block_id not in self.adjacency:
                    self.adjacency[block_id] = []
                self.adjacency[block_id].append(to_node)

    def get_station(self, station_id: str) -> Optional[StationNode]:
        """Get properties of a station by ID."""
        return self.stations.get(station_id)

    def get_section(self, section_id: str) -> Optional[dict]:
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

    def get_section_by_endpoints(self, from_node: str, to_node: str) -> Optional[dict]:
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

    def get_shortest_path(self, origin_station: str, destination_station: str) -> List[str]:
        """Find the shortest path of station IDs between two stations."""
        try:
            return nx.shortest_path(self.graph, source=origin_station, target=destination_station)
        except nx.NetworkXNoPath:
            return []
        except nx.NodeNotFound:
            return []

    # ─── Query Methods ────────────────────────────────────────────────────────
    def next_block(self, train) -> Optional[str]:
        """
        Query the block ID of the block immediately ahead of the train.
        Returns None if the train is at its destination or entering a station next.
        """
        direction = getattr(train, "direction", None) or train.get("direction")
        current_section = getattr(train, "current_section", None) or train.get("current_section")
        
        if not current_section:
            last_station = getattr(train, "last_station", None) or train.get("last_station")
            next_station = getattr(train, "next_station", None) or train.get("next_station")
            if not next_station:
                return None
            
            sec = self.get_section_by_endpoints(last_station, next_station)
            if not sec:
                return None
            
            # Fetch the full section containing blocks list
            full_sec = self.get_section(sec["id"])
            if not full_sec:
                return None
            
            blocks_list = full_sec.get("blocks", [])
            if not blocks_list:
                return None
            
            if direction == "DOWN":
                return f"{blocks_list[-1]['id']}_DOWN"
            return blocks_list[0]["id"]
        
        else:
            curr_idx = getattr(train, "current_block_index", None) or train.get("current_block_index")
            sec = self.get_section(current_section)
            if not sec:
                return None
            
            blocks_list = sec.get("blocks", [])
            if curr_idx is None:
                # Compute current block index based on section progress
                progress = getattr(train, "section_progress", 0.0) or train.get("section_progress", 0.0)
                dist = sec["distance_km"]
                dist_from_origin = progress * dist
                if direction == "DOWN":
                    pos = dist - dist_from_origin
                else:
                    pos = dist_from_origin
                
                cum_dist = 0.0
                curr_idx = len(blocks_list) - 1
                for idx, b in enumerate(blocks_list):
                    cum_dist += b["length_km"]
                    if pos <= cum_dist + 1e-5:
                        curr_idx = idx
                        break
            
            if direction == "DOWN":
                if curr_idx > 0:
                    next_block_id = blocks_list[curr_idx - 1]["id"]
                    return f"{next_block_id}_DOWN"
                return None  # Next is station
            else:
                if curr_idx < len(blocks_list) - 1:
                    return blocks_list[curr_idx + 1]["id"]
                return None  # Next is station

    def free_blocks(self, state=None) -> List[str]:
        """Returns a list of block IDs that are currently free (not occupied)."""
        if state:
            return [bid for bid, bstate in state.blocks.items() if bstate.occupied_by is None]
        return [bid for bid, b in self.blocks.items() if b.occupied_by is None]

    def block_length(self, block_id: str) -> float:
        """Returns the length of a block in km."""
        base_id = block_id[:-5] if block_id.endswith("_DOWN") else block_id
        if base_id in self.blocks:
            return self.blocks[base_id].length_km
        # Check in sections just in case
        for sec in self.sections.values():
            for b in sec.get("blocks", []):
                if b["id"] == base_id:
                    return b["length_km"]
        return 0.0
