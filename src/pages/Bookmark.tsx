import { useState } from 'react'
import { Link } from 'react-router-dom'
import { bookmarkletCode } from '../lib/bookmarklet'
import BookmarkletButton, { bookmarkletLabel } from '../lib/BookmarkletButton'

export default function Bookmark() {
  const [copied, setCopied] = useState(false)
  const code = bookmarkletCode(window.location.origin)
  return (
    <>
      <p><Link to="/">← Mes listes</Link></p>
      <h2>Coup de cœur</h2>
      <p className="muted">Vous repérez un produit dans une boutique ? Ajoutez-le à une liste en un clic, avec son nom, son prix et sa photo. Idéal pour Amazon et les sites qui bloquent la lecture automatique.</p>

      <div className="card share center">
        <p style={{ marginTop: 0 }}><strong>Glissez ce bouton dans votre barre de favoris</strong></p>
        <BookmarkletButton />
        <p className="muted small">Barre de favoris cachée ? Chrome, Edge, Firefox : <code>Ctrl+Maj+B</code> (Mac : <code>Cmd+Maj+B</code>).</p>
      </div>

      <h3>Comment l'utiliser</h3>
      <ol>
        <li>Ouvrez la page du produit dans votre boutique.</li>
        <li>Cliquez sur « {bookmarkletLabel} » dans la barre de favoris.</li>
        <li>Vérifiez la fiche préremplie, choisissez la liste, puis cliquez sur Ajouter.</li>
      </ol>
      <p className="muted small">Fonctionne sur ordinateur. Quelques sites très stricts bloquent ce type de bouton : collez alors le lien dans la liste, comme d'habitude.</p>

      <h3>Le glisser-déposer ne marche pas ?</h3>
      <p className="muted small">Créez un favori à la main (nom : « {bookmarkletLabel} ») et collez ce code à la place de l'adresse :</p>
      <button type="button" className="secondary" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
        {copied ? 'Code copié ✓' : 'Copier le code du bouton'}
      </button>
    </>
  )
}
