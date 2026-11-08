import { useEffect, useRef } from 'react'
import { bookmarkletCode } from './bookmarklet'

export const bookmarkletLabel = '+ Coup de cœur'

// Bouton à glisser dans la barre de favoris. React refuse d'écrire une adresse javascript:
// dans href : on la pose directement sur l'élément.
export default function BookmarkletButton() {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => { ref.current?.setAttribute('href', bookmarkletCode(window.location.origin)) }, [])
  return (
    <a ref={ref} className="bm-btn" draggable onClick={e => { e.preventDefault(); alert('Glissez ce bouton dans la barre de favoris au lieu de cliquer dessus.') }}>
      {bookmarkletLabel}
    </a>
  )
}
