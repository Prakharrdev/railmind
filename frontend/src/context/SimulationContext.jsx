/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';

export const SimulationContext = createContext(null);

const API_HOST = window.location.hostname || 'localhost';
const API_BASE = `http://${API_HOST}:8000`;
const WS_URL = `ws://${API_HOST}:8000/ws/live`;

// Pre-defined high-fidelity mock scenarios for portfolio demonstration
const MOCK_SCENARIOS = [
  {
    id: 'Scenario #14',
    title: 'Engine Slow',
    type: 'Engine Slowdown',
    improvement_pct: 12.4,
    snapshot: {
      conflicts: [
        {
          train_a_id: 'Vande_Bharat_02',
          train_b_id: 'Rajdhani_01',
          block_id: 'NDLS_GZB_01',
          conflict_start_sim_time: 845.5,
          overlap_minutes: 12.4,
          urgency_score: 28.5
        }
      ],
      activeRecommendation: {
        recommendation_id: 'rec_disrupt_14',
        actions: [
          { train_id: 'Vande_Bharat_02', action_type: 'hold', hold_minutes: 10 }
        ],
        improvement_pct: 12.4,
        projected_cost: 4200,
        sim_time: 845.5,
        stats: { latency_ms: 38.2, depth: 4, beam_width: 8, nodes_generated: 45 }
      },
      selectedRecommendationId: 'rec_disrupt_14',
      selectedRecommendationDetails: {
        recommendation_id: 'rec_disrupt_14',
        actions: [
          { train_id: 'Vande_Bharat_02', action_type: 'hold', hold_minutes: 10 }
        ],
        improvement_pct: 12.4,
        projected_cost: 4200,
        sim_time: 845.5,
        stats: { latency_ms: 38.2, depth: 4, beam_width: 8, nodes_generated: 45 }
      },
      decisionTree: {
        node_id: 'root',
        action_text: 'Initial Corridor Status (Conflict)',
        depth: 0,
        f_cost: 5200,
        was_in_beam: true,
        children: [
          {
            node_id: 'node_1',
            action_text: 'Hold Vande_Bharat_02 for 10m',
            depth: 1,
            f_cost: 4200,
            was_in_beam: true,
            children: [
              {
                node_id: 'node_2',
                action_text: 'Resume normal speed',
                depth: 2,
                f_cost: 4200,
                was_in_beam: true,
                children: []
              }
            ]
          },
          {
            node_id: 'node_3',
            action_text: 'No-Op (FCFS)',
            depth: 1,
            f_cost: 5200,
            was_in_beam: false,
            children: []
          }
        ]
      },
      metrics: {
        conflicts_resolved: 1,
        delay_reduction_pct: 12.4,
        avg_planner_latency_ms: 38.2,
        beam_efficiency: 0.88,
        total_train_delay_minutes: 42,
        total_passenger_delay_minutes: 180000
      }
    }
  },
  {
    id: 'Scenario #15',
    title: 'Platform Block',
    type: 'Platform Blockage',
    improvement_pct: 8.2,
    snapshot: {
      conflicts: [
        {
          train_a_id: 'Freight_02',
          train_b_id: 'Shatabdi_01',
          block_id: 'GZB_PF_02',
          conflict_start_sim_time: 860.0,
          overlap_minutes: 8.2,
          urgency_score: 15.0
        }
      ],
      activeRecommendation: {
        recommendation_id: 'rec_disrupt_15',
        actions: [
          { train_id: 'Freight_02', action_type: 'hold', hold_minutes: 8 }
        ],
        improvement_pct: 8.2,
        projected_cost: 5400,
        sim_time: 860.0,
        stats: { latency_ms: 44.5, depth: 4, beam_width: 8, nodes_generated: 32 }
      },
      selectedRecommendationId: 'rec_disrupt_15',
      selectedRecommendationDetails: {
        recommendation_id: 'rec_disrupt_15',
        actions: [
          { train_id: 'Freight_02', action_type: 'hold', hold_minutes: 8 }
        ],
        improvement_pct: 8.2,
        projected_cost: 5400,
        sim_time: 860.0,
        stats: { latency_ms: 44.5, depth: 4, beam_width: 8, nodes_generated: 32 }
      },
      decisionTree: {
        node_id: 'root',
        action_text: 'Station Queue Blockage GZB',
        depth: 0,
        f_cost: 6000,
        was_in_beam: true,
        children: [
          {
            node_id: 'node_1',
            action_text: 'Hold Freight_02 for 8m at GZB Outer',
            depth: 1,
            f_cost: 5400,
            was_in_beam: true,
            children: [
              {
                node_id: 'node_2',
                action_text: 'Clear PF 2 for Shatabdi_01',
                depth: 2,
                f_cost: 5400,
                was_in_beam: true,
                children: []
              }
            ]
          },
          {
            node_id: 'node_3',
            action_text: 'Let Freight_02 enter GZB PF 2 (Hold Shatabdi_01)',
            depth: 1,
            f_cost: 5900,
            was_in_beam: true,
            children: []
          }
        ]
      },
      metrics: {
        conflicts_resolved: 1,
        delay_reduction_pct: 8.2,
        avg_planner_latency_ms: 44.5,
        beam_efficiency: 0.75,
        total_train_delay_minutes: 54,
        total_passenger_delay_minutes: 240000
      }
    }
  },
  {
    id: 'Scenario #16',
    title: 'Signal Hold',
    type: 'Signal Hold',
    improvement_pct: 11.7,
    snapshot: {
      conflicts: [
        {
          train_a_id: 'Gatimaan_01',
          train_b_id: 'Freight_01',
          block_id: 'ALJN_TDL_02',
          conflict_start_sim_time: 880.0,
          overlap_minutes: 11.7,
          urgency_score: 22.4
        }
      ],
      activeRecommendation: {
        recommendation_id: 'rec_disrupt_16',
        actions: [
          { train_id: 'Freight_01', action_type: 'hold', hold_minutes: 12 }
        ],
        improvement_pct: 11.7,
        projected_cost: 4800,
        sim_time: 880.0,
        stats: { latency_ms: 41.0, depth: 4, beam_width: 8, nodes_generated: 40 }
      },
      selectedRecommendationId: 'rec_disrupt_16',
      selectedRecommendationDetails: {
        recommendation_id: 'rec_disrupt_16',
        actions: [
          { train_id: 'Freight_01', action_type: 'hold', hold_minutes: 12 }
        ],
        improvement_pct: 11.7,
        projected_cost: 4800,
        sim_time: 880.0,
        stats: { latency_ms: 41.0, depth: 4, beam_width: 8, nodes_generated: 40 }
      },
      decisionTree: {
        node_id: 'root',
        action_text: 'Signal Red Aspect Block ALJN_TDL_02',
        depth: 0,
        f_cost: 5800,
        was_in_beam: true,
        children: [
          {
            node_id: 'node_1',
            action_text: 'Hold Freight_01 for 12m',
            depth: 1,
            f_cost: 4800,
            was_in_beam: true,
            children: [
              {
                node_id: 'node_2',
                action_text: 'Let Gatimaan_01 overtake at ALJN',
                depth: 2,
                f_cost: 4800,
                was_in_beam: true,
                children: []
              }
            ]
          },
          {
            node_id: 'node_3',
            action_text: 'No Overtake (Hold Gatimaan_01)',
            depth: 1,
            f_cost: 5600,
            was_in_beam: true,
            children: []
          }
        ]
      },
      metrics: {
        conflicts_resolved: 1,
        delay_reduction_pct: 11.7,
        avg_planner_latency_ms: 41.0,
        beam_efficiency: 0.82,
        total_train_delay_minutes: 48,
        total_passenger_delay_minutes: 210000
      }
    }
  }
];

