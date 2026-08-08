import {
  BarChartOutlined,
  BookOutlined,
  DeleteOutlined,
  DollarOutlined,
  LineChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { FormEvent } from 'react';
import { SignalList } from './shared';
import { formatDateTime, formatPercent } from '../utils';
import type {
  StockAnalysisRecord,
  StockAnalysisResult,
  StockMarketSnapshot,
} from '../types';

export type AnalysisForm = {
  ticker: string;
  name: string;
  current_price: string;
  previous_close: string;
  volume: string;
  previous_volume: string;
  rsi: string;
  macd: string;
  macd_signal: string;
  memo: string;
};

export function StockAnalysisPanel({
  analysisForm,
  onFormChange,
  onSubmit,
  onLoadMarketSnapshot,
  marketLoading,
  analysisLoading,
  analysisMessage,
  marketSnapshot,
  analysisResult,
  topAnalysisCandidates,
  watchlistTickerSet,
  onCreateWatchlistFromAnalysis,
  analysisRecordQuery,
  onQueryChange,
  analysisRecordRatingFilter,
  onRatingFilterChange,
  filteredAnalysisRecords,
  analysisRecords,
  onRefreshRecords,
  creatingReportRecordId,
  onCreateReport,
  deletingAnalysisRecordId,
  onDeleteRecord,
}: {
  analysisForm: AnalysisForm;
  onFormChange: (form: AnalysisForm) => void;
  onSubmit: (event: FormEvent) => void;
  onLoadMarketSnapshot: () => void;
  marketLoading: boolean;
  analysisLoading: boolean;
  analysisMessage: string | null;
  marketSnapshot: StockMarketSnapshot | null;
  analysisResult: StockAnalysisResult | null;
  topAnalysisCandidates: StockAnalysisRecord[];
  watchlistTickerSet: Set<string>;
  onCreateWatchlistFromAnalysis: (record: StockAnalysisRecord) => void;
  analysisRecordQuery: string;
  onQueryChange: (value: string) => void;
  analysisRecordRatingFilter: string;
  onRatingFilterChange: (value: string) => void;
  filteredAnalysisRecords: StockAnalysisRecord[];
  analysisRecords: StockAnalysisRecord[];
  onRefreshRecords: () => void;
  creatingReportRecordId: number | null;
  onCreateReport: (recordId: number) => void;
  deletingAnalysisRecordId: number | null;
  onDeleteRecord: (recordId: number) => void;
}) {
  return (
    <article className="tool-pane stock-pane">
      <div className="pane-title">
        <BarChartOutlined />
        <h3>AI 분석 후보 만들기</h3>
      </div>
      <div className="pane-body">
        <form className="analysis-form" onSubmit={onSubmit}>
          <label>
            <span>종목코드</span>
            <input
              onChange={(event) => onFormChange({ ...analysisForm, ticker: event.target.value })}
              required
              value={analysisForm.ticker}
            />
          </label>
          <label>
            <span>종목명</span>
            <input
              onChange={(event) => onFormChange({ ...analysisForm, name: event.target.value })}
              required
              value={analysisForm.name}
            />
          </label>
          <label>
            <span>현재가</span>
            <input
              min="0"
              onChange={(event) =>
                onFormChange({ ...analysisForm, current_price: event.target.value })
              }
              required
              type="number"
              value={analysisForm.current_price}
            />
          </label>
          <label>
            <span>전일 종가</span>
            <input
              min="0"
              onChange={(event) =>
                onFormChange({ ...analysisForm, previous_close: event.target.value })
              }
              required
              type="number"
              value={analysisForm.previous_close}
            />
          </label>
          <label>
            <span>오늘 거래량</span>
            <input
              min="0"
              onChange={(event) => onFormChange({ ...analysisForm, volume: event.target.value })}
              required
              type="number"
              value={analysisForm.volume}
            />
          </label>
          <label>
            <span>전일 거래량</span>
            <input
              min="1"
              onChange={(event) =>
                onFormChange({ ...analysisForm, previous_volume: event.target.value })
              }
              required
              type="number"
              value={analysisForm.previous_volume}
            />
          </label>
          <label>
            <span>RSI</span>
            <input
              max="100"
              min="0"
              onChange={(event) => onFormChange({ ...analysisForm, rsi: event.target.value })}
              required
              type="number"
              value={analysisForm.rsi}
            />
          </label>
          <label>
            <span>MACD</span>
            <input
              onChange={(event) => onFormChange({ ...analysisForm, macd: event.target.value })}
              required
              type="number"
              value={analysisForm.macd}
            />
          </label>
          <label>
            <span>MACD Signal</span>
            <input
              onChange={(event) =>
                onFormChange({ ...analysisForm, macd_signal: event.target.value })
              }
              required
              type="number"
              value={analysisForm.macd_signal}
            />
          </label>
          <label className="wide-field">
            <span>분석 메모</span>
            <input
              onChange={(event) => onFormChange({ ...analysisForm, memo: event.target.value })}
              placeholder="예: 실적 발표 전, 거래량 급증, 기관 수급 확인 필요"
              value={analysisForm.memo}
            />
          </label>
          <button
            className="secondary-button"
            disabled={marketLoading || !analysisForm.ticker.trim()}
            onClick={onLoadMarketSnapshot}
            type="button"
          >
            <ReloadOutlined />
            시세/지표 불러오기
          </button>
          <button className="primary-button" disabled={analysisLoading} type="submit">
            <LineChartOutlined />
            분석 실행
          </button>
        </form>

        {analysisMessage && <div className="inline-message">{analysisMessage}</div>}
        {marketSnapshot && (
          <div className="market-snapshot">
            <span>{marketSnapshot.provider_symbol}</span>
            <span>{marketSnapshot.latest_trading_day}</span>
            <span>거래량 {marketSnapshot.volume_multiplier}배</span>
            <span>RSI {marketSnapshot.rsi}</span>
            <span>MACD {marketSnapshot.macd}</span>
          </div>
        )}
        {analysisResult && (
          <div className={`analysis-result ${analysisResult.rating}`}>
            <div className="analysis-score">
              <strong>{analysisResult.score}</strong>
              <span>{analysisResult.rating_label}</span>
            </div>
            <div className="analysis-copy">
              <h3>
                {analysisResult.name} {analysisResult.ticker}
              </h3>
              <p>{analysisResult.summary}</p>
              <p>{analysisResult.ai_summary}</p>
              <small>{analysisResult.ai_powered ? 'OpenAI 요약 사용' : '기본 분석 요약 사용'}</small>
            </div>
            <div className="analysis-columns">
              <SignalList title="긍정 신호" items={analysisResult.signals} />
              <SignalList title="주의 신호" items={analysisResult.risk_notes} />
              <SignalList title="체크리스트" items={analysisResult.action_checklist} />
            </div>
            <div className="disclaimer">{analysisResult.disclaimer}</div>
          </div>
        )}

        {topAnalysisCandidates.length > 0 && (
          <div className="analysis-leaderboard">
            <div className="chart-head">
              <strong>추천 후보 상위 기록</strong>
              <span>점수 · 거래량 · 가격 흐름 기준</span>
            </div>
            <div className="leaderboard-list">
              {topAnalysisCandidates.map((record, index) => (
                <article className={`leaderboard-card ${record.rating}`} key={record.id}>
                  <div className="leaderboard-rank">#{index + 1}</div>
                  <div>
                    <strong>
                      {record.name} <span>{record.ticker}</span>
                    </strong>
                    <small>
                      점수 {record.score} · {record.rating_label} · 거래량 {record.volume_multiplier}배
                    </small>
                  </div>
                  <button
                    className="secondary-button compact-button"
                    disabled={watchlistTickerSet.has(record.ticker)}
                    onClick={() => onCreateWatchlistFromAnalysis(record)}
                    type="button"
                  >
                    <BookOutlined />
                    {watchlistTickerSet.has(record.ticker) ? '저장됨' : '관심저장'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="analysis-history">
          <div className="chart-head">
            <strong>저장된 분석 기록</strong>
            <button className="secondary-button" onClick={onRefreshRecords} type="button">
              <ReloadOutlined />
              새로고침
            </button>
          </div>
          <div className="analysis-filter-bar">
            <input
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="종목명/코드 검색"
              type="search"
              value={analysisRecordQuery}
            />
            <select
              aria-label="분석 등급 필터"
              onChange={(event) => onRatingFilterChange(event.target.value)}
              value={analysisRecordRatingFilter}
            >
              <option value="all">전체 등급</option>
              <option value="candidate">관심 후보</option>
              <option value="watch">관찰 필요</option>
              <option value="caution">주의</option>
            </select>
            <span className="analysis-filter-count">
              {filteredAnalysisRecords.length}/{analysisRecords.length}
            </span>
          </div>
          <div className="analysis-record-list">
            {filteredAnalysisRecords.map((record) => (
              <article className={`analysis-record ${record.rating}`} key={record.id}>
                <div className="analysis-record-main">
                  <div>
                    <strong>
                      {record.name} <span>{record.ticker}</span>
                    </strong>
                    <small>
                      {formatDateTime(record.created_at)} · 점수 {record.score} · {record.rating_label}
                    </small>
                  </div>
                  <p>{record.summary}</p>
                  {record.memo && <p>메모: {record.memo}</p>}
                </div>
                <div className="analysis-record-side">
                  <span
                    className={record.price_change_percent >= 0 ? 'profit-positive' : 'profit-negative'}
                  >
                    {formatPercent(record.price_change_percent)}
                  </span>
                  <small>거래량 {record.volume_multiplier}배</small>
                  <button
                    className="secondary-button compact-button"
                    disabled={watchlistTickerSet.has(record.ticker)}
                    onClick={() => onCreateWatchlistFromAnalysis(record)}
                    type="button"
                  >
                    <BookOutlined />
                    관심
                  </button>
                  <button
                    className="secondary-button compact-button"
                    disabled={creatingReportRecordId === record.id}
                    onClick={() => onCreateReport(record.id)}
                    type="button"
                  >
                    <DollarOutlined />
                    Report
                  </button>
                  <button
                    className="icon-danger-button"
                    disabled={deletingAnalysisRecordId === record.id}
                    onClick={() => onDeleteRecord(record.id)}
                    title="분석 기록 삭제"
                    type="button"
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              </article>
            ))}
            {analysisRecords.length === 0 && (
              <div className="empty-state">아직 저장된 분석 기록이 없습니다.</div>
            )}
            {analysisRecords.length > 0 && filteredAnalysisRecords.length === 0 && (
              <div className="empty-state">조건에 맞는 분석 기록이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
