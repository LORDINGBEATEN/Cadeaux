import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Thumb from '../lib/Thumb'
import Modal from '../lib/Modal'
import { countdown, firstName, fmtDate, fmtPrice, getGuestName, guestToken, hostOf, itemLabel, setGuestName } from '../lib/util'

type Item = { id: string; title: string | null; url: string | null; note: string | null; price: number | null; currency: string | null; image_url: string | null; claimed: boolean; claimed_by: string | null; anonymous: boolean; mine: boolean
  group_gift: boolean; contrib_total: number; contrib_count: number; participant: boolean; contributors: { name: string; amount: number; buyer: boolean; mine: boolean }[] | null }
type Shared = { title: string; occasion: string; event_date: string | null; owner_name: string | null; is_owner: boolean; items: Item[] }

export default function SharedList() {
  const { code } = useParams()
  const [data, setData] = useState<Shared | null | undefined>(undefined)
  const [name, setName] = useState(getGuestName())
  const [err, setErr] = useState('')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [contributing, setContributing] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [buyer, setBuyer] = useState(false)
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
  function openContribute(i: Item) {
    const mine = i.contributors?.find(c => c.mine)
    const remaining = Math.max((i.price ?? 0) - Number(i.contrib_total), 0) + (mine?.amount ?? 0)
    setAmount(String(mine?.amount ?? remaining)); setBuyer(!!mine?.buyer); setErr(''); setContributing(i.id)
  }
  async function contribute(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const guest = name.trim()
    const amt = Number(amount.replace(',', '.'))
    if (!guest) return setErr('Indiquez votre prénom.')
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Indiquez un montant.')
    setGuestName(guest)
    const { error } = await supabase.rpc('contribute', { code, item: contributing, guest, token: guestToken(), p_amount: amt, buyer })
    if (error) return setErr(error.message)
    setContributing(null); load()
  }
  async function withdraw(item: string) {
    if (!confirm('Retirer votre participation ?')) return
    await supabase.rpc('withdraw_contribution', { item, token: guestToken() }); load()
  }
  async function setBuyerFor(item: string, on: boolean) {
    const { error } = await supabase.rpc('set_buyer', { item, token: guestToken(), on_: on })
    if (error) setErr(error.message)
    load()
  }
  const isComplete = (i: Item) => i.group_gift && Number(i.contrib_count) > 0 && Number(i.contrib_total) >= (i.price ?? 0)
  function groupBlock(i: Item) {
    const price = i.price ?? 0, total = Number(i.contrib_total), n = Number(i.contrib_count)
    const complete = isComplete(i)
    const mine = i.contributors?.find(c => c.mine)
    return (
      <div className="group">
        <div className="pbar"><div style={{ width: `${Math.min(100, price ? (total / price) * 100 : 0)}%` }} /></div>
        <div className="between small" style={{ marginTop: 4 }}>
          <span className="muted">{fmtPrice(total, i.currency)} réunis sur {fmtPrice(price, i.currency)} · {n} participant{n > 1 ? 's' : ''}</span>
          <strong className={complete ? 'ok' : 'miss'}>{complete ? 'Complet' : `Il manque ${fmtPrice(price - total, i.currency)}`}</strong>
        </div>
        {i.contributors === null && n > 0 && <div className="muted small">Les noms sont visibles après avoir participé.</div>}
        {i.contributors && i.contributors.length > 0 && (
          <ul className="contribs">
            {i.contributors.map((c, k) => (
              <li key={k}><span className="av">{c.name[0]?.toUpperCase()}</span><span style={{ flex: 1 }}>{c.name}{c.mine ? ' (vous)' : ''}</span>
                {c.buyer && <span className="badge mine">Acheteur</span>}<b>{fmtPrice(c.amount, i.currency)}</b></li>
            ))}
          </ul>
        )}
        {!data!.is_owner && (
          <div className="btnrow" style={{ marginTop: 8 }}>
            {mine ? <>
              {!complete || mine ? <button type="button" className="secondary" onClick={() => openContribute(i)}>Modifier ma part</button> : null}
              <button type="button" className="secondary" onClick={() => setBuyerFor(i.id, !mine.buyer)}>{mine.buyer ? 'Ne plus m’occuper de l’achat' : 'Je m’occupe de l’achat'}</button>
              <button type="button" className="link" onClick={() => withdraw(i.id)}>Retirer ma participation</button>
            </> : !complete && <button type="button" onClick={() => openContribute(i)}>Participer</button>}
          </div>
        )}
      </div>
    )
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
          <li key={i.id} className={`${i.claimed || isComplete(i) ? 'taken' : ''}${i.group_gift && !i.claimed && Number(i.contrib_count) > 0 ? ' has-group' : ''}`}>
            {(i.claimed || isComplete(i)) && <span className="ribbon"><i>{i.claimed ? 'Réservé' : 'Complet'}</i></span>}
            <Thumb label={itemLabel(i)} image={i.image_url} />
            <div>
              {i.url ? <a href={i.url} target="_blank" rel="noreferrer noopener"><strong>{itemLabel(i)}</strong></a> : <strong>{itemLabel(i)}</strong>}
              <div className="muted small">{[i.price !== null ? fmtPrice(i.price, i.currency) : null, i.url ? hostOf(i.url) : null, i.note].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="actions">
              {data.is_owner ? (i.claimed ? <span className="badge">Réservé par {i.claimed_by}{i.anonymous ? ' (nom caché aux invités)' : ''}</span> : null)
                : i.mine ? <><span className="badge mine">Réservé par vous{i.anonymous ? ' (nom caché)' : ''}</span><button className="link" onClick={() => unclaim(i.id)}>Annuler</button></>
                : i.claimed ? <span className="badge">{i.claimed_by ? `Réservé par ${i.claimed_by}` : 'Réservé'}</span>
                : i.group_gift ? (Number(i.contrib_count) === 0
                    ? <><button onClick={() => { setErr(''); setClaiming(i.id) }}>Je l'offre</button><button className="secondary" onClick={() => openContribute(i)}>Participer</button></>
                    : null)
                : <button onClick={() => { setErr(''); setClaiming(i.id) }}>Je l'offre</button>}
            </div>
            {i.group_gift && !i.claimed && Number(i.contrib_count) > 0 && groupBlock(i)}
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
      {contributing && (() => {
        const it = data.items.find(x => x.id === contributing)!
        const mineAmt = it.contributors?.find(c => c.mine)?.amount ?? 0
        const remaining = Math.max((it.price ?? 0) - Number(it.contrib_total), 0) + mineAmt
        return (
          <Modal title="Participer au cadeau" onClose={() => setContributing(null)}>
            <form onSubmit={contribute}>
              <p className="muted small" style={{ marginTop: 0 }}>« {itemLabel(it)} » · il manque {fmtPrice(remaining, it.currency)}. Les autres participants verront votre prénom et votre part.</p>
              <label className="small">Votre prénom</label>
              <input required autoFocus maxLength={60} placeholder="Ex : Marie" value={name} onChange={e => setName(e.target.value)} />
              <label className="small">Votre participation ({it.currency || 'EUR'})</label>
              <input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
              <p className="muted small" style={{ margin: '2px 0 0' }}>Maximum {fmtPrice(remaining, it.currency)}. Le règlement se fait entre participants, hors de l'application.</p>
              <label className="check"><input type="checkbox" checked={buyer} onChange={e => setBuyer(e.target.checked)} /><span>Je m'occupe de l'achat</span></label>
              {err && <p className="err">{err}</p>}
              <div className="btnrow" style={{ marginTop: 12 }}>
                <button>Participer</button>
                <button type="button" className="secondary" onClick={() => setContributing(null)}>Annuler</button>
              </div>
            </form>
          </Modal>
        )
      })()}
      {!claiming && err && <p className="err">{err}</p>}
    </>
  )
}
