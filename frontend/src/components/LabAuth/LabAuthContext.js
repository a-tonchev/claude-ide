import { createContext, useContext } from 'react';

export const LabAuthContext = createContext(null);
export const useLabAuth = () => useContext(LabAuthContext);
