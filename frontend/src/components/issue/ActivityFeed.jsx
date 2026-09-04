import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Avatar from '../common/Avatar';
import { timeAgo } from '../../utils/dateUtils';
import { ACTIONS, ACTIVITY_TYPES } from '../../constants';
import { activitiesApi } from '../../api/resources';
import {
  TbArrowsExchange,
  TbUserCheck,
  TbMessage,
  TbEdit,
  TbPlus,
} from 'react-icons/tb';

const ACTIVITY_ICONS = {
  [ACTIVITY_TYPES.STATUS_CHANGE]: TbArrowsExchange,
  [ACTIVITY_TYPES.ASSIGNMENT]: TbUserCheck,
  [ACTIVITY_TYPES.COMMENT]: TbMessage,
  [ACTIVITY_TYPES.FIELD_UPDATE]: TbEdit,
  [ACTIVITY_TYPES.CREATED]: TbPlus,
};

/**
 * Displays the activity history for a given issue, newest first.
 *
 * @param {Object} props
 * @param {string} props.issueId - The issue whose activities are shown
 */
function ActivityFeed({ issueId }) {
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    activitiesApi.listByIssue(issueId).then((activities) => {
      dispatch({ type: ACTIONS.SET_ACTIVITIES_FOR_ISSUE, payload: { issueId, activities } });
    }).catch(() => {});
  }, [issueId, dispatch]);

  // Activities are stored newest-first; filter by issueId
  const activities = state.activities.filter((a) => a.issueId === issueId);

  function getUser(userId) {
    return state.users.find((u) => u.id === userId);
  }

  if (activities.length === 0) {
    return (
      <div>
        <h6 className="fw-semibold mb-2">Aktivite</h6>
        <p className="text-muted small">Henüz aktivite yok.</p>
      </div>
    );
  }

  return (
    <div>
      <h6 className="fw-semibold mb-3">Aktivite</h6>
      <ul className="list-unstyled mb-0">
        {activities.map((activity) => {
          const user = getUser(activity.userId);
          const Icon = ACTIVITY_ICONS[activity.type] || TbEdit;

          return (
            <li key={activity.id} className="d-flex gap-2 mb-3">
              <div className="position-relative flex-shrink-0">
                <Avatar
                  name={user?.name ?? '?'}
                  color={user?.avatarColor}
                  size={28}
                />
                <span
                  className="position-absolute bottom-0 end-0 d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: '#fff',
                    border: '1px solid #DFE1E6',
                  }}
                  aria-hidden="true"
                >
                  <Icon size={9} color="#42526E" />
                </span>
              </div>

              <div className="flex-grow-1">
                <p className="mb-0 small">
                  <span className="fw-semibold">{user?.name ?? 'Bilinmeyen'}</span>{' '}
                  {activity.description}
                </p>
                <p className="mb-0 text-muted" style={{ fontSize: '0.7rem' }}>
                  {timeAgo(activity.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ActivityFeed;
