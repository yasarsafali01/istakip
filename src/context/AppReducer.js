import { ACTIONS } from '../constants';

/**
 * Pure reducer function for the application state.
 * Handles all state transitions based on dispatched actions.
 */
function AppReducer(state, action) {
  switch (action.type) {
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
        // Also remove associated comments and activities
        comments: state.comments.filter((c) => c.issueId !== action.payload.issueId),
        activities: state.activities.filter((a) => a.issueId !== action.payload.issueId),
      };
    }

    case ACTIONS.MOVE_ISSUE: {
      // Drag-and-drop status change on the board
      const { issueId, newStatus } = action.payload;
      return {
        ...state,
        issues: state.issues.map((issue) => {
          if (issue.id !== issueId) return issue;
          const now = new Date().toISOString();
          // Req 19.8: auto-fill resolvedAt when status becomes 'Done' and resolvedAt is empty
          const resolvedAt =
            newStatus === 'Done' && !issue.resolvedAt ? now : issue.resolvedAt;
          return { ...issue, status: newStatus, resolvedAt, updatedAt: now };
        }),
      };
    }

    // ─── REQUEST ASSIGNEE ────────────────────────────────────────────────────
    case ACTIONS.UPDATE_REQUEST_ASSIGNEE: {
      const { issueId, assigneeId } = action.payload;
      return {
        ...state,
        issues: state.issues.map((issue) =>
          issue.id === issueId
            ? { ...issue, assigneeId, updatedAt: new Date().toISOString() }
            : issue
        ),
      };
    }

    // ─── CLONE REQUEST ───────────────────────────────────────────────────────
    case ACTIONS.CLONE_REQUEST: {
      const { sourceIssueId, newId, newNumber, clonedAt } = action.payload;
      const source = state.issues.find((i) => i.id === sourceIssueId);
      if (!source) return state;
      const cloned = {
        ...source,
        id: newId,
        number: newNumber,
        title: `${source.title} (Kopya)`,
        status: 'To Do',
        resolvedAt: null,
        timeSpent: 0,
        createdAt: clonedAt,
        updatedAt: clonedAt,
        visibleTo: [],
        assigneeId: null,
      };
      return {
        ...state,
        issues: [...state.issues, cloned],
      };
    }

    // ─── UPDATE REQUEST DATES ────────────────────────────────────────────────
    case ACTIONS.UPDATE_REQUEST_DATES: {
      const { issueId, resolvedAt, timeSpent } = action.payload;
      return {
        ...state,
        issues: state.issues.map((issue) =>
          issue.id === issueId
            ? { ...issue, resolvedAt, timeSpent, updatedAt: new Date().toISOString() }
            : issue
        ),
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

    case ACTIONS.ASSIGN_ISSUE_TO_SPRINT: {
      const { issueId, sprintId } = action.payload;
      return {
        ...state,
        issues: state.issues.map((issue) =>
          issue.id === issueId
            ? { ...issue, sprintId, updatedAt: new Date().toISOString() }
            : issue
        ),
      };
    }

    // ─── COMMENT ────────────────────────────────────────────────────────────
    case ACTIONS.ADD_COMMENT: {
      return {
        ...state,
        comments: [...state.comments, action.payload],
      };
    }

    case ACTIONS.DELETE_COMMENT: {
      return {
        ...state,
        comments: state.comments.filter((c) => c.id !== action.payload.commentId),
      };
    }

    // ─── ACTIVITY ───────────────────────────────────────────────────────────
    case ACTIONS.ADD_ACTIVITY: {
      return {
        ...state,
        // Prepend so the list is always newest-first
        activities: [action.payload, ...state.activities],
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

    // ─── VISIBLE_TO ──────────────────────────────────────────────────────────
    case ACTIONS.ADD_VISIBLE_USER: {
      const { issueId, userId } = action.payload;
      return {
        ...state,
        issues: state.issues.map(issue =>
          issue.id === issueId && !issue.visibleTo.includes(userId)
            ? { ...issue, visibleTo: [...issue.visibleTo, userId], updatedAt: new Date().toISOString() }
            : issue
        ),
      };
    }

    default:
      return state;
  }
}

export default AppReducer;
