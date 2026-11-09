import { NextResponse, type NextRequest } from 'next/server';

/** Páginas da área logada: sem cookie de sessão, vai para /entrar. A validação real é no servidor. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get('gx_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = `?proximo=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/projetos/:path*', '/equipe/:path*', '/configuracoes/:path*'] };
