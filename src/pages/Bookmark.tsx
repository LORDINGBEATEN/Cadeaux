import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookmarkletCode } from '../lib/bookmarklet'

export default function Bookmark() {
  const ref = useRef<HTMLAnchorElement>(null)
  const code = bookmarkletCode(window.location.origin)
  const [copied, setCopied] = useState(false)
  // React refuse d'écrire une adresse javascript: dans href : on la pose directement sur l'élément.
  useEffect(() => { ref.current?.setAttribute('href', code) }, [code])

  return (
    <>
      <p><Link to="/">← Mes listes</Link></p>
      <h2>Le bouton « + Ma P'tite Liste »</h2>
      <p className="muted">Ajoutez un produit en un clic depuis n'importe quelle boutique, avec son nom, son prix et sa photo. Idéal pour Amazon et les sites qui bloquent la lecture automatique.</p>

      <div className="card share center">
        <p style={{ marginTop: 0 }}><strong>Glissez ce bouton dans votre barre de favoris</strong></p>
        <a ref={ref} className="bm-btn" onClick={e => { e.preventDefault(); alert('Glissez ce bouton dans la barre de favoris au lieu de cliquer dessus.') }}>+ Ma P'tite Liste</a>
        <p className="muted small">Barre de favoris cachée ? Chrome, Edge, Firefox : <code>Ctrl+Maj+B</code> (Mac : <code>Cmd+Maj+B</code>).</p>
      </div>

      <h3>Comment l'utiliser</h3>
      <ol>
        <li>Ouvrez la page du produit dans votre boutique.</li>
        <li>Cliquez sur « + Ma P'tite Liste » dans la barre de favoris.</li>
        <li>Vérifiez la fiche préremplie, choisissez la liste, puis cliquez sur Ajouter.</li>
      </ol>
      <p className="muted small">Fonctionne sur ordinateur. Quelques sites très stricts bloquent ce type de bouton : collez alors le lien dans la liste, comme d'habitude.</p>

      <h3>Le glisser-déposer ne marche pas ?</h3>
      <p className="muted small">Créez un favori à la main (nom : « + Ma P'tite Liste ») et collez ce code à la place de l'adresse :</p>
      <button type="button" className="secondary" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
        {copied ? 'Code copié ✓' : 'Copier le code du bouton'}
      </button>
    </>
  )
}
