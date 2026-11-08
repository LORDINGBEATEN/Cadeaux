// Fonction serveur Vercel : lit le nom et le prix d'un produit à partir de l'URL d'une page web.
// Réservée aux utilisateurs connectés (évite d'en faire un proxy ouvert) et protégée contre le SSRF.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 2_500_000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export type Preview = { title: string | null; price: number | null; currency: string | null; error?: string }

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7))
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const l = ip.toLowerCase()
  return l === '::1' || l === '::' || /^f[cd]/.test(l) || /^fe[89ab]/.test(l)
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocole refusé')
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('port refusé')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('hôte refusé')
  if (isIP(host)) { if (isPrivateIp(host)) throw new Error('adresse refusée'); return }
  const addrs = await lookup(host, { all: true })
  if (addrs.length === 0 || addrs.some(a => isPrivateIp(a.address))) throw new Error('adresse refusée')
}

async function fetchHtml(start: URL): Promise<string> {
  let url = start
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url)
    const r = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5' },
    })
    const loc = r.headers.get('location')
    if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url); continue }
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const type = r.headers.get('content-type') ?? ''
    if (!/html/i.test(type)) throw new Error('pas une page web')
    const chunks: Uint8Array[] = []
    let size = 0
    const reader = r.body!.getReader()
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value); size += value.length
    }
    reader.cancel().catch(() => {})
    const buf = Buffer.concat(chunks)
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString('latin1'))?.[1] ?? 'utf-8'
    try { return new TextDecoder(charset).decode(buf) } catch { return buf.toString('utf8') }
  }
  throw new Error('trop de redirections')
}

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[e.toLowerCase()]
  })
}

function metas(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {}
    for (const a of m[0].matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3]
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase()
    if (key && attrs.content !== undefined && !(key in out)) out[key] = decode(attrs.content)
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any
function findProduct(node: Json, depth = 0): Json | null {
  if (!node || typeof node !== 'object' || depth > 6) return null
  if (Array.isArray(node)) { for (const n of node) { const p = findProduct(n, depth + 1); if (p) return p } return null }
  const types: unknown[] = [].concat(node['@type'] ?? [])
  if (types.includes('Product') || types.includes('ProductGroup')) return node
  return findProduct(node['@graph'], depth + 1) ?? findProduct(node.mainEntity, depth + 1) ?? findProduct(node.hasVariant, depth + 1)
}

function jsonLdProduct(html: string): Json | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const p = findProduct(JSON.parse(m[1].trim())); if (p) return p } catch { /* JSON-LD invalide : on ignore */ }
  }
  return null
}

function firstOffer(o: Json, depth = 0): Json | null {
  if (!o || depth > 3) return null
  if (Array.isArray(o)) return firstOffer(o[0], depth + 1)
  if (o.offers) return firstOffer(o.offers, depth + 1) ?? o
  return o
}

export function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.')
  let n: string
  if (c >= 0 && d >= 0) n = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (c >= 0) n = /,\d{1,2}$/.test(s) && s.indexOf(',') === c ? s.replace(',', '.') : s.replace(/,/g, '')
  else n = (s.match(/\./g) ?? []).length > 1 ? s.replace(/\./g, '') : s
  const v = Math.round(parseFloat(n) * 100) / 100
  return Number.isFinite(v) && v > 0 && v < 10_000_000 ? v : null
}

// Amazon n'utilise pas les données structurées standard : lecture de son balisage.
function amazon(html: string): { title: string | null; priceRaw: string | null } {
  const title = /id="productTitle"[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? null
  const priceRe = (cls: string) => new RegExp(`class="a-price(?![^"]*a-text-price)[^"]*${cls}[^"]*"[^>]*>\\s*<span class="a-offscreen">([^<]+)</span>`, 'i')
  const priceRaw = (priceRe('apex-pricetopay-value').exec(html) ?? priceRe('').exec(html))?.[1] ?? null
  return { title, priceRaw }
}

const symbolCurrency = (raw: string | null) => (!raw ? null : raw.includes('€') ? 'EUR' : raw.includes('£') ? 'GBP' : raw.includes('$') ? 'USD' : null)

export function extract(html: string): Preview {
  const m = metas(html)
  const product = jsonLdProduct(html)
  const offer = firstOffer(product?.offers)
  const spec = offer?.priceSpecification
  const clean = (t: unknown) => (typeof t === 'string' ? decode(t).replace(/\s+/g, ' ').trim().slice(0, 200) || null : null)
  const az = amazon(html)
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]

  const title = clean(product?.name) ?? clean(az.title) ?? clean(m['og:title']) ?? clean(m['twitter:title']) ?? clean(pageTitle)
  const price = parsePrice(offer?.price ?? offer?.lowPrice ?? spec?.price ?? (Array.isArray(spec) ? spec[0]?.price : undefined)) ??
    parsePrice(m['product:price:amount'] ?? m['og:price:amount'] ?? m['product:sale_price:amount'] ?? m['price']) ??
    parsePrice(az.priceRaw)
  const cur = offer?.priceCurrency ?? spec?.priceCurrency ?? m['product:price:currency'] ?? m['og:price:currency'] ?? m['pricecurrency'] ?? symbolCurrency(az.priceRaw)
  const currency = typeof cur === 'string' && /^[A-Za-z]{3}$/.test(cur.trim()) ? cur.trim().toUpperCase() : null
  return { title, price, currency: price !== null ? currency : null }
}

export async function lookupPreview(url: URL): Promise<Preview> {
  return extract(await fetchHtml(url))
}

async function isAuthed(authorization: string): Promise<boolean> {
  const base = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key || !/^Bearer\s+\S+/.test(authorization)) return false
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(5000) })
    return r.ok
  } catch { return false }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!(await isAuthed(req.headers.authorization ?? ''))) return send(res, 401, { error: 'Connexion requise' })
  let url: URL
  try { url = new URL(new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? '') } catch { return send(res, 400, { error: 'URL invalide' }) }
  try {
    send(res, 200, await lookupPreview(url))
  } catch (e) {
    // Site illisible ou qui bloque les robots : l'utilisateur saisira les infos à la main.
    send(res, 200, { title: null, price: null, currency: null, error: e instanceof Error ? e.message : 'erreur' } satisfies Preview)
  }
}
