import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContentOpsScreen } from './ContentOpsScreen';
import type { YoutubeProjectSummary } from '../types';

const projects: YoutubeProjectSummary[] = [
  {
    slug: '2026-01-01-trend',
    date: '2026-01-01',
    has_research: true,
    has_ideas: true,
    has_qa: false,
    has_script: false,
    has_production: false,
    has_review: false,
    updated_at: '2026-01-01T00:00:00Z',
    view_count: null,
  },
];

function baseProps() {
  return {
    active: true,
    isAdmin: true,
    activeTab: 'youtube' as const,
    onTabChange: vi.fn(),
    youtubeProjects: projects,
    youtubeProjectsLoading: false,
    youtubeProjectsMessage: null,
    onRefreshProjects: vi.fn(),
    selectedSlug: null,
    onSelectProject: vi.fn(),
    projectDetail: null,
    detailLoading: false,
    detailMessage: null,
  };
}

describe('ContentOpsScreen', () => {
  it('shows a locked message for non-admins instead of the tabs', () => {
    render(<ContentOpsScreen {...baseProps()} isAdmin={false} />);

    expect(
      screen.getByText('관리자 계정으로 로그인하면 콘텐츠 운영 현황을 볼 수 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('lists youtube projects and reports their pipeline stage progress', () => {
    render(<ContentOpsScreen {...baseProps()} />);

    expect(screen.getByText('2026-01-01-trend')).toBeInTheDocument();
    expect(screen.getByText('왼쪽에서 프로젝트를 선택하면 단계별 내용을 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('calls onSelectProject when a project card is clicked', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ContentOpsScreen {...props} />);

    await user.click(screen.getByText('2026-01-01-trend'));

    expect(props.onSelectProject).toHaveBeenCalledWith('2026-01-01-trend');
  });

  it('calls onTabChange when switching to the character tab', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ContentOpsScreen {...props} />);

    await user.click(screen.getByRole('tab', { name: /캐릭터·이모티콘/ }));

    expect(props.onTabChange).toHaveBeenCalledWith('character');
  });

  it('renders the selected project detail sections', () => {
    render(
      <ContentOpsScreen
        {...baseProps()}
        selectedSlug="2026-01-01-trend"
        projectDetail={{
          slug: '2026-01-01-trend',
          date: '2026-01-01',
          research: '조사 결과',
          ideas: null,
          qa: null,
          script: null,
          production: null,
          review: null,
          review_metrics: null,
        }}
      />,
    );

    expect(screen.getByText('시장조사')).toBeInTheDocument();
    expect(screen.getByText('조사 결과')).toBeInTheDocument();
  });

  it('shows a view count badge on the project card when review metrics exist', () => {
    render(
      <ContentOpsScreen
        {...baseProps()}
        youtubeProjects={[{ ...projects[0], view_count: '12,345' }]}
      />,
    );

    expect(screen.getByText('조회수 12,345')).toBeInTheDocument();
  });

  it('renders the review metrics table alongside the review section', () => {
    render(
      <ContentOpsScreen
        {...baseProps()}
        selectedSlug="2026-01-01-trend"
        projectDetail={{
          slug: '2026-01-01-trend',
          date: '2026-01-01',
          research: null,
          ideas: null,
          qa: null,
          script: null,
          production: null,
          review: '# review.md',
          review_metrics: {
            view_count: '12,345',
            ctr: '4.2%',
            avg_watch_time: null,
            subscriber_delta: null,
            engagement: null,
            top_traffic_source: null,
          },
        }}
      />,
    );

    expect(screen.getByText('조회수')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('CTR')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
    expect(screen.queryByText('평균 시청 지속시간')).not.toBeInTheDocument();
  });
});
