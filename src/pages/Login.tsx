import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { VERSION } from '../lib/Brand'

type Mode = 'home' | 'signin' | 'signup'

// Accepte un code seul ou un lien complet (…/s/<code>).
function extractCode(v: string): string {
  const s = v.trim()
  const m = s.match(/\/s\/([^/?#\s]+)/)
  return m ? m[1] : s
}

export default function Login() {
  const nav = useNavigate()
  const [mode, setMode] = useState<Mode>('home')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  function go(m: Mode) { setMode(m); setErr(''); setMsg('') }

  function openCode(e: React.FormEvent) {
    e.preventDefault()
    const c = extractCode(code)
    if (!c) return setErr('Saisissez le code ou le lien de la liste.')
    nav(`/s/${encodeURIComponent(c)}`)
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('E-mail ou mot de passe incorrect.')
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name: name.trim() || undefined } },
    })
    if (error) return setErr(error.message)
    if (!data.session) setMsg('Compte créé : vérifiez vos e-mails pour confirmer.')
  }

  async function magic() {
    setErr(''); setMsg('')
    if (!email) return setErr('Saisissez d\'abord votre e-mail.')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) return setErr(error.message)
    setMsg('Lien de connexion envoyé ! Regardez votre boîte mail.')
  }

  return (
    <>
    <main className="card hero">
      <img src="/favicon.svg" className="mark-img" alt="" width="64" height="64" />
      <h1 className="brand-title">Ma <sup>P'tite</sup> Liste</h1>
      <p className="intro">Faites votre liste, partagez le lien.<br />Vos proches réservent, vous gardez la surprise.</p>

      {mode === 'home' && <>
        <form onSubmit={openCode} className="code-bar">
          <input type="text" placeholder="Code ou lien de la liste" aria-label="Code ou lien de la liste" value={code} onChange={e => setCode(e.target.value)} />
          <button>Ouvrir</button>
        </form>
        <p className="muted small">Invité ? Aucun compte nécessaire : vous pouvez voir une liste et vous positionner sur un cadeau en le réservant.</p>
        <div className="or"><span>ou</span></div>
        <p className="muted small" style={{ marginTop: 0 }}>Un compte est nécessaire pour créer vos propres listes.</p>
        <div className="row auth-btns">
          <button type="button" onClick={() => go('signin')}>Se connecter</button>
          <button type="button" className="secondary" onClick={() => go('signup')}>Créer un compte</button>
        </div>
      </>}

      {mode === 'signin' && (
        <form onSubmit={signIn}>
          <p className="muted small hint">Votre compte est commun à toutes les applications du « P'tit Canif ». Connectez-vous pour gérer vos listes.</p>
          <input type="email" required placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
          <button>Se connecter</button>
          <p className="muted small"><a href="#" onClick={e => { e.preventDefault(); magic() }}>Recevoir un lien de connexion par e-mail</a></p>
        </form>
      )}

      {mode === 'signup' && (
        <form onSubmit={signUp}>
          <p className="muted small hint">Votre compte sera commun à toutes les applications du « P'tit Canif ». Il vous permet de créer et de gérer vos listes.</p>
          <input type="text" required placeholder="Prénom" value={name} onChange={e => setName(e.target.value)} />
          <input type="email" required placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" required minLength={6} placeholder="Mot de passe (6 caractères min.)" value={password} onChange={e => setPassword(e.target.value)} />
          <button>Créer mon compte</button>
        </form>
      )}

      {mode !== 'home' && <p className="muted small"><a href="#" onClick={e => { e.preventDefault(); go('home') }}>← Retour</a></p>}
      {msg && <p className="ok">{msg}</p>}
      {err && <p className="err">{err}</p>}
    </main>
    <footer className="page-foot">{VERSION}</footer>
    </>
  )
}
