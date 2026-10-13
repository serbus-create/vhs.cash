'use client'

import { isPriced, type CenaRezim, type OrderTermsState } from '@/lib/order-terms'

const RADIOS: { value: CenaRezim; label: string }[] = [
  { value: 'pevna', label: 'Pevná cena' },
  { value: 'hodinova', label: 'Hodinová sazba' },
  { value: 'bez_ceny', label: 'Bez ceny' },
]

const inputCls = (disabled?: boolean) =>
  `w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`

export default function OrderTermsSection({
  value,
  onChange,
  hasPricedData,
  disabled,
}: {
  value: OrderTermsState
  onChange: (next: OrderTermsState) => void
  /** formulář obsahuje ceny/slevy, které by se při přechodu na hodinovou sazbu / bez ceny vynulovaly */
  hasPricedData: boolean
  disabled?: boolean
}) {
  const set = (patch: Partial<OrderTermsState>) => onChange({ ...value, ...patch })

  const changeRezim = (r: CenaRezim) => {
    if (r === value.cenaRezim) return
    if (isPriced(value.cenaRezim) && !isPriced(r) && hasPricedData) {
      const ok = window.confirm(
        'Při uložení se ceny položek, slevy a součty dokumentu vynulují. Dokud neuložíte, můžete se vrátit k pevné ceně a hodnoty zůstanou. Pokračovat?'
      )
      if (!ok) return
    }
    // dokud uživatel zálohu neměnil, hodinová sazba je výchozí bez zálohy; jinak se záloha nemění
    set({ cenaRezim: r, ...(value.zalohaTouched ? {} : { bezZalohy: r === 'hodinova' }) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-[#111111] mb-4 uppercase tracking-wide">Kontakt a cena podle podmínek</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Kontaktní osoba klienta</label>
          <input
            value={value.contactName}
            onChange={(e) => set({ contactName: e.target.value })}
            disabled={disabled}
            placeholder="Jméno a příjmení"
            className={inputCls(disabled)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail kontaktní osoby</label>
          <input
            type="email"
            value={value.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
            disabled={disabled}
            placeholder="jmeno@firma.cz"
            className={inputCls(disabled)}
          />
        </div>

        <div className="sm:col-span-2">
          <span className="block text-xs font-medium text-gray-600 mb-1.5">Způsob ceny</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {RADIOS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm text-[#111111]">
                <input
                  type="radio"
                  name="cena_rezim"
                  checked={value.cenaRezim === r.value}
                  onChange={() => changeRezim(r.value)}
                  disabled={disabled}
                  className="accent-[#F04E12]"
                />
                {r.label}
              </label>
            ))}
          </div>
          {!isPriced(value.cenaRezim) && (
            <p className="mt-2 text-xs text-gray-500">
              Položky slouží jako popis služeb. Při uložení se ceny položek, slevy a součty dokumentu nastaví na 0.
            </p>
          )}
        </div>

        {value.cenaRezim === 'hodinova' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Hodinová sazba
              <span className="ml-1.5 text-gray-400 font-normal normal-case">Kč bez DPH, povinná při vytvoření</span>
            </label>
            <input
              inputMode="decimal"
              value={value.hodinovaSazba}
              onChange={(e) => set({ hodinovaSazba: e.target.value })}
              disabled={disabled}
              placeholder="900"
              className={inputCls(disabled)}
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {isPriced(value.cenaRezim)
              ? 'Záloha, % z ceny (částka se dopočítá z položek)'
              : 'Záloha, % z výsledné ceny'}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number" min="0" max="100" step="1"
              value={value.zalohaProcent}
              onChange={(e) => set({ zalohaProcent: e.target.value, zalohaTouched: true })}
              disabled={disabled || value.bezZalohy}
              className={inputCls(disabled || value.bezZalohy)}
            />
            <label className="flex items-center gap-2 text-sm text-[#111111] whitespace-nowrap">
              <input
                type="checkbox"
                checked={value.bezZalohy}
                onChange={(e) => set({ bezZalohy: e.target.checked, zalohaTouched: true })}
                disabled={disabled}
                className="accent-[#F04E12]"
              />
              Bez zálohy
            </label>
          </div>
        </div>

        {value.cenaRezim === 'hodinova' && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Orientační odhad
              <span className="ml-1.5 text-gray-400 font-normal normal-case">nepovinné</span>
            </label>
            <input
              value={value.odhadText}
              onChange={(e) => set({ odhadText: e.target.value })}
              disabled={disabled}
              placeholder="asi 10 hodin"
              className={inputCls(disabled)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
