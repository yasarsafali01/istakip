import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

/**
 * Displays a progress bar for each project showing issue distribution
 * (To Do / In Progress / Done).
 *
 * @param {Object} props
 * @param {string} [props.unitId]    - Filter projects by unit ID
 * @param {string} [props.projectId] - Filter to a single project by ID
 */
function ProjectProgress({ unitId, projectId }) {
  const { state } = useAppContext();
  const navigate = useNavigate();

  let projects = state.projects;
  if (projectId) {
    projects = projects.filter(p => p.id === projectId);
  } else if (unitId) {
    projects = projects.filter(p => p.unitId === unitId);
  }

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title fw-semibold mb-3">Proje İlerlemesi</h6>

        {projects.length === 0 ? (
          <p className="text-muted small">Henüz proje yok.</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {projects.map((project) => {
              const projectIssues = state.issues.filter(
                (i) => i.projectId === project.id
              );
              const total = projectIssues.length;
              const done = projectIssues.filter((i) => i.status === 'Done').length;
              const inProgress = projectIssues.filter(
                (i) => i.status === 'In Progress' || i.status === 'In Review'
              ).length;
              const todo = total - done - inProgress;
              const donePercent = total ? Math.round((done / total) * 100) : 0;
              const inProgressPercent = total
                ? Math.round((inProgress / total) * 100)
                : 0;

              return (
                <li key={project.id} className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <button
                      className="btn btn-link p-0 text-decoration-none fw-semibold small"
                      onClick={() => navigate(`/projects/${project.id}?tab=board`)}
                    >
                      {project.name}
                    </button>
                    <span className="text-muted small">{total} issue</span>
                  </div>

                  {/* Segmented progress bar */}
                  <div
                    className="progress"
                    style={{ height: 8 }}
                    role="progressbar"
                    aria-label={`${project.name} ilerleme`}
                    aria-valuenow={donePercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-bar"
                      style={{ width: `${donePercent}%`, backgroundColor: '#00875A' }}
                      title={`Done: ${done}`}
                    />
                    <div
                      className="progress-bar"
                      style={{ width: `${inProgressPercent}%`, backgroundColor: '#0052CC' }}
                      title={`In Progress: ${inProgress}`}
                    />
                    <div
                      className="progress-bar"
                      style={{
                        width: `${100 - donePercent - inProgressPercent}%`,
                        backgroundColor: '#DFE1E6',
                      }}
                      title={`To Do: ${todo}`}
                    />
                  </div>

                  <div className="d-flex gap-3 mt-1">
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      <span
                        className="d-inline-block rounded-circle me-1"
                        style={{ width: 8, height: 8, backgroundColor: '#00875A' }}
                        aria-hidden="true"
                      />
                      Done {done}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      <span
                        className="d-inline-block rounded-circle me-1"
                        style={{ width: 8, height: 8, backgroundColor: '#0052CC' }}
                        aria-hidden="true"
                      />
                      In Progress {inProgress}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      <span
                        className="d-inline-block rounded-circle me-1"
                        style={{ width: 8, height: 8, backgroundColor: '#DFE1E6' }}
                        aria-hidden="true"
                      />
                      To Do {todo}
                    </span>
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

export default ProjectProgress;
