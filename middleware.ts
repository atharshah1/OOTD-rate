import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl

  // If a Supabase OAuth code lands on any page that isn't the callback handler,
  // forward the request to the callback route so the code can be exchanged.
  const code = searchParams.get('code')
  if (code && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', origin)
    callbackUrl.searchParams.set('code', code)

    const next = searchParams.get('next')
    if (next) {
      callbackUrl.searchParams.set('next', next)
    }

    return NextResponse.redirect(callbackUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - public assets
     * - the callback route itself (already handled by its own route handler)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
