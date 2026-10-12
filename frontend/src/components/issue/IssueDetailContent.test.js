import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IssueDetailContent from './IssueDetailContent';
import AppContext from '../../context/AppContext';
import { issuesApi, commentsApi, activitiesApi, templatesApi } from '../../api/resources';
import { seedUsers, seedProjects, seedUnits, seedIssues } from '../../data/seedData';
import { ACTIONS } from '../../constants';

// The component only talks to the backend through these resources.
jest.mock('../../api/resources', () => ({
  issuesApi: {
    get: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateAssignee: jest.fn(),
    updateDates: jest.fn(),
    delete: jest.fn(),
    addVisibleUser: jest.fn(),
    assignees: jest.fn(),
  },
  commentsApi: { listByIssue: jest.fn(), create: jest.fn(), delete: jest.fn() },
  activitiesApi: { listByIssue: jest.fn() },
  templatesApi: { listByProject: jest.fn() },
}));

const NO_ACTIONS = {
  edit: false, delete: false, changeStatus: false, complete: false, approve: false, assign: false, reject: false,
  forward: false, cancel: false, rate: false, clone: false, share: false, moveSprint: false, editDates: false, comment: true,
};
const ALL_ACTIONS = Object.fromEntries(Object.keys(NO_ACTIONS).map((k) => [k, true]));

const baseRequest = seedIssues.find((i) => i.id === 'issue-bigd1-req1');
const deptHead = seedUsers.find((u) => u.id === 'user-bigd-head');

function renderIssue({ actions = NO_ACTIONS, readonly = false, user = deptHead } = {}) {
  const issue = { ...baseRequest, allowedActions: actions };
  const dispatch = jest.fn();
  const state = {
    auth: { isAuthenticated: true, currentUser: { id: user.id, role: user.role, unitId: user.unitId } },
    users: seedUsers,
    projects: seedProjects,
    units: seedUnits,
    issues: [issue],
    sprints: [],
    comments: [],
    activities: [],
  };
  render(
    <AppContext.Provider value={{ state, dispatch }}>
      <IssueDetailContent issue={issue} onClose={jest.fn()} readonly={readonly} />
    </AppContext.Provider>
  );
  return { issue, dispatch };
}

// CRA resets mock implementations before every test (resetMocks), so defaults live here.
beforeEach(() => {
  commentsApi.listByIssue.mockResolvedValue([]);
  activitiesApi.listByIssue.mockResolvedValue([]);
  templatesApi.listByProject.mockResolvedValue([]);
  issuesApi.assignees.mockResolvedValue({ users: seedUsers.slice(0, 3), teams: [] });
  issuesApi.update.mockResolvedValue({});
  issuesApi.get.mockImplementation((id) => Promise.resolve({ ...baseRequest, id, key: baseRequest.number }));
});

describe('buttons follow allowedActions from the backend', () => {
  test('no actions: no edit, delete, reject or status buttons', () => {
    renderIssue();
    expect(screen.queryByRole('button', { name: /düzenle/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^sil$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /geri çevir/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^ata$/i })).toBeNull();
  });

  test('all actions: edit, delete, reject and assign buttons are shown', () => {
    renderIssue({ actions: ALL_ACTIONS });
    expect(screen.getByRole('button', { name: /düzenle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sil$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /geri çevir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ata$/i })).toBeInTheDocument();
  });

  test('the role alone grants nothing: a Daire Başkanı without edit permission sees no edit button', () => {
    renderIssue({ actions: { ...NO_ACTIONS, delete: true } });
    expect(screen.queryByRole('button', { name: /düzenle/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^sil$/i })).toBeInTheDocument();
  });

  test('readonly hides every action even when the backend allows it', () => {
    renderIssue({ actions: ALL_ACTIONS, readonly: true });
    expect(screen.queryByRole('button', { name: /düzenle/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^sil$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /geri çevir/i })).toBeNull();
  });
});

describe('assignee options', () => {
  test('are loaded from the backend when the user may assign', async () => {
    renderIssue({ actions: { ...NO_ACTIONS, assign: true } });
    await waitFor(() => expect(issuesApi.assignees).toHaveBeenCalledWith(baseRequest.id, undefined));
  });

  test('are not requested when the user may not assign', () => {
    renderIssue();
    expect(issuesApi.assignees).not.toHaveBeenCalled();
  });
});

describe('editing', () => {
  test('a request in edit mode shows the müdürlük picker', () => {
    renderIssue({ actions: ALL_ACTIONS });
    fireEvent.click(screen.getByRole('button', { name: /düzenle/i }));
    expect(screen.getByTestId('project-select')).toBeInTheDocument();
  });

  test('saving sends the edited fields to the API and refreshes the issue', async () => {
    const { dispatch } = renderIssue({ actions: ALL_ACTIONS });
    fireEvent.click(screen.getByRole('button', { name: /düzenle/i }));
    fireEvent.change(screen.getByDisplayValue(baseRequest.title), { target: { value: 'VPN erişimi (güncel)' } });
    fireEvent.click(screen.getByRole('button', { name: /kaydet/i }));

    await waitFor(() => expect(issuesApi.update).toHaveBeenCalledTimes(1));
    expect(issuesApi.update).toHaveBeenCalledWith(baseRequest.id, expect.objectContaining({
      title: 'VPN erişimi (güncel)',
      description: baseRequest.description,
      priority: baseRequest.priority,
      projectId: baseRequest.projectId,
    }));
    // Status and assignee were untouched, so only the fields update is sent.
    expect(issuesApi.updateStatus).not.toHaveBeenCalled();
    expect(issuesApi.updateAssignee).not.toHaveBeenCalled();
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: ACTIONS.UPDATE_ISSUE })));
  });
});
