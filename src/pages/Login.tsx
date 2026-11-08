import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (password) {
      let { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const r = await supabase.auth.signUp({ email, password, options: { data: { name: name || undefined } } })
        if (r.error) return setErr(error.message)
        if (!r.data.session) setMsg('Compte créé : vérifiez vos e-mails pour confirmer.')
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin, data: { name: name || undefined } },
      })
      if (error) return setErr(error.message)
      setMsg('Lien de connexion envoyé ! Regardez votre boîte mail.')
    }
  }

  return (
    <main className="card hero">
      <span className="mark">🎁</span>
      <h1>Ma P'tite Liste</h1>
      <p className="muted">Créez vos listes d'idées cadeaux et partagez-les par lien : vos proches réservent, sans doublons.</p>
      <form onSubmit={submit}>
        <input type="text" placeholder="Prénom (pour un nouveau compte)" value={name} onChange={e => setName(e.target.value)} />
        <input type="email" required placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Mot de passe (facultatif)" value={password} onChange={e => setPassword(e.target.value)} />
        <button>{password ? 'Se connecter / créer le compte' : 'Recevoir un lien de connexion'}</button>
      </form>
      <p className="muted small">Sans mot de passe, un lien magique vous est envoyé par e-mail.</p>
      {msg && <p className="ok">{msg}</p>}
      {err && <p className="err">{err}</p>}
    </main>
  )
}
