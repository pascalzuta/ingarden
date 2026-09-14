import { FormEvent, useState } from 'react';
import { useAppData } from '../lib/data';
import { supabase } from '../lib/supabase';
import type { TeamMember } from '../lib/types';

export default function Team({ member }: { member: TeamMember }) {
  const { data, loading, error, reload } = useAppData();
  const [saveError, setSaveError] = useState<string | null>(null);
  const isAdmin = member.role === 'admin';

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  async function addMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from('ig_team_members').insert({
      email: String(f.get('email') || '').trim().toLowerCase(),
      name: String(f.get('name') || '').trim(),
      role: String(f.get('role')),
    });
    if (error) setSaveError(error.message);
    else {
      (e.target as HTMLFormElement).reset();
      reload();
    }
  }

  async function removeMember(m: TeamMember) {
    if (!window.confirm(`Remove ${m.email} from the team? They lose access immediately.`)) return;
    const { error } = await supabase.from('ig_team_members').delete().eq('id', m.id);
    if (error) setSaveError(error.message);
    else reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <div className="sub">
            Who can use this system. A person signs up with the listed email on the login screen and gets access.
          </div>
        </div>
      </div>

      {saveError && <div className="error-box">{saveError}</div>}

      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Signed up</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.id}>
                <td>{m.name || <span className="muted">—</span>}</td>
                <td>{m.email}</td>
                <td><span className={`badge ${m.role === 'admin' ? 'status-active' : ''}`}>{m.role}</span></td>
                <td>{m.user_id ? 'Yes' : <span className="muted">not yet</span>}</td>
                {isAdmin && (
                  <td>
                    {m.id !== member.id && (
                      <button className="small danger" onClick={() => removeMember(m)}>Remove</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <form className="panel" onSubmit={addMember}>
          <h2>Add a team member</h2>
          <div className="form-grid">
            <label className="field"><span>Email *</span><input name="email" type="email" required /></label>
            <label className="field"><span>Name</span><input name="name" /></label>
            <label className="field">
              <span>Role</span>
              <select name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <button className="primary" type="submit">Add to team</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Then tell them to open the app and use “Create account” with exactly this email.
          </p>
        </form>
      )}
    </>
  );
}
