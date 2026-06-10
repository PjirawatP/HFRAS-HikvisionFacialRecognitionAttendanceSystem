import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



async function handler(
    req: NextRequest,
    context: { params: Promise<{ slug: string[] }> }
) {
    try {
        const { slug } = await context.params
        const path = slug.join("/")
        const search = req.nextUrl.searchParams.toString()
        const backendUrl = `${NEXT_PUBLIC_API_URL}/api/overview/${path}${search ? `?${search}` : ""}`

        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const headers: HeadersInit = {
            "Content-Type": "application/json",
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(backendUrl, {
            method: req.method,
            headers,
            body: req.method !== "GET" ? await req.text() : undefined,
            cache: "no-store"
        })

        const text = await res.text()

        return new NextResponse(text, {
            status: res.status,
            headers: {
                "Content-Type": res.headers.get("Content-Type") ?? "application/json",
            },
        })
    } catch (error) {
        // console.error("Proxy error:", error)
        return NextResponse.json({ error: "Backend connection failed" }, { status: 500 })
    }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE }