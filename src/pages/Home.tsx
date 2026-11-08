import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import Thumb from '../lib/Thumb'
import NewListModal from '../lib/NewListModal'
import BookmarkletButton from '../lib/BookmarkletButton'
import { daysUntil, fmtDate, inDays, itemLabel } from '../lib/util'

type Item = { id: string; title: string | null; url: string; image_url: string | null }
type L = { id: string; title: string; occasion: string; event_date: string | null; share_code: string; archived_at: string | null; items: Item[] }
const VIEW = 'ptite-lists-view'
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
  const [view, setView] = useState<'cards' | 'rows'>(localStorage.getItem(VIEW) === 'rows' ? 'rows' : 'cards')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showArchives, setShowArchives] = useState(false)
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

  const rawName = (user.user_metadata?.name as string | undefined) || (user.email ?? '').split('@')[0]
  const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : ''

  const active = useMemo(() => sortLists((lists ?? []).filter(l => !l.archived_at)), [lists])
  const archived = useMemo(() => sortLists((lists ?? []).filter(l => l.archived_at)), [lists])
  const visible = active.filter(l => filter === 'all' || (filter === NO_DATE ? !l.event_date : l.occasion === filter))
  const next = active.find(l => (daysUntil(l.event_date) ?? -1) >= 0)
  const occasions = [...new Set(active.map(l => l.occasion))]
  const showFilters = active.length >= 4

  function chooseView(v: 'cards' | 'rows') { setView(v); localStorage.setItem(VIEW, v) }
  function hideFrame() { setHideCdc(true); localStorage.setItem(HIDE_CDC, '1') }
  async function copy(l: L) {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${l.share_code}`)
    setCopied(l.id); setTimeout(() => setCopied(c => (c === l.id ? null : c)), 2000)
  }
  async function restore(id: string) { await supabase.from('lists').update({ archived_at: null }).eq('id', id); load() }
  function openCreate() { setCreating(true) }

  if (lists === null) return <p>Chargement…</p>

  const newListButton = <button type="button" onClick={openCreate}>+ Nouvelle liste</button>

  const modal = creating && <NewListModal onClose={() => setCreating(false)} onCreated={id => nav(`/l/${id}`)} />

  const frame = !hideCdc && (
    <section className="bmframe">
      <div className="bmtext">
        <strong>Coup de cœur</strong>
        <p>Un produit repéré dans une boutique ? Ajoutez-le à une liste en un clic, avec son nom, son prix et sa photo.</p>
        <p className="muted small">Glissez le bouton dans votre barre de favoris. <Link to="/coup-de-coeur">Comment ça marche</Link></p>
      </div>
      <div className="bmaction"><BookmarkletButton /><button type="button" className="link" onClick={hideFrame}>Masquer</button></div>
    </section>
  )

  const hello = (text: string) => (
    <div className="hello">
      <div><h2>Bonjour {name}</h2><p className="muted">{text}</p></div>
      {newListButton}
    </div>
  )

  if (active.length === 0)
    return (
      <>
        {hello(archived.length > 0 ? 'Aucune liste active pour le moment.' : "Créez votre première liste d'idées cadeaux, puis partagez-la par lien.")}
        {frame}
        {Archives()}
        {modal}
      </>
    )

  function Archives() {
    if (archived.length === 0) return null
    return (
      <section className="archives">
        <button type="button" className="link" onClick={() => setShowArchives(s => !s)} aria-expanded={showArchives}>
          {showArchives ? '▾' : '▸'} Archives ({archived.length})
        </button>
        {showArchives && (
          <ul className="rows">
            {archived.map(l => {
              const first = l.items[0]
              return (
                <li key={l.id} className="archived">
                  <Link to={`/l/${l.id}`} className="row-main">
                    <Thumb label={first ? itemLabel(first) : l.title} image={first?.image_url ?? null} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="lc-title" style={{ padding: 0 }}>{l.title}</div>
                      <div className="muted small">{[l.occasion, l.event_date && fmtDate(l.event_date), `${l.items.length} idée${l.items.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</div>
                    </div>
                  </Link>
                  <button type="button" className="link" onClick={() => restore(l.id)}>Restaurer</button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    )
  }

  return (
    <>
      {hello(next ? `Prochaine date : ${next.title}, ${inDays(daysUntil(next.event_date)!)}` : 'Vos listes d’idées cadeaux')}

      <div className="toolbar">
        <div className="chips">
          {showFilters && <>
            <button className={`chipbtn${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>Toutes · {active.length}</button>
            {occasions.map(o => <button key={o} className={`chipbtn${filter === o ? ' on' : ''}`} onClick={() => setFilter(o)}>{o}</button>)}
            {active.some(l => !l.event_date) && <button className={`chipbtn${filter === NO_DATE ? ' on' : ''}`} onClick={() => setFilter(NO_DATE)}>Sans date</button>}
          </>}
        </div>
        <div className="seg" role="group" aria-label="Affichage">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => chooseView('cards')} aria-pressed={view === 'cards'}>Cartes</button>
          <button className={view === 'rows' ? 'on' : ''} onClick={() => chooseView('rows')} aria-pressed={view === 'rows'}>Liste</button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="cards">
          {visible.map(l => {
            const n = l.items.length
            const shown = l.items.slice(0, n > 4 ? 3 : 4)
            return (
              <div key={l.id} className="lcard">
                <Link to={`/l/${l.id}`} className="lc-main">
                  <div className="mosaic">
                    {n === 0 && <div className="empty-note">Aucune idée pour l'instant</div>}
                    {shown.map(i => <Thumb key={i.id} label={itemLabel(i)} image={i.image_url} fill />)}
                    {n > 4 && <div className="tile fill more">+{n - 3}</div>}
                  </div>
                  <div className="lc-title">{l.title}</div>
                  <div className="lc-meta"><Pill l={l} /><span className="muted small">{[l.event_date && fmtDate(l.event_date), `${n} idée${n > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</span></div>
                </Link>
                <div className="lc-actions">
                  <button className="link" onClick={() => copy(l)}>{copied === l.id ? 'Lien copié ✓' : '🔗 Copier le lien'}</button>
                  <Link to={`/l/${l.id}`} className="open">Ouvrir →</Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <ul className="rows">
          {visible.map(l => {
            const n = l.items.length, first = l.items[0]
            return (
              <li key={l.id}>
                <Link to={`/l/${l.id}`} className="row-main">
                  <Thumb label={first ? itemLabel(first) : l.title} image={first?.image_url ?? null} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lc-title" style={{ padding: 0 }}>{l.title}</div>
                    <div className="muted small">{[l.occasion, l.event_date && fmtDate(l.event_date), `${n} idée${n > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Pill l={l} />
                </Link>
                <button className="link" onClick={() => copy(l)} aria-label={`Copier le lien de ${l.title}`}>{copied === l.id ? 'Copié ✓' : '🔗'}</button>
              </li>
            )
          })}
        </ul>
      )}
      {visible.length === 0 && <p className="muted">Aucune liste dans cette catégorie.</p>}

      {frame}
      {Archives()}
      {modal}
    </>
  )
}
