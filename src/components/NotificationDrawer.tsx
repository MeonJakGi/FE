import { NotificationItem } from '@/types/dashboard';
import AppButton from '@/components/AppButton';

interface Props {
  open: boolean;
  items: NotificationItem[];
  onRead: (notificationId: number) => void;
}

function parseNotificationMeta(text: string) {
  const slotId = text.match(/slot_id\s*=\s*([^,\s]+)/)?.[1];
  const productId = text.match(/product_id\s*=\s*([^,\s]+)/)?.[1];

  return { slotId, productId };
}

function getNotificationCategory(item: NotificationItem) {
  const typeText = `${item.alarmType ?? ''} ${item.type ?? ''}`.toUpperCase();
  const copyText = `${item.title} ${item.message}`.toUpperCase();

  if (typeText.includes('SHELF_EMPTY') || copyText.includes('완전히 비어')) {
    return 'empty';
  }

  if (
    typeText.includes('ORDER_REQUIRED') ||
    typeText.includes('ORDER_NEEDED') ||
    copyText.includes('발주')
  ) {
    return 'order';
  }

  if (
    typeText.includes('NEED_CHECK') ||
    typeText.includes('NEEDS_CHECK') ||
    typeText.includes('MISPLACED') ||
    copyText.includes('기준 위치') ||
    copyText.includes('오진열')
  ) {
    return 'misplaced';
  }

  return 'default';
}

function buildNotificationCopy(item: NotificationItem) {
  const sourceText = `${item.title} ${item.message}`;
  const { slotId, productId } = parseNotificationMeta(sourceText);

  if (getNotificationCategory(item) === 'empty') {
    return {
      title: `${item.productName ?? '상품'}이 매대에서 전량 소진되었습니다.`,
      message: item.locationLabel
        ? `${item.locationLabel} 위치를 확인해 주세요.`
        : '매대 위치를 확인해 주세요.',
    };
  }

  if (getNotificationCategory(item) === 'order') {
    return {
      title: `${item.productName ?? '상품'} 발주가 필요합니다.`,
      message: item.locationLabel
        ? `${item.locationLabel} 위치의 총 재고와 ROP를 확인해 주세요.`
        : '총 재고와 ROP를 확인해 주세요.',
    };
  }

  if (slotId || productId) {
    const title = item.productName
      ? `${item.productName}이 기준 위치와 다른 곳에 진열되었습니다.`
      : productId
        ? `상품 ${productId}가 기준 위치와 다른 곳에 진열되었습니다.`
        : '상품이 기준 위치와 다른 곳에 진열되었습니다.';

    const message = item.locationLabel
      ? `${item.locationLabel} 위치를 확인해 주세요.`
      : slotId
        ? `현재 슬롯 ${slotId}에서 감지되었습니다. 기준 위치를 확인해 주세요.`
        : '기준 위치를 확인해 주세요.';

    return { title, message };
  }

  return {
    title: item.title,
    message: item.message,
  };
}

export default function NotificationDrawer({ open, items, onRead }: Props) {
  return (
    <aside className={`notify-drawer ${open ? 'open' : 'closed'}`} aria-hidden={!open}>
      <div className="notify-head">
        <h3 style={{ margin: 0 }}>알림</h3>
      </div>
      <ul className="notify-list">
        {items.map((item) => {
          const copy = buildNotificationCopy(item);
          const category = getNotificationCategory(item);

          return (
            <li
              key={item.notificationId}
              className={`notify-item notify-${category} ${item.isRead ? '' : 'unread'}`}
            >
              <strong>{copy.title}</strong>
              <div className="notify-message">{copy.message}</div>
              {!item.isRead ? (
                <div style={{ marginTop: 8 }}>
                  <AppButton variant="secondary" onClick={() => onRead(item.notificationId)}>읽음 처리</AppButton>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
