// Fonction serveur Vercel : relaie une photo de produit quand le navigateur ne peut pas la charger
// lui-même (site qui bloque l'affichage depuis un autre site). Images uniquement, protégée contre le SSRF.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 6_000_000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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


function fail(res: ServerResponse, status: number) {
  res.statusCode = status
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.end()
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let url: URL
  try { url = new URL(new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? '') } catch { return fail(res, 400) }
  try {
    for (let hop = 0; hop < 4; hop++) {
      await assertPublic(url)
      const r = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', Referer: url.origin + '/' },
      })
      const loc = r.headers.get('location')
      if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url); continue }
      if (!r.ok) return fail(res, 404)
      const type = r.headers.get('content-type') ?? ''
      if (!/^image\//i.test(type)) return fail(res, 404)
      const chunks: Uint8Array[] = []
      let size = 0
      const reader = r.body!.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > MAX_BYTES) { reader.cancel().catch(() => {}); return fail(res, 404) }
        chunks.push(value)
      }
      res.statusCode = 200
      res.setHeader('Content-Type', type)
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      return res.end(Buffer.concat(chunks))
    }
    fail(res, 404)
  } catch {
    fail(res, 404)
  }
}
