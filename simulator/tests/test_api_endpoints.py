from fastapi.testclient import TestClient
from api.main import app
from api.sim_runner import sim_runner

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

def test_simulation_endpoints():
    # Test GET /trains
    response = client.get("/trains")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "train_id" in data[0]

    # Test GET /conflicts
    response = client.get("/conflicts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    # Test GET /metrics
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "total_train_delay_minutes" in response.json()

def test_planner_endpoints():
    # Test GET /recommendations
    response = client.get("/recommendations")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)

def test_control_endpoints():
    # Test POST /planner/config
    payload = {"depth": 3, "beam_width": 6, "step_minutes": 5}
    response = client.post("/planner/config", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert sim_runner.planner.depth == 3
    assert sim_runner.planner.beam_width == 6

    # Test POST /action
    action_payload = {"train_id": "22436_UP", "action_type": "noop", "hold_minutes": 0.0}
    response = client.post("/action", json=action_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Test POST /disrupt
    disruption_payload = {
        "disruption_id": "api_test_disp",
        "train_id": "22436_UP",
        "disruption_type": "engine_slow",
        "magnitude_minutes": 15.0,
        "start_time": 850.0,
        "end_time": 865.0
    }
    response = client.post("/disrupt", json=disruption_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
