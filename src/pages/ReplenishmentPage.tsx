import { useEffect, useMemo, useState } from 'react';
import DetailModal from '@/components/DetailModal';
import StatusBadge from '@/components/StatusBadge';
import {
  completeReplenishment,
  fetchReplenishmentItems,
  fetchReplenishmentSummary,
  fetchShelfImage,
  type LatestDetectionResponse,
  type DetectionOverlayResponse,
  type BboxResponse,
} from '@/api/dashboard';
import type { ReplenishmentItem } from '@/types/dashboard';
import AppButton from '@/components/AppButton';

interface Props {
  storeId?: number;
}

const PREVIEW_REPLENISHMENT_ITEM: ReplenishmentItem = {
  skuCode: 'PREVIEW-001',
  productName: '샘플_보충필요상품',
  status: 'REPLENISH_REQUIRED',
  priority: 1,
  warehouseQty: 12,
  shelfLabel: '선반 A',
  slotLabel: '2-3',
  detectedAt: '2026.05.29 10:00',
  statusReason: 'DB 연결 없이 모달 확인용 샘플 데이터입니다.',
  confidence: 0.95,
  detectedQuantity: 1,
  estimatedShelfQty: 1,
  productImageUrl: null,
  imageS3Key: null,
  imageWidth: null,
  imageHeight: null,
  bbox: null,
};

function getShelfIdByTab(currentShelf: 'A' | 'B') {
  return currentShelf === 'A' ? 1 : 2;
}

function formatDateTime(value: string | null | undefined): string {
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

function getFallbackShelfId(item: ReplenishmentItem, currentShelf: 'A' | 'B') {
  if (item.shelfId) {
    return item.shelfId;
  }

  if (item.shelfLabel?.includes('B')) {
    return 2;
  }

  if (item.shelfLabel?.includes('A')) {
    return 1;
  }

  return getShelfIdByTab(currentShelf);
}

function isMisplacedItem(item: ReplenishmentItem) {
  const reason = item.statusReason?.toUpperCase() ?? '';

  return (
    item.status === 'NEEDS_CHECK' ||
    item.status === 'NEED_CHECK' ||
    reason.includes('MISPLACED') ||
    item.statusReason?.includes('오진열') ||
    item.statusReason?.includes('기준 위치') ||
    item.statusReason?.includes('다른 곳')
  );
}

function normalizeSlotCode(value: string | undefined | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/선반/g, '')
    .replace(/\s+/g, '')
    .replace(/_/g, '-');
}

function isSameSlot(detection: DetectionOverlayResponse, selected: ReplenishmentItem) {
  const detectionSlot = normalizeSlotCode(detection.slotCode);
  const selectedSlot = normalizeSlotCode(selected.slotLabel);

  if (!detectionSlot || !selectedSlot) {
    return false;
  }

  return (
    detectionSlot === selectedSlot ||
    detectionSlot.includes(selectedSlot) ||
    selectedSlot.includes(detectionSlot)
  );
}

function isSameSku(detection: DetectionOverlayResponse, selected: ReplenishmentItem) {
  return detection.skuCode === String(selected.skuCode);
}

function isCheckDetection(detection: DetectionOverlayResponse) {
  return (
    detection.status === 'NEEDS_CHECK' ||
    detection.status === 'NEED_CHECK' ||
    detection.statusLabel?.includes('확인') ||
    detection.statusLabel?.includes('오진열')
  );
}

function findBySlot(
  detections: DetectionOverlayResponse[],
  selected: ReplenishmentItem,
) {
  const slotMatches = detections.filter((detection) => isSameSlot(detection, selected));

  return slotMatches.find(isCheckDetection) ?? slotMatches[0] ?? null;
}

function findBySku(
  detections: DetectionOverlayResponse[],
  selected: ReplenishmentItem,
) {
  return detections.find((detection) => isSameSku(detection, selected)) ?? null;
}

