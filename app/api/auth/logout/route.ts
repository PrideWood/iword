import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';
import { isSameOrigin } from '@/lib/request-security';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 });
  await destroySession(); return NextResponse.json({ ok: true });
}
