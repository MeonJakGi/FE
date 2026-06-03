export type StockStatus =
  | 'NORMAL'
  | 'REPLENISH_REQUIRED'
  | 'NEEDS_CHECK'
  | 'ORDER_REQUIRED'
  | 'ENOUGH'
  | 'NEED_REFILL'
  | 'NEED_CHECK'
  | 'ORDER_NEEDED';

export interface ReplenishmentItem {
  skuCode: number | string;
  productName: string;
  status: Exclude<StockStatus, 'ORDER_REQUIRED' | 'ORDER_NEEDED'>;
  priority: number;

  // 프론트 화면에서는 warehouseQty로 사용
  warehouseQty: number;

  // 프론트 화면에서는 shelfLabel / slotLabel로 사용
  shelfLabel: string;
  slotLabel: string;

  detectedAt: string;
  stockId?: number;
  shelfId?: number | null;
  shelfImageId?: number;

  // 백엔드 reasonSummary를 api/dashboard.ts에서 statusReason으로 매핑해서 사용
  statusReason?: string | null;

  confidence?: number | null;
  detectedQuantity?: number;
  estimatedShelfQty?: number | null;

  productImageUrl?: string | null;
  imageS3Key?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;

  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface OrderSummary {
  orderRequiredSkuCount: number;
  soldOutSkuCount: number;
  lastUpdatedAt: string | null;
  categoryDistribution: CategoryDistribution[];
}

export interface OrderListResponse {
  items: OrderItem[];
}

export interface OrderItem {
  skuCode: string;
  productName: string;
  status: StockStatus;
  updatedAt: string | null;
  totalQuantity: number;
  shelfLabel: string;
  slotLabel: string;
  category?: string | null;
  isOrderCompleted: boolean;
  stockId?: number;
  reorderPoint: number | null;
  recommendedOrderQuantity: number | null;
  leadTimeDays: number | null;
  statusReason: string | null;
  confidence?: number | null;
  productImageUrl: string | null;
  imageS3Key?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface NotificationItem {
  notificationId: number;
  type: 'REPLENISH_REQUIRED' | 'NEEDS_CHECK' | 'ORDER_REQUIRED' | 'NEED_REFILL' | 'NEED_CHECK' | 'ORDER_NEEDED';
  title: string;
  message: string;
  skuCode: number | string;
  targetScreen: 'SCR-1' | 'SCR-2';
  createdAt: string;
  isRead: boolean;
  stockId?: number;
  alarmType?: string;
  productName?: string;
  locationLabel?: string;
}

export interface BboxResponse {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionOverlayResponse {
  detectionResultId: number;
  skuCode: string;
  productName: string;
  slotCode: string;
  bbox: BboxResponse;
  depthPosition: string;
  confidence: number;
  status: StockStatus;
  statusLabel: string;
}

export interface LatestDetectionResponse {
  shelfId: number;
  shelfImageId: number;
  imageS3Key: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  capturedAt: string;
  frontEdgePoints: string | null;
  detections: DetectionOverlayResponse[];
}
