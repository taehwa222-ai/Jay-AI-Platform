import {
  CloudSyncOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileMarkdownOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SmileOutlined,
  StarFilled,
  StarOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getContentDocuments,
  getContentVersions,
  getEmoticonProjects,
  getYoutubeProjects,
  saveContentDocument,
  restoreContentVersion,
} from '../api';
import type {
  ContentDocument,
  ContentKind,
  ContentVersion,
  EmoticonProjectSummary,
  YoutubeProjectSummary,
} from '../types';
import { formatDateTime } from '../utils';
import { usePersistentState } from '../hooks/usePersistentState';
import { ConfirmDialog } from './ConfirmDialog';

export type ContentOpsTabId = ContentKind;

type PendingContentAction =
  | { type: 'kind'; kind: ContentKind }
  | { type: 'project'; slug: string }
  | { type: 'document'; document: ContentDocument }
  | { type: 'recent'; item: RecentDocument };

type RecentDocument = {
  key: string;
  kind: ContentKind;
  slug: string;
  filename: string;
  openedAt: string;
};

type LocalDraft = { content: string; savedAt: string };
type OutlineItem = { level: number; text: string; line: number; start: number };

const FAVORITES_STORAGE_KEY = 'jay-ai-content-favorites';
const RECENT_DOCUMENTS_STORAGE_KEY = 'jay-ai-content-recent-documents';
const LOCAL_DRAFTS_STORAGE_KEY = 'jay-ai-content-local-drafts';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecentDocumentArray(value: unknown): value is RecentDocument[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RecentDocument).key === 'string' &&
        ((item as RecentDocument).kind === 'youtube' ||
          (item as RecentDocument).kind === 'emoticon') &&
        typeof (item as RecentDocument).slug === 'string' &&
        typeof (item as RecentDocument).filename === 'string' &&
        typeof (item as RecentDocument).openedAt === 'string',
    )
  );
}

function isLocalDraftMap(value: unknown): value is Record<string, LocalDraft> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as LocalDraft).content === 'string' &&
        typeof (item as LocalDraft).savedAt === 'string',
    )
  );
}

function getDocumentKey(kind: ContentKind, slug: string, filename: string) {
  return `${kind}:${slug}:${filename}`;
}

function getProjectKey(kind: ContentKind, slug: string) {
  return `${kind}:${slug}`;
}

function getProjectProgress(project: YoutubeProjectSummary | EmoticonProjectSummary) {
  if ('has_ideas' in project) {
    const steps = [
      project.has_research,
      project.has_ideas,
      project.has_qa,
      project.has_script,
      project.has_production,
      project.has_review,
    ];
    const completed = steps.filter(Boolean).length;
    return { completed, total: steps.length, percent: Math.round((completed / steps.length) * 100) };
  }
  const baseSteps = [
    project.has_character,
    project.has_research,
    project.has_qa,
    project.has_friends,
    project.has_review,
  ];
  const setSteps = project.sets.flatMap((set) => [
    set.has_set_doc,
    set.has_submission_checklist,
    set.has_submission_copy,
  ]);
  const steps = [...baseSteps, ...setSteps];
  const completed = steps.filter(Boolean).length;
  return {
    completed,
    total: steps.length,
    percent: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0,
  };
}

function buildOutline(markdown: string): OutlineItem[] {
  let start = 0;
  return markdown.split('\n').flatMap((line, index) => {
    const itemStart = start;
    start += line.length + 1;
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    return match
      ? [{ level: match[1].length, text: match[2].trim(), line: index + 1, start: itemStart }]
      : [];
  });
}

const YOUTUBE_IDEA_TEMPLATE = `# 기획안

## 한 줄 콘셉트

## 타깃 시청자

## 핵심 메시지 3개

## 훅 / 전개 / 결론

## 대표 승인 체크
- [ ] 소재 승인
- [ ] 제목·썸네일 방향 승인
`;

const YOUTUBE_SCRIPT_TEMPLATE = `# 대본

## 오프닝 훅 (0~10초)

## 본문 1

## 본문 2

## 결론 및 CTA

## 팩트체크 메모
`;

