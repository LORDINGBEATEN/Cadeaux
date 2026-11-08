// Script du favori « + Ma P'tite Liste ». Il s'exécute dans la page du produit (dans le navigateur
// de l'utilisateur, donc sans blocage anti-robot), lit nom, prix et photo, puis ouvre l'appli.
// Cette fonction doit rester autonome : elle est convertie en texte pour devenir le favori.
export function grab(app: string) {
  const meta = (n: string) =>
    (document.querySelector(`meta[property="${n}"],meta[name="${n}"],meta[itemprop="${n}"]`) as HTMLMetaElement | null)?.content || ''
  const txt = (sel: string) => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim()
  const num = (raw: unknown): string => {
    const s = String(raw ?? '').replace(/[^\d.,]/g, '')
    if (!/\d/.test(s)) return ''
    const c = s.lastIndexOf(','), d = s.lastIndexOf('.')
    const n = c >= 0 && d >= 0 ? (c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''))
      : c >= 0 ? (/,\d{1,2}$/.test(s) && s.indexOf(',') === c ? s.replace(',', '.') : s.replace(/,/g, ''))
      : (s.match(/\./g) || []).length > 1 ? s.replace(/\./g, '') : s
    const v = Math.round(parseFloat(n) * 100) / 100
    return isFinite(v) && v > 0 && v < 1e7 ? String(v) : ''
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const findProduct = (n: any, depth = 0): any => {
    if (!n || typeof n !== 'object' || depth > 6) return null
    if (Array.isArray(n)) { for (const x of n) { const p = findProduct(x, depth + 1); if (p) return p } return null }
    const types = ([] as unknown[]).concat(n['@type'] || [])
    if (types.includes('Product') || types.includes('ProductGroup')) return n
    return findProduct(n['@graph'], depth + 1) || findProduct(n.mainEntity, depth + 1) || findProduct(n.hasVariant, depth + 1)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let product: any = null
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    if (product) return
    try { product = findProduct(JSON.parse(s.textContent || '')) } catch { /* JSON-LD invalide */ }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstOffer = (o: any, depth = 0): any => (!o || depth > 3 ? null : Array.isArray(o) ? firstOffer(o[0], depth + 1) : o.offers ? firstOffer(o.offers, depth + 1) || o : o)
  const offer = firstOffer(product && product.offers)

  const title = ((product && product.name) || txt('#productTitle') || meta('og:title') || document.title || '').toString().trim().slice(0, 200)
  const amazonPrice = txt('.apex-pricetopay-value .a-offscreen') || txt('#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen') || txt('.a-price:not(.a-text-price) .a-offscreen')
  // Dernier recours : un élément « prix » visible dans la page (on ignore les anciens prix barrés).
  const domPrice = (): string => {
    if (amazonPrice) return ''
    const bad = /old|was|strike|cross|before|ancien|barr|unit|per-/i
    const els = Array.from(document.querySelectorAll('[itemprop="price"],[data-price],[class*="price" i],[class*="prix" i]'))
    for (const el of els) {
      if (bad.test(String(el.className || ''))) continue
      const raw = el.getAttribute('content') || el.getAttribute('data-price') || el.textContent || ''
      if (raw.length <= 40 && num(raw)) return raw
    }
    return ''
  }
  const shownPrice = amazonPrice || domPrice()
  const price = num(offer && (offer.price || offer.lowPrice || (offer.priceSpecification && offer.priceSpecification.price))) ||
    num(meta('product:price:amount') || meta('og:price:amount') || meta('price')) || num(shownPrice)
  let cur = String((offer && offer.priceCurrency) || meta('product:price:currency') || meta('og:price:currency') || meta('priceCurrency') || '').toUpperCase()
  if (!/^[A-Z]{3}$/.test(cur)) cur = shownPrice.includes('€') ? 'EUR' : shownPrice.includes('£') ? 'GBP' : shownPrice.includes('$') ? 'USD' : ''

  const landing = document.querySelector('#landingImage') as HTMLImageElement | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let img: any = product && product.image
  if (Array.isArray(img)) img = img[0]
  if (img && typeof img === 'object') img = img.url || img.contentUrl
  img = img || meta('og:image:secure_url') || meta('og:image') || meta('twitter:image') ||
    (landing && (landing.getAttribute('data-old-hires') || landing.src)) || ''
  let image = ''
  try { image = img ? new URL(String(img), location.href).href.replace(/^http:/, 'https:') : '' } catch { /* ignoré */ }

  const p = new URLSearchParams()
  p.set('u', location.href.split('#')[0])
  if (title) p.set('t', title)
  if (price) p.set('p', price)
  if (price && cur) p.set('c', cur)
  if (image && image.length < 1500) p.set('i', image)
  window.open(app + '/ajouter?' + p.toString(), '_blank')
}

// Un favori est une seule ligne : on encode le script (le navigateur le décode à l'exécution).
export const bookmarkletCode = (app: string) =>
  'javascript:' + encodeURIComponent(`(${grab.toString()})(${JSON.stringify(app)});void 0`)
