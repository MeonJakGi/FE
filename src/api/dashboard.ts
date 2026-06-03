import { getJson, postJson, patchJson } from './client';
import type {
  OrderSummary,
  OrderItem,
  ReplenishmentItem,
  NotificationItem,
  LatestDetectionResponse,
  DetectionOverlayResponse,
  BboxResponse,
  StockStatus,
} from '@/types/dashboard';

export type {
  BboxResponse,
  DetectionOverlayResponse,
  LatestDetectionResponse,
} from '@/types/dashboard';

type Primitive = string | number | boolean | null | undefined;
type AnyRecord = Record<string, Primitive | object | Array<unknown>>;

interface ReplenishmentSummaryResponse {
  normal_count: number;
  replenish_required_count: number;
  needs_check_count: number;
  last_updated_at?: string | null;
}

interface ReplenishmentSummaryApiResponse {
  normal_count?: number;
  replenish_required_count?: number;
  needs_check_count?: number;
  last_updated_at?: string | null;
  normalCount?: number;
  replenishRequiredCount?: number;
  needsCheckCount?: number;
  lastUpdatedAt?: string | null;
  summary?: {
    enoughCount?: number;
    needRefillCount?: number;
    needCheckCount?: number;
  };
}

interface OrderSummaryResponse {
  order_required_sku_count?: number;
  sold_out_sku_count?: number;
  last_updated_at?: string | null;
  category_distribution?: Array<{ category: string; count: number }>;
  orderRequiredSkuCount?: number;
  soldOutSkuCount?: number;
  lastUpdatedAt?: string | null;
  categoryDistribution?: Array<{ category: string; count: number }>;
}

interface ItemListResponse<T> {
  items: T[];
  pagination?: {
    page: number;
    size: number;
    total: number;
  };
}

interface NotificationsResponse {
  unread_count?: number;
  unreadCount?: number;
  items?: AnyRecord[];
  notifications?: AnyRecord[];
}

interface NotificationUnreadCountResponse {
  unread_count?: number;
  unreadCount?: number;
  count?: number;
}

export interface StoreItem {
  storeId: number;
  storeName: string;
}

interface StoresResponse {
  items?: AnyRecord[];
  stores?: AnyRecord[];
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value: Primitive, fallback = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return fallback;
};

