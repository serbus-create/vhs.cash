import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTermsPdf } from '@/lib/pdf/generate-terms'
import type { PartyInput } from '@/lib/terms/parties'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vymyšlená ukázková data, žádné skutečné osobní údaje.
const SAMPLE_SUPPLIER: PartyInput = {
  name: 'Ukázková Firma s.r.o.',
  ico: '12345678',
  dic: 'CZ12345678',
  address: 'Ukázková 1',
  city: 'Praha',
  zip: '110 00',
  profile_type: 'sro',
  spisova_znacka: 'C 123456 vedená u Městského soudu v Praze',
  represented_by: 'jednateli Ukázkovou Osobou a Dalším Zástupcem',
}

const SAMPLE_CLIENTS: Record<'firma' | 'osvc', PartyInput> = {
  firma: {
    name: 'Vzorový Klient s.r.o.',
    ico: '87654321',
    dic: 'CZ87654321',
    address: 'Vzorová 2',
    city: 'Brno',
    zip: '602 00',
    entity_type: 'firma',
    spisova_znacka: 'C 654321 vedená u Krajského soudu v Brně',
    represented_by: 'jednatelem Vzorovým Jednatelem',
  },
  osvc: {
    name: 'Jan Vzorový',
    ico: '11223344',
    address: 'Testovací 3',
    city: 'Ostrava',
    zip: '702 00',
    entity_type: 'osvc',
  },
}

export async function GET(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('klient') === 'firma' ? 'firma' : 'osvc'

  const { pdf, missing } = await generateTermsPdf({
    supplier: SAMPLE_SUPPLIER,
    client: SAMPLE_CLIENTS[kind],
    values: { hodinova_sazba: '900', zaloha_castka: '12 000' },
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="podminky-spoluprace-nahled.pdf"',
      'X-Terms-Missing': missing.join(','),
    },
  })
}
