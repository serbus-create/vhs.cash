export const formatCurrency = (amount: number, currency = 'CZK') =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(amount)

export const formatDate = (date: string | null | undefined) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  issued: 'Vydáno',
  sent: 'Odesláno',
  paid: 'Zaplaceno',
  overdue: 'Po splatnosti',
  cancelled: 'Stornováno',
}

export const TYPE_LABELS: Record<string, string> = {
  faktura: 'Faktura',
  nabidka: 'Cenová nabídka',
  objednavka: 'Objednávka',
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  issued: 'bg-gray-200 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-[#FEE9E2] text-[#F04E12]',
  cancelled: 'bg-red-100 text-red-700',
}

const FINAL_STATUSES = new Set(['paid', 'cancelled', 'storno'])

export function getDisplayStatus(status: string, dueDate: string | null | undefined): string {
  if (!FINAL_STATUSES.has(status) && dueDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(dueDate) < today) return 'overdue'
  }
  return status
}

export const TYPE_PREFIX: Record<string, string> = {
  faktura: 'FA',
  nabidka: 'CN',
  objednavka: 'OB',
}

export interface LineItemForCalc {
  quantity: number
  unitPrice: number
  vatRate: number
  discountPercent: number
}

export function calcDocumentTotals(
  items: LineItemForCalc[],
  docDiscountPercent: number,
): {
  subtotalBeforeDocDiscount: number
  totalWithoutVat: number
  vatAmount: number
  totalWithVat: number
} {
  const docFactor = 1 - docDiscountPercent / 100
  let subtotalBeforeDocDiscount = 0
  let totalWithoutVat = 0
  let vatAmount = 0

  for (const item of items) {
    const baseAfterItemDiscount = item.quantity * item.unitPrice * (1 - item.discountPercent / 100)
    subtotalBeforeDocDiscount += baseAfterItemDiscount
    const baseAfterAllDiscounts = baseAfterItemDiscount * docFactor
    totalWithoutVat += baseAfterAllDiscounts
    vatAmount += baseAfterAllDiscounts * (item.vatRate / 100)
  }

  return {
    subtotalBeforeDocDiscount,
    totalWithoutVat,
    vatAmount,
    totalWithVat: totalWithoutVat + vatAmount,
  }
}
