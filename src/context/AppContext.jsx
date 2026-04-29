import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AppReducer from './AppReducer';
import seedData, { SEED_VERSION } from '../data/seedData';

const STORAGE_KEY = 'jira-clone-state';
// Bump this version whenever the data shape changes significantly.
// A mismatch will clear localStorage and reload from seedData.
const STATE_VERSION = '6';
const VERSION_KEY = 'jira-clone-version';

/**
 * Initialises the reducer state.
 * Loads from localStorage if available and version matches;
 * otherwise falls back to seed data.
 * @param {Object} initialState - The default initial state
 * @returns {Object} The resolved initial state
 */
function init(initialState) {
  try {
    const savedVersion = localStorage.getItem(VERSION_KEY);
    // If version mismatch, clear old data and use fresh seed
    if (savedVersion !== STATE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(VERSION_KEY, STATE_VERSION);
      return initialState;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Guard: if seedVersion doesn't match, clear localStorage and reload seed data
      if (parsed.seedVersion !== SEED_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        return initialState;
      }

      // Ensure auth state exists
      if (!parsed.auth) {
        parsed.auth = { isAuthenticated: false, currentUser: null };
      }
      // Ensure units array exists
      if (!parsed.units) {
        parsed.units = [];
      }
      // Guard: if users don't have password field, data is stale → reset
      if (!parsed.users || parsed.users.length === 0 || !parsed.users[0].password) {
        localStorage.removeItem(STORAGE_KEY);
        return initialState;
      }
      // Guard: if sprint count is less than seed data, data is stale → reset
      if (!parsed.sprints || parsed.sprints.length < initialState.sprints.length) {
        localStorage.removeItem(STORAGE_KEY);
        return initialState;
      }
      // Guard: if issue count is less than seed data, data is stale → reset
      if (!parsed.issues || parsed.issues.length < initialState.issues.length) {
        localStorage.removeItem(STORAGE_KEY);
        return initialState;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load state from localStorage, using seed data.', err);
  }
  return initialState;
}

const AppContext = createContext(null);

/**
 * Application-wide state provider.
 * Wraps children with the AppContext and keeps localStorage in sync.
 */
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(AppReducer, seedData, init);

  // Sync state to localStorage after every update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(VERSION_KEY, STATE_VERSION);
    } catch (err) {
      console.warn('Failed to persist state to localStorage.', err);
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Custom hook for consuming the AppContext.
 * Must be used inside an AppProvider.
 * @returns {{ state: Object, dispatch: Function }}
 */
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
