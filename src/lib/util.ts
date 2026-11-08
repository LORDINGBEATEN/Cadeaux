export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
export const itemLabel = (i: { title: string | null; url: string | null }) => i.title?.trim() || (i.url ? hostOf(i.url) : 'Idée')
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

export function tile(label: string) {
  let h = 0
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) % 4
  const letter = label.trim().charAt(0).toUpperCase() || '🎁'
  return { cls: `tile tile-${h}`, letter }
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

export function countdown(date: string | null): string | null {
  const days = daysUntil(date)
  if (days === null || days < 0) return null
  if (days === 0) return "c'est aujourd'hui !"
  return days === 1 ? "plus qu'un jour" : `plus que ${days} jours`
}

export function inDays(days: number): string {
  return days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`
}

// Prénom à afficher : premier mot du nom (« Benoit Legrand » → « Benoit », « Marie-Claire » reste entier).
export function firstName(full: string | null | undefined): string {
  const w = (full ?? '').trim().split(/\s+/)[0] ?? ''
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : ''
}