export const SimulationProvider = ({ children }) => {
  const [network, setNetwork] = useState(null);
  const [trains, setTrains] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [recommendations, setRecommendations] = useState({});
  const [activeRecommendation, setActiveRecommendation] = useState(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState(null);
  const [decisionTree, setDecisionTree] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState([]);
  const [plannerConfig, setPlannerConfig] = useState({ depth: 4, beam_width: 8, step_minutes: 5 });
  const [simTime, setSimTime] = useState(840.0);
  
  // Selection/Highlighting States
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState(null);

  // Scenario History / Replay States
  const [replayHistory] = useState(MOCK_SCENARIOS);
  const [activeReplay, setActiveReplay] = useState(null); // stores selected scenario object or null

  const activeReplayRef = useRef(null);
  useEffect(() => {
    activeReplayRef.current = activeReplay;
  }, [activeReplay]);

  // Fetch static network topology
  const fetchNetwork = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/network`);
      setNetwork(response.data);
    } catch (error) {
      console.error('Error fetching network layout:', error);
    }
  }, []);

  // Fetch benchmark historical metrics
  const fetchBenchmarkMetrics = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/metrics/benchmark`);
      setBenchmarkMetrics(response.data);
    } catch (error) {
      console.error('Error fetching benchmark metrics:', error);
    }
  }, []);

  // Fetch active/past recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/recommendations`);
      setRecommendations(response.data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  }, []);

  // Fetch detailed trace node for decision tree
  const fetchTrace = useCallback(async (recId) => {
    if (!recId) return;
    // Don't override if we are in replay mode
    if (activeReplayRef.current && activeReplayRef.current.snapshot?.selectedRecommendationId === recId) {
      return;
    }
    try {
      const response = await axios.get(`${API_BASE}/recommendations/${recId}/trace`);
      setDecisionTree(response.data);
    } catch (error) {
      console.error(`Error fetching trace for recommendation ${recId}:`, error);
    }
  }, []);

  const [selectedRecommendationDetails, setSelectedRecommendationDetails] = useState(null);

  // Fetch detailed recommendation stats
  const fetchRecommendationDetails = useCallback(async (recId) => {
    if (!recId) return;
    // Don't override if we are in replay mode
    if (activeReplayRef.current && activeReplayRef.current.snapshot?.selectedRecommendationId === recId) {
      return;
    }
    try {
      const response = await axios.get(`${API_BASE}/recommendations/${recId}`);
      setSelectedRecommendationDetails(response.data);
    } catch (error) {
      console.error(`Error fetching details for recommendation ${recId}:`, error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    fetchNetwork();
    fetchBenchmarkMetrics();
    fetchRecommendations();
  }, [fetchNetwork, fetchBenchmarkMetrics, fetchRecommendations]);

  // Handle selected recommendation trace and details fetching
  useEffect(() => {
    if (selectedRecommendationId) {
      fetchTrace(selectedRecommendationId);
      fetchRecommendationDetails(selectedRecommendationId);
    } else {
      setDecisionTree(null);
      setSelectedRecommendationDetails(null);
    }
  }, [selectedRecommendationId, fetchTrace, fetchRecommendationDetails]);

  // Configure planner API
  const updatePlannerConfig = useCallback(async (newConfig) => {
    try {
      await axios.post(`${API_BASE}/planner/config`, newConfig);
      setPlannerConfig(prev => ({ ...prev, ...newConfig }));
      fetchRecommendations();
    } catch (error) {
      console.error('Error updating planner configuration:', error);
    }
  }, [fetchRecommendations]);

  // Inject disruption API
  const injectDisruption = useCallback(async (disruptionData) => {
    try {
      const response = await axios.post(`${API_BASE}/disrupt`, disruptionData);
      fetchBenchmarkMetrics();
      return response.data;
    } catch (error) {
      console.error('Error injecting disruption:', error);
      throw error;
    }
  }, [fetchBenchmarkMetrics]);

  // Apply hold action API
  const applyAction = useCallback(async (actionData) => {
    try {
      const response = await axios.post(`${API_BASE}/action`, actionData);
      fetchRecommendations();
      return response.data;
    } catch (error) {
      console.error('Error applying hold action:', error);
      throw error;
    }
  }, [fetchRecommendations]);

  // Handler for WebSocket incoming messages
  const handleWebSocketMessage = useCallback((payload) => {
    if (payload.sim_time !== undefined) {
      if (!activeReplayRef.current) {
        setSimTime(payload.sim_time);
      }
      if (payload.trains) {
        setTrains(payload.trains);
      }
      // Only update live variables if NOT currently in historical replay mode
      if (!activeReplayRef.current) {
        if (payload.conflicts) {
          setConflicts(payload.conflicts);
        }
        if (payload.metrics) {
          setMetrics(payload.metrics);
        }
        if (payload.recommendation && payload.recommendation.recommendation_id) {
          const rec = payload.recommendation;
          setActiveRecommendation(rec);
          setRecommendations(prev => ({
            ...prev,
            [rec.recommendation_id]: rec
          }));
          setSelectedRecommendationId(rec.recommendation_id);
        } else {
          setActiveRecommendation(null);
        }
      } else {
        // If in replay mode, we still capture dynamic disruptions in background history
        if (payload.recommendation && payload.recommendation.recommendation_id) {
          const rec = payload.recommendation;
          setRecommendations(prev => ({
            ...prev,
            [rec.recommendation_id]: rec
          }));
        }
      }
    }
  }, []);

  const { status: wsStatus, reconnect } = useWebSocket(WS_URL, handleWebSocketMessage);

  return (
    <SimulationContext.Provider
      value={{
        network,
        trains,
        simTime: activeReplay ? (activeReplay.snapshot.activeRecommendation?.sim_time || 840.0) : simTime,
        conflicts: activeReplay ? activeReplay.snapshot.conflicts : conflicts,
        recommendations: activeReplay ? { [activeReplay.snapshot.activeRecommendation.recommendation_id]: activeReplay.snapshot.activeRecommendation } : recommendations,
        activeRecommendation: activeReplay ? activeReplay.snapshot.activeRecommendation : activeRecommendation,
        selectedRecommendationId: activeReplay ? activeReplay.snapshot.selectedRecommendationId : selectedRecommendationId,
        setSelectedRecommendationId,
        selectedRecommendationDetails: activeReplay ? activeReplay.snapshot.selectedRecommendationDetails : selectedRecommendationDetails,
        decisionTree: activeReplay ? activeReplay.snapshot.decisionTree : decisionTree,
        metrics: activeReplay ? activeReplay.snapshot.metrics : metrics,
        benchmarkMetrics,
        plannerConfig,
        updatePlannerConfig,
        injectDisruption,
        applyAction,
        selectedTrainId,
        setSelectedTrainId,
        selectedConflict,
        setSelectedConflict,
        wsStatus,
        reconnect,
        
        // Scenario History Replay fields
        replayHistory,
        activeReplay,
        setActiveReplay
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};
