import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { firstName } from './util'

const EVT = 'ptite-profile-name'

// Prénom affiché : profil, sinon métadonnées du compte, sinon début de l'e-mail.
export function useProfileName(user: User) {
  const [stored, setStored] = useState('')
  useEffect(() => {
    let on = true
    supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
      .then(r => { if (on) setStored(r.data?.name ?? '') })
    const h = (e: Event) => setStored((e as CustomEvent<string>).detail)
    window.addEventListener(EVT, h)
    return () => { on = false; window.removeEventListener(EVT, h) }
  }, [user.id])
  const raw = stored || (user.user_metadata?.name as string | undefined) || (user.email ?? '').split('@')[0].split(/[._+-]/)[0]
  return {
    name: firstName(raw),
    announce: (n: string) => window.dispatchEvent(new CustomEvent(EVT, { detail: n })),
  }
}
