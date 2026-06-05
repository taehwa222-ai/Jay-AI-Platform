import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CrownOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getHealth, getManual, getModules, getMonetizationIdeas, getOverview, getRoadmap } from './api';
import type {
  HealthStatus,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
} from './types';

const stockPlan = [
  {
    title: '국내 종목 분석',
    body: '가격, 거래량, 재무, 공시, 뉴스 요약을 모아 종목별 분석 리포트를 만듭니다.',
  },
  {
    title: '추천 후보 목록',
    body: '매수 지시가 아니라 조건 기반 관심 후보와 근거를 보여주는 방식으로 시작합니다.',
  },
  {
    title: '내 주식 관리',
    body: '보유 종목, 매수가, 비중, 손익, 리스크 메모, 리밸런싱 체크리스트를 관리합니다.',
  },
  {
    title: '규제 안전장치',
    body: '수익 보장 표현, 맞춤 매매 지시, 양방향 유료 리딩방 형태는 별도 검토 대상으로 둡니다.',
  },
];

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [manual, setManual] = useState<ManualSection[]>([]);
  const [ideas, setIdeas] = useState<MonetizationIdea[]>([]);
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
      const [healthResult, overviewResult, modulesResult, manualResult, ideasResult, roadmapResult] =
        await Promise.all([
          getHealth(),
          getOverview(),
          getModules(),
          getManual(),
          getMonetizationIdeas(),
          getRoadmap(),
        ]);
      setHealth(healthResult);
      setOverview(overviewResult);
      setModules(modulesResult);
      setManual(manualResult);
      setIdeas(ideasResult);
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
          <a href="#access">
            <TeamOutlined />
            회원/관리
          </a>
          <a href="#manual">
            <BookOutlined />
            사용 매뉴얼
          </a>
          <a href="#stocks">
            <BarChartOutlined />
            국내주식
          </a>
          <a href="#revenue">
            <DollarOutlined />
            수익화
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
            <span className="eyebrow">AI Revenue Platform</span>
            <h1>AI 수익화 운영 콘솔</h1>
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
          <StatusTile label="우선순위" value="회원/관리" tone="steady" />
          <StatusTile label="운영 형태" value="VPS 배포형" />
        </section>

        <section className="hero-panel">
          <div>
            <span className="state-chip">{overview?.status ?? 'loading'}</span>
            <h2>{overview?.name ?? 'Jay AI Platform'}</h2>
            <p>{overview?.message ?? 'Loading platform overview.'}</p>
          </div>
          <div className="hero-actions">
            <a href="#manual">
              <BookOutlined />
              매뉴얼 보기
            </a>
            <a href="#access">
              <LockOutlined />
              권한 설계
            </a>
          </div>
        </section>

        <section className="section-block" id="access">
          <SectionTitle
            eyebrow="Access First"
            icon={<SafetyCertificateOutlined />}
            title="회원가입/로그인과 관리페이지"
          />
          <div className="access-grid">
            <article className="tool-pane">
              <div className="pane-title">
                <UserAddOutlined />
                <h3>회원 기능</h3>
              </div>
              <div className="pane-body">
                <p>다음 개발 단계에서 실제 회원가입, 로그인, 비밀번호 재설정, 세션 관리를 붙입니다.</p>
                <ul className="check-list">
                  <li>이메일 회원가입</li>
                  <li>로그인/로그아웃</li>
                  <li>JWT 또는 세션 인증</li>
                  <li>일반 회원과 관리자 권한 분리</li>
                </ul>
              </div>
            </article>
            <article className="tool-pane">
              <div className="pane-title">
                <CrownOutlined />
                <h3>관리 기능</h3>
              </div>
              <div className="pane-body">
                <p>운영자는 회원, 사용량, 권한, 기능 공개 여부, 공지사항을 관리하게 됩니다.</p>
                <ul className="check-list">
                  <li>회원 목록</li>
                  <li>관리자 권한 설정</li>
                  <li>기능별 사용량</li>
                  <li>결제/구독 관리 준비</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section className="section-block">
          <SectionTitle eyebrow="Service Map" icon={<AppstoreOutlined />} title="개발할 모듈 구조" />
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" key={module.id}>
                <div className="card-head">
                  <h3>{module.title}</h3>
                  <span>{module.status}</span>
                </div>
                <p>{module.description}</p>
                <ul>
                  {module.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="manual">
          <SectionTitle
            eyebrow="Manual Screen"
            icon={<BookOutlined />}
            title="로컬 개발부터 VPS 배포까지"
          />
          <div className="manual-list">
            {manual.map((section) => (
              <article className="manual-card" key={section.id}>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.summary}</p>
                </div>
                <div className="command-list">
                  {section.commands.map((command) => (
                    <code key={command}>{command}</code>
                  ))}
                </div>
                <ul className="check-list">
                  {section.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="stocks">
          <SectionTitle eyebrow="Korea Stock Lab" icon={<BarChartOutlined />} title="국내 주식 분석과 내 주식 관리" />
          <div className="stock-grid">
            {stockPlan.map((item) => (
              <article className="stock-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="revenue">
          <SectionTitle eyebrow="Revenue Lab" icon={<DollarOutlined />} title="수익 창출 아이디어" />
          <div className="idea-grid">
            {ideas.map((idea) => (
              <article className="idea-card" key={idea.id}>
                <h3>{idea.title}</h3>
                <dl>
                  <dt>모델</dt>
                  <dd>{idea.model}</dd>
                  <dt>주의</dt>
                  <dd>{idea.risk}</dd>
                  <dt>다음 작업</dt>
                  <dd>{idea.next_step}</dd>
                </dl>
              </article>
            ))}
          </div>
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

function SectionTitle({ eyebrow, icon, title }: { eyebrow: string; icon: ReactNode; title: string }) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <span className="section-icon">{icon}</span>
    </div>
  );
}
