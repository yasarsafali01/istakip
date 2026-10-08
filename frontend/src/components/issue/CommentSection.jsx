import React, { useState, useEffect, useCallback } from 'react';
import { TbTrash, TbSend, TbTemplate } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ACTIONS } from '../../constants';
import { commentsApi, activitiesApi, templatesApi } from '../../api/resources';
import { timeAgo } from '../../utils/dateUtils';
import { fillTemplate } from '../../utils/templateUtils';
import Avatar from '../common/Avatar';
import ConfirmDialog from '../common/ConfirmDialog';

/**
 * Comment list with add and delete functionality for a given issue.
 *
 * @param {Object} props
 * @param {string} props.issueId - The issue whose comments are shown
 */
function CommentSection({ issueId }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const issue = state.issues.find((i) => i.id === issueId);
  const project = state.projects.find((p) => p.id === issue?.projectId);
  const reporter = state.users.find((u) => u.id === issue?.reporterId);

  useEffect(() => {
    if (!project) return;
    templatesApi.listByProject(project.id, { kind: 'reply' }).then(setTemplates).catch(() => {});
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function insertTemplate(tmpl) {
    setText(fillTemplate(tmpl.body, { issue, project, currentUser, reporterName: reporter?.name }));
    setTemplatesOpen(false);
  }

  const loadComments = useCallback(() => {
    commentsApi.listByIssue(issueId).then((comments) => {
      dispatch({ type: ACTIONS.SET_COMMENTS_FOR_ISSUE, payload: { issueId, comments } });
    }).catch(() => {});
  }, [issueId, dispatch]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const comments = state.comments
    .filter((c) => c.issueId === issueId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  function getUser(userId) {
    return state.users.find((u) => u.id === userId);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || !currentUser) return;

    try {
      await commentsApi.create(issueId, text.trim());
      setText('');
      loadComments();
      activitiesApi.listByIssue(issueId).then((activities) => {
        dispatch({ type: ACTIONS.SET_ACTIVITIES_FOR_ISSUE, payload: { issueId, activities } });
      }).catch(() => {});
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await commentsApi.delete(deleteTarget);
      loadComments();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <h6 className="fw-semibold mb-3">Yorumlar ({comments.length})</h6>

      {/* Comment list */}
      {comments.length > 0 && (
        <ul className="list-unstyled mb-3">
          {comments.map((comment) => {
            const author = getUser(comment.authorId);
            const isOwn = currentUser && comment.authorId === currentUser.id;

            return (
              <li key={comment.id} className="d-flex gap-2 mb-3">
                <Avatar
                  name={author?.name ?? '?'}
                  color={author?.avatarColor}
                  size={30}
                  className="flex-shrink-0 mt-1"
                />
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-semibold small">{author?.name ?? 'Bilinmeyen'}</span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {timeAgo(comment.createdAt)}
                    </span>
                    {isOwn && (
                      <button
                        className="btn btn-link btn-sm p-0 ms-auto text-danger"
                        onClick={() => setDeleteTarget(comment.id)}
                        aria-label="Yorumu sil"
                      >
                        <TbTrash size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p
                    className="mb-0 small p-2 rounded"
                    style={{
                      backgroundColor: comment.text.startsWith('✅') ? '#E3FCEF' : '#F4F5F7',
                      whiteSpace: 'pre-wrap',
                      borderLeft: comment.text.startsWith('✅') ? '3px solid #00875A' : 'none',
                    }}
                  >
                    {comment.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add comment form */}
      {currentUser && (
        <form onSubmit={handleSubmit} className="d-flex gap-2 align-items-start">
          <Avatar
            name={currentUser.name ?? '?'}
            color={currentUser.avatarColor}
            size={30}
            className="flex-shrink-0 mt-1"
          />
          <div className="flex-grow-1">
            <textarea
              className="form-control form-control-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Yorum yaz…"
              aria-label="Yorum metni"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit(e);
                }
              }}
            />
            <div className="d-flex justify-content-end gap-2 mt-1 position-relative">
              {templates.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={() => setTemplatesOpen((o) => !o)}
                  >
                    <TbTemplate size={14} aria-hidden="true" />
                    Şablon
                  </button>
                  {templatesOpen && (
                    <>
                      <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setTemplatesOpen(false)} />
                      <div
                        className="position-absolute bg-white rounded shadow p-1"
                        style={{ zIndex: 1050, bottom: '110%', right: 0, minWidth: 200, border: '1px solid #DFE1E6' }}
                      >
                        {templates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="btn btn-sm w-100 text-start btn-light mb-1"
                            style={{ fontSize: '0.8rem' }}
                            onClick={() => insertTemplate(t)}
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              <button
                type="submit"
                className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                disabled={!text.trim()}
              >
                <TbSend size={14} aria-hidden="true" />
                Gönder
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Yorumu Sil"
        message="Bu yorumu silmek istediğinizden emin misiniz?"
        confirmText="Sil"
      />
    </div>
  );
}

export default CommentSection;
