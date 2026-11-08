import { useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { configured } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import ListPage from './pages/ListPage'
import SharedList from './pages/SharedList'
import Bookmark from './pages/Bookmark'
import Brand from './lib/Brand'
import AddFromPage from './pages/AddFromPage'
import ProfileMenu from './lib/ProfileMenu'

function Private() {
  const { session, loading } = useAuth()
  const loc = useLocation()
  // Si on arrive depuis le bouton sans être connecté (lien magique dans un autre onglet),
  // on garde la fiche en mémoire pour la rouvrir après la connexion.
  useEffect(() => {
    if (!loading && !session && loc.pathname === '/ajouter' && loc.search)
      localStorage.setItem('ptite-pending-add', JSON.stringify({ search: loc.search, at: Date.now() }))
  }, [loading, session, loc.pathname, loc.search])
  if (loading) return <main className="card">Chargement…</main>
  if (!session) return <Login />
  return (
    <>
      <header>
        <Link to="/" className="logo"><Brand /></Link>
        <ProfileMenu />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/l/:id" element={<ListPage />} />
          <Route path="/coup-de-coeur" element={<Bookmark />} />
          <Route path="/bouton" element={<Navigate to="/coup-de-coeur" replace />} />
          <Route path="/ajouter" element={<AddFromPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  if (!configured)
    return (
      <main className="card">
        <h1>🎁 Configuration requise</h1>
        <p>Créez un fichier <code>.env.local</code> avec <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> (voir le README).</p>
      </main>
    )
  return (
    <Routes>
      {/* Page publique pour les invités : aucun compte nécessaire */}
      <Route path="/s/:code" element={<>
        <header><span className="logo"><Brand /></span></header>
        <main><SharedList /></main>
      </>} />
      <Route path="*" element={<Private />} />
    </Routes>
  )
}
