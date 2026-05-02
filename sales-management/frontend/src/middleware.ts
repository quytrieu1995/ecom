import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Check token từ cookie (set bởi setAuth) hoặc header
  // Vì token lưu ở localStorage (client-only), middleware chỉ redirect
  // nếu không có cookie auth — để client-side guard xử lý phần còn lại
  const token = request.cookies.get('access_token')?.value

  // Nếu đã có token mà vào trang public → về dashboard
  if (token && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
