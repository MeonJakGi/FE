import { useCallback, useEffect, useState } from 'react';
import NotificationDrawer from '@/components/NotificationDrawer';
import OrderPage from '@/pages/OrderPage';
import ReplenishmentPage from '@/pages/ReplenishmentPage';
import { fetchNotificationUnreadCount, fetchNotifications, fetchStores, readNotification } from '@/api/dashboard';
import { getApiUrl } from '@/api/client';
import type { StoreItem } from '@/api/dashboard';
import type { NotificationItem } from '@/types/dashboard';
import Topbar from '@/components/Topbar';
import AppTabs from '@/components/AppTabs';

const FALLBACK_STORE: StoreItem = {
  storeId: 1,
  storeName: '씨드큐브 창동점',
};

export default function App() {
  const [tab, setTab] = useState<'SCR-1' | 'SCR-2'>('SCR-1');
  const [openNotify, setOpenNotify] = useState(false);
  const [stores, setStores] = useState<StoreItem[]>([FALLBACK_STORE]);
  const [selectedStoreId, setSelectedStoreId] = useState(FALLBACK_STORE.storeId);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const selectedStore = stores.find((store) => store.storeId === selectedStoreId) ?? FALLBACK_STORE;

  const loadStores = async () => {
    try {
      const data = await fetchStores();
      if (data.length === 0) return;

      setStores(data);
      setSelectedStoreId((currentStoreId) =>
        data.some((store) => store.storeId === currentStoreId)
          ? currentStoreId
          : data[0].storeId,
      );
    } catch {
      setStores([FALLBACK_STORE]);
      setSelectedStoreId(FALLBACK_STORE.storeId);
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      const [unreadCountData, notificationsData] = await Promise.all([
        fetchNotificationUnreadCount(),
        fetchNotifications(),
      ]);
      setNotifications(notificationsData.items);
      setUnreadCount(unreadCountData);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadStores();
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const source = new EventSource(getApiUrl('/notifications/stream'));

    const refreshNotifications = () => {
      void loadNotifications();
    };

    source.addEventListener('notification', refreshNotifications);
    source.onmessage = refreshNotifications;

    return () => {
      source.removeEventListener('notification', refreshNotifications);
      source.close();
    };
  }, [loadNotifications]);

  const onReadNotification = async (notificationId: number) => {
    await readNotification(notificationId);
    await loadNotifications();
  };

  return (
    <div className="app-shell">
      <Topbar
        left={
          <div className="brand-wrap">
            <img src="/assets/Icon 2.png" alt="BeShow icon" className="brand-icon" />
            <img src="/assets/Typo1-1.png" alt="Be:SHOW" className="brand-wordmark" />
          </div>
        }
        center={
          <AppTabs
            value={tab}
            onChange={setTab}
            items={[
              { key: 'SCR-1', label: '보충 필요 리스트' },
              { key: 'SCR-2', label: '발주 필요 리스트' },
            ]}
          />
        }
        right={
          <div className="top-actions">
            <div className="store-select-wrap">
              <select
                className="store-select"
                value={selectedStore.storeId}
                aria-label="점포 선택"
                onChange={(e) => setSelectedStoreId(Number(e.target.value))}
              >
                {stores.map((store) => (
                  <option key={store.storeId} value={store.storeId}>
                    {store.storeName}
                  </option>
                ))}
              </select>
              <img src="/assets/chevron.png" alt="open" className="store-chevron" />
            </div>

            <button className="icon-btn" type="button" aria-label="새로고침" onClick={() => window.location.reload()}>
              <img src="/assets/reload.png" alt="reload" />
            </button>

            <button
              className="icon-btn notify-btn"
              type="button"
              aria-label="알림"
              onClick={() => setOpenNotify((prev) => !prev)}
            >
              <img src="/assets/bell.png" alt="notifications" />
              {unreadCount > 0 ? <span className="notify-dot">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
            </button>
          </div>
        }
      />

      <main key={tab} className="tab-panel">
        {tab === 'SCR-1' ? (
          <ReplenishmentPage storeId={selectedStoreId} />
        ) : (
          <OrderPage storeId={selectedStoreId} />
        )}
      </main>

      <NotificationDrawer
        open={openNotify}
        items={notifications}
        onRead={onReadNotification}
      />
    </div>
  );
}
