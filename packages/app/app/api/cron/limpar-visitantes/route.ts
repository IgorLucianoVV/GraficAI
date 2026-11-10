import { NextResponse, type NextRequest } from 'next/server';
import { getDb, purgeGuests } from '@graficai/server';

/** Cron diário (vercel.json): apaga visitantes parados há mais de 30 dias. Exige CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const removed = await purgeGuests(await getDb(), Number(process.env.GUEST_RETENTION_DAYS ?? 30));
  return NextResponse.json({ removed });
}
