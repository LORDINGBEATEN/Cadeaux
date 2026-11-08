import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Thumb from '../lib/Thumb'
import NewListModal from '../lib/NewListModal'
import Modal from '../lib/Modal'
import { fmtDate, fmtPrice, hostOf, itemLabel } from '../lib/util'

type Item = { id: string; title: string | null; url: string; note: string | null; price: number | null; currency: string | null; image_url: string | null }
type List = { title: string; occasion: string; event_date: string | null; share_code: string; archived_at: string | null }
// Nom approximatif déduit de l'adresse, quand la page ne peut pas être lue.
function titleFromUrl(url: string): string | null {
  try {
    const seg = new URL(url).pathname.split('/').map(x => { try { return decodeURIComponent(x) } catch { return x } })
      .filter(x => x.includes('-') && /[a-zA-ZÀ-ÿ]{3}/.test(x)).sort((a, b) => b.length - a.length)[0]
    if (!seg) return null
    const t = seg.replace(/\.(html?|php)$/i, '').replace(/[-_]+/g, ' ').trim()
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : null
  } catch { return null }
}
type Preview = { title: string | null; price: number | null; currency: string | null; image: string | null; error?: string }
async function fetchPreview(url: string): Promise<Preview> {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${session?.access_token}` } })
  return r.json()
}
const EMPTY = { url: '', title: '', price: '', note: '' }

export default function ListPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [f, setF] = useState(EMPTY)
  const [currency, setCurrency] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [hint, setHint] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ url: '', title: '', price: '', note: '', image: '' })
  const [editErr, setEditErr] = useState('')
  const [editingList, setEditingList] = useState(false)
  const [claimFor, setClaimFor] = useState<string | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimErr, setClaimErr] = useState('')
  const [claims, setClaims] = useState<Record<string, string>>({})
  const [hideClaims, setHideClaims] = useState(localStorage.getItem('ptite-hide-claims') === '1')
  const lastLookup = useRef('')

  async function load() {
    const [l, it] = await Promise.all([
      supabase.from('lists').select('title, occasion, event_date, share_code, archived_at').eq('id', id).single(),
      supabase.from('items').select('id, title, url, note, price, currency, image_url').eq('list_id', id).order('created_at'),
    ])
    setList(l.data); setItems(it.data ?? [])
    const cl = await supabase.rpc('list_claims', { p_list: id })
    setClaims(Object.fromEntries(((cl.data ?? []) as { item_id: string; guest_name: string }[]).map(c => [c.item_id, c.guest_name])))
  }
  useEffect(() => { load() }, [id])

  const normalize = (raw: string) => {
    const u = raw.trim()
    return u && !/^https?:\/\//i.test(u) ? 'https://' + u : u
  }

  // Récupère le nom et le prix de la page, sans écraser ce que l'utilisateur a déjà saisi.
  async function lookup(raw: string) {
    const url = normalize(raw)
    if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url) || url === lastLookup.current) return
    lastLookup.current = url
    setSearching(true); setHint('')
    try {
      const p = await fetchPreview(url)
      const guess = p.title ? null : titleFromUrl(url)
      setF(cur => ({ ...cur, title: cur.title || p.title || guess || '', price: cur.price || (p.price !== null ? String(p.price) : '') }))
      if (p.price !== null) setCurrency(p.currency)
      setImage(p.image)
      const found = [p.title, p.price !== null ? fmtPrice(p.price, p.currency) : null].filter(Boolean).join(' · ')
      setHint(found ? `Trouvé : ${found}`
        : p.error ? `Ce site refuse la lecture automatique (${p.error})${guess ? ' : nom déduit du lien, saisissez le prix.' : ' : saisissez les infos à la main.'} Astuce : le bouton « Coup de cœur » lit la page depuis votre navigateur.`
        : 'Infos introuvables sur cette page : saisissez-les à la main.')
    } catch {
      setHint('Recherche impossible : saisissez les infos à la main.')
    } finally { setSearching(false) }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const price = f.price ? Number(f.price.replace(',', '.')) : null
    const { error } = await supabase.from('items').insert({
      list_id: id, url: normalize(f.url), title: f.title.trim() || null, note: f.note.trim() || null,
      price: price !== null && Number.isFinite(price) ? price : null,
      currency: price !== null ? currency || 'EUR' : null,
      image_url: image,
    })
    if (error) return setErr('Lien invalide : ' + error.message)
    setF(EMPTY); setCurrency(null); setImage(null); setHint(''); lastLookup.current = ''; load()
  }
  // Relit les liens déjà ajoutés et complète ce qui manque, sans écraser l'existant.
  async function refresh() {
    const todo = items.filter(i => !i.image_url || i.price === null || !i.title)
    if (todo.length === 0) return setRefreshMsg('Tout est déjà à jour.')
    setRefreshing(true)
    let done = 0, updated = 0
    const say = () => setRefreshMsg(`Actualisation… ${done}/${todo.length}`)
    say()
    const queue = [...todo]
    const worker = async () => {
      let it: Item | undefined
      while ((it = queue.shift())) {
        try {
          const p = await fetchPreview(it.url)
          const patch: Partial<Item> = {}
          if (!it.title && p.title) patch.title = p.title
          if (!it.image_url && p.image) patch.image_url = p.image
          if (it.price === null && p.price !== null) { patch.price = p.price; patch.currency = p.currency || 'EUR' }
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from('items').update(patch).eq('id', it.id)
            if (!error) updated++
          }
        } catch { /* lien illisible : on passe au suivant */ }
        done++; say()
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, todo.length) }, worker))
    await load()
    setRefreshing(false)
    setRefreshMsg(updated > 0
      ? `${updated} idée${updated > 1 ? 's' : ''} complétée${updated > 1 ? 's' : ''}. Les autres sont sur des sites qui bloquent la lecture.`
      : 'Rien de nouveau trouvé : ces sites bloquent la lecture automatique.')
  }
  function startEdit(i: Item) {
    setEditErr('')
    setDraft({ url: i.url, title: i.title ?? '', price: i.price !== null ? String(i.price) : '', note: i.note ?? '', image: i.image_url ?? '' })
    setEditing(i.id)
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); setEditErr('')
    const img = draft.image.trim()
    if (img && !/^https?:\/\/\S+$/i.test(img)) return setEditErr("L'adresse de la photo doit commencer par https://")
    const price = draft.price.trim() ? Number(draft.price.replace(',', '.')) : null
    if (price !== null && !Number.isFinite(price)) return setEditErr('Prix invalide')
    const cur = items.find(x => x.id === editing)
    const { error } = await supabase.from('items').update({
      url: normalize(draft.url), title: draft.title.trim() || null, note: draft.note.trim() || null,
      price, currency: price !== null ? cur?.currency || 'EUR' : null, image_url: img || null,
    }).eq('id', editing)
    if (error) return setEditErr('Modification impossible : ' + error.message)
    setEditing(null); load()
  }
  async function claimForSomeone(e: React.FormEvent) {
    e.preventDefault(); setClaimErr('')
    const { error } = await supabase.rpc('owner_claim_item', { p_item: claimFor, guest: claimName })
    if (error) return setClaimErr(error.message)
    setClaimFor(null); load()
  }
  async function unclaimItem(itemId: string) {
    if (!confirm(`Retirer la réservation de ${claims[itemId]} ?`)) return
    await supabase.rpc('owner_unclaim_item', { p_item: itemId })
    load()
  }
  async function remove(itemId: string) {
    if (claims[itemId] && !confirm(`Cette idée est réservée par ${claims[itemId]}. La supprimer quand même ?`)) return
    await supabase.from('items').delete().eq('id', itemId); load() }
  async function setArchived(on: boolean) {
    await supabase.from('lists').update({ archived_at: on ? new Date().toISOString() : null }).eq('id', id)
    if (on) nav('/'); else load()
  }
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
      <div className="between" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>{list.title}</h2>
        <button type="button" className="secondary" onClick={() => setEditingList(true)}>✎ Modifier</button>
      </div>
      <span className="chip">{list.occasion}{list.event_date ? ` · ${fmtDate(list.event_date)}` : ''}</span>
      {list.archived_at && (
        <div className="note" style={{ marginTop: 12 }}>
          📦 Cette liste est archivée : elle n'apparaît plus dans « Mes listes ». Son lien de partage reste actif.{' '}
          <button type="button" className="link" onClick={() => setArchived(false)}>Restaurer</button>
        </div>
      )}

      <div className="card share">
        <strong>Lien à partager</strong>
        <p className="muted small">Toute personne qui a ce lien peut voir la liste et réserver une idée, sans créer de compte.</p>
        <div className="row"><input readOnly value={link} onFocus={e => e.target.select()} /><button onClick={copy}>{copied ? 'Copié ✓' : 'Copier'}</button></div>
        <p className="note">
          {hideClaims ? '🤫 Réservations masquées pour garder la surprise.' : '👀 Les réservations de vos proches s’affichent sur vos idées.'}{' '}
          <button type="button" className="link" onClick={() => { const v = !hideClaims; setHideClaims(v); localStorage.setItem('ptite-hide-claims', v ? '1' : '0') }}>
            {hideClaims ? 'Afficher' : 'Masquer'}
          </button>
        </p>
      </div>

      <div className="between">
        <h3 style={{ margin: 0 }}>Mes idées</h3>
        {items.length > 0 && <button type="button" className="secondary" onClick={refresh} disabled={refreshing}>↻ Actualiser les infos</button>}
      </div>
      {refreshMsg && <p className="muted small">{refreshMsg}</p>}
      {items.length === 0 && <p className="muted">Collez ci-dessous des liens vers des pages web qui montrent vos idées de cadeaux.</p>}
      <ul className="items">
        {items.map(i => editing === i.id ? (
          <li key={i.id} className="editing">
            <form onSubmit={saveEdit}>
              <input required placeholder="Lien de la page web" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} />
              <div className="row">
                <input placeholder="Nom" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
                <input inputMode="decimal" placeholder="Prix" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} style={{ maxWidth: 110 }} />
              </div>
              <input placeholder="Note : taille, couleur… (facultatif)" value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} />
              <div className="it-preview">
                <Thumb label={draft.title || 'Idée'} image={draft.image.trim() || null} />
                <input placeholder="Adresse de la photo (https://…, facultatif)" value={draft.image} onChange={e => setDraft({ ...draft, image: e.target.value })} style={{ flex: 1 }} />
              </div>
              {editErr && <p className="err">{editErr}</p>}
              <div className="btnrow"><button>Enregistrer</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Annuler</button></div>
            </form>
          </li>
        ) : (
          <li key={i.id} className={claims[i.id] && !hideClaims ? 'taken' : ''}>
            <Thumb label={itemLabel(i)} image={i.image_url} />
            <div>
              <a href={i.url} target="_blank" rel="noreferrer noopener"><strong>{itemLabel(i)}</strong></a>
              <div className="muted small">{hostOf(i.url)}{i.note ? ` · ${i.note}` : ''}</div>
              {!hideClaims && (
                <div className="claimrow">
                  {claims[i.id]
                    ? <><span className="badge">Réservé par {claims[i.id]}</span><button type="button" className="link" onClick={() => unclaimItem(i.id)}>Retirer</button></>
                    : <button type="button" className="link" onClick={() => { setClaimName(''); setClaimErr(''); setClaimFor(i.id) }}>Réserver pour quelqu'un…</button>}
                </div>
              )}
            </div>
            {i.price !== null && <div className="price">{fmtPrice(i.price, i.currency)}</div>}
            <div className="actions">
              <button className="link" onClick={() => startEdit(i)}>Modifier</button>
              <button className="link" onClick={() => remove(i.id)}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={addItem} className="card">
        <h3>Ajouter une idée</h3>
        <input required placeholder="Lien de la page web (https://…)" value={f.url}
          onChange={e => setF({ ...f, url: e.target.value })}
          onBlur={e => lookup(e.target.value)}
          onPaste={e => { const t = e.clipboardData.getData('text'); setTimeout(() => lookup(t), 0) }} />
        {searching && <p className="muted small">🔎 Recherche du nom, du prix et de la photo…</p>}
        {!searching && (hint || image) && (
          <div className="it-preview">
            {image && <Thumb label={f.title || 'Idée'} image={image} />}
            <p className="muted small" style={{ flex: 1, margin: 0 }}>{hint}{image && <> <button type="button" className="link" onClick={() => setImage(null)}>Retirer la photo</button></>}</p>
          </div>
        )}
        <div className="row">
          <input placeholder="Nom" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <input inputMode="decimal" placeholder="Prix" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} style={{ maxWidth: 110 }} />
        </div>
        <input placeholder="Note : taille, couleur… (facultatif)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <button disabled={searching}>Ajouter</button>
        {err && <p className="err">{err}</p>}
      </form>
      <div className="btnrow" style={{ marginTop: 20 }}>
        {!list.archived_at && <button type="button" className="secondary" onClick={() => setArchived(true)}>📦 Archiver la liste</button>}
        <button type="button" className="link danger" style={{ marginTop: 0 }} onClick={deleteList}>Supprimer la liste</button>
      </div>
      {editingList && (
        <NewListModal
          edit={{ id: id!, title: list.title, occasion: list.occasion, event_date: list.event_date }}
          onClose={() => setEditingList(false)}
          onCreated={() => { setEditingList(false); load() }}
        />
      )}
      {claimFor && (
        <Modal title="Réserver pour quelqu'un" onClose={() => setClaimFor(null)}>
          <form onSubmit={claimForSomeone}>
            <p className="muted small" style={{ marginTop: 0 }}>« {itemLabel(items.find(x => x.id === claimFor) ?? { title: null, url: '' })} » sera marquée comme réservée au nom de la personne indiquée.</p>
            <input required autoFocus maxLength={60} placeholder="Prénom de la personne" value={claimName} onChange={e => setClaimName(e.target.value)} />
            {claimErr && <p className="err">{claimErr}</p>}
            <div className="btnrow" style={{ marginTop: 12 }}>
              <button>Réserver</button>
              <button type="button" className="secondary" onClick={() => setClaimFor(null)}>Annuler</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
