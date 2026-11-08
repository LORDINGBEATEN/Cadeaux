import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import Thumb from '../lib/Thumb'
import NewListModal from '../lib/NewListModal'
import BookmarkletButton from '../lib/BookmarkletButton'
import { useProfileName } from '../lib/profile'
import { BOOKMARKLET_VERSION } from '../lib/bookmarklet'
import { daysUntil, fmtDate, inDays, itemLabel } from '../lib/util'

type Item = { id: string; title: string | null; url: string | null; image_url: string | null }
type L = { id: string; title: string; occasion: string; event_date: string | null; share_code: string; archived_at: string | null; items: Item[] }
const HIDE_CDC = 'ptite-hide-coup-de-coeur'
const NO_DATE = '__nodate'

// À venir (la plus proche d'abord), puis sans date, puis passées (la plus récente d'abord).
function sortLists(lists: L[]): L[] {
  const rank = (l: L) => { const d = daysUntil(l.event_date); return d === null ? 1 : d >= 0 ? 0 : 2 }
  return [...lists].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    if (ra === 0) return daysUntil(a.event_date)! - daysUntil(b.event_date)!
    if (ra === 2) return (b.event_date ?? '').localeCompare(a.event_date ?? '')
    return a.title.localeCompare(b.title, 'fr')
  })
}

function Pill({ l }: { l: L }) {
  const d = daysUntil(l.event_date)
  if (d === null) return <span className="pill grey">sans date</span>
  if (d < 0) return <span className="pill grey">terminée</span>
  return <span className="pill">{inDays(d)}</span>
}

