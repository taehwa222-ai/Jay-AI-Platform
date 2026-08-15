import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ContentOpsScreen } from './ContentOpsScreen';

const api = vi.hoisted(() => ({
  getYoutubeProjects: vi.fn(),
  getEmoticonProjects: vi.fn(),
  getContentDocuments: vi.fn(),
  saveContentDocument: vi.fn(),
}));

vi.mock('../api', () => api);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.getYoutubeProjects.mockResolvedValue([
    {
      slug: '2026-08-15-internal-os',
      date: '2026-08-15',
      has_research: true,
      has_ideas: true,
      has_qa: false,
      has_script: true,
      has_production: false,
      has_review: false,
      updated_at: '2026-08-15T00:00:00Z',
      view_count: null,
    },
  ]);
  api.getEmoticonProjects.mockResolvedValue([]);
  api.getContentDocuments.mockResolvedValue([
    { filename: 'ideas.md', content: '# Ideas', updated_at: '2026-08-15T00:00:00Z' },
    { filename: 'script.md', content: '# Script', updated_at: '2026-08-15T00:00:00Z' },
  ]);
  api.saveContentDocument.mockImplementation(
    async (_token: string, _kind: string, _slug: string, filename: string, content: string) => ({
      filename,
      content,
      updated_at: '2026-08-15T01:00:00Z',
    }),
  );
});

it('loads a project once, edits Markdown, and saves it through the API', async () => {
  const user = userEvent.setup();
  render(<ContentOpsScreen active token="owner-token" />);

  const project = await screen.findByRole('button', {
    name: '프로젝트 2026-08-15-internal-os 열기',
  });
  await user.click(project);
  const editor = await screen.findByLabelText('Markdown 편집기');
  expect(editor).toHaveValue('# Ideas');
  await user.clear(editor);
  await user.type(editor, '# Updated ideas');
  await user.click(screen.getByRole('button', { name: /저장$/ }));

  await waitFor(() =>
    expect(api.saveContentDocument).toHaveBeenCalledWith(
      'owner-token',
      'youtube',
      '2026-08-15-internal-os',
      'ideas.md',
      '# Updated ideas',
    ),
  );
  expect(api.getContentDocuments).toHaveBeenCalledTimes(1);
});

it('inserts planning and script templates directly into the selected document', async () => {
  const user = userEvent.setup();
  render(<ContentOpsScreen active token="owner-token" />);

  expect(screen.getByRole('button', { name: /기획안 삽입/ })).toBeDisabled();
  await user.click(
    await screen.findByRole('button', { name: '프로젝트 2026-08-15-internal-os 열기' }),
  );
  await user.click(screen.getByRole('button', { name: /기획안 삽입/ }));
  await user.click(screen.getByRole('button', { name: /대본 삽입/ }));

  const editor = screen.getByLabelText('Markdown 편집기');
  expect((editor as HTMLTextAreaElement).value).toContain('## 한 줄 콘셉트');
  expect((editor as HTMLTextAreaElement).value).toContain('## 오프닝 훅');
  expect(api.saveContentDocument).not.toHaveBeenCalled();
});

it('shows project progress and navigates Markdown headings from the outline', async () => {
  const user = userEvent.setup();
  render(<ContentOpsScreen active token="owner-token" />);

  expect(await screen.findByLabelText('진행률 50%')).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: '프로젝트 2026-08-15-internal-os 열기' }),
  );
  const outline = await screen.findByLabelText('문서 목차');
  await user.click(within(outline).getByRole('button', { name: /Ideas/ }));

  const editor = screen.getByLabelText('Markdown 편집기');
  expect(editor).toHaveFocus();
  expect(editor).toHaveProperty('selectionStart', 0);
});

