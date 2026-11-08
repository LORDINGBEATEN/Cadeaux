import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Item = { id: string; title: string; url: string | null; price: number | null; note: string | null }
type Claim = { item_id: string; user_id: string }

export default function ListPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const uid = useAuth().session!.user.id
  const [list, setList] = useState<{ title: string; occasion: string; owner_id: string; group_id: string } | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [claims, setClaims] = useState<Record<string, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [f, setF] = useState({ title: '', url: '', price: '', note: '' })

  async function load() {
    const { data: l } = await supabase.from('lists').select('*').eq('id', id).single()
    if (!l) return
    setList(l)
    const [it, cl, pr] = await Promise.all([
      supabase.from('items').select('*').eq('list_id', id).order('created_at'),
      supabase.from('claims').select('item_id, user_id'),
      supabase.from('profiles').select('id, name'),
    ])
    setItems(it.data ?? [])
    const itemIds = new Set((it.data ?? []).map(i => i.id))
    setClaims(Object.fromEntries(((cl.data ?? []) as Claim[]).filter(c => itemIds.has(c.item_id)).map(c => [c.item_id, c.user_id])))
    const n = Object.fromEntries((pr.data ?? []).map(p => [p.id, p.name]))
    setNames(n); setOwnerName(n[l.owner_id] ?? '')
  }
  useEffect(() => { load() }, [id])

  const mine = list?.owner_id === uid

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    let url = f.url.trim()
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url
    await supabase.from('items').insert({ list_id: id, title: f.title, url: url || null, price: f.price ? Number(f.price) : null, note: f.note || null })
    setF({ title: '', url: '', price: '', note: '' }); load()
  }
  async function remove(itemId: string) { await supabase.from('items').delete().eq('id', itemId); load() }
  async function claim(itemId: string) { await supabase.from('claims').insert({ item_id: itemId }); load() }
  async function unclaim(itemId: string) { await supabase.from('claims').delete().eq('item_id', itemId); load() }
  async function deleteList() {
    if (!confirm('Supprimer cette liste ?')) return
    await supabase.from('lists').delete().eq('id', id); nav(`/g/${list!.group_id}`)
  }

  if (!list) return <p>Chargement…</p>
  return (
    <>
      <p><Link to={`/g/${list.group_id}`}>← Retour au groupe</Link></p>
      <h2>{list.title}</h2>
      <p className="muted">{list.occasion} · liste de {mine ? 'vous' : ownerName}</p>
      {mine && <p className="note">🤫 Vous ne verrez pas qui a réservé quoi : la surprise reste entière !</p>}

      {items.length === 0 && <p className="muted">Aucun cadeau pour le moment.</p>}
      <ul className="items">
        {items.map(i => {
          const by = claims[i.id]
          return (
            <li key={i.id} className={by ? 'taken' : ''}>
              <div>
                <strong>{i.title}</strong>
                {i.price != null && <span className="muted"> · {i.price} €</span>}
                {i.url && <> · <a href={i.url} target="_blank" rel="noreferrer noopener">voir le lien</a></>}
                {i.note && <div className="muted small">{i.note}</div>}
              </div>
              <div className="actions">
                {mine ? <button className="link" onClick={() => remove(i.id)}>Supprimer</button>
                  : by ? (by === uid
                      ? <button className="secondary" onClick={() => unclaim(i.id)}>Annuler ma réservation</button>
                      : <span className="badge">Réservé par {names[by] ?? 'quelqu’un'}</span>)
                    : <button onClick={() => claim(i.id)}>Je l'offre</button>}
              </div>
            </li>
          )
        })}
      </ul>

      {mine && (
        <>
          <form onSubmit={addItem} className="card">
            <h3>Ajouter un cadeau</h3>
            <input required placeholder="Nom du cadeau" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
            <input placeholder="Lien (facultatif)" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
            <div className="row">
              <input type="number" min="0" step="0.01" placeholder="Prix €" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} />
              <input placeholder="Note (taille, couleur…)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
            </div>
            <button>Ajouter</button>
          </form>
          <button className="link danger" onClick={deleteList}>Supprimer la liste</button>
        </>
      )}
    </>
  )
}
