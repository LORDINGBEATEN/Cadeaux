import { useState } from 'react'
import { supabase } from './supabase'
import Modal from './Modal'

const OCCASIONS = ['Anniversaire', 'Noël', 'Naissance', 'Mariage', 'Autre']

// Fenêtre de création d'une liste, utilisée sur « Mes listes » et sur la fiche « Coup de cœur ».
export default function NewListModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, title: string) => void }) {
  const [title, setTitle] = useState('')
  const [occasion, setOccasion] = useState(OCCASIONS[0])
  const [date, setDate] = useState('')
  const [err, setErr] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const t = title.trim()
    const { data, error } = await supabase.from('lists').insert({ title: t, occasion, event_date: date || null }).select('id').single()
    if (error) return setErr(error.message)
    onCreated(data.id, t)
  }

  return (
    <Modal title="Nouvelle liste" onClose={onClose}>
      <form onSubmit={create}>
        <input required autoFocus placeholder="Ex : Mes idées pour Noël" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="row">
          <select value={occasion} onChange={e => setOccasion(e.target.value)} aria-label="Occasion">{OCCASIONS.map(o => <option key={o}>{o}</option>)}</select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
        </div>
        {err && <p className="err">{err}</p>}
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button>Créer la liste</button>
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </Modal>
  )
}
