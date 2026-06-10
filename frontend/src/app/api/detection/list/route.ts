import { cookies } from "next/headers"
import { NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const headers: HeadersInit = {}

        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/detection/list`, {
            headers,
            cache: "no-store",
        })

        if (!res.ok) {
            const errorText = await res.text()

            // console.error("backend error:", errorText)

            return NextResponse.json(
                { error: "ไม่สามารถดึงข้อมูลบุคคลได้" },
                { status: res.status }
            )
        }

        const data = await res.json()

        return NextResponse.json(data, { status: 200 })

    } catch (error) {
        // console.error("server error:", error)

        return NextResponse.json(
            { error: "Internal server 500" },
            { status: 500 }
        )
    }
}