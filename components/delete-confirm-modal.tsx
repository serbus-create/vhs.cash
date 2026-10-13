'use client'

import { useEffect, useState } from 'react'

export default function DeleteConfirmModal({
  title,
  description,
  confirmWord = 'SMAZAT',
  pdfHref,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmWord?: string
  pdfHref?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = value.trim() === confirmWord

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const submit = async () => {
    if (!matches || busy) return
    setBusy(true)
    await onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4 max-h-[90vh] max-h-[90dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-[#111111]">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
        {pdfHref && (
          <a href={pdfHref} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-[#F04E12] hover:underline">
            Stáhnout PDF
          </a>
        )}
        <div>
          <label htmlFor="delete-confirm-input" className="block text-sm font-medium text-[#111111] mb-1">
            Pro potvrzení napište {confirmWord}
          </label>
          <input
            id="delete-confirm-input"
            autoFocus
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-[#111111] hover:bg-gray-50">
            Zrušit
          </button>
          <button
            onClick={submit}
            disabled={!matches || busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Smazat
          </button>
        </div>
      </div>
    </div>
  )
}
