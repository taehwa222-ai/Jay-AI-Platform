import {
  ApiOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getHealth, getOverview, getRoadmap } from './api';
import type { HealthStatus, PlatformOverview, RoadmapPhase } from './types';

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshState();
  }, []);

  async function refreshState() {
    setLoading(true);
    setError(null);

    try {
      const [healthResult, overviewResult, roadmapResult] = await Promise.all([
        getHealth(),
        getOverview(),
        getRoadmap(),
      ]);
      setHealth(healthResult);
      setOverview(overviewResult);
      setRoadmap(roadmapResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <DeploymentUnitOutlined />
          <span>Jay AI Platform</span>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <a href="#foundation">
            <CloudServerOutlined />
            Foundation
          </a>
          <a href="#modules">
            <AppstoreOutlined />
            Modules
          </a>
          <a href="#roadmap">
            <CodeOutlined />
            Roadmap
          </a>
        </nav>
        <div className="sidebar-status">
          <span className={`status-dot ${health?.ok ? 'online' : ''}`} />
          <span>{health?.ok ? 'server online' : 'checking server'}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Custom AI Platform</span>
            <h1>Clean Platform Base</h1>
          </div>
          <button
            className="icon-button"
            disabled={loading}
            onClick={() => void refreshState()}
            title="Refresh"
            type="button"
          >
            <ReloadOutlined />
          </button>
        </header>

        {error && <div className="error-box">{error}</div>}

        <section className="metric-band" id="foundation">
          <StatusTile label="API" value={health?.ok ? 'Online' : 'Checking'} tone={health?.ok ? 'good' : 'muted'} />
          <StatusTile label="Environment" value={health?.env ?? 'loading'} />
          <StatusTile label="Deployment" value="VPS Ready" tone="steady" />
        </section>

        <section className="dashboard-grid">
          <article className="tool-pane overview-pane">
            <div className="pane-title">
              <ApiOutlined />
              <h2>{overview?.name ?? 'Jay AI Platform'}</h2>
            </div>
            <div className="pane-body">
              <span className="state-chip">{overview?.status ?? 'loading'}</span>
              <p>{overview?.message ?? 'Loading platform overview.'}</p>
            </div>
          </article>

          <article className="tool-pane module-pane" id="modules">
            <div className="pane-title">
              <AppstoreOutlined />
              <h2>Custom Modules</h2>
            </div>
            <div className="pane-body">
              {overview?.modules.length ? (
                <ul className="module-list">
                  {overview.modules.map((module) => (
                    <li key={module}>{module}</li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">No custom modules yet.</div>
              )}
            </div>
          </article>
        </section>

        <section className="phase-list" id="roadmap">
          {roadmap.map((phase) => (
            <article className="phase-card" key={phase.id}>
              <div className="phase-head">
                <h3>{phase.title}</h3>
                <span>{phase.status}</span>
              </div>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>
                    <CheckCircleOutlined />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'muted' | 'steady';
}) {
  return (
    <div className={`status-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
