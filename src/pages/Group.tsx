import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type L = { id: string; title: string; occasion: string; event_date: string | null; owner_id: string }
type P = { id: string; name: string }
const OCCASIONS = ['Anniversaire', 'Noël', 'Naissance', 'Mariage', 'Autre']

export default function Group() {
  const { id } = useParams()
  const uid = useAuth().session!.user.id
  const [group, setGroup] = useState<{ name: string; invite_code: string } | null>(null)
  const [lists, setLists] = useState<L[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [title, setTitle] = useState('')
  const [occasion, setOccasion] = useState(OCCASIONS[0])
  const [date, setDate] = useState('')
  const [copied, setCopied] = useState(false)

  async function load() {
    const [g, l, m] = await Promise.all([
      supabase.from('groups').select('name, invite_code').eq('id', id).single(),
      supabase.from('lists').select('*').eq('group_id', id).order('event_date', { nullsFirst: false }),
      supabase.from('group_members').select('user_id').eq('group_id', id),
    ])
    setGroup(g.data); setLists(l.data ?? [])
    const ids = (m.data ?? []).map(x => x.user_id)
    const { data: ps } = await supabase.from('profiles').select('id, name').in('id', ids)
    setPeople(Object.fromEntries((ps as P[] ?? []).map(p => [p.id, p.name])))
  }
  useEffect(() => { load() }, [id])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('lists').insert({ group_id: id, title, occasion, event_date: date || null })
    setTitle(''); setDate(''); load()
  }
  const link = group ? `${window.location.origin}/join/${group.invite_code}` : ''
  async function copy() { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  if (!group) return <p>Chargement…</p>
  return (
    <>
      <h2>👪 {group.name}</h2>
      <div className="card">
        <strong>Inviter des proches</strong>
        <p className="muted small">Envoyez ce lien : il suffit de l'ouvrir pour rejoindre le groupe.</p>
        <div className="row"><input readOnly value={link} onFocus={e => e.target.select()} /><button onClick={copy}>{copied ? 'Copié ✓' : 'Copier'}</button></div>
        <p className="muted small">Membres : {Object.values(people).join(', ')}</p>
      </div>

      <h3>Listes du groupe</h3>
      {lists.length === 0 && <p className="muted">Aucune liste pour le moment.</p>}
      <ul className="list">
        {lists.map(l => (
          <li key={l.id}>
            <Link to={`/l/${l.id}`}>
              {l.owner_id === uid ? '⭐ ' : ''}{l.title} <span className="muted">— {l.occasion}{l.event_date ? ` · ${new Date(l.event_date).toLocaleDateString('fr-FR')}` : ''} · de {people[l.owner_id] ?? '?'}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="card">
        <h3>Créer ma liste</h3>
        <input required placeholder="Ex : Mes idées pour Noël" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="row">
          <select value={occasion} onChange={e => setOccasion(e.target.value)}>{OCCASIONS.map(o => <option key={o}>{o}</option>)}</select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button>Créer</button>
      </form>
    </>
  )
}
