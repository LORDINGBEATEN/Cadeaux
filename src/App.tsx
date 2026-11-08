import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { configured, supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import Group from './pages/Group'
import ListPage from './pages/ListPage'
import Join from './pages/Join'

export default function App() {
  const { session, loading } = useAuth()
  const loc = useLocation()

  if (!configured)
    return (
      <main className="card">
        <h1>🎁 Configuration requise</h1>
        <p>Créez un fichier <code>.env.local</code> avec <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> (voir le README).</p>
      </main>
    )
  if (loading) return <main className="card">Chargement…</main>
  if (!session) {
    if (loc.pathname !== '/login') sessionStorage.setItem('redirect', loc.pathname)
    return <Login />
  }
  const redirect = sessionStorage.getItem('redirect')
  if (redirect && loc.pathname === '/login') {
    sessionStorage.removeItem('redirect')
    return <Navigate to={redirect} replace />
  }

  return (
    <>
      <header>
        <Link to="/" className="logo">🎁 Liste cadeaux</Link>
        <button className="link" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/g/:id" element={<Group />} />
          <Route path="/l/:id" element={<ListPage />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
