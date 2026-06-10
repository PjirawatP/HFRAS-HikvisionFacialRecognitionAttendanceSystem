import { NextRequest, NextResponse } from "next/server"

import { UserRole } from "@/types/auth"



export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get("access_token")?.value
  const role = req.cookies.get("role")?.value as UserRole | undefined

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }

  if (
    pathname.startsWith("/admin") &&
    role !== UserRole.ADMIN &&
    role !== UserRole.SUPERADMIN
  ) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}



export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
}