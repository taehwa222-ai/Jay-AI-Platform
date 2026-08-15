import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEmoticonProjects, getOperations, getYoutubeProjects } from '../api';
import type {
  EmoticonProjectSummary,
  OperationsOverview,
  StockAnalysisRecord,
  StockHolding,
  StockWatchlistItem,
  UserAccount,
  YoutubeProjectSummary,
} from '../types';
import { formatWon } from '../utils';

type HomeDashboardProps = {
  active: boolean;
  canAccessContentOps: boolean;
  canAccessStocks: boolean;
  canManageUsers: boolean;
  currentUser: UserAccount;
  holdings: StockHolding[];
  onOpenAccount: () => void;
  onOpenContentOps: () => void;
  onOpenOperations: () => void;
  onOpenStocks: () => void;
  pendingUserCount: number;
  stockAnalysisRecords: StockAnalysisRecord[];
  token: string;
  watchlist: StockWatchlistItem[];
};

type HomeTask = {
  id: string;
  title: string;
  description: string;
  label: string;
  tone: 'attention' | 'steady' | 'good';
  onOpen: () => void;
};

export function HomeDashboard({
  active,
  canAccessContentOps,
  canAccessStocks,
  canManageUsers,
  currentUser,
  holdings,
  onOpenAccount,
  onOpenContentOps,
  onOpenOperations,
  onOpenStocks,
  pendingUserCount,
  stockAnalysisRecords,
  token,
  watchlist,
}: HomeDashboardProps) {
  const [youtubeProjects, setYoutubeProjects] = useState<YoutubeProjectSummary[]>([]);
  const [emoticonProjects, setEmoticonProjects] = useState<EmoticonProjectSummary[]>([]);
  const [operations, setOperations] = useState<OperationsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const [youtube, emoticon, operationsOverview] = await Promise.all([
        canAccessContentOps ? getYoutubeProjects(token) : Promise.resolve([]),
        canAccessContentOps ? getEmoticonProjects(token) : Promise.resolve([]),
        canManageUsers ? getOperations(token) : Promise.resolve(null),
      ]);
      setYoutubeProjects(youtube);
      setEmoticonProjects(emoticon);
      setOperations(operationsOverview);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '홈 요약을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [canAccessContentOps, canManageUsers, token]);

  useEffect(() => {
    if (active) void loadHome();
  }, [active, loadHome]);

  const analyzedTickers = useMemo(
    () => new Set(stockAnalysisRecords.map((record) => record.ticker)),
    [stockAnalysisRecords],
  );
  const unreviewedWatchlist = watchlist.filter((item) => !analyzedTickers.has(item.ticker));
  const portfolioValue = holdings.reduce((total, holding) => total + holding.market_value, 0);
  const contentInProgress = youtubeProjects.filter((project) => !project.has_production).length
    + emoticonProjects.filter((project) => !project.has_review).length;

  const tasks: HomeTask[] = [
    ...(canManageUsers && pendingUserCount > 0 ? [{
      id: 'pending-users',
      title: `가입 승인 ${pendingUserCount}건`,
      description: '새 구성원의 역할과 모듈 접근 권한을 확인하세요.',
      label: '사용자 검토',
      tone: 'attention' as const,
      onOpen: onOpenAccount,
    }] : []),
    ...(canAccessStocks && unreviewedWatchlist.length > 0 ? [{
      id: 'watchlist-review',
      title: `미분석 관심종목 ${unreviewedWatchlist.length}개`,
      description: `${unreviewedWatchlist.slice(0, 3).map((item) => item.name || item.ticker).join(', ')}${unreviewedWatchlist.length > 3 ? ' 외' : ''}`,
      label: '주식 검토',
      tone: 'steady' as const,
      onOpen: onOpenStocks,
    }] : []),
    ...(canAccessContentOps && contentInProgress > 0 ? [{
      id: 'content-progress',
      title: `진행 중 콘텐츠 ${contentInProgress}건`,
      description: '대본·제작·검수 단계가 남은 프로젝트를 이어서 작업하세요.',
      label: '콘텐츠 작업',
      tone: 'steady' as const,
      onOpen: onOpenContentOps,
    }] : []),
    ...(canManageUsers && operations?.errors_last_24h ? [{
      id: 'server-errors',
      title: `최근 서버 오류 ${operations.errors_last_24h}건`,
      description: '오류 경로와 발생 시각을 운영 현황에서 확인하세요.',
      label: '운영 점검',
      tone: 'attention' as const,
      onOpen: onOpenOperations,
    }] : []),
  ];

  const recentContent = [
    ...youtubeProjects.map((project) => ({
      id: `youtube-${project.slug}`,
      kind: 'YouTube',
      title: project.slug,
      updatedAt: project.updated_at,
      ready: project.has_production,
    })),
    ...emoticonProjects.map((project) => ({
      id: `emoticon-${project.slug}`,
      kind: '이모티콘',
      title: project.slug,
      updatedAt: project.updated_at,
      ready: project.has_review,
    })),
  ].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)).slice(0, 4);

  return (
    <section
      aria-label="오늘의 업무 대시보드"
      className={active ? 'section-block home-dashboard' : 'screen-hidden'}
      id="home"
    >
      <div className="home-hero">
        <div>
          <span className="workspace-kicker"><CheckCircleOutlined /> EXECUTIVE HOME</span>
          <h2>{greeting()}, {currentUser.name}님</h2>
          <p>지금 확인해야 할 업무부터 순서대로 정리했습니다.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => void loadHome()} type="button">
          <ReloadOutlined spin={loading} /> 요약 새로고침
        </button>
      </div>

      {message && <div className="error-box" role="alert">{message}</div>}

      <div className="home-metric-grid">
        <HomeMetric icon={<BarChartOutlined />} label="보유 평가액" value={canAccessStocks ? formatWon(portfolioValue) : '권한 없음'} />
        <HomeMetric icon={<FileTextOutlined />} label="분석 기록" value={canAccessStocks ? `${stockAnalysisRecords.length}개` : '권한 없음'} />
        <HomeMetric icon={<VideoCameraOutlined />} label="진행 중 콘텐츠" value={canAccessContentOps ? `${contentInProgress}건` : '권한 없음'} />
        <HomeMetric icon={<CloudServerOutlined />} label="시스템 상태" tone={operations?.status === 'attention' ? 'attention' : 'good'} value={canManageUsers ? operations?.status === 'attention' ? '확인 필요' : '정상' : '관리자 전용'} />
      </div>

      <div className="home-main-grid">
        <article className="home-panel home-task-panel">
          <PanelHeader count={tasks.length} eyebrow="TODAY" title="오늘 확인할 업무" />
          {loading && tasks.length === 0 ? (
            <div className="home-loading" role="status"><span className="loading-spinner" />업무 요약을 불러오는 중</div>
          ) : tasks.length > 0 ? (
            <div className="home-task-list">
              {tasks.map((task) => (
                <button className={`home-task-row ${task.tone}`} key={task.id} onClick={task.onOpen} type="button">
                  <span className="home-task-indicator" />
                  <span><small>{task.label}</small><strong>{task.title}</strong><em>{task.description}</em></span>
                  <ArrowRightOutlined />
                </button>
              ))}
            </div>
          ) : (
            <div className="home-empty"><CheckCircleOutlined /><span><strong>긴급하게 확인할 업무가 없습니다</strong><small>각 워크스페이스에서 새 작업을 시작할 수 있습니다.</small></span></div>
          )}
        </article>

        <article className="home-panel home-quick-panel">
          <PanelHeader eyebrow="QUICK START" title="바로가기" />
          <div className="home-quick-grid">
            {canAccessStocks && <QuickButton icon={<BarChartOutlined />} label="주식 분석" onClick={onOpenStocks} />}
            {canAccessContentOps && <QuickButton icon={<VideoCameraOutlined />} label="Content Ops" onClick={onOpenContentOps} />}
            {canManageUsers && <QuickButton icon={<CloudServerOutlined />} label="운영 현황" onClick={onOpenOperations} />}
            <QuickButton icon={<TeamOutlined />} label="사내 계정" onClick={onOpenAccount} />
          </div>
          {operations && (
            <div className="home-system-strip">
              <span className={operations.status === 'healthy' ? 'online' : 'attention'} />
              <span><strong>{operations.status === 'healthy' ? '시스템 정상 운영 중' : '운영 상태 확인 필요'}</strong><small>AI {operations.ai_usage.today_count}/{operations.ai_usage.daily_limit} · 오류 {operations.errors_last_24h}건 · DB {operations.database.journal_mode.toUpperCase()}</small></span>
            </div>
          )}
        </article>
      </div>

      {canAccessContentOps && (
        <article className="home-panel home-content-panel">
          <PanelHeader count={recentContent.length} eyebrow="RECENT CONTENT" title="최근 콘텐츠" />
          {recentContent.length > 0 ? (
            <div className="home-content-list">
              {recentContent.map((content) => (
                <button key={content.id} onClick={onOpenContentOps} type="button">
                  <span className="home-content-kind">{content.kind}</span>
                  <span><strong>{content.title}</strong><small>{formatUpdatedAt(content.updatedAt)}</small></span>
                  <em className={content.ready ? 'ready' : ''}>{content.ready ? '검수 완료' : '진행 중'}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="home-empty compact"><FileTextOutlined /><span><strong>아직 콘텐츠 프로젝트가 없습니다</strong><small>Content Ops에서 첫 프로젝트를 시작하세요.</small></span></div>
          )}
        </article>
      )}
    </section>
  );
}

function HomeMetric({ icon, label, tone = 'steady', value }: { icon: ReactNode; label: string; tone?: 'steady' | 'good' | 'attention'; value: string }) {
  return <article className={`home-metric ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function PanelHeader({ count, eyebrow, title }: { count?: number; eyebrow: string; title: string }) {
  return <div className="home-panel-header"><span><small>{eyebrow}</small><strong>{title}</strong></span>{count !== undefined && <em>{count}</em>}</div>;
}

function QuickButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} type="button"><span>{icon}</span><strong>{label}</strong><ArrowRightOutlined /></button>;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침입니다';
  if (hour < 18) return '좋은 오후입니다';
  return '오늘도 수고 많으셨습니다';
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
