import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Thumb from '../lib/Thumb'
import NewListModal from '../lib/NewListModal'
import { fmtPrice, hostOf } from '../lib/util'

const LAST = 'ptite-last-list'
const NEW = '__new'
type L = { id: string; title: string }

// Écran ouvert par le bouton de la barre de favoris : la fiche arrive préremplie.
export default function AddFromPage() {
  const [q] = useSearchParams()
  const url = q.get('u') ?? ''
  const image = q.get('i') && /^https?:\/\//i.test(q.get('i')!) ? q.get('i') : null
  const currency = /^[A-Z]{3}$/.test(q.get('c') ?? '') ? q.get('c')! : 'EUR'
  const validUrl = /^https?:\/\/\S+$/i.test(url)

  const [lists, setLists] = useState<L[] | null>(null)
  const [listId, setListId] = useState('')
  const [title, setTitle] = useState(q.get('t') ?? '')
  const [price, setPrice] = useState(q.get('p') ?? '')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [added, setAdded] = useState<{ list: string; listTitle: string } | null>(null)

  useEffect(() => {
    localStorage.removeItem('ptite-pending-add') // la fiche est ouverte : plus rien à reprendre
    supabase.from('lists').select('id, title').order('title').then(({ data }) => {
      const ls = data ?? []
      setLists(ls)
      const last = localStorage.getItem(LAST)
      setListId(ls.find(l => l.id === last)?.id ?? ls[0]?.id ?? '')
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const p = price.trim() ? Number(price.replace(',', '.')) : null
    if (p !== null && !Number.isFinite(p)) return setErr('Prix invalide')
    const { error } = await supabase.from('items').insert({
      list_id: listId, url, title: title.trim() || null, note: note.trim() || null,
      price: p, currency: p !== null ? currency : null, image_url: image,
    })
    if (error) return setErr("Ajout impossible : " + error.message)
    localStorage.setItem(LAST, listId)
    setAdded({ list: listId, listTitle: lists?.find(l => l.id === listId)?.title ?? '' })
  }

  const newListModal = creatingList && (
    <NewListModal
      onClose={() => setCreatingList(false)}
      onCreated={(id, t) => { setLists(prev => [...(prev ?? []), { id, title: t }]); setListId(id); setCreatingList(false) }}
    />
  )

  if (!validUrl)
    return <div className="card"><h3>Rien à ajouter</h3><p className="muted">Cette page s'ouvre depuis le bouton de la barre de favoris. <Link to="/bouton">Installer le bouton</Link></p></div>
  if (added)
    return (
      <div className="card center">
        <div className="tick">✓</div>
        <h3>Ajouté à « {added.listTitle} »</h3>
        <p className="muted">{title || hostOf(url)}{price ? ` · ${fmtPrice(Number(price.replace(',', '.')), currency)}` : ''}</p>
        <Link to={`/l/${added.list}`}><button type="button">Voir ma liste</button></Link>
        <p className="muted small">Vous pouvez fermer cet onglet et continuer vos recherches.</p>
      </div>
    )
  if (lists === null) return <p>Chargement…</p>
  if (lists.length === 0)
    return (
      <>
        <div className="card center">
          <h3>Créez d'abord une liste</h3>
          <p className="muted">Vous n'avez pas encore de liste pour y ajouter « {title || hostOf(url)} ».</p>
          <button type="button" onClick={() => setCreatingList(true)}>+ Nouvelle liste</button>
        </div>
        {newListModal}
      </>
    )

  return (
    <>
    <form onSubmit={submit} className="card">
      <h3>Ajouter à ma liste</h3>
      <div className="it-preview">
        <Thumb label={title || 'Idée'} image={image} />
        <p className="muted small" style={{ margin: 0, flex: 1, wordBreak: 'break-all' }}>{hostOf(url)}</p>
      </div>
      <input required placeholder="Nom" value={title} onChange={e => setTitle(e.target.value)} />
      <div className="row">
        <select value={listId} onChange={e => (e.target.value === NEW ? setCreatingList(true) : setListId(e.target.value))} aria-label="Liste">
          {lists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          <option value={NEW}>+ Nouvelle liste…</option>
        </select>
        <input inputMode="decimal" placeholder="Prix" value={price} onChange={e => setPrice(e.target.value)} style={{ maxWidth: 110 }} />
      </div>
      <input placeholder="Note : taille, couleur… (facultatif)" value={note} onChange={e => setNote(e.target.value)} />
      {err && <p className="err">{err}</p>}
      <button style={{ width: '100%', marginTop: 8 }}>Ajouter</button>
    </form>
    {newListModal}
    </>
  )
}