function findSelectedDetection(
  shelfImage: LatestDetectionResponse | null,
  selected: ReplenishmentItem | null,
): DetectionOverlayResponse | null {
  if (!shelfImage || !selected) {
    return null;
  }

  const slotDetection = findBySlot(shelfImage.detections, selected);
  const skuDetection = findBySku(shelfImage.detections, selected);

  if (isMisplacedItem(selected)) {
    return slotDetection ?? skuDetection;
  }

  return skuDetection ?? slotDetection;
}

function ShelfCropPreview({
  imageUrl,
  imageWidth,
  imageHeight,
  bbox,
}: {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  bbox: BboxResponse;
}) {
  const previewWidth = 230;
  const previewHeight = 136;

  if (!imageWidth || !imageHeight) {
    return (
      <div className="sku-modal-image-box">
        <img
          src={imageUrl}
          alt="선반 이미지"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    );
  }

  const isNormalizedBbox =
    bbox.x <= 1 &&
    bbox.y <= 1 &&
    bbox.width <= 1 &&
    bbox.height <= 1;

  const pixelBbox = isNormalizedBbox
    ? {
        x: bbox.x * imageWidth,
        y: bbox.y * imageHeight,
        width: bbox.width * imageWidth,
        height: bbox.height * imageHeight,
      }
    : bbox;

  const safeBboxWidth = Math.max(pixelBbox.width, 1);
  const safeBboxHeight = Math.max(pixelBbox.height, 1);

  const minScale = Math.max(previewWidth / imageWidth, previewHeight / imageHeight);
  const bboxScale = Math.max(
    previewWidth / (safeBboxWidth * 1.8),
    previewHeight / (safeBboxHeight * 1.8),
  );
  const scale = Math.min(Math.max(bboxScale, minScale), 8);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const bboxCenterX = pixelBbox.x + safeBboxWidth / 2;
  const bboxCenterY = pixelBbox.y + safeBboxHeight / 2;
  const centeredLeft = previewWidth / 2 - bboxCenterX * scale;
  const centeredTop = previewHeight / 2 - bboxCenterY * scale;
  const imageLeft =
    renderedWidth <= previewWidth
      ? (previewWidth - renderedWidth) / 2
      : Math.min(0, Math.max(previewWidth - renderedWidth, centeredLeft));
  const imageTop =
    renderedHeight <= previewHeight
      ? (previewHeight - renderedHeight) / 2
      : Math.min(0, Math.max(previewHeight - renderedHeight, centeredTop));

  return (
    <div
      className="sku-modal-image-box"
      style={{
        width: previewWidth,
        height: previewHeight,
        overflow: 'hidden',
        position: 'relative',
        padding: 0,
        background: '#f4f8fc',
      }}
    >
      <img
        src={imageUrl}
        alt="선반 확대 이미지"
        style={{
          width: imageWidth * scale,
          height: imageHeight * scale,
          maxWidth: 'none',
          maxHeight: 'none',
          position: 'absolute',
          left: imageLeft,
          top: imageTop,
          display: 'block',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: pixelBbox.x * scale + imageLeft,
          top: pixelBbox.y * scale + imageTop,
          width: safeBboxWidth * scale,
          height: safeBboxHeight * scale,
          border: '2px solid #3da5ff',
          borderRadius: 6,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default function ReplenishmentPage({ storeId = 1 }: Props) {
  const [selected, setSelected] = useState<ReplenishmentItem | null>(null);
  const [shelf, setShelf] = useState<'A' | 'B'>('A');

  const [items, setItems] = useState<ReplenishmentItem[]>([]);
  const [summary, setSummary] = useState({
    normal_count: 0,
    replenish_required_count: 0,
    needs_check_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedShelfImage, setSelectedShelfImage] = useState<LatestDetectionResponse | null>(null);
  const [shelfImageLoading, setShelfImageLoading] = useState(false);
  const [shelfImageError, setShelfImageError] = useState<string | null>(null);

  const [currentShelfImage, setCurrentShelfImage] = useState<LatestDetectionResponse | null>(null);
  const [currentShelfImageLoading, setCurrentShelfImageLoading] = useState(false);
  const [currentShelfImageError, setCurrentShelfImageError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, itemsData] = await Promise.all([
        fetchReplenishmentSummary(storeId),
        fetchReplenishmentItems(storeId),
      ]);

      setSummary(summaryData);
      setItems(itemsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [storeId]);

  useEffect(() => {
    const loadCurrentShelfImage = async () => {
      try {
        setCurrentShelfImageLoading(true);
        setCurrentShelfImageError(null);

        const shelfId = getShelfIdByTab(shelf);
        const shelfImage = await fetchShelfImage(shelfId);

        setCurrentShelfImage(shelfImage);
      } catch (e) {
        setCurrentShelfImage(null);
        setCurrentShelfImageError(e instanceof Error ? e.message : '선반 이미지 조회 실패');
      } finally {
        setCurrentShelfImageLoading(false);
      }
    };

    void loadCurrentShelfImage();
  }, [shelf]);

  useEffect(() => {
    if (!selected) {
      setSelectedShelfImage(null);
      setShelfImageError(null);
      return;
    }

    const loadSelectedShelfImage = async () => {
      try {
        setShelfImageLoading(true);
        setShelfImageError(null);

        const shelfId = getFallbackShelfId(selected, shelf);
        const shelfImage = await fetchShelfImage(shelfId);

        setSelectedShelfImage(shelfImage);
      } catch (e) {
        setSelectedShelfImage(null);
        setShelfImageError(e instanceof Error ? e.message : '선반 이미지 조회 실패');
      } finally {
        setShelfImageLoading(false);
      }
    };

    void loadSelectedShelfImage();
  }, [selected, shelf]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const selectedShelfId = getShelfIdByTab(shelf);

        if (item.shelfId) {
          return item.shelfId === selectedShelfId;
        }

        if (item.shelfLabel) {
          return item.shelfLabel.includes(`선반 ${shelf}`);
        }

        return true;
      }),
    [items, shelf],
  );

  const selectedDetection = useMemo(
    () => findSelectedDetection(selectedShelfImage, selected),
    [selectedShelfImage, selected],
  );

  const onComplete = async () => {
    if (!selected) return;

    await completeReplenishment(selected.skuCode, storeId);
    setSelected(null);
    await load();
  };

  return (
    <div className="page">
      <section className="overview-section">
        <h3 className="section-title">Overview</h3>

        <div className="overview-cards">
          <article className="overview-card tone-a">
            <p className="overview-label">정상 항목 수</p>
            <p className="overview-value">{summary.normal_count}</p>
          </article>

          <article className="overview-card tone-b">
            <p className="overview-label">보충 필요 항목 수</p>
            <p className="overview-value">{summary.replenish_required_count}</p>
          </article>

          <article className="overview-card tone-c">
            <p className="overview-label">확인 필요 항목 수</p>
            <p className="overview-value">{summary.needs_check_count}</p>
          </article>
        </div>
      </section>

      <section className="monitoring-section">
        <h3 className="section-title">Monitoring</h3>

        <div className="shelf-control-row">
          <div className="shelf-selector-bar">
            <button
              className={`shelf-segment ${shelf === 'A' ? 'active' : ''}`}
              onClick={() => setShelf('A')}
              type="button"
            >
              선반 A
            </button>

            <button
              className={`shelf-segment ${shelf === 'B' ? 'active' : ''}`}
              onClick={() => setShelf('B')}
              type="button"
            >
              선반 B
            </button>
          </div>

          <button className="shelf-add-btn" type="button" aria-label="선반 추가">
            +
          </button>
        </div>

        <div className="monitor-image-box">
          {currentShelfImageLoading ? (
            <div className="monitor-image-inner">선반 이미지 로딩 중...</div>
          ) : currentShelfImage?.imageUrl ? (
            <img
              src={currentShelfImage.imageUrl}
              alt="선반 이미지"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div className="monitor-image-inner">
              {currentShelfImageError ? '선반 이미지 조회 실패' : '탐지 이미지 영역'}
            </div>
          )}
        </div>
      </section>

      {loading && <div style={{ marginTop: 12 }}>로딩 중...</div>}

      {error && <div style={{ marginTop: 12, color: '#c24141' }}>오류: {error}</div>}

      <section className="task-list-section">
        <div className="task-list-heading-row">
          <h3 className="section-title task-list-title">작업 필요 리스트</h3>

          <button
            className="modal-preview-btn"
            type="button"
            onClick={() => setSelected(PREVIEW_REPLENISHMENT_ITEM)}
          >
            모달 미리보기
          </button>
        </div>
      </section>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="table replenishment-table">
            <colgroup>
              <col className="replenishment-col-priority" />
              <col className="replenishment-col-name" />
              <col className="replenishment-col-status" />
              <col className="replenishment-col-total" />
              <col className="replenishment-col-estimated" />
              <col className="replenishment-col-location" />
              <col className="replenishment-col-time" />
            </colgroup>
            <thead>
              <tr>
                <th>우선순위</th>
                <th>상품명</th>
                <th>상품상태</th>
                <th>총 재고</th>
                <th>추정 진열 재고</th>
                <th>위치</th>
                <th>탐지 시각</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={String(item.skuCode)}
                  onClick={() => setSelected(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{item.priority}</td>
                  <td>{item.productName}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.warehouseQty}</td>
                  <td>{item.estimatedShelfQty ?? '--'}</td>
                  <td>
                    {item.shelfLabel} {item.slotLabel}
                  </td>
                  <td>{formatDateTime(item.detectedAt)}</td>
                </tr>
              ))}

              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>
                    작업 필요 항목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetailModal open={!!selected} title="SKU Detail" onClose={() => setSelected(null)}>
        {selected && (
          <div className="sku-modal-body">
            <div className="sku-modal-top">
              {shelfImageLoading ? (
                <div className="sku-modal-image-box">선반 이미지 로딩 중...</div>
              ) : selectedShelfImage?.imageUrl && selectedDetection?.bbox ? (
                <ShelfCropPreview
                  imageUrl={selectedShelfImage.imageUrl}
                  imageWidth={selectedShelfImage.imageWidth}
                  imageHeight={selectedShelfImage.imageHeight}
                  bbox={selectedDetection.bbox}
                />
              ) : selectedShelfImage?.imageUrl ? (
                <div className="sku-modal-image-box sku-modal-image-missing-bbox">
                  <img
                    src={selectedShelfImage.imageUrl}
                    alt="선반 이미지"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                  <span>bbox 데이터 없음</span>
                </div>
              ) : (
                <div className="sku-modal-image-box">
                  {shelfImageError ? '선반 이미지 조회 실패' : '선반 이미지 없음'}
                </div>
              )}

              <div className="sku-modal-summary">
                <p className="sku-modal-name">{selected.productName}</p>
                <p className="sku-modal-id">SKU ID: {selected.skuCode}</p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">현재 상태:</span>{' '}
                  <StatusBadge status={selected.status} />
                </p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">탐지 시각:</span>{' '}
                  {formatDateTime(selected.detectedAt)}
                </p>

                <p className="sku-modal-row">
                  <span className="sku-modal-label">상태 근거:</span>{' '}
                  {selected.statusReason ?? '결손 탐지'}
                </p>
              </div>
            </div>

            <div className="sku-modal-metrics">
              <div className="sku-metric-box">
                <p>현재 창고 재고</p>
                <strong>{selected.warehouseQty}</strong>
              </div>

              <div className="sku-metric-box">
                <p>탐지 수량</p>
                <strong>{selected.detectedQuantity ?? '-'}</strong>
              </div>

              <div className="sku-metric-box">
                <p>탐지 Confidence</p>
                <strong>
                  {selected.confidence === null || selected.confidence === undefined
                    ? '-'
                    : `${Math.round(selected.confidence * 100)} %`}
                </strong>
              </div>

              <div className="sku-metric-box">
                <p>진열 위치</p>
                <strong>
                  {selected.shelfLabel} {selected.slotLabel}
                </strong>
              </div>
            </div>

            <div className="sku-modal-actions">
              <AppButton onClick={() => void onComplete()}>보충 완료 처리</AppButton>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
}
