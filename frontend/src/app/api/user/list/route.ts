import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"


export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const headers: HeadersInit = {
            "Content-Type": "application/json",
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/user/list`, {
            method: "GET",
            headers,
            cache: "no-store",
        })

        if (!res.ok) {
            return NextResponse.json(
                { error: "Failed to fetch users" },
                { status: res.status }
            )
        }

        return NextResponse.json(await res.json(), {
            headers: { "Cache-Control": "no-store, max-age=0" },
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
