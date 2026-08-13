'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)

    const errorDesc = params.get('error_description')
    if (errorDesc) {
      setErrorMsg(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
      return
    }

    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')

    if (!access_token || !refresh_token) {
      setErrorMsg('Pozvánkový odkaz je neplatný nebo neobsahuje přístupové tokeny. Požádejte o novou pozvánku.')
      return
    }

    const supabase = createClient()

    supabase.auth.setSession({ access_token, refresh_token }).then(async ({ error }) => {
      if (error) {
        const isExpired =
          error.message.toLowerCase().includes('expired') ||
          error.message.toLowerCase().includes('invalid')
        setErrorMsg(
          isExpired
            ? 'Platnost tohoto odkazu vypršela nebo byl již použit. Požádejte o novou pozvánku.'
            : `Chyba při ověření: ${error.message}`
        )
        return
      }

      if (type === 'invite') {
        try {
          await fetch('/api/auth/accept-invite', { method: 'POST' })
        } catch {
          // joined_at zůstane NULL — admin to uvidí v dashboardu, není to blocker
        }
      }

      router.replace('/dashboard')
    })
  }, [router])

  if (!errorMsg) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white text-sm">
          <svg className="w-5 h-5 animate-spin text-[#F04E12]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Ověřuji přístup…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(#F04E12 1px, transparent 1px), linear-gradient(90deg, #F04E12 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#111111] mb-2">Pozvánku nelze použít</h1>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <a
            href="/login"
            className="inline-block bg-[#F04E12] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
          >
            Zpět na přihlášení
          </a>
        </div>
      </div>
    </div>
  )
}
