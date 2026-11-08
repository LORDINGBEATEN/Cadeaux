import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Thumb from '../lib/Thumb'
import Modal from '../lib/Modal'
import { countdown, firstName, fmtDate, fmtPrice, getGuestName, guestToken, hostOf, itemLabel, setGuestName } from '../lib/util'

type Item = { id: string; title: string | null; url: string | null; note: string | null; price: number | null; currency: string | null; image_url: string | null; claimed: boolean; claimed_by: string | null; anonymous: boolean; mine: boolean }
type Shared = { title: string; occasion: string; event_date: string | null; owner_name: string | null; is_owner: boolean; items: Item[] }

export default function SharedList() {
  const { code } = useParams()
  const [data, setData] = useState<Shared | null | undefined>(undefined)
  const [name, setName] = useState(getGuestName())
  const [err, setErr] = useState('')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [hideName, setHideName] = useState(localStorage.getItem('ptite-guest-anon') === '1')

  async function load() {
    const { data } = await supabase.rpc('get_shared_list', { code, token: guestToken() })
    setData(data)
  }
  useEffect(() => { load() }, [code])

  async function claim(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const guest = name.trim()
    if (!guest) return setErr('Indiquez votre prénom.')
    setGuestName(guest); localStorage.setItem('ptite-guest-anon', hideName ? '1' : '0')
    const { error } = await supabase.rpc('claim_item', { code, item: claiming, guest, token: guestToken(), anon: hideName })
    if (error) return setErr(error.message)
    setClaiming(null); load()
  }
  async function unclaim(item: string) {
    await supabase.rpc('unclaim_item', { item, token: guestToken() }); load()
  }

  if (data === undefined) return <p>Chargement…</p>
  if (data === null) return <div className="card"><h2>Liste introuvable</h2><p className="muted">Ce lien n'est plus valide.</p></div>

  return (
    <>
      <div className="center">
        <h2 style={{ marginBottom: 4 }}>{data.title}</h2>
        <span className="chip">{data.occasion}{data.event_date ? ` · ${fmtDate(data.event_date)}` : ''}</span>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          {data.owner_name ? `Liste de ${firstName(data.owner_name)}` : ''}{countdown(data.event_date) ? ` · ${countdown(data.event_date)}` : ''}
        </p>
      </div>

      {data.is_owner && <p className="note">👀 C'est votre liste : voici ce que vos proches ont déjà réservé.</p>}

      {data.items.length === 0 && <p className="muted">Aucune idée pour le moment.</p>}
      <ul className="items">
        {data.items.map(i => (
          <li key={i.id} className={i.claimed ? 'taken' : ''}>
            <Thumb label={itemLabel(i)} image={i.image_url} />
            <div>
              {i.url ? <a href={i.url} target="_blank" rel="noreferrer noopener"><strong>{itemLabel(i)}</strong></a> : <strong>{itemLabel(i)}</strong>}
              <div className="muted small">{[i.price !== null ? fmtPrice(i.price, i.currency) : null, i.url ? hostOf(i.url) : null, i.note].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="actions">
              {data.is_owner ? (i.claimed ? <span className="badge">Réservé par {i.claimed_by}{i.anonymous ? ' (nom caché aux invités)' : ''}</span> : null)
                : i.mine ? <><span className="badge mine">Réservé par vous{i.anonymous ? ' (nom caché)' : ''}</span><button className="link" onClick={() => unclaim(i.id)}>Annuler</button></>
                : i.claimed ? <span className="badge">{i.claimed_by ? `Réservé par ${i.claimed_by}` : 'Réservé'}</span>
                : <button onClick={() => { setErr(''); setClaiming(i.id) }}>Je l'offre</button>}
            </div>
          </li>
        ))}
      </ul>
      {claiming && (
        <Modal title="Je l'offre" onClose={() => setClaiming(null)}>
          <form onSubmit={claim}>
            <p className="muted small" style={{ marginTop: 0 }}>« {itemLabel(data.items.find(x => x.id === claiming) ?? { title: null, url: null })} » sera marquée comme réservée. Aucun compte n'est nécessaire.</p>
            <label className="small">Votre prénom</label>
            <input required autoFocus maxLength={60} placeholder="Ex : Marie" value={name} onChange={e => setName(e.target.value)} />
            <label className="check">
              <input type="checkbox" checked={hideName} onChange={e => setHideName(e.target.checked)} />
              <span>Cacher mon nom aux autres invités<br /><small className="muted">Ils verront simplement « Réservé ». Le propriétaire de la liste pourra toujours le voir.</small></span>
            </label>
            {err && <p className="err">{err}</p>}
            <div className="btnrow" style={{ marginTop: 12 }}>
              <button>Je l'offre</button>
              <button type="button" className="secondary" onClick={() => setClaiming(null)}>Annuler</button>
            </div>
          </form>
        </Modal>
      )}
      {!claiming && err && <p className="err">{err}</p>}
    </>
  )
}
