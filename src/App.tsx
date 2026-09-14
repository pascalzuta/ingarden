import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useMembership, useSession } from './lib/session';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Influencers from './pages/Influencers';
import InfluencerDetail from './pages/InfluencerDetail';
import Posts from './pages/Posts';
import Reports from './pages/Reports';
import Conversions from './pages/Conversions';
import Team from './pages/Team';

export default function App() {
  const { session, loading } = useSession();
  const { member, loading: memberLoading } = useMembership(session);

  if (loading || (session && memberLoading)) {
    return <div className="login-wrap muted">Loading…</div>;
  }
  if (!session) {
    return <Login />;
  }
  if (!member) {
    return (
      <div className="login-wrap">
        <div className="panel login-card">
          <h1>No access</h1>
          <p className="muted">
            {session.user.email} is not on the team list. Ask an admin to add this email under Team.
          </p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">Ingarden</div>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/influencers">Influencers</NavLink>
        <NavLink to="/posts">Posts</NavLink>
        <NavLink to="/reports">Reports</NavLink>
        <NavLink to="/conversions">Revenue</NavLink>
        <NavLink to="/team">Team</NavLink>
        <div className="spacer" />
        <div className="who">{member.name || member.email}</div>
        <a
          href="#signout"
          onClick={(e) => {
            e.preventDefault();
            supabase.auth.signOut();
          }}
        >
          Sign out
        </a>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/influencers" element={<Influencers />} />
          <Route path="/influencers/:id" element={<InfluencerDetail member={member} />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/conversions" element={<Conversions />} />
          <Route path="/team" element={<Team member={member} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
