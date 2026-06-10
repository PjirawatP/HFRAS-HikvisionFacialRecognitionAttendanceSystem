import { cookies } from "next/headers"
import { NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function GET() {
    const cookieStore = await cookies()
    const token = cookieStore.get("access_token")?.value

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const response = await fetch(`${API_URL}/worker/status`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })

    } catch (error) {
        // console.error("Error fetching worker status:", error)

        return NextResponse.json(
            { status: "unreachable", message: "Cannot connect to API" },
            { status: 503 }
        )
    }
}