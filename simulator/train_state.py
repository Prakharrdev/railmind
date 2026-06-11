from dataclasses import dataclass, replace
from typing import Dict, List, Optional

@dataclass
class TrainState:
    train_id: str
    name: str
    train_class: str
    direction: str
    typical_passengers: int
    current_section: Optional[str]
    section_progress: float
    current_speed_kmph: float
    delay_minutes: float
    is_held: bool
    hold_remaining_minutes: float
    last_station: str
    next_station: Optional[str]
    route: List[str]
    current_route_index: int
    station_arrival_times: Dict[str, float]  # station_id -> actual arrival time
    station_departure_times: Dict[str, float]  # station_id -> actual departure time
    current_block_index: Optional[int]

@dataclass
class BlockState:
    block_id: str
    occupied_by: Optional[str]  # train_id or None

@dataclass
class StationState:
    station_id: str
    occupied_platforms: int
    train_ids: List[str]  # train_ids currently at this station's platforms

@dataclass
class NetworkState:
    sim_time: float
    trains: Dict[str, TrainState]
    blocks: Dict[str, BlockState]
    stations: Dict[str, StationState]

    def clone(self) -> 'NetworkState':
        """Custom clone function that copies only mutable structures for speed."""
        cloned_trains = {
            tid: replace(
                tstate,
                station_arrival_times=tstate.station_arrival_times.copy(),
                station_departure_times=tstate.station_departure_times.copy(),
                route=tstate.route.copy()
            )
            for tid, tstate in self.trains.items()
        }
        cloned_blocks = {
            bid: replace(bstate)
            for bid, bstate in self.blocks.items()
        }
        cloned_stations = {
            sid: replace(sstate, train_ids=sstate.train_ids.copy())
            for sid, sstate in self.stations.items()
        }
        return NetworkState(
            sim_time=self.sim_time,
            trains=cloned_trains,
            blocks=cloned_blocks,
            stations=cloned_stations
        )
