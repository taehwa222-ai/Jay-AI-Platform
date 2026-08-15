import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  createDatabaseBackup,
  createInvitation,
  downloadDatabaseBackup,
  exportWorkspaceData,
  getDataStatus,
  getInvitations,
  revokeInvitation,
  restoreDatabaseBackup,
  verifyDatabaseBackup,
} from '../api';
import type { DataStatus, Invitation } from '../types';

export function DataControlPanel({ token }: { token: string }) {
  const [data, setData] = useState<DataStatus | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [latestLink, setLatestLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextData, nextInvitations] = await Promise.all([
        getDataStatus(token),
        getInvitations(token),
      ]);
      setData(nextData);
      setInvitations(nextInvitations);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '운영 데이터를 불러오지 못했습니다.');
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function backup() {
    setBusy(true);
    try {
      const result = await createDatabaseBackup(token);
      setMessage(result.message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function verify(filename: string) {
    setBusy(true);
    try {
      await verifyDatabaseBackup(token, filename);
      setMessage(`${filename} 무결성 검사를 통과했습니다.`);
    } finally {
      setBusy(false);
    }
  }

  async function download(filename: string) {
    const blob = await downloadDatabaseBackup(token, filename);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportAll() {
    const blob = await exportWorkspaceData(token);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `jay-ai-export-${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function restore(filename: string) {
    const expected = `RESTORE ${filename}`;
    const confirmation = window.prompt(
      `복원 전에 현재 DB의 안전 백업을 자동 생성합니다. 계속하려면 다음 문구를 입력하세요.\n${expected}`,
    );
    if (confirmation !== expected) {
      if (confirmation !== null) setMessage('확인 문구가 일치하지 않아 복원을 취소했습니다.');
      return;
    }
    setBusy(true);
    try {
      const result = await restoreDatabaseBackup(token, filename, confirmation);
      setMessage(`${result.message} 안전 백업: ${result.safety_backup}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const invitation = await createInvitation(token, {
        email,
        role,
        can_access_stocks: true,
        can_access_content_ops: true,
        expires_in_days: 7,
      });
      const link = `${window.location.origin}/?invite=${encodeURIComponent(invitation.token ?? '')}#auth`;
      setLatestLink(link);
      setEmail('');
      setMessage('7일 동안 유효한 초대 링크를 생성했습니다. 이 화면을 닫기 전에 복사하세요.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="data-control-grid">
      <article className="operations-panel data-safety-panel">
        <div className="operations-panel-heading"><span><DatabaseOutlined /></span><div><h3>데이터 안전 센터</h3><p>백업 생성 · 검증 · 내려받기</p></div></div>
        {data && <div className="data-safety-stats"><span><small>DB</small><strong>{formatBytes(data.database_size_bytes)}</strong></span><span><small>Markdown</small><strong>{data.content_file_count}개</strong></span><span><small>WAL</small><strong>{data.wal_enabled ? '정상' : '확인 필요'}</strong></span></div>}
        <div className="data-safety-actions"><button className="primary-button" disabled={busy} onClick={() => void backup()} type="button"><SafetyCertificateOutlined /> 지금 안전 백업</button><button className="secondary-button" disabled={busy} onClick={() => void exportAll()} type="button"><CloudDownloadOutlined /> 전체 ZIP 내보내기</button></div>
        <div className="backup-list">
          {data?.backups.slice(0, 5).map((item) => <div key={item.filename}><span><strong>{item.filename}</strong><small>{formatBytes(item.size_bytes)}</small></span><button onClick={() => void verify(item.filename)} type="button"><CheckCircleOutlined /> 검증</button><button onClick={() => void download(item.filename)} type="button"><CloudDownloadOutlined /> 저장</button><button className="restore-button" disabled={busy} onClick={() => void restore(item.filename)} type="button">복원</button></div>)}
          {data?.backups.length === 0 && <div className="empty-state">아직 생성된 백업이 없습니다.</div>}
        </div>
      </article>

      <article className="operations-panel invitation-panel">
        <div className="operations-panel-heading"><span><TeamOutlined /></span><div><h3>팀 초대</h3><p>권한이 포함된 일회용 가입 링크</p></div></div>
        <form onSubmit={(event) => void invite(event)}><input aria-label="초대 이메일" onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" required type="email" value={email} /><select aria-label="초대 역할" onChange={(event) => setRole(event.target.value as 'member' | 'admin')} value={role}><option value="member">멤버</option><option value="admin">관리자</option></select><button disabled={busy} type="submit">초대 생성</button></form>
        {latestLink && <div className="invite-link"><input aria-label="생성된 초대 링크" readOnly value={latestLink} /><button onClick={() => void navigator.clipboard.writeText(latestLink)} type="button"><CopyOutlined /> 복사</button></div>}
        <div className="invitation-list">
          {invitations.slice(0, 6).map((item) => <div key={item.id}><span><strong>{item.email}</strong><small>{item.used_at ? '사용 완료' : item.revoked_at ? '취소됨' : `${item.role} · ${new Date(item.expires_at).toLocaleDateString('ko-KR')}까지`}</small></span>{!item.used_at && !item.revoked_at && <button aria-label="초대 취소" onClick={() => void revokeInvitation(token, item.id).then(load)} type="button"><DeleteOutlined /></button>}</div>)}
        </div>
      </article>
      {message && <div className="inline-message data-control-message">{message}</div>}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
