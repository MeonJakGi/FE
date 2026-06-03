import { StockStatus } from '@/types/dashboard';

interface Props {
  status: StockStatus;
}

export default function StatusBadge({ status }: Props) {
  if (status === 'NORMAL') return <span className="badge normal">정상</span>;
  if (status === 'REPLENISH_REQUIRED') return <span className="badge replenish">보충 필요</span>;
  if (status === 'NEEDS_CHECK') return <span className="badge check">확인 필요</span>;
  return <span className="badge order">발주 필요</span>;
}