const toString = (value: Primitive, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const pick = <T = Primitive>(obj: AnyRecord, keys: string[], fallback: T): T => {
  for (const key of keys) {
    if (key in obj && obj[key] !== null && obj[key] !== undefined) {
      return obj[key] as T;
    }
  }
  return fallback;
};

const normalizeStatus = (status: string): StockStatus => {
  switch (status) {
    case 'ENOUGH':
      return 'NORMAL';
    case 'NEED_REFILL':
      return 'REPLENISH_REQUIRED';
    case 'NEED_CHECK':
      return 'NEEDS_CHECK';
    case 'ORDER_NEEDED':
      return 'ORDER_REQUIRED';
    default:
      return status as StockStatus;
  }
};

const mapBbox = (raw: AnyRecord): BboxResponse | null => {
  const nestedBbox = isRecord(raw.bbox) ? raw.bbox : null;
  const bboxSource = nestedBbox ?? raw;

  const x = pick<Primitive>(bboxSource, ['x', 'bboxX', 'bbox_x'], null);
  const y = pick<Primitive>(bboxSource, ['y', 'bboxY', 'bbox_y'], null);
  const width = pick<Primitive>(bboxSource, ['width', 'bboxWidth', 'bbox_width', 'w'], null);
  const height = pick<Primitive>(bboxSource, ['height', 'bboxHeight', 'bbox_height', 'h'], null);
  const xMin = pick<Primitive>(bboxSource, ['xMin', 'x_min', 'xmin'], null);
  const yMin = pick<Primitive>(bboxSource, ['yMin', 'y_min', 'ymin'], null);
  const xMax = pick<Primitive>(bboxSource, ['xMax', 'x_max', 'xmax'], null);
  const yMax = pick<Primitive>(bboxSource, ['yMax', 'y_max', 'ymax'], null);

  if (x !== null && y !== null && width !== null && height !== null) {
    return {
      x: toNumber(x),
      y: toNumber(y),
      width: toNumber(width),
      height: toNumber(height),
    };
  }

  if (xMin !== null && yMin !== null && xMax !== null && yMax !== null) {
    const startX = toNumber(xMin);
    const startY = toNumber(yMin);

    return {
      x: startX,
      y: startY,
      width: toNumber(xMax) - startX,
      height: toNumber(yMax) - startY,
    };
  }

  return null;
};

const mapReplenishmentSummary = (
  raw: ReplenishmentSummaryApiResponse,
): ReplenishmentSummaryResponse => ({
  normal_count: raw.normal_count ?? raw.normalCount ?? raw.summary?.enoughCount ?? 0,
  replenish_required_count:
    raw.replenish_required_count ??
    raw.replenishRequiredCount ??
    raw.summary?.needRefillCount ??
    0,
  needs_check_count: raw.needs_check_count ?? raw.needsCheckCount ?? raw.summary?.needCheckCount ?? 0,
  last_updated_at: raw.last_updated_at ?? raw.lastUpdatedAt ?? null,
});

const mapOrderSummary = (raw: OrderSummaryResponse): OrderSummary => ({
  orderRequiredSkuCount: raw.orderRequiredSkuCount ?? raw.order_required_sku_count ?? 0,
  soldOutSkuCount: raw.soldOutSkuCount ?? raw.sold_out_sku_count ?? 0,
  lastUpdatedAt: raw.lastUpdatedAt ?? raw.last_updated_at ?? null,
  categoryDistribution: (raw.categoryDistribution ?? raw.category_distribution ?? []).map((item) => ({
    category: item.category,
    count: item.count,
  })),
});

const mapReplenishmentItem = (raw: AnyRecord): ReplenishmentItem => {
  const skuCode = pick<Primitive>(raw, ['skuCode', 'sku_code', 'product_id', 'productId'], 0);
  const rawStatus = pick<string>(raw, ['status'], 'NORMAL');
  const status = normalizeStatus(rawStatus) as ReplenishmentItem['status'];

  return {
    skuCode: toString(skuCode),
    productName: pick<string>(raw, ['productName', 'product_name'], '-'),
    status,
    priority: toNumber(pick<Primitive>(raw, ['priority'], 0)),

    warehouseQty: toNumber(
      pick<Primitive>(
        raw,
        [
          'warehouseQty',
          'warehouse_qty',
          'totalQuantity',
          'total_quantity',
          'inventoryQuantity',
          'inventory_quantity',
        ],
        0,
      ),
    ),

    shelfLabel: pick<string>(
      raw,
      ['shelfLabel', 'shelf_label', 'shelfName', 'shelf_name'],
      '',
    ),

    slotLabel: pick<string>(
      raw,
      ['slotLabel', 'slot_label', 'slotCode', 'slot_code'],
      '',
    ),

    detectedAt: toString(
      pick<Primitive>(
        raw,
        ['detectedAt', 'detected_at', 'changed_at', 'captured_at'],
        '',
      ),
    ),

    stockId: toNumber(pick<Primitive>(raw, ['stockId', 'stock_id'], 0)) || undefined,

    shelfId:
      toNumber(pick<Primitive>(raw, ['shelfId', 'shelf_id'], 0)) || null,

    shelfImageId:
      toNumber(pick<Primitive>(raw, ['shelfImageId', 'shelf_image_id'], 0)) || undefined,

    statusReason:
      toString(
        pick<Primitive>(
          raw,
          ['statusReason', 'status_reason', 'reasonSummary', 'reason_summary', 'reason'],
          '',
        ),
      ) || null,

    confidence: (() => {
      const value = pick<Primitive>(raw, ['confidence'], null);
      if (value === null || value === undefined) return null;
      return toNumber(value);
    })(),

    detectedQuantity: toNumber(
      pick<Primitive>(raw, ['detectedQuantity', 'detected_quantity', 'detected_qty'], 0),
    ),

    estimatedShelfQty: (() => {
      const value = pick<Primitive>(
        raw,
        [
          'estimatedShelfQty',
          'estimatedShelfQuantity',
          'estimated_shelf_qty',
          'estimated_shelf_quantity',
          'estimatedDisplayQuantity',
          'estimated_display_quantity',
        ],
        null,
      );

      return value === null || value === undefined ? null : toNumber(value);
    })(),

    productImageUrl:
      toString(pick<Primitive>(raw, ['productImageUrl', 'product_image_url'], '')) || null,

    imageS3Key:
      toString(pick<Primitive>(raw, ['imageS3Key', 'image_s3_key', 'image_s3_url'], '')) || null,

    imageWidth: (() => {
      const value = pick<Primitive>(raw, ['imageWidth', 'image_width'], null);
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    imageHeight: (() => {
      const value = pick<Primitive>(raw, ['imageHeight', 'image_height'], null);
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    bbox: mapBbox(raw),
  };
};

const mapOrderItem = (raw: AnyRecord): OrderItem => {
  const skuCode = pick<Primitive>(raw, ['skuCode', 'sku_code', 'product_id', 'productId'], 0);
  const rawStatus = pick<string>(raw, ['status'], 'ORDER_REQUIRED');
  const status = normalizeStatus(rawStatus);

  return {
    skuCode: toString(skuCode),
    productName: pick<string>(raw, ['productName', 'product_name'], '-'),
    status,

    updatedAt:
      toString(
        pick<Primitive>(
          raw,
          ['updatedAt', 'updated_at', 'status_changed_at', 'changed_at', 'detected_at'],
          '',
        ),
      ) || null,

    totalQuantity: toNumber(
      pick<Primitive>(
        raw,
        ['totalQuantity', 'total_quantity', 'warehouseQty', 'warehouse_qty', 'inventoryQuantity'],
        0,
      ),
    ),

    shelfLabel: pick<string>(
      raw,
      ['shelfLabel', 'shelf_label', 'shelfName', 'shelf_name'],
      '',
    ),

    slotLabel: pick<string>(
      raw,
      ['slotLabel', 'slot_label', 'slotCode', 'slot_code'],
      '',
    ),

    category:
      toString(pick<Primitive>(raw, ['category', 'categoryName', 'category_name'], '')) || null,

    isOrderCompleted: Boolean(
      pick<Primitive>(raw, ['isOrderCompleted', 'is_order_completed'], false),
    ),

    stockId: toNumber(pick<Primitive>(raw, ['stockId', 'stock_id'], 0)) || undefined,

    reorderPoint: (() => {
      const value = pick<Primitive>(raw, ['reorderPoint', 'reorder_point'], null);
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    recommendedOrderQuantity: (() => {
      const value = pick<Primitive>(
        raw,
        ['recommendedOrderQuantity', 'recommended_order_quantity'],
        null,
      );
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    leadTimeDays: (() => {
      const value = pick<Primitive>(raw, ['leadTimeDays', 'lead_time_days'], null);
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    statusReason:
      toString(
        pick<Primitive>(
          raw,
          ['statusReason', 'status_reason', 'orderReason', 'order_reason', 'reasonSummary', 'reason'],
          '',
        ),
      ) || null,

    confidence: (() => {
      const value = pick<Primitive>(raw, ['confidence'], null);
      if (value === null || value === undefined) return null;
      return toNumber(value);
    })(),

    productImageUrl:
      toString(pick<Primitive>(raw, ['productImageUrl', 'product_image_url'], '')) || null,

    imageS3Key:
      toString(pick<Primitive>(raw, ['imageS3Key', 'image_s3_key', 'image_s3_url'], '')) || null,

    imageWidth: (() => {
      const value = pick<Primitive>(raw, ['imageWidth', 'image_width'], null);
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    imageHeight: (() => {
      const value = pick<Primitive>(raw, ['imageHeight', 'image_height'], null);
      return value === null || value === undefined ? null : toNumber(value);
    })(),

    bbox: mapBbox(raw),
  };
};

const mapNotificationItem = (raw: AnyRecord): NotificationItem => {
  const skuCode = pick<Primitive>(raw, ['skuCode', 'sku_code', 'product_id', 'productId'], 0);
  const rawType = pick<string>(raw, ['type', 'alarmType', 'alarm_type'], 'NEEDS_CHECK');
  const type = normalizeStatus(rawType) as NotificationItem['type'];

  return {
    notificationId: toNumber(
    pick<Primitive>(raw, ['notificationId', 'notification_id', 'alarmId', 'alarm_id'], 0),),
    type,
    alarmType: pick<string>(raw, ['alarmType', 'alarm_type'], rawType),
    title: pick<string>(raw, ['title', 'message'], ''),
    message: pick<string>(raw, ['message'], ''),
    skuCode: typeof skuCode === 'string' ? skuCode : toNumber(skuCode),
    targetScreen: pick<'SCR-1' | 'SCR-2'>(
      raw,
      ['targetScreen', 'target_screen'],
      type === 'ORDER_REQUIRED' ? 'SCR-2' : 'SCR-1',
    ),
    createdAt: toString(pick<Primitive>(raw, ['createdAt', 'created_at'], '')),
    isRead: Boolean(pick<Primitive>(raw, ['isRead', 'is_read'], false)),
    stockId: toNumber(pick<Primitive>(raw, ['stockId', 'stock_id'], 0)) || undefined,
    productName: toString(pick<Primitive>(raw, ['productName', 'product_name'], '')) || undefined,
    locationLabel:
      toString(pick<Primitive>(raw, ['locationLabel', 'location_label'], '')) || undefined,
  };
};

const mapStoreItem = (raw: AnyRecord): StoreItem => ({
  storeId: toNumber(pick<Primitive>(raw, ['storeId', 'store_id', 'id'], 1), 1),
  storeName: toString(pick<Primitive>(raw, ['storeName', 'store_name', 'name', 'label'], '')),
});

const mapDetectionOverlay = (raw: AnyRecord): DetectionOverlayResponse | null => {
  const bbox = mapBbox(raw);

  if (!bbox) {
    return null;
  }

  const rawStatus = toString(pick<Primitive>(raw, ['status'], 'NORMAL'));

  return {
    detectionResultId: toNumber(
      pick<Primitive>(raw, ['detectionResultId', 'detection_result_id', 'id'], 0),
    ),
    skuCode: toString(
      pick<Primitive>(raw, ['skuCode', 'sku_code', 'productId', 'product_id'], ''),
    ),
    productName: toString(pick<Primitive>(raw, ['productName', 'product_name'], '')),
    slotCode: toString(pick<Primitive>(raw, ['slotCode', 'slot_code', 'slotId', 'slot_id'], '')),
    bbox,
    depthPosition: toString(
      pick<Primitive>(raw, ['depthPosition', 'depth_position'], ''),
    ),
    confidence: toNumber(pick<Primitive>(raw, ['confidence'], 0)),
    status: normalizeStatus(rawStatus),
    statusLabel: toString(
      pick<Primitive>(raw, ['statusLabel', 'status_label'], rawStatus),
    ),
  };
};

const mapLatestDetection = (raw: LatestDetectionResponse | AnyRecord): LatestDetectionResponse => {
  const source = raw as AnyRecord;
  const rawDetections = source.detections ?? source.overlays ?? source.items ?? [];

  return {
    shelfId: toNumber(pick<Primitive>(source, ['shelfId', 'shelf_id'], 0)),
    shelfImageId: toNumber(
      pick<Primitive>(source, ['shelfImageId', 'shelf_image_id', 'imageId', 'image_id'], 0),
    ),
    imageS3Key: toString(pick<Primitive>(source, ['imageS3Key', 'image_s3_key'], '')),
    imageUrl: toString(
      pick<Primitive>(source, ['imageUrl', 'image_url', 'originalImageUrl', 'original_image_url'], ''),
    ),
    imageWidth: toNumber(pick<Primitive>(source, ['imageWidth', 'image_width', 'width'], 0)),
    imageHeight: toNumber(pick<Primitive>(source, ['imageHeight', 'image_height', 'height'], 0)),
    capturedAt: toString(pick<Primitive>(source, ['capturedAt', 'captured_at'], '')),
    frontEdgePoints:
      toString(pick<Primitive>(source, ['frontEdgePoints', 'front_edge_points'], '')) || null,
    detections: asArray<AnyRecord>(rawDetections)
      .map(mapDetectionOverlay)
      .filter((detection): detection is DetectionOverlayResponse => detection !== null),
  };
};

export async function fetchStores(): Promise<StoreItem[]> {
  const data = await getJson<StoresResponse | AnyRecord[]>('/dashboard/stores');

  const rawItems = Array.isArray(data)
    ? data
    : isRecord(data)
      ? data.items ?? data.stores ?? []
      : [];

  return asArray<AnyRecord>(rawItems)
    .map(mapStoreItem)
    .filter((item) => item.storeName.length > 0);
}

export async function fetchReplenishmentSummary(
  storeId = 1,
): Promise<ReplenishmentSummaryResponse> {
  const data = await getJson<ReplenishmentSummaryApiResponse>(
    `/dashboard/replenishment/summary?store_id=${storeId}`,
  );

  return mapReplenishmentSummary(data);
}

export async function fetchReplenishmentItems(storeId = 1): Promise<ReplenishmentItem[]> {
  const data = await getJson<ItemListResponse<AnyRecord>>(
    `/dashboard/replenishment/items?store_id=${storeId}`,
  );

  return asArray<AnyRecord>(data?.items).map(mapReplenishmentItem);
}

export async function completeReplenishment(
  skuCode: number | string,
  storeId = 1,
  operatorId = 'staff_001',
) {
  return postJson(`/tasks/replenishment/${skuCode}/complete`, {
    store_id: storeId,
    operator_id: operatorId,
  });
}

export async function fetchOrderSummary(storeId = 1): Promise<OrderSummary> {
  const data = await getJson<OrderSummaryResponse>(
    `/dashboard/order/summary?store_id=${storeId}`,
  );

  return mapOrderSummary(data);
}

export async function fetchOrderItems(storeId = 1): Promise<OrderItem[]> {
  const data = await getJson<ItemListResponse<AnyRecord>>(
    `/dashboard/order/items?store_id=${storeId}`,
  );

  return asArray<AnyRecord>(data?.items).map(mapOrderItem);
}

export async function updateOrderCompleted(
  skuCode: number | string,
  orderCompleted: boolean,
) {
  return postJson(`/dashboard/order/item/${skuCode}/complete`, {
    orderCompleted,
  });
}

export async function fetchNotificationUnreadCount(): Promise<number> {
  const data = await getJson<NotificationUnreadCountResponse | number>(
    '/notifications/unread-count',
  );

  if (typeof data === 'number') return data;

  return data.unreadCount ?? data.unread_count ?? data.count ?? 0;
}

export async function fetchNotifications(
  storeId?: number,
): Promise<{ unreadCount: number; items: NotificationItem[] }> {
  const path = storeId === undefined ? '/notifications' : `/notifications?store_id=${storeId}`;
  const data = await getJson<NotificationsResponse>(path);
  const items = asArray<AnyRecord>(data?.items ?? data?.notifications);

  return {
    unreadCount: data?.unreadCount ?? data?.unread_count ?? 0,
    items: items.map(mapNotificationItem),
  };
}

export async function readNotification(notificationId: number) {
  if (!notificationId) {
    throw new Error('알림 ID가 없습니다.');
  }

  return patchJson(`/notifications/${notificationId}/read`, {});
}

export async function readAllNotifications(storeId = 1) {
  return postJson('/notifications/read-all', {
    store_id: storeId,
  });
}

export async function fetchShelfImage(
  shelfId: number,
  status?: string,
  misplaced?: boolean,
): Promise<LatestDetectionResponse> {
  const params = new URLSearchParams();

  params.set('shelf_id', String(shelfId));

  if (status) {
    params.set('status', status);
  }

  if (misplaced !== undefined) {
    params.set('misplaced', String(misplaced));
  }

  const data = await getJson<LatestDetectionResponse>(
    `/dashboard/replenishment/shelf-image?${params.toString()}`,
  );

  return mapLatestDetection(data);
}
