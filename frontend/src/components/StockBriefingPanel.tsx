import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { getDailyStockRun, getStockBriefing, runDailyStockAutomation } from '../api';
import type { DailyStockRun, StockBriefing } from '../types';

export function StockBriefingPanel({ token }: { token: string }) {
  const [briefing, setBriefing] = useState<StockBriefing | null>(null);
  const [dailyRun, setDailyRun] = useState<DailyStockRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningDaily, setRunningDaily] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const [nextBriefing, nextDailyRun] = await Promise.all([
        getStockBriefing(token, refresh),
        getDailyStockRun(token),
      ]);
      setBriefing(nextBriefing);
      setDailyRun(nextDailyRun);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '브리핑을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const runDaily = async () => {
    setRunningDaily(true);
    try {
      const result = await runDailyStockAutomation(token);
      setDailyRun(result.run);
      setBriefing(await getStockBriefing(token, true));
      setMessage(result.already_ran ? '오늘의 데일리 동기화가 이미 완료되었습니다.' : null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '데일리 주식 동기화에 실패했습니다.');
    } finally {
      setRunningDaily(false);
    }
  };

  return (
    <div className="briefing-panel">
      <div className="panel-title-row">
        <div><FileTextOutlined /><span><strong>오늘의 자동 브리핑</strong><small>현재 데이터로 매일 한 번 생성합니다.</small></span></div>
        <button disabled={loading} onClick={() => void load(true)} type="button"><ReloadOutlined spin={loading} /> 다시 생성</button>
      </div>
      {message && <div className="error-box">{message}</div>}
      <div className="briefing-run-status">
        <div>
          <strong>오늘의 시세·공시 동기화</strong>
          <small>{dailyRun ? dailyRun.summary : '아직 실행하지 않았습니다. 보유종목 시세와 관심종목 공시를 한 번에 확인하세요.'}</small>
          {dailyRun && <small>상태: {dailyRun.status} · 시세 {dailyRun.price_updated_count}건 · 공시 {dailyRun.disclosure_count}건 · 업무 {dailyRun.task_created_count}건{dailyRun.telegram_sent ? ' · 텔레그램 발송됨' : ''}</small>}
        </div>
        <button disabled={runningDaily || dailyRun?.status === 'running'} onClick={() => void runDaily()} type="button">
          <ReloadOutlined spin={runningDaily || dailyRun?.status === 'running'} /> {dailyRun ? '오늘 결과 확인' : '오늘 동기화 실행'}
        </button>
      </div>
      {briefing ? <article><span>{briefing.briefing_date}</span><h3>{briefing.title}</h3><p>{briefing.body}</p><div><small>보유 {briefing.holding_count}</small><small>관심 {briefing.watchlist_count}</small><small>분석 {briefing.analysis_count}</small></div></article> : <div className="workspace-loading-card">브리핑을 준비하고 있습니다.</div>}
    </div>
  );
}
