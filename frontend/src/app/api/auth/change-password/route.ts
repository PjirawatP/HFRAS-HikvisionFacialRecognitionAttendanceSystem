import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function POST(req: NextRequest) {
    try {
        const token = (await cookies()).get("access_token")?.value

        if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

        const body = await req.json()

        const res = await fetch(`${API_URL}/auth/change-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        })

        const data = await res.json()

        if (!res.ok) return NextResponse.json(data, { status: res.status })

        return NextResponse.json(data)
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}