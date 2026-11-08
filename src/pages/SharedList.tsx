import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Thumb from '../lib/Thumb'
import { countdown, fmtDate, fmtPrice, getGuestName, guestToken, hostOf, itemLabel, setGuestName } from '../lib/util'

type Item = { id: string; title: string | null; url: string; note: string | null; price: number | null; currency: string | null; image_url: string | null; claimed: boolean; claimed_by: string | null; mine: boolean }
type Shared = { title: string; occasion: string; event_date: string | null; owner_name: string | null; is_owner: boolean; items: Item[] }

export default function SharedList() {
  const { code } = useParams()
  const [data, setData] = useState<Shared | null | undefined>(undefined)
  const [name, setName] = useState(getGuestName())
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.rpc('get_shared_list', { code, token: guestToken() })
    setData(data)
  }
  useEffect(() => { load() }, [code])

  async function claim(item: string) {
    setErr('')
    if (!name.trim()) return setErr('Indiquez d’abord votre prénom ci-dessus.')
    setGuestName(name.trim())
    const { error } = await supabase.rpc('claim_item', { code, item, guest: name.trim(), token: guestToken() })
    if (error) setErr(error.message)
    load()
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
          {data.owner_name ? `Liste de ${data.owner_name}` : ''}{countdown(data.event_date) ? ` · ${countdown(data.event_date)}` : ''}
        </p>
      </div>

      {data.is_owner
        ? <p className="note">🤫 C'est votre liste : les réservations sont cachées pour garder la surprise.</p>
        : <div className="card">
            <strong>Votre prénom</strong>
            <p className="muted small">Pour que les autres sachent qui offre quoi. Aucun compte n'est nécessaire.</p>
            <input placeholder="Ex : Marie" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
          </div>}

      {data.items.length === 0 && <p className="muted">Aucune idée pour le moment.</p>}
      <ul className="items">
        {data.items.map(i => (
          <li key={i.id} className={i.claimed ? 'taken' : ''}>
            <Thumb label={itemLabel(i)} image={i.image_url} />
            <div>
              <a href={i.url} target="_blank" rel="noreferrer noopener"><strong>{itemLabel(i)}</strong></a>
              <div className="muted small">{[i.price !== null ? fmtPrice(i.price, i.currency) : null, hostOf(i.url), i.note].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="actions">
              {data.is_owner ? null
                : i.mine ? <><span className="badge mine">Réservé par vous</span><button className="link" onClick={() => unclaim(i.id)}>Annuler</button></>
                : i.claimed ? <span className="badge">Réservé par {i.claimed_by}</span>
                : <button onClick={() => claim(i.id)}>Je l'offre</button>}
            </div>
          </li>
        ))}
      </ul>
      {err && <p className="err">{err}</p>}
    </>
  )
}
