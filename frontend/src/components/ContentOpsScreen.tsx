import { ReloadOutlined, SmileOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { SectionTitle } from './shared';
import type {
  EmoticonProjectDetail,
  EmoticonProjectSummary,
  ReviewMetrics,
  YoutubeProjectDetail,
  YoutubeProjectSummary,
} from '../types';

const CONTENT_OPS_TABS = [
  {
    id: 'youtube',
    title: '유튜브',
    description: '요즘 트렌드 영상 기획 파이프라인 결과물을 봅니다.',
  },
  {
    id: 'character',
    title: '캐릭터·이모티콘',
    description: '카카오톡 이모티콘 파이프라인 결과물을 봅니다.',
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

const EMOTICON_STAGE_LABELS: { key: keyof EmoticonProjectSummary; label: string }[] = [
  { key: 'has_character', label: '캐릭터' },
  { key: 'has_research', label: '조사' },
  { key: 'has_qa', label: '검수' },
  { key: 'has_friends', label: '서브캐릭터' },
  { key: 'has_review', label: '성과' },
];

const EMOTICON_DETAIL_SECTIONS = [
  ['character', '캐릭터 컨셉'],
  ['research', '시장조사'],
  ['qa', '검수'],
  ['friends', '서브 캐릭터'],
  ['review', '성과'],
] as const;

const REVIEW_METRIC_LABELS: { key: keyof ReviewMetrics; label: string }[] = [
  { key: 'view_count', label: '조회수' },
  { key: 'ctr', label: 'CTR' },
  { key: 'avg_watch_time', label: '평균 시청 지속시간' },
  { key: 'subscriber_delta', label: '구독자 증감' },
  { key: 'engagement', label: '좋아요/댓글/공유' },
  { key: 'top_traffic_source', label: '트래픽 소스 1위' },
];

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
  emoticonProjects,
  emoticonProjectsLoading,
  emoticonProjectsMessage,
  onRefreshEmoticonProjects,
  selectedEmoticonSlug,
  onSelectEmoticonProject,
  emoticonProjectDetail,
  emoticonDetailLoading,
  emoticonDetailMessage,
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
  emoticonProjects: EmoticonProjectSummary[];
  emoticonProjectsLoading: boolean;
  emoticonProjectsMessage: string | null;
  onRefreshEmoticonProjects: () => void;
  selectedEmoticonSlug: string | null;
  onSelectEmoticonProject: (slug: string) => void;
  emoticonProjectDetail: EmoticonProjectDetail | null;
  emoticonDetailLoading: boolean;
  emoticonDetailMessage: string | null;
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
                          {project.view_count && (
                            <span className="content-ops-metric">조회수 {project.view_count}</span>
                          )}
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
                              {key === 'review' && projectDetail.review_metrics && (
                                <dl className="content-ops-metrics">
                                  {REVIEW_METRIC_LABELS.filter(
                                    ({ key: metricKey }) => projectDetail.review_metrics?.[metricKey],
                                  ).map(({ key: metricKey, label: metricLabel }) => (
                                    <div key={metricKey}>
                                      <dt>{metricLabel}</dt>
                                      <dd>{projectDetail.review_metrics?.[metricKey]}</dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
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
                <SmileOutlined />
                <h3>카카오톡 이모티콘 파이프라인</h3>
                <button
                  className="secondary-button"
                  onClick={onRefreshEmoticonProjects}
                  type="button"
                >
                  <ReloadOutlined />
                  새로고침
                </button>
              </div>
              <div className="pane-body">
                {emoticonProjectsMessage && (
                  <div className="inline-message">{emoticonProjectsMessage}</div>
                )}
                {emoticonProjectsLoading && emoticonProjects.length === 0 ? (
                  <div className="empty-state">불러오는 중...</div>
                ) : emoticonProjects.length === 0 ? (
                  <div className="empty-state">
                    아직 만들어진 캐릭터가 없습니다. Claude Code에서 /emo-pipeline 을 실행하면
                    여기에 나타납니다.
                  </div>
                ) : (
                  <div className="content-ops-layout">
                    <div className="content-ops-list">
                      {emoticonProjects.map((project) => (
                        <button
                          className={`content-ops-card ${
                            selectedEmoticonSlug === project.slug ? 'active' : ''
                          }`}
                          key={project.slug}
                          onClick={() => onSelectEmoticonProject(project.slug)}
                          type="button"
                        >
                          <strong>{project.slug}</strong>
                          <span>세트 {project.sets.length}개</span>
                          <div className="content-ops-stages">
                            {EMOTICON_STAGE_LABELS.map(({ key, label }) => (
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
                      {emoticonDetailMessage && (
                        <div className="inline-message">{emoticonDetailMessage}</div>
                      )}
                      {!selectedEmoticonSlug && (
                        <div className="empty-state">
                          왼쪽에서 캐릭터를 선택하면 단계별 내용을 볼 수 있습니다.
                        </div>
                      )}
                      {selectedEmoticonSlug && emoticonDetailLoading && (
                        <div className="empty-state">불러오는 중...</div>
                      )}
                      {selectedEmoticonSlug &&
                        !emoticonDetailLoading &&
                        emoticonProjectDetail &&
                        EMOTICON_DETAIL_SECTIONS.map(([key, label]) =>
                          emoticonProjectDetail[key] ? (
                            <div className="content-ops-stage-block" key={key}>
                              <h4>{label}</h4>
                              <pre className="report-body">{emoticonProjectDetail[key]}</pre>
                            </div>
                          ) : null,
                        )}
                      {selectedEmoticonSlug &&
                        !emoticonDetailLoading &&
                        emoticonProjectDetail?.sets.map((set) => (
                          <div className="content-ops-stage-block" key={set.set_key}>
                            <h4>세트: {set.set_key}</h4>
                            {set.set_doc && (
                              <pre className="report-body">{set.set_doc}</pre>
                            )}
                            {set.submission_copy && (
                              <>
                                <h4>제출 문구</h4>
                                <pre className="report-body">{set.submission_copy}</pre>
                              </>
                            )}
                            {set.submission_checklist && (
                              <>
                                <h4>제출 체크리스트</h4>
                                <pre className="report-body">{set.submission_checklist}</pre>
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
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
