'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nesprávný email nebo heslo.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(#F04E12 1px, transparent 1px), linear-gradient(90deg, #F04E12 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-[#F04E12] rounded-xl flex items-center justify-center shadow-2xl">
            <span className="text-white font-bold text-xl tracking-tight">vhs.</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Orange top stripe */}
          <div className="h-1 bg-[#F04E12]" />

          <div className="p-8">
            <h1 className="text-2xl font-bold text-[#111111] mb-1">VHS Cash</h1>
            <p className="text-gray-500 text-sm mb-8">Přihlaste se ke svému účtu</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] focus:border-transparent transition-shadow"
                  placeholder="vas@email.cz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Heslo</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F04E12] text-white py-3 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Přihlašování…' : 'Přihlásit se'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          vhs. creative agency — interní fakturační systém
        </p>
      </div>
    </div>
  )
}