export function ContentOpsScreen({
  active,
  token,
  discardSignal = 0,
  onDirtyChange,
}: {
  active: boolean;
  token: string;
  discardSignal?: number;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [kind, setKind] = useState<ContentKind>('youtube');
  const [youtubeProjects, setYoutubeProjects] = useState<YoutubeProjectSummary[]>([]);
  const [emoticonProjects, setEmoticonProjects] = useState<EmoticonProjectSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ContentDocument[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [pendingAction, setPendingAction] = useState<PendingContentAction | null>(null);
  const [favoriteProjects, setFavoriteProjects] = usePersistentState<string[]>(
    FAVORITES_STORAGE_KEY,
    [],
    isStringArray,
  );
  const [recentDocuments, setRecentDocuments] = usePersistentState<RecentDocument[]>(
    RECENT_DOCUMENTS_STORAGE_KEY,
    [],
    isRecentDocumentArray,
  );
  const [localDrafts, setLocalDrafts] = usePersistentState<Record<string, LocalDraft>>(
    LOCAL_DRAFTS_STORAGE_KEY,
    {},
    isLocalDraftMap,
  );
  const lastDiscardSignal = useRef(discardSignal);
  const discardedDraftKey = useRef<string | null>(null);
  const resumeAttempted = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const projects = useMemo(
    () => (kind === 'youtube' ? youtubeProjects : emoticonProjects),
    [emoticonProjects, kind, youtubeProjects],
  );
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    const matchingProjects = query
      ? projects.filter((project) => project.slug.toLowerCase().includes(query))
      : projects;
    return [...matchingProjects].sort((first, second) => {
      const firstFavorite = favoriteProjects.includes(getProjectKey(kind, first.slug));
      const secondFavorite = favoriteProjects.includes(getProjectKey(kind, second.slug));
      return Number(secondFavorite) - Number(firstFavorite);
    });
  }, [favoriteProjects, kind, projectQuery, projects]);
  const selectedDocument = documents.find((item) => item.filename === selectedFilename) ?? null;
  const hasUnsavedChanges = selectedDocument !== null && draft !== selectedDocument.content;
  const selectedDocumentKey =
    selectedSlug && selectedFilename ? getDocumentKey(kind, selectedSlug, selectedFilename) : null;
  const activeLocalDraft = selectedDocumentKey ? localDrafts[selectedDocumentKey] : null;
  const lineCount = draft.length === 0 ? 0 : draft.split('\n').length;
  const outline = useMemo(() => buildOutline(draft), [draft]);

  useEffect(() => {
    if (!active || !token) return;
    void loadProjects(kind);
  }, [active, kind, token]);

  useEffect(() => {
    if (!active || !token || resumeAttempted.current) return;
    resumeAttempted.current = true;
    if (recentDocuments.length === 0) return;
    const latest = recentDocuments[0];
    void selectProject(latest.slug, latest.kind, latest.filename).then(() => {
      setMessage(`${latest.slug}/${latest.filename} 마지막 작업을 재개했습니다.`);
    });
  }, [active, recentDocuments, token]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (lastDiscardSignal.current === discardSignal) return;
    lastDiscardSignal.current = discardSignal;
    discardCurrentDraft();
    setDraft(selectedDocument?.content ?? '');
    setPendingAction(null);
  }, [discardSignal]);

  useEffect(() => {
    if (!active || !hasUnsavedChanges || !selectedDocumentKey) return;
    const timeout = window.setTimeout(() => {
      setLocalDrafts((items) => ({
        ...items,
        [selectedDocumentKey]: { content: draft, savedAt: new Date().toISOString() },
      }));
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [active, draft, hasUnsavedChanges, selectedDocumentKey, setLocalDrafts]);

  useEffect(() => {
    if (!active || !hasUnsavedChanges) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveDocument();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [active, draft, hasUnsavedChanges, selectedFilename, selectedSlug]);

  async function loadProjects(nextKind: ContentKind) {
    setLoading(true);
    setMessage(null);
    try {
      if (nextKind === 'youtube') {
        setYoutubeProjects(await getYoutubeProjects(token));
      } else {
        setEmoticonProjects(await getEmoticonProjects(token));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프로젝트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function selectProject(
    slug: string,
    nextKind: ContentKind = kind,
    preferredFilename?: string,
  ) {
    if (nextKind === kind && slug === selectedSlug && documents.length > 0) {
      if (preferredFilename) {
        const preferred = documents.find((item) => item.filename === preferredFilename);
        if (preferred) openDocument(preferred, nextKind, slug);
      }
      return;
    }
    setKind(nextKind);
    setSelectedSlug(slug);
    setSelectedFilename(null);
    setDocuments([]);
    setDraft('');
    setEditorMode('edit');
    setLoading(true);
    setMessage(null);
    try {
      const result = await getContentDocuments(token, nextKind, slug);
      setDocuments(result);
      const preferred =
        result.find((item) => item.filename === preferredFilename) ??
        result.find((item) => item.filename === 'ideas.md') ??
        result[0];
      if (preferred) {
        openDocument(preferred, nextKind, slug);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문서를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function openDocument(document: ContentDocument, nextKind = kind, slug = selectedSlug) {
    if (!slug) return;
    const documentKey = getDocumentKey(nextKind, slug, document.filename);
    const localDraft = discardedDraftKey.current === documentKey ? undefined : localDrafts[documentKey];
    if (discardedDraftKey.current === documentKey) discardedDraftKey.current = null;
    setSelectedFilename(document.filename);
    setDraft(localDraft?.content ?? document.content);
    setMessage(localDraft ? `${document.filename} 브라우저 임시저장을 복구했습니다.` : null);
    setEditorMode('edit');
    const recentItem: RecentDocument = {
      key: documentKey,
      kind: nextKind,
      slug,
      filename: document.filename,
      openedAt: new Date().toISOString(),
    };
    setRecentDocuments((items) => [
      recentItem,
      ...items.filter((item) => item.key !== documentKey),
    ].slice(0, 6));
  }

  function selectDocument(document: ContentDocument) {
    openDocument(document);
  }

  function requestAction(action: PendingContentAction) {
    if (hasUnsavedChanges) {
      setPendingAction(action);
      return;
    }
    void executeAction(action);
  }

  async function executeAction(action: PendingContentAction) {
    if (action.type === 'kind') {
      setKind(action.kind);
      setSelectedSlug(null);
      setSelectedFilename(null);
      setDocuments([]);
      setDraft('');
      setEditorMode('edit');
      return;
    }
    if (action.type === 'project') {
      await selectProject(action.slug);
      return;
    }
    if (action.type === 'recent') {
      await selectProject(action.item.slug, action.item.kind, action.item.filename);
      return;
    }
    selectDocument(action.document);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    discardCurrentDraft();
    setPendingAction(null);
    void executeAction(action);
  }

  function discardCurrentDraft() {
    if (!selectedDocumentKey) return;
    discardedDraftKey.current = selectedDocumentKey;
    setLocalDrafts((items) => {
      const nextItems = { ...items };
      delete nextItems[selectedDocumentKey];
      return nextItems;
    });
  }

  function toggleFavorite(slug: string) {
    const projectKey = getProjectKey(kind, slug);
    setFavoriteProjects((items) =>
      items.includes(projectKey)
        ? items.filter((item) => item !== projectKey)
        : [projectKey, ...items],
    );
  }

  async function saveDocument() {
    if (!selectedSlug || !selectedFilename) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveContentDocument(token, kind, selectedSlug, selectedFilename, draft);
      setDocuments((items) =>
        items.map((item) => (item.filename === saved.filename ? saved : item)),
      );
      discardCurrentDraft();
      setVersions(await getContentVersions(token, kind, selectedSlug, selectedFilename));
      setMessage(`${saved.filename} 저장 완료`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문서를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleHistory() {
    if (!selectedSlug || !selectedFilename) return;
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (nextOpen) {
      setVersions(await getContentVersions(token, kind, selectedSlug, selectedFilename));
    }
  }

  async function restoreVersion(version: ContentVersion) {
    if (hasUnsavedChanges) {
      setMessage('현재 변경사항을 먼저 저장하거나 버린 뒤 이전 버전을 복원하세요.');
      return;
    }
    setSaving(true);
    try {
      const restored = await restoreContentVersion(token, version);
      setDocuments((items) => items.map((item) => item.filename === restored.filename ? restored : item));
      setDraft(restored.content);
      setVersions(await getContentVersions(token, kind, version.slug, version.filename));
      setMessage(`${version.filename}의 이전 버전을 복원했습니다.`);
    } finally {
      setSaving(false);
    }
  }

  function insertTemplate(template: string, label: string) {
    if (!selectedDocument) {
      setMessage('템플릿을 삽입할 Markdown 문서를 먼저 선택하세요.');
      return;
    }
    const nextDraft = draft.trim().length > 0 ? `${draft.trimEnd()}\n\n${template}` : template;
    setDraft(nextDraft);
    setEditorMode('edit');
    setMessage(`${label} 템플릿을 현재 문서 끝에 삽입했습니다.`);
    queueMicrotask(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(nextDraft.length, nextDraft.length);
    });
  }

  function jumpToHeading(item: OutlineItem) {
    setEditorMode('edit');
    queueMicrotask(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(item.start, item.start);
    });
  }

  if (!active) return null;

  return (
    <section className="section-block" id="contentOps">
      <div className="workspace-intro content-intro">
        <div>
          <span className="workspace-kicker"><FileMarkdownOutlined /> MARKDOWN STUDIO</span>
          <h2>기획부터 대본까지, 끊김 없이 편집</h2>
          <p>프로젝트 폴더를 탐색하고 핵심 Markdown 문서를 바로 수정하세요.</p>
        </div>
        <div className="content-intro-metric">
          <span>전체 프로젝트</span>
          <strong>{loading && projects.length === 0 ? '—' : projects.length}</strong>
          <small>{kind === 'youtube' ? 'YouTube' : '이모티콘'} workspace</small>
        </div>
      </div>
      <div className="content-ops-toolbar">
        <div className="content-type-switch" role="tablist" aria-label="콘텐츠 유형">
          <button
            aria-selected={kind === 'youtube'}
            className={kind === 'youtube' ? 'active' : ''}
            onClick={() => requestAction({ type: 'kind', kind: 'youtube' })}
            role="tab"
            type="button"
          >
            <VideoCameraOutlined /> YouTube
          </button>
          <button
            aria-selected={kind === 'emoticon'}
            className={kind === 'emoticon' ? 'active' : ''}
            onClick={() => requestAction({ type: 'kind', kind: 'emoticon' })}
            role="tab"
            type="button"
          >
            <SmileOutlined /> 이모티콘
          </button>
        </div>
        <div className="content-toolbar-actions">
          {kind === 'youtube' && (
            <>
              <button
                className="secondary-button"
                disabled={!selectedDocument}
                onClick={() => insertTemplate(YOUTUBE_IDEA_TEMPLATE, '기획안')}
                type="button"
              >
                <FileAddOutlined /> 기획안 삽입
              </button>
              <button
                className="secondary-button"
                disabled={!selectedDocument}
                onClick={() => insertTemplate(YOUTUBE_SCRIPT_TEMPLATE, '대본')}
                type="button"
              >
                <FileAddOutlined /> 대본 삽입
              </button>
            </>
          )}
            <button
              aria-label="프로젝트 목록 새로고침"
              className="icon-button light"
              disabled={loading}
              onClick={() => void loadProjects(kind)}
              title="프로젝트 목록 새로고침"
              type="button"
            >
              <ReloadOutlined className={loading ? 'spin' : ''} />
            </button>
        </div>
      </div>

      <div className="content-productivity-bar">
        <div className="recent-documents" aria-label="최근 문서">
          <span className="productivity-label">최근 문서</span>
          <div>
            {recentDocuments.slice(0, 4).map((item) => (
              <button
                key={item.key}
                onClick={() => requestAction({ type: 'recent', item })}
                title={`${item.slug}/${item.filename}`}
                type="button"
              >
                <FileMarkdownOutlined />
                <span>{item.filename}</span>
                <small>{item.slug}</small>
              </button>
            ))}
            {recentDocuments.length === 0 && <small className="recent-empty">문서를 열면 여기에 표시됩니다.</small>}
          </div>
        </div>
        <span className={`autosave-state ${hasUnsavedChanges ? 'active' : ''}`}>
          <CloudSyncOutlined />
          {hasUnsavedChanges
            ? activeLocalDraft
              ? '브라우저 임시저장 완료'
              : '임시저장 준비 중'
            : '자동 임시저장 사용 중'}
        </span>
      </div>

      {message && <div className="inline-message floating-message" role="status">{message}</div>}
      <div className="content-editor-layout">
        <aside className="project-list-panel">
          <div className="project-panel-head">
            <span className="project-panel-icon"><FolderOpenOutlined /></span>
            <span><strong>{kind === 'youtube' ? 'YouTube 프로젝트' : '이모티콘 프로젝트'}</strong><small>{filteredProjects.length}개 표시</small></span>
          </div>
          <label className="project-search">
            <SearchOutlined />
            <input
              aria-label="프로젝트 검색"
              onChange={(event) => setProjectQuery(event.target.value)}
              placeholder="프로젝트 검색"
              type="search"
              value={projectQuery}
            />
          </label>
          {loading && projects.length === 0 ? (
            <div className="loading-state"><span className="loading-spinner" /> 프로젝트를 불러오는 중</div>
          ) : (
            <div className="content-project-list">
              {filteredProjects.map((project) => {
                const favorite = favoriteProjects.includes(getProjectKey(kind, project.slug));
                const progress = getProjectProgress(project);
                return (
                  <div className="content-project-row" key={project.slug}>
                    <button
                      aria-label={`프로젝트 ${project.slug} 열기`}
                      className={`content-project-open ${selectedSlug === project.slug ? 'active' : ''}`}
                      onClick={() => requestAction({ type: 'project', slug: project.slug })}
                      type="button"
                    >
                      <span className="project-file-icon"><FolderOpenOutlined /></span>
                      <span className="project-copy">
                        <strong>{project.slug}</strong>
                        <small>{formatDateTime(project.updated_at)} · {progress.completed}/{progress.total} 단계</small>
                        <span className="project-progress" aria-label={`진행률 ${progress.percent}%`}>
                          <span style={{ width: `${progress.percent}%` }} />
                        </span>
                      </span>
                    </button>
                    <button
                      aria-label={`${project.slug} ${favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}`}
                      className={`project-favorite ${favorite ? 'active' : ''}`}
                      onClick={() => toggleFavorite(project.slug)}
                      title={favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                      type="button"
                    >
                      {favorite ? <StarFilled /> : <StarOutlined />}
                    </button>
                  </div>
                );
              })}
              {projects.length === 0 && <div className="empty-state"><FolderOpenOutlined /> 프로젝트가 없습니다.</div>}
              {projects.length > 0 && filteredProjects.length === 0 && <div className="empty-state"><SearchOutlined /> 검색 결과가 없습니다.</div>}
            </div>
          )}
        </aside>

        <article className="markdown-editor-panel">
          {selectedSlug ? (
            <>
              <div className="document-tabs" role="tablist" aria-label="Markdown 문서">
                {documents.map((document) => (
                  <button
                    aria-selected={selectedFilename === document.filename}
                    className={selectedFilename === document.filename ? 'active' : ''}
                    key={document.filename}
                    onClick={() => requestAction({ type: 'document', document })}
                    role="tab"
                    type="button"
                  >
                    <FileMarkdownOutlined /> {document.filename}
                  </button>
                ))}
              </div>
              {selectedFilename ? (
                <>
                  <div className="editor-head">
                    <div>
                      <span className="eyebrow">{selectedSlug}</span>
                      <h3>{selectedFilename} {hasUnsavedChanges && <span className="dirty-dot" title="저장되지 않은 변경사항" />}</h3>
                    </div>
                    <div className="editor-actions">
                      <button className="secondary-button" onClick={() => void toggleHistory()} type="button"><HistoryOutlined /> 버전 {versions.length > 0 ? versions.length : ''}</button>
                      <div className="editor-mode-switch" role="tablist" aria-label="편집기 보기 방식">
                        <button aria-selected={editorMode === 'edit'} className={editorMode === 'edit' ? 'active' : ''} onClick={() => setEditorMode('edit')} role="tab" type="button"><EditOutlined /> 편집</button>
                        <button aria-selected={editorMode === 'preview'} className={editorMode === 'preview' ? 'active' : ''} onClick={() => setEditorMode('preview')} role="tab" type="button"><EyeOutlined /> 미리보기</button>
                      </div>
                      <button
                        className="primary-button"
                        disabled={saving || !hasUnsavedChanges}
                        onClick={() => void saveDocument()}
                        type="button"
                      >
                        <SaveOutlined /> {saving ? '저장 중…' : '저장'}
                      </button>
                    </div>
                  </div>
                  <div className="editor-content-shell">
                    {editorMode === 'edit' ? (
                      <textarea
                        aria-label="Markdown 편집기"
                        className="markdown-editor"
                        onChange={(event) => setDraft(event.target.value)}
                        ref={editorRef}
                        spellCheck={false}
                        value={draft}
                      />
                    ) : (
                      <pre className="markdown-preview" aria-label="Markdown 미리보기">{draft || '미리볼 내용이 없습니다.'}</pre>
                    )}
                    <aside className="markdown-outline" aria-label="문서 목차">
                      <div><strong>문서 목차</strong><small>{outline.length}개 제목</small></div>
                      <nav>
                        {outline.map((item) => (
                          <button
                            className={`level-${item.level}`}
                            key={`${item.start}-${item.text}`}
                            onClick={() => jumpToHeading(item)}
                            title={`${item.line}번째 줄`}
                            type="button"
                          >
                            <span>{item.text}</span><small>L{item.line}</small>
                          </button>
                        ))}
                        {outline.length === 0 && <span className="outline-empty"># 제목을 입력하면 목차가 생성됩니다.</span>}
                      </nav>
                    </aside>
                  </div>
                  <div className="editor-statusbar">
                    <span>
                      {hasUnsavedChanges
                        ? activeLocalDraft
                          ? `브라우저 임시저장 ${new Date(activeLocalDraft.savedAt).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : '저장되지 않은 변경사항'
                        : '모든 변경사항 서버 저장됨'}
                    </span>
                    <span>{lineCount.toLocaleString()} lines · {draft.length.toLocaleString()} chars · Ctrl+S 저장</span>
                  </div>
                  {historyOpen && (
                    <aside className="version-history" aria-label="문서 버전 기록">
                      <div><strong><HistoryOutlined /> 저장 이력</strong><small>저장 직전 내용이 자동 보존됩니다.</small></div>
                      {versions.map((version) => (
                        <article key={version.id}>
                          <span><strong>{new Date(version.created_at).toLocaleString('ko-KR')}</strong><small>{version.content.slice(0, 90).replace(/\s+/g, ' ') || '빈 문서'}</small></span>
                          <button disabled={saving || hasUnsavedChanges} onClick={() => void restoreVersion(version)} type="button">복원</button>
                        </article>
                      ))}
                      {versions.length === 0 && <div className="empty-state">아직 이전 버전이 없습니다. 문서를 수정해 저장하면 생성됩니다.</div>}
                    </aside>
                  )}
                </>
              ) : (
                <div className="editor-empty"><FileMarkdownOutlined /><strong>Markdown 문서가 없습니다</strong><span>프로젝트 폴더에 .md 파일을 추가하세요.</span></div>
              )}
            </>
          ) : (
            <div className="editor-empty"><FolderOpenOutlined /><strong>프로젝트를 선택하세요</strong><span>왼쪽 목록에서 작업할 프로젝트를 선택하면 문서가 열립니다.</span></div>
          )}
        </article>
      </div>
      <ConfirmDialog
        confirmLabel="변경사항 버리기"
        description="저장하지 않은 Markdown 수정 내용이 사라집니다. 선택한 작업으로 계속할까요?"
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        open={pendingAction !== null}
        title="저장하지 않은 변경사항이 있습니다"
      />
    </section>
  );
}
