import { useState } from 'react'
import { tile } from './util'

// Photo du produit. Si elle ne charge pas directement, on la relaie par le serveur ; si elle ne charge toujours
// pas (ou s'il n'y en a pas), image par défaut : un cadeau.
export default function Thumb({ label, image, fill, onBroken }: { label: string; image: string | null; fill?: boolean; onBroken?: () => void }) {
  const [stage, setStage] = useState(0) // 0 direct, 1 via le serveur, 2 image par défaut
  void label; void tile
  if (image && stage < 2)
    return (
      <img
        className={`tile thumb${fill ? ' fill' : ''}`}
        src={stage === 0 ? image : `/api/img?url=${encodeURIComponent(image)}`}
        alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={() => { if (stage === 0) setStage(1); else { setStage(2); onBroken?.() } }}
      />
    )
  return (
    <div className={`tile tile-default${fill ? ' fill' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </svg>
    </div>
  )
}
