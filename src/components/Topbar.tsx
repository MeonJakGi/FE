import { ReactNode } from 'react';

interface Props {
  left: ReactNode;
  center?: ReactNode;
  right: ReactNode;
}

export default function Topbar({ left, center, right }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">{left}</div>
      <div className="topbar-center">{center}</div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}
