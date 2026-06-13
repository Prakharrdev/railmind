import { useContext } from 'react';
import { SimulationContext } from '../context/SimulationContext';

export const useSimulatorState = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulatorState must be used within a SimulationProvider');
  }
  return context;
};
