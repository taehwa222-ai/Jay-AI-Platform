import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CheckSquareOutlined,
  FileSearchOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

export const VIEW_IDS = ['auth', 'home', 'tasks', 'stocks', 'contentOps', 'operations'] as const;
export type ViewId = (typeof VIEW_IDS)[number];

const LAST_VIEW_KEY = 'jay-ai-last-view';

export const VIEW_META: Record<ViewId, { eyebrow: string; title: string; description: string }> = {
  auth: {
    eyebrow: 'Team Access',
    title: '사내 구성원 로그인',
    description: '대표와 승인된 구성원이 내부 운영 도구에 안전하게 접근합니다.',
  },
  home: {
    eyebrow: 'Executive Home',
    title: '오늘의 업무',
    description: '확인이 필요한 투자, 콘텐츠, 사용자와 운영 상태를 한곳에서 정리합니다.',
  },
  tasks: {
    eyebrow: 'Work Inbox',
    title: '업무 인박스',
    description: '오늘 처리할 업무를 수집하고 진행 상태와 마감일을 관리합니다.',
  },
  stocks: {
    eyebrow: 'Stock Intelligence',
    title: '주식 분석 Lab',
    description: '포트폴리오, 관심종목, AI 분석과 공시를 한 흐름에서 관리합니다.',
  },
  contentOps: {
    eyebrow: 'Content Operations',
    title: 'Content Ops',
    description: 'YouTube와 이모티콘 기획 문서를 빠르게 찾고 편집합니다.',
  },
  operations: {
    eyebrow: 'Operations Control',
    title: '운영 현황',
    description: '서버, 데이터 보존, AI 비용과 외부 API 상태를 한 화면에서 확인합니다.',
  },
};

export const STOCK_TABS = [
  { id: 'holdings', title: '보유종목', description: '내가 실제로 보유한 주식과 손익을 관리합니다.' },
  { id: 'watchlist', title: '관심종목', description: '아직 매수 전인 종목을 따로 저장하고 추적합니다.' },
  { id: 'analysis', title: 'AI 분석', description: '한 종목의 시세, 거래량, RSI, MACD를 분석합니다.' },
  { id: 'scan', title: '후보 스캔', description: '여러 종목을 한 번에 비교해 후보를 정렬합니다.' },
  { id: 'reports', title: '내부 리포트', description: '저장한 분석 기록을 대표 검토용 Markdown으로 정리합니다.' },
  { id: 'disclosures', title: '공시', description: 'OpenDART에서 최근 1년 공시 목록을 조회합니다.' },
  { id: 'notifications', title: '알림 센터', description: '텔레그램 연결, AI 한도와 발송 이력을 관리합니다.' },
] as const;

export type StockTabId = (typeof STOCK_TABS)[number]['id'];

export function isStockTabId(value: unknown): value is StockTabId {
  return typeof value === 'string' && STOCK_TABS.some((tab) => tab.id === value);
}

export function getStockTabIcon(tabId: StockTabId): ReactNode {
  switch (tabId) {
    case 'holdings':
      return <LineChartOutlined />;
    case 'watchlist':
      return <BookOutlined />;
    case 'analysis':
      return <BarChartOutlined />;
    case 'scan':
      return <AppstoreOutlined />;
    case 'reports':
    case 'disclosures':
      return <FileSearchOutlined />;
    case 'notifications':
      return <BellOutlined />;
  }
}

export const TASK_VIEW_ICON = <CheckSquareOutlined />;

export function getInitialView(): ViewId {
  if (typeof window === 'undefined') return 'home';
  const hashView = window.location.hash.replace('#', '');
  if (hashView === 'access') return 'auth';
  if (VIEW_IDS.includes(hashView as ViewId)) return hashView as ViewId;
  const storedView = localStorage.getItem(LAST_VIEW_KEY);
  return VIEW_IDS.includes(storedView as ViewId) ? (storedView as ViewId) : 'home';
}

export function rememberView(view: ViewId) {
  localStorage.setItem(LAST_VIEW_KEY, view);
}
