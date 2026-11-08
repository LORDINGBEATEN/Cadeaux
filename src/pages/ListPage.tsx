import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Thumb from '../lib/Thumb'
import { fmtDate, fmtPrice, hostOf, itemLabel } from '../lib/util'

type Item = { id: string; title: string | null; url: string; note: string | null; price: number | null; currency: string | null; image_url: string | null }
type List = { title: string; occasion: string; event_date: string | null; share_code: string }
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
  const lastLookup = useRef('')

  async function load() {
    const [l, it] = await Promise.all([
      supabase.from('lists').select('title, occasion, event_date, share_code').eq('id', id).single(),
      supabase.from('items').select('id, title, url, note, price, currency, image_url').eq('list_id', id).order('created_at'),
    ])
    setList(l.data); setItems(it.data ?? [])
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
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const p: { title: string | null; price: number | null; currency: string | null; image: string | null; error?: string } = await r.json()
      const guess = p.title ? null : titleFromUrl(url)
      setF(cur => ({ ...cur, title: cur.title || p.title || guess || '', price: cur.price || (p.price !== null ? String(p.price) : '') }))
      if (p.price !== null) setCurrency(p.currency)
      setImage(p.image)
      const found = [p.title, p.price !== null ? fmtPrice(p.price, p.currency) : null].filter(Boolean).join(' · ')
      setHint(found ? `Trouvé : ${found}`
        : p.error ? `Ce site refuse la lecture automatique (${p.error})${guess ? ' : nom déduit du lien, saisissez le prix.' : ' : saisissez les infos à la main.'}`
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
      <span className="chip">{list.occasion}{list.event_date ? ` · ${fmtDate(list.event_date)}` : ''}</span>

      <div className="card share">
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
            <Thumb label={itemLabel(i)} image={i.image_url} />
            <div>
              <a href={i.url} target="_blank" rel="noreferrer noopener"><strong>{itemLabel(i)}</strong></a>
              <div className="muted small">{hostOf(i.url)}{i.note ? ` · ${i.note}` : ''}</div>
            </div>
            {i.price !== null && <div className="price">{fmtPrice(i.price, i.currency)}</div>}
            <button className="link" onClick={() => remove(i.id)}>Supprimer</button>
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
      <button className="link danger" onClick={deleteList}>Supprimer la liste</button>
    </>
  )
}
