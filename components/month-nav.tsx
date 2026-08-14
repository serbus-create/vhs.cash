import { monthLabel } from '@/lib/utils'

export interface NavDate {
  year: number
  month: number
}

export function prevMonth(d: NavDate): NavDate {
  const dt = new Date(d.year, d.month - 2)
  return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
}

export function nextMonth(d: NavDate): NavDate {
  const dt = new Date(d.year, d.month)
  return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
}

export default function MonthNav({
  navDate,
  onPrev,
  onNext,
}: {
  navDate: NavDate
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-1">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#111111] transition-colors"
        aria-label="Předchozí měsíc"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="min-w-[160px] text-center text-sm font-semibold text-[#111111] select-none px-1">
        {monthLabel(navDate.year, navDate.month)}
      </span>
      <button
        onClick={onNext}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#111111] transition-colors"
        aria-label="Následující měsíc"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
