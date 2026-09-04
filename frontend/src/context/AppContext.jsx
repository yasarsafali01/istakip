import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AppReducer from './AppReducer';
import { ACTIONS } from '../constants';
import { restoreSession } from '../api/auth';
import { usersApi, unitsApi, projectsApi, issuesApi, sprintsApi } from '../api/resources';
import { buildUnitCodeByProjectId, mapIssues } from '../api/mappers';

const initialState = {
  auth: { isAuthenticated: false, currentUser: null },
  loading: true,
  units: [],
  users: [],
  projects: [],
  issues: [],
  sprints: [],
  comments: [],
  activities: [],
  inventory: [],
};

const AppContext = createContext(null);

/**
 * Application-wide state provider. Holds a client-side cache of backend
 * data; all data originates from the API (there is no localStorage
 * persistence — a page reload re-fetches from the server).
 */
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(AppReducer, initialState);

  // Fetches units/users/projects/issues/sprints for the current session and
  // replaces them in state. Comments/activities/inventory are loaded on
  // demand per issue/project (see SET_COMMENTS_FOR_ISSUE etc.).
  const hydrateAll = useCallback(async () => {
    const [units, users, projects, issues] = await Promise.all([
      unitsApi.list(),
      usersApi.list(),
      projectsApi.list(),
      issuesApi.list(),
    ]);

    const sprintLists = await Promise.all(projects.map((p) => sprintsApi.listByProject(p.id)));
    const sprints = sprintLists.flat();

    const unitCodeByProjectId = buildUnitCodeByProjectId(projects, units);

    dispatch({
      type: ACTIONS.HYDRATE,
      payload: {
        units,
        users,
        projects,
        sprints,
        issues: mapIssues(issues, unitCodeByProjectId),
      },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await restoreSession();
        if (cancelled) return;
        if (user) {
          dispatch({ type: ACTIONS.LOGIN, payload: user });
          await hydrateAll();
        }
      } catch (err) {
        console.warn('Failed to restore session', err);
      } finally {
        if (!cancelled) dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateAll]);

  return (
    <AppContext.Provider value={{ state, dispatch, hydrateAll }}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Custom hook for consuming the AppContext.
 * Must be used inside an AppProvider.
 * @returns {{ state: Object, dispatch: Function, hydrateAll: Function }}
 */
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
