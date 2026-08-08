import type { ReactNode } from 'react';

export function StatusTile({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'muted' | 'steady';
}) {
  return (
    <div className={`status-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  icon,
  title,
}: {
  eyebrow: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <span className="section-icon">{icon}</span>
    </div>
  );
}

export function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="signal-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
