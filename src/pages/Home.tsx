import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/util'

type L = { id: string; title: string; occasion: string; event_date: string | null }
const OCCASIONS = ['Anniversaire', 'Noël', 'Naissance', 'Mariage', 'Autre']

export default function Home() {
  const [lists, setLists] = useState<L[]>([])
  const [title, setTitle] = useState('')
  const [occasion, setOccasion] = useState(OCCASIONS[0])
  const [date, setDate] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ptite-pending-add')
      if (raw) {
        localStorage.removeItem('ptite-pending-add')
        const { search, at } = JSON.parse(raw) as { search: string; at: number }
        if (Date.now() - at < 3600_000) { nav('/ajouter' + search, { replace: true }); return }
      }
    } catch { /* ignoré */ }
    supabase.from('lists').select('id, title, occasion, event_date').order('event_date', { nullsFirst: false })
      .then(({ data }) => setLists(data ?? []))
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.from('lists')
      .insert({ title, occasion, event_date: date || null }).select('id').single()
    if (error) return setErr(error.message)
    nav(`/l/${data.id}`)
  }

  return (
    <>
      <h2>Mes listes</h2>
      {lists.length === 0 && <p className="muted">Vous n'avez pas encore de liste. Créez la première ci-dessous !</p>}
      <ul className="list">
        {lists.map(l => (
          <li key={l.id}>
            <Link to={`/l/${l.id}`}>
              {l.title} <span className="muted">— {l.occasion}{l.event_date ? ` · ${fmtDate(l.event_date)}` : ''}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="card">
        <h3>Nouvelle liste</h3>
        <input required placeholder="Ex : Mes idées pour Noël" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="row">
          <select value={occasion} onChange={e => setOccasion(e.target.value)}>{OCCASIONS.map(o => <option key={o}>{o}</option>)}</select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button>Créer la liste</button>
      </form>
      {err && <p className="err">{err}</p>}
    </>
  )
}
