import { ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { SectionTitle } from './shared';
import type { YoutubeProjectDetail, YoutubeProjectSummary } from '../types';

const CONTENT_OPS_TABS = [
  {
    id: 'youtube',
    title: '유튜브',
    description: '요즘 트렌드 영상 기획 파이프라인 결과물을 봅니다.',
  },
  {
    id: 'character',
    title: '캐릭터·이모티콘',
    description: '카카오톡 이모티콘 파이프라인 — 아직 준비 중입니다.',
  },
] as const;

export type ContentOpsTabId = (typeof CONTENT_OPS_TABS)[number]['id'];

const YOUTUBE_STAGE_LABELS: { key: keyof YoutubeProjectSummary; label: string }[] = [
  { key: 'has_research', label: '조사' },
  { key: 'has_ideas', label: '기획' },
  { key: 'has_qa', label: '검수' },
  { key: 'has_script', label: '대본' },
  { key: 'has_production', label: '컷구성' },
  { key: 'has_review', label: '성과' },
];

const YOUTUBE_DETAIL_SECTIONS = [
  ['research', '시장조사'],
  ['ideas', '기획'],
  ['qa', '검수'],
  ['script', '대본'],
  ['production', '컷 구성'],
  ['review', '성과'],
] as const;

export function ContentOpsScreen({
  active,
  isAdmin,
  activeTab,
  onTabChange,
  youtubeProjects,
  youtubeProjectsLoading,
  youtubeProjectsMessage,
  onRefreshProjects,
  selectedSlug,
  onSelectProject,
  projectDetail,
  detailLoading,
  detailMessage,
}: {
  active: boolean;
  isAdmin: boolean;
  activeTab: ContentOpsTabId;
  onTabChange: (tab: ContentOpsTabId) => void;
  youtubeProjects: YoutubeProjectSummary[];
  youtubeProjectsLoading: boolean;
  youtubeProjectsMessage: string | null;
  onRefreshProjects: () => void;
  selectedSlug: string | null;
  onSelectProject: (slug: string) => void;
  projectDetail: YoutubeProjectDetail | null;
  detailLoading: boolean;
  detailMessage: string | null;
}) {
  return (
    <section className={active ? 'section-block' : 'screen-hidden'} id="contentOps">
      <SectionTitle
        eyebrow="Content Ops"
        icon={<VideoCameraOutlined />}
        title="콘텐츠 운영 (대표 전용, 읽기 전용)"
      />
      {isAdmin ? (
        <>
          <div className="content-ops-tabs" role="tablist" aria-label="콘텐츠 사업 메뉴">
            {CONTENT_OPS_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                role="tab"
                type="button"
              >
                <strong>{tab.title}</strong>
                <small>{tab.description}</small>
              </button>
            ))}
          </div>

          {activeTab === 'youtube' && (
            <article className="tool-pane">
              <div className="pane-title">
                <VideoCameraOutlined />
                <h3>유튜브 트렌드 파이프라인</h3>
                <button className="secondary-button" onClick={onRefreshProjects} type="button">
                  <ReloadOutlined />
                  새로고침
                </button>
              </div>
              <div className="pane-body">
                {youtubeProjectsMessage && (
                  <div className="inline-message">{youtubeProjectsMessage}</div>
                )}
                {youtubeProjectsLoading && youtubeProjects.length === 0 ? (
                  <div className="empty-state">불러오는 중...</div>
                ) : youtubeProjects.length === 0 ? (
                  <div className="empty-state">
                    아직 만들어진 프로젝트가 없습니다. Claude Code에서 /yt-pipeline 을 실행하면
                    여기에 나타납니다.
                  </div>
                ) : (
                  <div className="content-ops-layout">
                    <div className="content-ops-list">
                      {youtubeProjects.map((project) => (
                        <button
                          className={`content-ops-card ${
                            selectedSlug === project.slug ? 'active' : ''
                          }`}
                          key={project.slug}
                          onClick={() => onSelectProject(project.slug)}
                          type="button"
                        >
                          <strong>{project.slug}</strong>
                          <span>{project.date || '날짜 미상'}</span>
                          <div className="content-ops-stages">
                            {YOUTUBE_STAGE_LABELS.map(({ key, label }) => (
                              <small
                                className={project[key] ? 'stage-done' : 'stage-pending'}
                                key={key}
                              >
                                {label}
                              </small>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="content-ops-detail">
                      {detailMessage && <div className="inline-message">{detailMessage}</div>}
                      {!selectedSlug && (
                        <div className="empty-state">
                          왼쪽에서 프로젝트를 선택하면 단계별 내용을 볼 수 있습니다.
                        </div>
                      )}
                      {selectedSlug && detailLoading && (
                        <div className="empty-state">불러오는 중...</div>
                      )}
                      {selectedSlug &&
                        !detailLoading &&
                        projectDetail &&
                        YOUTUBE_DETAIL_SECTIONS.map(([key, label]) =>
                          projectDetail[key] ? (
                            <div className="content-ops-stage-block" key={key}>
                              <h4>{label}</h4>
                              <pre className="report-body">{projectDetail[key]}</pre>
                            </div>
                          ) : null,
                        )}
                    </div>
                  </div>
                )}
              </div>
            </article>
          )}

          {activeTab === 'character' && (
            <article className="tool-pane">
              <div className="pane-title">
                <VideoCameraOutlined />
                <h3>캐릭터·이모티콘</h3>
              </div>
              <div className="pane-body">
                <div className="empty-state">카카오톡 이모티콘 파이프라인은 아직 준비 중입니다.</div>
              </div>
            </article>
          )}
        </>
      ) : (
        <div className="empty-state">관리자 계정으로 로그인하면 콘텐츠 운영 현황을 볼 수 있습니다.</div>
      )}
    </section>
  );
}
