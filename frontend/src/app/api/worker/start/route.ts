import { cookies } from "next/headers"
import { NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function POST() {
    const cookieStore = await cookies()
    const token = cookieStore.get("access_token")?.value

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const response = await fetch(`${API_URL}/worker/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })

    } catch (error) {
        // console.error("Error starting worker:", error)

        return NextResponse.json(
            { ok: false, message: "Cannot connect to API" },
            { status: 503 }
        )
    }
}