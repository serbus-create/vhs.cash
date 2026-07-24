import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import path from 'path';
import QRCode from 'qrcode';
import InvoiceTemplate from '@/components/pdf/invoice-template';
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Register fonts at module load time
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');
Font.register({ family: 'DejaVu', src: path.join(FONTS_DIR, 'dejavu.ttf') });
Font.register({ family: 'DejaVu-Bold', src: path.join(FONTS_DIR, 'dejavu-bold.ttf') });
Font.registerHyphenationCallback((word) => [word]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (docErr || !doc) {
    console.error('[pdf] doc fetch error:', docErr);
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const [clientResult, profileResult] = await Promise.all([
    doc.client_id
      ? supabase.from('clients').select('*').eq('id', doc.client_id).single()
      : Promise.resolve({ data: null }),
    doc.company_profile_id
      ? supabase.from('company_profiles').select('*').eq('id', doc.company_profile_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const client: Client | null = clientResult.data ?? null;
  const companyProfile: CompanyProfile | null = profileResult.data ?? null;

  // QR payment code — invoices only, requires supplier IBAN
  let qrCodeUrl: string | null = null;
  if (doc.type === 'faktura' && companyProfile?.iban) {
    try {
      const ibanClean = companyProfile.iban.replace(/\s/g, '');
      const amount = (doc.total_with_vat ?? 0).toFixed(2);
      const currency = doc.currency ?? 'CZK';

      let payload: string;

      if (currency === 'EUR') {
        // EPC QR (SEPA Credit Transfer, version 002)
        const bic = (companyProfile.swift ?? '').replace(/\s/g, '');
        const name = (companyProfile.name ?? '').slice(0, 70);
        payload = [
          'BCD',          // Service Tag
          '002',          // Version
          '1',            // Character set: UTF-8
          'SCT',          // Identification: SEPA Credit Transfer
          bic,            // BIC (may be empty — allowed since EPC v002)
          name,           // Beneficiary name
          ibanClean,      // Beneficiary IBAN
          `EUR${amount}`, // Amount
          '',             // Purpose (empty)
          '',             // Remittance reference (empty — using unstructured below)
          doc.number,     // Unstructured remittance info
          '',             // Beneficiary to originator info (empty)
        ].join('\n');
      } else {
        // SPD format — Czech QR Platba
        const vs = doc.variable_symbol ?? '';
        payload = [
          'SPD*1.0',
          `ACC:${ibanClean}`,
          `AM:${amount}`,
          `CC:${currency}`,
          `MSG:${doc.number}`,
          vs ? `X-VS:${vs}` : '',
        ].filter(Boolean).join('*');
      }

      qrCodeUrl = await QRCode.toDataURL(payload, {
        width: 160,
        margin: 1,
        color: { dark: '#111111', light: '#FFFFFF' },
      });
    } catch (qrErr) {
      console.error('[pdf] QR generation error:', qrErr);
    }
  }

  const docWithItems = doc as DocumentWithItems;

  try {
    console.log('[pdf] rendering', doc.number);

    const buffer: Buffer = await renderToBuffer(
      React.createElement(InvoiceTemplate, {
        doc: docWithItems,
        client,
        companyProfile,
        qrCodeUrl,
        clientCountry: client?.country ?? null,
      }) as unknown as React.ReactElement
    );

    console.log('[pdf] rendered successfully, size:', buffer.length);

    const typeLabel =
      doc.type === 'faktura' ? 'Faktura' : doc.type === 'nabidka' ? 'Nabidka' : 'Objednavka';
    const filename = `${typeLabel}-${doc.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[pdf] render error:', err);
    return NextResponse.json(
      { error: 'PDF generation failed', detail: String(err) },
      { status: 500 }
    );
  }
}
