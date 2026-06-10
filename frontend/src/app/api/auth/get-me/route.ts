import { NextRequest, NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



function extractTokenFromCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null

    const match = cookieHeader
        .split(";")
        .map(c => c.trim())
        .find(c => c.startsWith("access_token="))

    return match ? match.split("=")[1] : null
}



export async function GET(request: NextRequest) {
    const cookieHeader = request.headers.get("cookie")
    const token = extractTokenFromCookie(cookieHeader)

    if (!token) {
        return NextResponse.json(
            { detail: "Unauthorized" },
            { status: 401 }
        )
    }

    const res = await fetch(`${API_URL}/auth/get-me`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    const data = await res.json()

    return NextResponse.json(data, { status: res.status })
}
