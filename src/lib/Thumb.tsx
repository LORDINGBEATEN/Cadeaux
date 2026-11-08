import { useState } from 'react'
import { tile } from './util'

// Photo du produit ; si elle manque ou ne charge pas, pastille colorée avec l'initiale.
export default function Thumb({ label, image, fill }: { label: string; image: string | null; fill?: boolean }) {
  const [bad, setBad] = useState(false)
  if (image && !bad)
    return <img className={`tile thumb${fill ? ' fill' : ''}`} src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
  const t = tile(label)
  return <div className={t.cls + (fill ? ' fill' : '')}>{t.letter}</div>
}
