import {
  BarChartOutlined,
  DeleteOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { FormEvent } from 'react';
import { StatusTile } from './shared';
import { formatPercent, formatPlainPercent, formatWon } from '../utils';
import type { StockHolding } from '../types';

export type HoldingForm = {
  ticker: string;
  name: string;
  quantity: string;
  average_price: string;
  current_price: string;
  investment_thesis: string;
  risk_memo: string;
};

export type PortfolioBreakdownItem = StockHolding & { allocationPercent: number };

export function StockHoldingsPanel({
  holdings,
  holdingForm,
  onFormChange,
  onCreate,
  holdingLoading,
  holdingMessage,
  holdingRefreshLoading,
  onRefreshPrices,
  currentPriceDrafts,
  onCurrentPriceDraftChange,
  savingCurrentPriceId,
  onSaveCurrentPrice,
  prefillAnalysisLoadingKey,
  onAnalyze,
  quickAnalysisLoadingKey,
  onQuickAnalyze,
  onDelete,
  portfolioTotals,
  portfolioProfitPercent,
  portfolioBreakdown,
  maxHoldingProfitPercent,
}: {
  holdings: StockHolding[];
  holdingForm: HoldingForm;
  onFormChange: (form: HoldingForm) => void;
  onCreate: (event: FormEvent) => void;
  holdingLoading: boolean;
  holdingMessage: string | null;
  holdingRefreshLoading: boolean;
  onRefreshPrices: () => void;
  currentPriceDrafts: Record<number, string>;
  onCurrentPriceDraftChange: (holdingId: number, value: string) => void;
  savingCurrentPriceId: number | null;
  onSaveCurrentPrice: (holding: StockHolding) => void;
  prefillAnalysisLoadingKey: string | null;
  onAnalyze: (holding: StockHolding) => void;
  quickAnalysisLoadingKey: string | null;
  onQuickAnalyze: (holding: StockHolding) => void;
  onDelete: (holdingId: number) => void;
  portfolioTotals: { cost: number; value: number; profit: number };
  portfolioProfitPercent: number;
  portfolioBreakdown: PortfolioBreakdownItem[];
  maxHoldingProfitPercent: number;
}) {
  return (
    <article className="tool-pane stock-pane">
      <div className="pane-title">
        <LineChartOutlined />
        <h3>내 주식 포트폴리오</h3>
        <button
          className="secondary-button"
          disabled={holdingRefreshLoading || holdings.length === 0}
          onClick={onRefreshPrices}
          type="button"
        >
          <ReloadOutlined />
          현재가 전체 갱신
        </button>
      </div>
      <div className="pane-body">
        <div className="portfolio-summary">
          <StatusTile label="평가금액" value={formatWon(portfolioTotals.value)} tone="good" />
          <StatusTile label="투입원금" value={formatWon(portfolioTotals.cost)} />
          <StatusTile
            label="손익"
            value={`${formatWon(portfolioTotals.profit)} (${formatPercent(portfolioProfitPercent)})`}
            tone={portfolioTotals.profit >= 0 ? 'good' : 'steady'}
          />
        </div>

        {portfolioBreakdown.length > 0 && (
          <div className="portfolio-visuals">
            <div className="portfolio-chart-panel">
              <div className="chart-head">
                <strong>보유 비중</strong>
                <span>평가금액 기준</span>
              </div>
              <div className="allocation-list">
                {portfolioBreakdown.map((holding) => (
                  <div className="allocation-row" key={holding.id}>
                    <div className="allocation-label">
                      <strong>{holding.name}</strong>
                      <span>{formatPlainPercent(holding.allocationPercent)}</span>
                    </div>
                    <div className="allocation-track">
                      <div
                        className="allocation-fill"
                        style={{ width: `${Math.max(2, holding.allocationPercent)}%` }}
                      />
                    </div>
                    <small>{formatWon(holding.market_value)}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="portfolio-chart-panel">
              <div className="chart-head">
                <strong>수익률 비교</strong>
                <span>종목별 손익률</span>
              </div>
              <div className="performance-list">
                {portfolioBreakdown.map((holding) => {
                  const barWidth = Math.max(
                    4,
                    (Math.abs(holding.profit_loss_percent) / maxHoldingProfitPercent) * 100,
                  );
                  return (
                    <div className="performance-row" key={holding.id}>
                      <div className="performance-label">
                        <strong>{holding.name}</strong>
                        <span
                          className={holding.profit_loss >= 0 ? 'profit-positive' : 'profit-negative'}
                        >
                          {formatPercent(holding.profit_loss_percent)}
                        </span>
                      </div>
                      <div className="performance-track">
                        <div
                          className={`performance-fill ${
                            holding.profit_loss >= 0 ? 'positive' : 'negative'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <small>{formatWon(holding.profit_loss)}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <details className="stock-form-disclosure">
          <summary>
            <span><PlusOutlined /> 보유종목 추가</span>
            <small>종목, 수량, 평단가와 투자 근거 입력</small>
          </summary>
          <form className="stock-form" onSubmit={onCreate}>
          <label>
            <span>종목코드</span>
            <input
              onChange={(event) => onFormChange({ ...holdingForm, ticker: event.target.value })}
              placeholder="005930"
              required
              value={holdingForm.ticker}
            />
          </label>
          <label>
            <span>종목명</span>
            <input
              onChange={(event) => onFormChange({ ...holdingForm, name: event.target.value })}
              placeholder="삼성전자"
              required
              value={holdingForm.name}
            />
          </label>
          <label>
            <span>보유수량</span>
            <input
              min="0"
              onChange={(event) => onFormChange({ ...holdingForm, quantity: event.target.value })}
              required
              step="0.0001"
              type="number"
              value={holdingForm.quantity}
            />
          </label>
          <label>
            <span>평단가</span>
            <input
              min="0"
              onChange={(event) => onFormChange({ ...holdingForm, average_price: event.target.value })}
              required
              type="number"
              value={holdingForm.average_price}
            />
          </label>
          <label>
            <span>현재가</span>
            <input
              min="0"
              onChange={(event) => onFormChange({ ...holdingForm, current_price: event.target.value })}
              required
              type="number"
              value={holdingForm.current_price}
            />
          </label>
          <label className="wide-field">
            <span>투자 근거</span>
            <input
              onChange={(event) =>
                onFormChange({ ...holdingForm, investment_thesis: event.target.value })
              }
              placeholder="예: 반도체 업황 회복, 실적 개선 기대"
              value={holdingForm.investment_thesis}
            />
          </label>
          <label className="wide-field">
            <span>리스크 메모</span>
            <input
              onChange={(event) => onFormChange({ ...holdingForm, risk_memo: event.target.value })}
              placeholder="예: 환율, 업황 둔화, 과열 구간"
              value={holdingForm.risk_memo}
            />
          </label>
          <button className="primary-button" disabled={holdingLoading} type="submit">
            <PlusOutlined />
            보유 종목 저장
          </button>
          </form>
        </details>

        <div className="holding-list">
          {holdings.map((holding) => (
            <div className="holding-row" key={holding.id}>
              <div className="holding-main">
                <strong>
                  {holding.name} <span>{holding.ticker}</span>
                </strong>
                <small>
                  {holding.quantity}주 · 평단 {formatWon(holding.average_price)} · 평가{' '}
                  {formatWon(holding.market_value)}
                </small>
                {(holding.investment_thesis || holding.risk_memo) && (
                  <p>
                    {holding.investment_thesis}
                    {holding.risk_memo ? ` / 리스크: ${holding.risk_memo}` : ''}
                  </p>
                )}
              </div>
              <div className={`profit-box ${holding.profit_loss >= 0 ? 'positive' : 'negative'}`}>
                <span>{formatWon(holding.profit_loss)}</span>
                <strong>{formatPercent(holding.profit_loss_percent)}</strong>
              </div>
              <div className="price-editor">
                <input
                  min="0"
                  onChange={(event) => onCurrentPriceDraftChange(holding.id, event.target.value)}
                  type="number"
                  value={currentPriceDrafts[holding.id] ?? holding.current_price}
                />
                <button
                  className="secondary-button"
                  disabled={savingCurrentPriceId === holding.id}
                  onClick={() => onSaveCurrentPrice(holding)}
                  title="현재가 저장"
                  type="button"
                >
                  <SaveOutlined />
                </button>
              </div>
              <button
                className="secondary-button row-action-button"
                disabled={prefillAnalysisLoadingKey === `holding-${holding.id}`}
                onClick={() => onAnalyze(holding)}
                title="이 종목을 AI 분석 폼으로 보내기"
                type="button"
              >
                <BarChartOutlined />
                분석
              </button>
              <button
                className="primary-button row-action-button"
                disabled={quickAnalysisLoadingKey === `holding-${holding.id}`}
                onClick={() => onQuickAnalyze(holding)}
                title="이 종목을 바로 AI 분석하고 저장하기"
                type="button"
              >
                즉시
              </button>
              <button
                className="icon-danger-button"
                onClick={() => onDelete(holding.id)}
                title="삭제"
                type="button"
              >
                <DeleteOutlined />
              </button>
            </div>
          ))}
          {holdings.length === 0 && <div className="empty-state">아직 저장된 보유 종목이 없습니다.</div>}
        </div>
        {holdingMessage && <div className="inline-message">{holdingMessage}</div>}
      </div>
    </article>
  );
}
