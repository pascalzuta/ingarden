import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseConversionsCsv } from '../lib/csv';
import { useAppData } from '../lib/data';
import { formatCents, parseMoneyToCents } from '../lib/money';
import { supabase } from '../lib/supabase';

export default function Conversions() {
  const { data, loading, error, reload } = useAppData();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  const infName = (id: string | null) => data.influencers.find((i) => i.id === id)?.name;

  async function importFile(file: File) {
    setBusy(true);
    setImportMsg(null);
    setImportErrors([]);
    const text = await file.text();
    const { rows, errors } = parseConversionsCsv(text);
    if (rows.length === 0) {
      setImportErrors(errors.length ? errors : ['No usable rows found.']);
      setBusy(false);
      return;
    }
    // upsert on order_ref so re-importing the same export is safe
    const withRef = rows.filter((r) => r.order_ref);
    const withoutRef = rows.filter((r) => !r.order_ref);
    let failed: string | null = null;
    if (withRef.length) {
      const { error } = await supabase
        .from('ig_conversions')
        .upsert(withRef.map((r) => ({ ...r, source: 'import' })), { onConflict: 'order_ref', ignoreDuplicates: true });
      if (error) failed = error.message;
    }
    if (!failed && withoutRef.length) {
      const { error } = await supabase.from('ig_conversions').insert(withoutRef.map((r) => ({ ...r, source: 'import' })));
      if (error) failed = error.message;
    }
    if (failed) setImportErrors([failed, ...errors]);
    else {
      setImportMsg(`Imported ${rows.length} rows (${withRef.length} de-duplicated by order ref).`);
      setImportErrors(errors);
      reload();
    }
    setBusy(false);
  }

  async function addManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const revenue = parseMoneyToCents(String(f.get('revenue') || ''));
    if (revenue == null) return;
    const { error } = await supabase.from('ig_conversions').insert({
      occurred_at: new Date(String(f.get('date'))).toISOString(),
      discount_code: String(f.get('code') || '').trim(),
      revenue_cents: revenue,
      order_ref: String(f.get('order') || '').trim(),
      influencer_id: String(f.get('influencer_id') || '') || null,
      source: 'manual',
    });
    if (error) setImportErrors([error.message]);
    else {
      (e.target as HTMLFormElement).reset();
      reload();
    }
  }

  const recent = data.conversions.slice(0, 100);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Revenue</h1>
          <div className="sub">
            Attributed automatically: a conversion's discount code is matched to the latest post using that code, else to
            the influencer who owns the code.
          </div>
        </div>
      </div>

      <div className="row-split">
        <div className="panel">
          <h2>Import CSV</h2>
          <p className="muted">
            Shopify order export works out of the box (Created at, Discount Code, Total, Name). Any CSV with date +
            revenue columns is accepted. Re-imports are de-duplicated by order reference.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
          {importMsg && <div className="ok-box" style={{ marginTop: 10 }}>{importMsg}</div>}
          {importErrors.length > 0 && (
            <div className="error-box" style={{ marginTop: 10 }}>
              {importErrors.slice(0, 8).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
              {importErrors.length > 8 && <div>…and {importErrors.length - 8} more.</div>}
            </div>
          )}
        </div>

        <form className="panel" onSubmit={addManual}>
          <h2>Add one manually</h2>
          <div className="form-grid">
            <label className="field"><span>Date *</span><input name="date" type="date" required /></label>
            <label className="field"><span>Revenue *</span><input name="revenue" placeholder="59,90" required /></label>
            <label className="field"><span>Discount code</span><input name="code" placeholder="ANNA20" /></label>
            <label className="field"><span>Order ref</span><input name="order" placeholder="#1001" /></label>
            <label className="field">
              <span>Influencer (overrides code match)</span>
              <select name="influencer_id" defaultValue="">
                <option value="">Match by code</option>
                {data.influencers.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="primary" type="submit">Add</button>
        </form>
      </div>

      <div className="panel">
        <h2>Latest conversions ({data.conversions.length} total)</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Order</th>
              <th>Code</th>
              <th>Attributed to</th>
              <th className="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.occurred_at).toLocaleDateString('en-GB')}</td>
                <td className="mono">{c.order_ref || '—'}</td>
                <td className="mono">{c.discount_code || '—'}</td>
                <td>
                  {c.influencer_id ? (
                    <Link to={`/influencers/${c.influencer_id}`}>{infName(c.influencer_id)}</Link>
                  ) : (
                    <span className="badge">unattributed</span>
                  )}
                </td>
                <td className="num">{formatCents(c.revenue_cents, c.currency)}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={5} className="muted">No revenue recorded yet. Import a CSV to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
