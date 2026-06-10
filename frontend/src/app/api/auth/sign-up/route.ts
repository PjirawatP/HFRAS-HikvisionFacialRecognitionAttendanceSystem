import { NextRequest, NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function POST(request: NextRequest) {
    const body = await request.json()

    const res = await fetch(`${API_URL}/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })

    const data = await res.json()
    const response = NextResponse.json(data, { status: res.status })

    const setCookie = res.headers.get("set-cookie")

    if (setCookie) response.headers.set("set-cookie", setCookie)

    return response
}
