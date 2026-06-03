import { useEffect, useMemo, useRef, useState } from 'react';
import DetailModal from '@/components/DetailModal';
import StatusBadge from '@/components/StatusBadge';
import { fetchOrderItems, fetchOrderSummary, updateOrderCompleted } from '@/api/dashboard';
import type { OrderItem, OrderSummary } from '@/types/dashboard';
import AppButton from '@/components/AppButton';
import glassIcon from '@/../assets/glass.png';
import chevronIcon from '@/../assets/chevron.png';
import resetIcon from '@/../assets/reset.png';

interface Props {
  storeId?: number;
}

const CAT_META: Record<string, { label: string; color: string }> = {
  과자: { label: '과자', color: '#f58c81' },
  면류: { label: '면류', color: '#ffa07a' },
  상온: { label: '상온', color: '#fab28b' },
  '통조림/안주': { label: '통조림/안주', color: '#fad099' },
  기타: { label: '기타', color: '#fadfb0' },
  미분류: { label: '미분류', color: '#a3a3a3' },
};

const EMPTY_SUMMARY: OrderSummary = {
  orderRequiredSkuCount: 0,
  soldOutSkuCount: 0,
  lastUpdatedAt: null,
  categoryDistribution: [],
};

function formatDateTime(value: string | null): string {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export default function OrderPage({ storeId = 1 }: Props) {
  const [selected, setSelected] = useState<OrderItem | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [summary, setSummary] = useState<OrderSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [completingSkuCode, setCompletingSkuCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const categorySelectRef = useRef<HTMLSelectElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, itemsData] = await Promise.all([
        fetchOrderSummary(storeId),
        fetchOrderItems(storeId),
      ]);

      setSummary(summaryData);
      setItems(itemsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
      setSummary(EMPTY_SUMMARY);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [storeId]);

  const maxDist = useMemo(() => {
    return Math.max(...summary.categoryDistribution.map((d) => d.count), 1);
  }, [summary.categoryDistribution]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const keyword = search.trim().toLowerCase();

      const qOk =
        keyword.length === 0 ||
        item.productName.toLowerCase().includes(keyword) ||
        String(item.skuCode).toLowerCase().includes(keyword);

      const cOk = category.trim().length === 0 || item.category === category;

      return qOk && cOk;
    });
  }, [items, search, category]);

  const onUpdateOrderCompleted = async (item: OrderItem, orderCompleted: boolean) => {
    const skuCode = String(item.skuCode);
    setCompletingSkuCode(skuCode);
    setError(null);
    setItems((prev) =>
      prev.map((current) =>
        String(current.skuCode) === skuCode
          ? { ...current, isOrderCompleted: orderCompleted }
          : current,
      ),
    );

    try {
      await updateOrderCompleted(item.skuCode, orderCompleted);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
      setItems((prev) =>
        prev.map((current) =>
          String(current.skuCode) === skuCode
            ? { ...current, isOrderCompleted: item.isOrderCompleted }
            : current,
        ),
      );
    } finally {
      setCompletingSkuCode(null);
    }
  };

  const onComplete = async () => {
    if (!selected) return;

    await onUpdateOrderCompleted(selected, true);
    setSelected(null);
  };

  return (
    <div className="page">
      <section className="overview-section">
        <h3 className="section-title">Overview</h3>

        <div className="order-overview-cards">
          <article className="order-overview-card tone-a">
            <p className="overview-label">발주 필요 SKU</p>
            <p className="order-overview-value">
              {summary.orderRequiredSkuCount} 건
            </p>
          </article>

          <article className="order-overview-card tone-c">
            <p className="overview-label">전량 소진 SKU</p>
            <p className="order-overview-value">
              {summary.soldOutSkuCount} 건
            </p>
          </article>

          <article className="order-overview-card tone-b wide">
            <p className="overview-label">카테고리 분포</p>

            <div className="order-dist-chart-wrap">
              <div className="order-dist-bars">
                {summary.categoryDistribution.map((d) => (
                  <div key={d.category} className="order-dist-bar-item">
                    <span className="order-dist-bar-count">{d.count}</span>
                    <div
                      className="order-dist-bar"
                      style={{
                        height:
                          d.count > 0
                            ? `${Math.max((d.count / maxDist) * 55, 4)}px`
                            : '0px',
                        background: CAT_META[d.category]?.color ?? '#a3a3a3',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="order-dist-axis" />

              <div className="order-dist-labels">
                {summary.categoryDistribution.map((d) => (
                  <span
                    key={`${d.category}-lbl`}
                    className="order-dist-bar-label"
                  >
                    {CAT_META[d.category]?.label ?? d.category}
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="task-list-section order-task-list">
        <h3 className="section-title task-list-title">발주 필요 리스트</h3>

        <div className="order-filter-bar">
          <div className="order-search-wrap">
            <img src={glassIcon} alt="" className="order-search-icon" />
            <input
              className="order-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
          </div>

          <div className="order-select-wrap">
            <select
              ref={categorySelectRef}
              className="order-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">카테고리 설정</option>
              <option value="과자">과자</option>
              <option value="면류">면류</option>
              <option value="상온">상온</option>
              <option value="통조림/안주">통조림/안주</option>
              <option value="기타">기타</option>
            </select>

            <button
              type="button"
              className="order-select-trigger"
              aria-label="카테고리 선택 열기"
              onClick={() => {
                const el = categorySelectRef.current;
                if (!el) return;

                if (
                  typeof (el as HTMLSelectElement & { showPicker?: () => void })
                    .showPicker === 'function'
                ) {
                  (el as HTMLSelectElement & { showPicker: () => void }).showPicker();
                } else {
                  el.focus();
                  el.click();
                }
              }}
            >
              <img src={chevronIcon} alt="" className="order-select-chevron" />
            </button>
          </div>

          <button
            className="order-reset"
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('');
            }}
          >
            <img src={resetIcon} alt="" className="order-reset-icon" />
            <span>Reset</span>
          </button>

          <div className="order-updated">
            <span className="order-updated-label">업데이트 시간:</span>
            <span className="order-updated-value">
              {formatDateTime(summary.lastUpdatedAt)}
            </span>
          </div>
        </div>
      </section>

      {loading && <div style={{ marginTop: 12 }}>로딩 중...</div>}
      {error && (
        <div style={{ marginTop: 12, color: '#c24141' }}>
          오류: {error}
        </div>
      )}

      <div className="table-wrap order-table-wrap">
        <div className="table-scroll order-table-scroll">
          <table className="table order-table">
            <thead>
              <tr>
                <th>SKU ID</th>
                <th>상품명</th>
                <th>상태 전환 시각</th>
                <th>진열 위치</th>
                <th>총 재고</th>
                <th>발주 완료 처리</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6}>발주 필요 항목이 없습니다.</td>
                </tr>
              )}

              {filteredItems.map((item) => (
                <tr
                  key={item.skuCode}
                  onClick={() => setSelected(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{item.skuCode}</td>
                  <td>{item.productName}</td>
                  <td>{formatDateTime(item.updatedAt)}</td>
                  <td>
                    {item.shelfLabel} {item.slotLabel}
                  </td>
                  <td>{item.totalQuantity}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={item.isOrderCompleted}
                      disabled={completingSkuCode === String(item.skuCode)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => void onUpdateOrderCompleted(item, e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailModal
        open={!!selected}
        title="SKU Detail"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="sku-modal-body order-sku-modal-body">
            <div className="sku-modal-top">
              <div className="sku-modal-image-box">
                {selected.productImageUrl ? (
                  <img
                    src={selected.productImageUrl}
                    alt={selected.productName}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  'SKU 이미지'
                )}
              </div>

              <div className="sku-modal-summary">
                <p className="sku-modal-name">{selected.productName}</p>
                <p className="sku-modal-id">SKU ID: {selected.skuCode}</p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">현재 상태:</span>{' '}
                  <StatusBadge status={selected.status} />
                </p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">상태 전환 시각:</span>{' '}
                  {formatDateTime(selected.updatedAt)}
                </p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">발주 필요 근거:</span>{' '}
                  {selected.statusReason ?? '창고 재고가 ROP 이하입니다.'}
                </p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">진열 위치:</span>{' '}
                  {selected.shelfLabel} {selected.slotLabel}
                </p>
              </div>
            </div>

            <div className="sku-modal-metrics">
              <div className="sku-metric-box">
                <p>현재 재고</p>
                <strong>{selected.totalQuantity}</strong>
              </div>

              <div className="sku-metric-box">
                <p>예상 리드 타임(일)</p>
                <strong>{selected.leadTimeDays ?? '-'}</strong>
              </div>
            </div>

            <div className="sku-modal-actions">
              <AppButton onClick={() => void onComplete()}>
                발주 완료 처리
              </AppButton>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
}
