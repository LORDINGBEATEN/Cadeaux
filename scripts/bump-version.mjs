// Incrémente le numéro de build dans version.json (à lancer avant chaque commit : npm run bump).
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../version.json', import.meta.url)
const v = JSON.parse(readFileSync(file, 'utf8'))
v.build += 1
writeFileSync(file, JSON.stringify(v, null, 2) + '\n')
console.log(`Version : ${v.major}.${v.minor}.${v.build}`)
