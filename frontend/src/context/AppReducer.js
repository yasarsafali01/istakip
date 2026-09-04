import { ACTIONS } from '../constants';

/**
 * Pure reducer function for the application state.
 * Handles all state transitions based on dispatched actions.
 */
function AppReducer(state, action) {
  switch (action.type) {
    // ─── DATA LOADING ───────────────────────────────────────────────────────
    case ACTIONS.HYDRATE: {
      return { ...state, ...action.payload };
    }

    case ACTIONS.SET_LOADING: {
      return { ...state, loading: action.payload };
    }

    // Replace the comments/activities/inventory belonging to one issue or
    // project — these are fetched on demand (not eagerly hydrated) since the
    // backend exposes them per-parent rather than as one flat collection.
    case ACTIONS.SET_COMMENTS_FOR_ISSUE: {
      const { issueId, comments } = action.payload;
      return {
        ...state,
        comments: [...state.comments.filter((c) => c.issueId !== issueId), ...comments],
      };
    }

    case ACTIONS.SET_ACTIVITIES_FOR_ISSUE: {
      const { issueId, activities } = action.payload;
      return {
        ...state,
        activities: [...state.activities.filter((a) => a.issueId !== issueId), ...activities],
      };
    }

    case ACTIONS.SET_INVENTORY_FOR_PROJECT: {
      const { projectId, inventory } = action.payload;
      return {
        ...state,
        inventory: [...state.inventory.filter((i) => i.projectId !== projectId), ...inventory],
      };
    }

    // ─── PROJECT ────────────────────────────────────────────────────────────
    case ACTIONS.ADD_PROJECT: {
      return {
        ...state,
        projects: [...state.projects, action.payload],
      };
    }

    case ACTIONS.UPDATE_PROJECT: {
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    }

    // ─── ISSUE ──────────────────────────────────────────────────────────────
    case ACTIONS.ADD_ISSUE: {
      return {
        ...state,
        issues: [...state.issues, action.payload],
      };
    }

    case ACTIONS.UPDATE_ISSUE: {
      return {
        ...state,
        issues: state.issues.map((issue) =>
          issue.id === action.payload.id
            ? { ...issue, ...action.payload, updatedAt: new Date().toISOString() }
            : issue
        ),
      };
    }

    case ACTIONS.DELETE_ISSUE: {
      return {
        ...state,
        issues: state.issues.filter((issue) => issue.id !== action.payload.issueId),
        comments: state.comments.filter((c) => c.issueId !== action.payload.issueId),
        activities: state.activities.filter((a) => a.issueId !== action.payload.issueId),
      };
    }

    // ─── SPRINT ─────────────────────────────────────────────────────────────
    case ACTIONS.ADD_SPRINT: {
      return {
        ...state,
        sprints: [...state.sprints, action.payload],
      };
    }

    case ACTIONS.START_SPRINT: {
      const { sprintId } = action.payload;
      return {
        ...state,
        sprints: state.sprints.map((sprint) =>
          sprint.id === sprintId
            ? { ...sprint, status: 'Active' }
            : sprint
        ),
      };
    }

    case ACTIONS.COMPLETE_SPRINT: {
      const { sprintId } = action.payload;
      return {
        ...state,
        sprints: state.sprints.map((sprint) =>
          sprint.id === sprintId
            ? { ...sprint, status: 'Completed' }
            : sprint
        ),
        // Move incomplete issues back to backlog (sprintId = null)
        issues: state.issues.map((issue) => {
          if (issue.sprintId === sprintId && issue.status !== 'Done') {
            return { ...issue, sprintId: null, updatedAt: new Date().toISOString() };
          }
          return issue;
        }),
      };
    }

    // ─── AUTH ────────────────────────────────────────────────────────────────
    case ACTIONS.LOGIN: {
      return {
        ...state,
        auth: {
          isAuthenticated: true,
          currentUser: action.payload, // { id, role, unitId }
        },
      };
    }

    case ACTIONS.LOGOUT: {
      return {
        ...state,
        auth: {
          isAuthenticated: false,
          currentUser: null,
        },
      };
    }

    // ─── UNIT ────────────────────────────────────────────────────────────────
    case ACTIONS.ADD_UNIT: {
      return {
        ...state,
        units: [...state.units, action.payload],
      };
    }

    case ACTIONS.UPDATE_UNIT: {
      return {
        ...state,
        units: state.units.map(unit =>
          unit.id === action.payload.id ? { ...unit, ...action.payload } : unit
        ),
      };
    }

    default:
      return state;
  }
}

export default AppReducer;
