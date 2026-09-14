import type { MonthlyRow } from '../lib/stats';
import { monthLabel } from '../lib/stats';
import { formatCents } from '../lib/money';

// Revenue vs spend, one column pair per month. Pure CSS, no chart library.
export default function MonthBars({ rows }: { rows: MonthlyRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.revenueCents, r.spendCents)));
  return (
    <div>
      <div className="bars">
        {rows.map((r) => (
          <div className="col" key={r.month} title={`${monthLabel(r.month)}: revenue ${formatCents(r.revenueCents)}, spend ${formatCents(r.spendCents)}`}>
            <div className="stack">
              <div className="bar revenue" style={{ height: `${(r.revenueCents / max) * 100}%` }} />
              <div className="bar spend" style={{ height: `${(r.spendCents / max) * 100}%` }} />
            </div>
            <div className="month">{monthLabel(r.month)}</div>
          </div>
        ))}
      </div>
      <div className="legend">
        <span><span className="dot" style={{ background: 'var(--accent)' }} />Revenue</span>
        <span><span className="dot" style={{ background: '#c9b458' }} />Spend</span>
      </div>
    </div>
  );
}
