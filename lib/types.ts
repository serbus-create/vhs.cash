export interface CompanyProfile {
  id: string
  user_id: string
  name: string
  ico: string | null
  dic: string | null
  address: string | null
  city: string | null
  zip: string | null
  email: string | null
  phone: string | null
  web: string | null
  bank_account: string | null
  iban: string | null
  swift: string | null
  is_default: boolean
  vat_payer: boolean
  profile_type: 'sro' | 'osvč'
  spisova_znacka: string | null
  represented_by?: string | null
  invoice_number_series: number
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  ico: string | null
  dic: string | null
  address: string | null
  city: string | null
  zip: string | null
  email: string | null
  phone: string | null
  country: string | null
  entity_type?: 'firma' | 'osvc' | null
  represented_by?: string | null
  contact_name?: string | null
  contact_email?: string | null
  created_at: string
}

export type DocumentType = 'faktura' | 'nabidka' | 'objednavka' | 'podminky'
export type DocumentStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'confirmed' | 'expired'

export interface Document {
  id: string
  user_id: string
  client_id: string | null
  company_profile_id: string | null
  type: DocumentType
  number: string
  subject: string | null
  issue_date: string
  due_date: string | null
  variable_symbol: string | null
  tax_date: string | null
  status: DocumentStatus
  total_without_vat: number
  total_with_vat: number
  currency: string
  exchange_rate?: number | null
  amount_czk?: number | null
  paid_amount?: number | null
  discount_percent: number
  discount_note: string | null
  contact_name?: string | null
  contact_email?: string | null
  terms_template_id?: string | null
  terms_values?: Record<string, string> | null
  terms_snapshot?: string | null
  terms_hash?: string | null
  terms_sent_at?: string | null
  terms_expires_at?: string | null
  confirm_token_hash?: string | null
  confirmed_at?: string | null
  confirmed_by_name?: string | null
  confirmed_by_role?: string | null
  confirmed_by_email?: string | null
  confirmed_by_phone?: string | null
  confirmed_ip?: string | null
  created_at: string
  clients?: Client | null
}

export interface TermsTemplate {
  id: string
  workspace_id: string
  version: number
  body: string
  defaults: Record<string, string>
  is_active: boolean
  created_at: string
}

export interface DocumentItem {
  id: string
  document_id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  discount_percent: number
  discount_note: string | null
}

export interface DocumentWithItems extends Document {
  document_items: DocumentItem[]
}
