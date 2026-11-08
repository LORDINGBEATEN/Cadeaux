import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type G = { id: string; name: string; invite_code: string }

export default function Home() {
  const [groups, setGroups] = useState<G[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()

  const load = () => supabase.from('groups').select('*').order('name').then(({ data }) => setGroups(data ?? []))
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.rpc('create_group', { group_name: name })
    if (error) return setErr(error.message)
    nav(`/g/${data}`)
  }
  async function join(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.rpc('join_group', { code: code.trim() })
    if (error) return setErr(error.message)
    nav(`/g/${data}`)
  }

  return (
    <>
      <h2>Mes groupes</h2>
      {groups.length === 0 && <p className="muted">Créez un groupe (famille, amis…) ou rejoignez-en un avec un code.</p>}
      <ul className="list">
        {groups.map(g => <li key={g.id}><Link to={`/g/${g.id}`}>👪 {g.name}</Link></li>)}
      </ul>
      <div className="grid">
        <form onSubmit={create} className="card">
          <h3>Créer un groupe</h3>
          <input required placeholder="Ex : Famille Dupont" value={name} onChange={e => setName(e.target.value)} />
          <button>Créer</button>
        </form>
        <form onSubmit={join} className="card">
          <h3>Rejoindre un groupe</h3>
          <input required placeholder="Code d'invitation" value={code} onChange={e => setCode(e.target.value)} />
          <button>Rejoindre</button>
        </form>
      </div>
      {err && <p className="err">{err}</p>}
    </>
  )
}
