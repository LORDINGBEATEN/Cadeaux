import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate, itemLabel } from '../lib/util'

type Item = { id: string; title: string | null; url: string; note: string | null }
type List = { title: string; occasion: string; event_date: string | null; share_code: string }

export default function ListPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [f, setF] = useState({ url: '', title: '', note: '' })
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  async function load() {
    const [l, it] = await Promise.all([
      supabase.from('lists').select('title, occasion, event_date, share_code').eq('id', id).single(),
      supabase.from('items').select('id, title, url, note').eq('list_id', id).order('created_at'),
    ])
    setList(l.data); setItems(it.data ?? [])
  }
  useEffect(() => { load() }, [id])

  async function addItem(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    let url = f.url.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const { error } = await supabase.from('items').insert({ list_id: id, url, title: f.title.trim() || null, note: f.note.trim() || null })
    if (error) return setErr('Lien invalide : ' + error.message)
    setF({ url: '', title: '', note: '' }); load()
  }
  async function remove(itemId: string) { await supabase.from('items').delete().eq('id', itemId); load() }
  async function deleteList() {
    if (!confirm('Supprimer cette liste et ses idées ?')) return
    await supabase.from('lists').delete().eq('id', id); nav('/')
  }

  if (!list) return <p>Chargement…</p>
  const link = `${window.location.origin}/s/${list.share_code}`
  async function copy() { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <>
      <p><Link to="/">← Mes listes</Link></p>
      <h2>{list.title}</h2>
      <p className="muted">{list.occasion}{list.event_date ? ` · ${fmtDate(list.event_date)}` : ''}</p>

      <div className="card">
        <strong>Lien à partager</strong>
        <p className="muted small">Toute personne qui a ce lien peut voir la liste et réserver une idée, sans créer de compte.</p>
        <div className="row"><input readOnly value={link} onFocus={e => e.target.select()} /><button onClick={copy}>{copied ? 'Copié ✓' : 'Copier'}</button></div>
        <p className="note">🤫 Vous ne verrez pas qui a réservé quoi : la surprise reste entière !</p>
      </div>

      <h3>Mes idées</h3>
      {items.length === 0 && <p className="muted">Collez ci-dessous des liens vers des pages web qui montrent vos idées de cadeaux.</p>}
      <ul className="items">
        {items.map(i => (
          <li key={i.id}>
            <div>
              <a href={i.url} target="_blank" rel="noreferrer noopener"><strong>{itemLabel(i)}</strong></a>
              {i.note && <div className="muted small">{i.note}</div>}
            </div>
            <button className="link" onClick={() => remove(i.id)}>Supprimer</button>
          </li>
        ))}
      </ul>

      <form onSubmit={addItem} className="card">
        <h3>Ajouter une idée</h3>
        <input required placeholder="Lien de la page web (https://…)" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
        <div className="row">
          <input placeholder="Nom (facultatif)" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <input placeholder="Note : taille, couleur… (facultatif)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        </div>
        <button>Ajouter</button>
        {err && <p className="err">{err}</p>}
      </form>
      <button className="link danger" onClick={deleteList}>Supprimer la liste</button>
    </>
  )
}
