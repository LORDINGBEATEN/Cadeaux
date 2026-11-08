export const VERSION = `v${__APP_VERSION__}`

// Logo + nom de l'application, avec le numéro de version dessous.
export default function Brand() {
  return (
    <>
      <span className="mark">🎁</span>
      <span className="brandtext"><span>Ma P'tite Liste</span><small className="ver">{VERSION}</small></span>
    </>
  )
}
