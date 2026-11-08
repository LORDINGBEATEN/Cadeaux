import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { useProfileName } from './profile'
import Modal from './Modal'

// Icône de profil (initiale) : prénom, e-mail, modification du prénom, déconnexion.
export default function ProfileMenu() {
  const user = useAuth().session!.user
  const { name, announce } = useProfileName(user)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.rpc('set_profile_name', { p_name: draft })
    if (error) return setErr(error.message)
    announce(draft.trim()); setEditing(false)
  }

  return (
    <div className="profile" ref={box}>
      <button type="button" className="avatar" aria-label="Mon profil" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {(name[0] ?? '?').toUpperCase()}
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="pm-id"><strong>{name}</strong><span className="muted small">{user.email}</span></div>
          <button type="button" className="pm-item" onClick={() => { setDraft(name); setErr(''); setEditing(true); setOpen(false) }}>Modifier mon prénom</button>
          <button type="button" className="pm-item" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
        </div>
      )}
      {editing && (
        <Modal title="Mon profil" onClose={() => setEditing(false)}>
          <form onSubmit={save}>
            <p className="muted small" style={{ marginTop: 0 }}>Votre prénom s'affiche dans « Bonjour … » et sur vos listes partagées (« Liste de … »). Seul le premier mot est affiché : écrivez « Marie-Claire » avec un tiret.</p>
            <input required autoFocus maxLength={60} placeholder="Votre prénom" value={draft} onChange={e => setDraft(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <div className="btnrow" style={{ marginTop: 12 }}>
              <button>Enregistrer</button>
              <button type="button" className="secondary" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
