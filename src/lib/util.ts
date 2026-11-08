export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
export const itemLabel = (i: { title: string | null; url: string }) => i.title?.trim() || hostOf(i.url)
export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

const TOKEN_KEY = 'ptit-canif-guest-token'
const NAME_KEY = 'ptit-canif-guest-name'
export function guestToken() {
  let t = localStorage.getItem(TOKEN_KEY)
  if (!t) { t = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, t) }
  return t
}
export const getGuestName = () => localStorage.getItem(NAME_KEY) ?? ''
export const setGuestName = (n: string) => localStorage.setItem(NAME_KEY, n)

export function fmtPrice(price: number | null, currency: string | null) {
  if (price === null || price === undefined) return ''
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(price)
  } catch {
    return `${price} ${currency ?? ''}`.trim()
  }
}