it('automatically resumes the most recently opened document', async () => {
  localStorage.setItem(
    'jay-ai-content-recent-documents',
    JSON.stringify([
      {
        key: 'youtube:2026-08-15-internal-os:script.md',
        kind: 'youtube',
        slug: '2026-08-15-internal-os',
        filename: 'script.md',
        openedAt: '2026-08-15T01:00:00Z',
      },
    ]),
  );
  render(<ContentOpsScreen active token="owner-token" />);

  expect(await screen.findByLabelText('Markdown 편집기')).toHaveValue('# Script');
  expect(screen.getByText(/script\.md 마지막 작업을 재개했습니다/)).toBeInTheDocument();
  expect(api.getContentDocuments).toHaveBeenCalledWith(
    'owner-token',
    'youtube',
    '2026-08-15-internal-os',
  );
});

it('protects an unsaved draft before switching documents', async () => {
  const user = userEvent.setup();
  render(<ContentOpsScreen active token="owner-token" />);

  await user.click(
    await screen.findByRole('button', { name: '프로젝트 2026-08-15-internal-os 열기' }),
  );
  const editor = await screen.findByLabelText('Markdown 편집기');
  await user.clear(editor);
  await user.type(editor, '# Unsaved draft');
  await user.click(screen.getByRole('tab', { name: /script\.md/ }));

  const dialog = screen.getByRole('dialog', { name: '저장하지 않은 변경사항이 있습니다' });
  expect(dialog).toBeInTheDocument();
  expect(editor).toHaveValue('# Unsaved draft');

  await user.click(screen.getByRole('button', { name: '변경사항 버리기' }));
  expect(await screen.findByLabelText('Markdown 편집기')).toHaveValue('# Script');
});

it('persists favorites, recent documents, and a recoverable browser draft', async () => {
  const user = userEvent.setup();
  const firstRender = render(<ContentOpsScreen active token="owner-token" />);

  await user.click(
    await screen.findByRole('button', { name: '프로젝트 2026-08-15-internal-os 열기' }),
  );
  await user.click(
    screen.getByRole('button', { name: '2026-08-15-internal-os 즐겨찾기 추가' }),
  );
  const editor = await screen.findByLabelText('Markdown 편집기');
  await user.clear(editor);
  await user.type(editor, '# Browser draft');

  await waitFor(
    () => {
      expect(localStorage.getItem('jay-ai-content-favorites')).toContain(
        'youtube:2026-08-15-internal-os',
      );
      expect(localStorage.getItem('jay-ai-content-recent-documents')).toContain('ideas.md');
      expect(localStorage.getItem('jay-ai-content-local-drafts')).toContain('# Browser draft');
    },
    { timeout: 2000 },
  );

  firstRender.unmount();
  render(<ContentOpsScreen active token="owner-token" />);
  const favoriteButton = await screen.findByRole('button', {
    name: '2026-08-15-internal-os 즐겨찾기 해제',
  });
  const projectRow = favoriteButton.closest('.content-project-row');
  expect(projectRow).not.toBeNull();
  await user.click(
    within(projectRow as HTMLElement).getByRole('button', {
      name: '프로젝트 2026-08-15-internal-os 열기',
    }),
  );
  expect(await screen.findByLabelText('Markdown 편집기')).toHaveValue('# Browser draft');
  expect(screen.getByText(/마지막 작업을 재개했습니다/)).toBeInTheDocument();
});

it('does not restore a local draft after the user explicitly discards it', async () => {
  const user = userEvent.setup();
  render(<ContentOpsScreen active token="owner-token" />);
  await user.click(
    await screen.findByRole('button', { name: '프로젝트 2026-08-15-internal-os 열기' }),
  );
  const editor = await screen.findByLabelText('Markdown 편집기');
  await user.clear(editor);
  await user.type(editor, '# Discard this');
  await waitFor(
    () => expect(localStorage.getItem('jay-ai-content-local-drafts')).toContain('# Discard this'),
    { timeout: 2000 },
  );

  await user.click(within(screen.getByLabelText('최근 문서')).getByRole('button', { name: /ideas\.md/ }));
  await user.click(screen.getByRole('button', { name: '변경사항 버리기' }));

  expect(await screen.findByLabelText('Markdown 편집기')).toHaveValue('# Ideas');
  expect(localStorage.getItem('jay-ai-content-local-drafts')).not.toContain('# Discard this');
});
