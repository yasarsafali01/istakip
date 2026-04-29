import React from 'react';
import { useAppContext } from '../../context/AppContext';
import Avatar from '../common/Avatar';
import { timeAgo } from '../../utils/dateUtils';

/**
 * Shows the 10 most recent activities across all projects.
 */
function RecentActivity() {
  const { state } = useAppContext();

  // Activities are stored newest-first in the reducer
  const recent = state.activities.slice(0, 10);

  function getUser(userId) {
    return state.users.find((u) => u.id === userId);
  }

  function getIssue(issueId) {
    return state.issues.find((i) => i.id === issueId);
  }

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title fw-semibold mb-3">Son Aktiviteler</h6>

        {recent.length === 0 ? (
          <p className="text-muted small">Henüz aktivite yok.</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {recent.map((activity) => {
              const user = getUser(activity.userId);
              const issue = getIssue(activity.issueId);

              return (
                <li key={activity.id} className="d-flex gap-2 mb-3">
                  {user && (
                    <Avatar
                      name={user.name}
                      color={user.avatarColor}
                      size={28}
                      className="flex-shrink-0 mt-1"
                    />
                  )}
                  <div className="flex-grow-1 overflow-hidden">
                    <p className="mb-0 small text-truncate">
                      <span className="fw-semibold">{user?.name ?? 'Bilinmeyen'}</span>{' '}
                      {activity.description}
                      {issue && (
                        <span className="text-muted ms-1">
                          — {issue.title}
                        </span>
                      )}
                    </p>
                    <p className="mb-0 text-muted" style={{ fontSize: '0.7rem' }}>
                      {timeAgo(activity.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default RecentActivity;
