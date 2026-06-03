import { ReactNode } from 'react';

interface Props {
  title: string;
  value: ReactNode;
  description?: ReactNode;
}

export default function KpiCard({ title, value, description }: Props) {
  return (
    <article className="card kpi-card">
      <p className="kpi-title">{title}</p>
      <p className="kpi-value">{value}</p>
      {description ? <p className="kpi-desc">{description}</p> : null}
    </article>
  );
}