export default function Home() {
  const user = useAuth().session!.user
  const [lists, setLists] = useState<L[] | null>(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const { name } = useProfileName(user)
  const [hideCdc, setHideCdc] = useState(localStorage.getItem(HIDE_CDC) === '1')
  const nav = useNavigate()

  const load = useCallback(async () => {
    const { data } = await supabase.from('lists')
      .select('id, title, occasion, event_date, share_code, archived_at, items(id, title, url, image_url, created_at)')
      .order('created_at', { referencedTable: 'items' })
    setLists((data as L[] | null) ?? [])
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ptite-pending-add')
      if (raw) {
        localStorage.removeItem('ptite-pending-add')
        const { search, at } = JSON.parse(raw) as { search: string; at: number }
        if (Date.now() - at < 3600_000) { nav('/ajouter' + search, { replace: true }); return }
      }
    } catch { /* ignoré */ }
    load()
  }, [load, nav])

  const active = useMemo(() => sortLists((lists ?? []).filter(l => !l.archived_at)), [lists])
  const archived = useMemo(() => sortLists((lists ?? []).filter(l => l.archived_at)), [lists])
  const q = query.trim().toLowerCase()
  const visible = active
    .filter(l => filter === 'all' || (filter === NO_DATE ? !l.event_date : l.occasion === filter))
    .filter(l => !q || l.title.toLowerCase().includes(q))
  const occasions = [...new Set(active.map(l => l.occasion))]
  const showFilters = active.length >= 4

  function hideFrame() { setHideCdc(true); localStorage.setItem(HIDE_CDC, '1') }
  async function copy(l: L) {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${l.share_code}`)
    setCopied(l.id); setTimeout(() => setCopied(c => (c === l.id ? null : c)), 2000)
  }
  async function restore(id: string) { await supabase.from('lists').update({ archived_at: null }).eq('id', id); load() }
  function openCreate() { setCreating(true) }

  if (lists === null) return <p>Chargement…</p>

  const modal = creating && <NewListModal onClose={() => setCreating(false)} onCreated={id => nav(`/l/${id}`)} />
  const addRow = <button type="button" className="addrow" onClick={openCreate}>+ Nouvelle liste</button>

  const frame = !hideCdc && (
    <section className="bmframe">
      <button type="button" className="bmclose" aria-label="Masquer ce bloc" onClick={hideFrame}>✕</button>
      <strong className="bm-title"><img src="/favicon.svg" alt="" width="20" height="20" />Coup de cœur</strong>
      <p>Un produit repéré dans une boutique ? Ajoutez-le à une liste en un clic, avec son nom, son prix et sa photo.</p>
      <p className="muted small">Glissez le bouton dans votre barre de favoris. <Link to="/coup-de-coeur">Comment ça marche</Link></p>
      <div className="bmaction"><BookmarkletButton /></div>
    </section>
  )

  // Bouton installé dans une ancienne version : on invite à le remplacer.
  const seen = Number(localStorage.getItem('ptite-bm-version') ?? 0)
  const outdated = seen > 0 && seen < BOOKMARKLET_VERSION
  const update = outdated && (
    <section className="bmframe bmupdate">
      <strong>Mise à jour du bouton Coup de cœur</strong>
      <p>Une nouvelle version est disponible. Glissez ce bouton dans votre barre de favoris pour remplacer l'ancien.</p>
      <div className="bmaction"><BookmarkletButton /></div>
    </section>
  )

  const hello = (text?: string) => (
    <div className="hello">
      <div><h2>Bonjour {name}</h2>{text && <p className="muted">{text}</p>}</div>
    </div>
  )

  if (active.length === 0)
    return (
      <>
        {hello(archived.length > 0 ? 'Aucune liste active pour le moment.' : "Créez votre première liste d'idées cadeaux, puis partagez-la par lien.")}
        {addRow}
        {update}
        {frame}
        {Archives()}
        {modal}
      </>
    )

  function Archives() {
    if (archived.length === 0) return null
    return (
      <section className="archives">
        <div className="muted small tl-title">Archivées</div>
        <ul className="timeline">
          {archived.map(l => {
            const dt = l.event_date ? new Date(l.event_date + 'T00:00:00') : null
            return (
              <li key={l.id} className="past archived">
                <div className="tl-date">
                  {dt ? <><span>{dt.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span><b>{dt.getDate()}</b></> : <span>sans<br />date</span>}
                </div>
                <div className="tl-rail"><i /></div>
                <div className="tl-card">
                  <Link to={`/l/${l.id}`} className="row-main">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="lc-title" style={{ padding: 0 }}>{l.title}</div>
                      <div className="muted small">{[l.occasion, `${l.items.length} idée${l.items.length > 1 ? 's' : ''}`].join(' · ')}</div>
                    </div>
                    <span className="pill grey">Archivée</span>
                  </Link>
                  <button type="button" className="link" onClick={() => restore(l.id)}>Restaurer</button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <>
      {hello()}
      {update}
      {frame}

      {(showFilters || query) && (
        <div className="searchbar">
          <input type="search" placeholder="Rechercher une liste" aria-label="Rechercher une liste" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      )}
      {showFilters && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={`chipbtn${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>Toutes · {active.length}</button>
          {occasions.map(o => <button key={o} className={`chipbtn${filter === o ? ' on' : ''}`} onClick={() => setFilter(o)}>{o}</button>)}
          {active.some(l => !l.event_date) && <button className={`chipbtn${filter === NO_DATE ? ' on' : ''}`} onClick={() => setFilter(NO_DATE)}>Sans date</button>}
        </div>
      )}

      <ul className="timeline">
        {visible.map(l => {
          const n = l.items.length
          const d = daysUntil(l.event_date)
          const dt = l.event_date ? new Date(l.event_date + 'T00:00:00') : null
          return (
            <li key={l.id} className={d === null ? 'nodate' : d < 0 ? 'past' : ''}>
              <div className="tl-date">
                {dt ? <><span>{dt.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span><b>{dt.getDate()}</b></> : <span>sans<br />date</span>}
              </div>
              <div className="tl-rail"><i /></div>
              <div className="tl-card">
                <Link to={`/l/${l.id}`} className="row-main">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lc-title" style={{ padding: 0 }}>{l.title}</div>
                    <div className="muted small">{[l.occasion, `${n} idée${n > 1 ? 's' : ''}`].join(' · ')}</div>
                  </div>
                  <Pill l={l} />
                </Link>
                <button className="link" onClick={() => copy(l)}>{copied === l.id ? 'Lien copié ✓' : 'Copier le lien'}</button>
              </div>
            </li>
          )
        })}
      </ul>
      {visible.length === 0 && <p className="muted">Aucune liste dans ce filtre.</p>}
      {addRow}
      {Archives()}
      {modal}
    </>
  )
}
