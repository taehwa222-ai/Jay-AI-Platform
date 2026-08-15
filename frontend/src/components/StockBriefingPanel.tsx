import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { getStockBriefing } from '../api';
import type { StockBriefing } from '../types';

export function StockBriefingPanel({ token }: { token: string }) {
  const [briefing, setBriefing] = useState<StockBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      setBriefing(await getStockBriefing(token, refresh));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '브리핑을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="briefing-panel">
      <div className="panel-title-row"><div><FileTextOutlined /><span><strong>오늘의 자동 브리핑</strong><small>현재 저장 데이터로 매일 한 번 생성합니다.</small></span></div><button disabled={loading} onClick={() => void load(true)} type="button"><ReloadOutlined spin={loading} /> 다시 생성</button></div>
      {message && <div className="error-box">{message}</div>}
      {briefing ? <article><span>{briefing.briefing_date}</span><h3>{briefing.title}</h3><p>{briefing.body}</p><div><small>보유 {briefing.holding_count}</small><small>관심 {briefing.watchlist_count}</small><small>분석 {briefing.analysis_count}</small></div></article> : <div className="workspace-loading-card">브리핑을 준비하고 있습니다.</div>}
    </div>
  );
}
