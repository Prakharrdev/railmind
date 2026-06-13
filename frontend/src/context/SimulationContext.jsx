import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';

export const SimulationContext = createContext(null);

const API_HOST = window.location.hostname || 'localhost';
const API_BASE = `http://${API_HOST}:8000`;
const WS_URL = `ws://${API_HOST}:8000/ws/live`;

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
  
  // Selection/Highlighting States
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState(null);

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
      if (payload.trains) {
        setTrains(payload.trains);
      }
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
    }
  }, []);

  const { status: wsStatus, reconnect } = useWebSocket(WS_URL, handleWebSocketMessage);

  return (
    <SimulationContext.Provider
      value={{
        network,
        trains,
        conflicts,
        recommendations,
        activeRecommendation,
        selectedRecommendationId,
        setSelectedRecommendationId,
        selectedRecommendationDetails,
        decisionTree,
        metrics,
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
        reconnect
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};
