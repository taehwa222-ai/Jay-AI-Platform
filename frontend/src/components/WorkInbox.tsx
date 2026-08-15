import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, syncContentTasks, updateTask } from '../api';
import type { WorkTask } from '../types';

export function WorkInbox({ active, token }: { active: boolean; token: string }) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<WorkTask['priority']>('normal');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (announce = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await syncContentTasks(token);
      setTasks(result.tasks);
      setMessage(
        announce || result.created_count > 0 || result.completed_count > 0
          ? `자동 수집 완료 · 새 업무 ${result.created_count}건 · 단계 완료 ${result.completed_count}건`
          : null,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '업무 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === 'all' || (filter === 'done' ? task.status === 'done' : task.status !== 'done')),
    [filter, tasks],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const task = await createTask(token, {
        title: title.trim(),
        description: '',
        priority,
        due_date: dueDate || null,
      });
      setTasks((items) => [task, ...items]);
      setTitle('');
      setDueDate('');
      setMessage('업무를 인박스에 추가했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '업무를 추가하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(task: WorkTask, status: WorkTask['status']) {
    const updated = await updateTask(token, task.id, { status });
    setTasks((items) => items.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function remove(taskId: number) {
    await deleteTask(token, taskId);
    setTasks((items) => items.filter((item) => item.id !== taskId));
  }

  const openCount = tasks.filter((task) => task.status !== 'done').length;
  const doingCount = tasks.filter((task) => task.status === 'doing').length;

  return (
    <section className={active ? 'section-block task-inbox' : 'screen-hidden'} id="tasks">
      <div className="workspace-intro">
        <div>
          <span className="workspace-kicker"><InboxOutlined /> WORK INBOX</span>
          <h2>해야 할 일을 놓치지 않는 개인 업무함</h2>
          <p>떠오른 업무를 즉시 수집하고, 진행 중과 완료 상태만 가볍게 관리하세요.</p>
        </div>
        <div className="task-intro-actions">
          <button className="secondary-button" disabled={loading} onClick={() => void load()} type="button"><ReloadOutlined spin={loading} /> 새로고침</button>
          <button className="primary-button" disabled={loading} onClick={() => void load(true)} type="button"><SyncOutlined spin={loading} /> Content Ops 자동 수집</button>
        </div>
      </div>

      <div className="task-summary-grid">
        <article><InboxOutlined /><span><small>열린 업무</small><strong>{openCount}</strong></span></article>
        <article><ClockCircleOutlined /><span><small>진행 중</small><strong>{doingCount}</strong></span></article>
        <article><CheckCircleOutlined /><span><small>완료</small><strong>{tasks.length - openCount}</strong></span></article>
      </div>

      <form className="task-capture" onSubmit={(event) => void submit(event)}>
        <input aria-label="새 업무" onChange={(event) => setTitle(event.target.value)} placeholder="새 업무를 입력하세요" value={title} />
        <select aria-label="우선순위" onChange={(event) => setPriority(event.target.value as WorkTask['priority'])} value={priority}>
          <option value="high">높음</option><option value="normal">보통</option><option value="low">낮음</option>
        </select>
        <input aria-label="마감일" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
        <button disabled={loading || !title.trim()} type="submit"><PlusOutlined /> 추가</button>
      </form>

      {message && <div className="inline-message">{message}</div>}
      <div className="task-filter" role="tablist">
        {(['open', 'done', 'all'] as const).map((value) => (
          <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)} type="button">
            {value === 'open' ? '열린 업무' : value === 'done' ? '완료' : '전체'}
          </button>
        ))}
      </div>
      <div className="task-list">
        {visibleTasks.map((task) => (
          <article className={`task-card ${task.status}`} key={task.id}>
            <button
              aria-label={`${task.title} 완료 전환`}
              className="task-check"
              onClick={() => void changeStatus(task, task.status === 'done' ? 'todo' : 'done')}
              type="button"
            >
              {task.status === 'done' ? <CheckCircleOutlined /> : <span />}
            </button>
            <div><strong>{task.title}</strong><small>{task.source_type === 'disclosure' ? '공시 자동 생성 · ' : task.source_type === 'content' ? '콘텐츠 자동 생성 · ' : ''}{task.due_date ? `마감 ${task.due_date}` : '마감일 없음'} · 우선순위 {task.priority}</small></div>
            {task.status !== 'done' && (
              <button className="task-progress" onClick={() => void changeStatus(task, task.status === 'doing' ? 'todo' : 'doing')} type="button">
                {task.status === 'doing' ? '대기로' : '진행 시작'}
              </button>
            )}
            <button aria-label="업무 삭제" className="icon-button" onClick={() => void remove(task.id)} type="button"><DeleteOutlined /></button>
          </article>
        ))}
        {!loading && visibleTasks.length === 0 && <div className="empty-state">해당 상태의 업무가 없습니다.</div>}
      </div>
    </section>
  );
}
