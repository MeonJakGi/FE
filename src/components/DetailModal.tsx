import { ReactNode } from 'react';
import xmarkIcon from '@/../assets/xmark.png';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function DetailModal({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-wrap" onClick={(e) => e.stopPropagation()}>
        <p className="modal-outside-title">{title}</p>
        <button className="modal-outside-close" type="button" onClick={onClose} aria-label="닫기">
          <img src={xmarkIcon} alt="" />
        </button>
        <section className="modal">
          {children}
        </section>
      </div>
    </div>
  );
}
