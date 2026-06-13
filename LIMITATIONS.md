# **RailMind: Known Limitations & Deployment Prerequisites**

This document details the known boundaries of the RailMind search-based planning prototype and outlines the roadmap required to transition the project from a simulator-bound decision-support tool to a production-ready advisory system for Indian Railways.

---

## **1. Known Limitations**

### **1.1 Single-Corridor Graph Model**
The current implementation of the simulator, timetabling system, and conflict detector is tailored to the Delhi-Kanpur corridor (8 stations, ~440 km). While this is a high-density, representative corridor, the system does not support:
*   Multi-corridor routing (e.g., trains crossing from the Northern Railway to the North Central or North Eastern Railways).
*   Junction station network grids outside the direct path of travel.
*   Cross-boundary conflict coordination (conflicts occurring when handovers happen between different control offices).

### **1.2 20-Minute Forward Projection Horizon**
To ensure that search nodes can be expanded and evaluated within the 200ms real-time latency budget, the simulator's forward projection is limited to 20 minutes. 
*   **The Issue:** For severe or long-duration disruptions (e.g., a signal block lasting 60+ minutes), cascade effects propagate far beyond the 20-minute window.
*   **The Consequence:** The planner may select actions that resolve local conflicts within the 20-minute horizon but inadvertently trigger worse delays downstream at the 45-minute mark.

### **1.3 Deterministic Transitions (No Uncertainty)**
The simulation assumes a deterministic environment. Once initial delays are sampled and injected, train speeds, traversal rates, platform occupancies, and block clearances follow deterministic calculations.
*   **Real-world contrast:** In real operations, train movements are stochastic. Passenger boarding times fluctuate, signals can switch intermittently, and weather can cause unpredictable deceleration.
*   **The Consequence:** Recommendations that work perfectly in a deterministic simulation may be too fragile for real-world stochastic operations.

### **1.4 Absence of Mechanical/Civil Failure Modelling**
The simulator does not model physical anomalies such as:
*   Locomotive engine breakdowns (traction failure).
*   Overhead Equipment (OHE) wire breaks.
*   Track fractures or civil maintenance blockages.
The system is strictly designed to handle slot sequencing and platform capacity scheduling under delay conditions.

---

## **2. Deployment Prerequisites**

Three key technical and regulatory gaps must be closed before RailMind can be deployed in a live operational environment:

### **2.1 Live Data & Sensor Integration**
A production deployment requires replacing the simulated event loops with live data streams.
*   **TMS/COA Integration:** The system must interface with the Train Management System (TMS) and Control Office Application (COA) of Indian Railways.
*   **Location Tracking:** GPS-based location streams (such as Real-Time Train Information System - RTIS) must feed directly into the `NetworkState` constructor to update coordinates dynamically every 30 seconds.

### **2.2 Network-Scale Simulator Expansion**
The single corridor design must be generalized:
*   **Graph Representation:** The `RailwayGraph` must be expanded to represent a regional or zone-wide directed network using a globally indexable node-link structure.
*   **Parallel Planning:** In a zone-wide system, multiple planners must run in parallel, scoped to regional subgraphs, to stay within acceptable planning latencies.

### **2.3 Safety Certification & Regulatory Compliance**
Since RailMind operates in a safety-adjacent domain, the system must undergo strict verification before deployment:
*   **G&SR Alignment:** The `CSPChecker` rules must be formally validated against the General and Subsidiary Rules (G&SR) of the respective railway zones.
*   **Software Certification:** The software must be audited and certified under **CENELEC EN 50128** standards, which specify safety integrity levels (SIL) for railway control and protection software.

---

## **3. Future Extensions**

If you are looking to build upon this project for academic research or portfolio enhancement, consider the following directions:
1.  **Stochastic Projection (Monte Carlo Simulation):** Instead of a single deterministic fast-forward simulation, run multiple randomized trajectories at each leaf node to estimate the probability distribution of delay costs.
2.  **A* Search with Admissible Heuristics:** Implement A* search as an alternative to Beam Search and analyze the exact latency vs. optimality trade-off on target hardware.
3.  **WhatsApp Dispatcher Integration:** Deliver recommended slot-swaps directly to section controllers via automated WhatsApp Business API alerts to bypass desktop browser dashboard dependencies.
4.  **Online Learning Feedback Loop:** Log accept/override decisions by controllers and feed them back to a regression model to update the priority scoring weights ($\mu_i$ and $\gamma_i$) over time.
