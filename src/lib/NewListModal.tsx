import { useState } from 'react'
import { supabase } from './supabase'
import Modal from './Modal'

const OCCASIONS = ['Anniversaire', 'Noël', 'Naissance', 'Mariage', 'Autre']

type Editable = { id: string; title: string; occasion: string; event_date: string | null }

// Fenêtre de création d'une liste (« Mes listes », fiche « Coup de cœur ») ou de modification (si `edit` est fourni).
export default function NewListModal({ onClose, onCreated, edit }: { onClose: () => void; onCreated: (id: string, title: string) => void; edit?: Editable }) {
  const [title, setTitle] = useState(edit?.title ?? '')
  const [occasion, setOccasion] = useState(edit?.occasion ?? OCCASIONS[0])
  const [date, setDate] = useState(edit?.event_date ?? '')
  const [err, setErr] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const t = title.trim()
    if (edit) {
      const { error } = await supabase.from('lists').update({ title: t, occasion, event_date: date || null }).eq('id', edit.id)
      if (error) return setErr(error.message)
      return onCreated(edit.id, t)
    }
    const { data, error } = await supabase.from('lists').insert({ title: t, occasion, event_date: date || null }).select('id').single()
    if (error) return setErr(error.message)
    onCreated(data.id, t)
  }

  return (
    <Modal title={edit ? 'Modifier la liste' : 'Nouvelle liste'} onClose={onClose}>
      <form onSubmit={create}>
        <input required autoFocus placeholder="Ex : Mes idées pour Noël" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="row">
          <select value={occasion} onChange={e => setOccasion(e.target.value)} aria-label="Occasion">{(OCCASIONS.includes(occasion) ? OCCASIONS : [occasion, ...OCCASIONS]).map(o => <option key={o}>{o}</option>)}</select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
        </div>
        {err && <p className="err">{err}</p>}
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button>{edit ? 'Enregistrer' : 'Créer la liste'}</button>
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </Modal>
  )
}
