
// basic auth

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const validAuth = 'Basic ' + btoa('couts:Jacky8826!')

  if (auth !== validAuth) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure"',
      },
    })
  }
}

export const config = {
  matcher: '/((?!_next|favicon.ico).*)',
}