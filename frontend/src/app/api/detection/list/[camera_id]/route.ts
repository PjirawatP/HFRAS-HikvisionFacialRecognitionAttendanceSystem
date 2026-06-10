import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function GET(
    req: NextRequest,
    context: { params: Promise<{ camera_id: string }> }
) {
    try {
        const { camera_id } = await context.params

        if (!camera_id || isNaN(Number(camera_id))) {
            return NextResponse.json(
                { error: "invalid camera id" },
                { status: 400 }
            )
        }

        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const headers: HeadersInit = {}

        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(
            `${NEXT_PUBLIC_API_URL}/detection/list/${camera_id}`,
            {
                headers,
                cache: "no-store",
            }
        )

        if (!res.ok) {
            const errorText = await res.text()

            // console.error("backend error:", errorText)

            return NextResponse.json(
                { error: "failed to fetch detections" },
                { status: res.status }
            )
        }

        const data = await res.json()

        return NextResponse.json(data)

    } catch (error) {
        // console.error("server error:", error)

        return NextResponse.json(
            { error: "internal server error" },
            { status: 500 }
        )
    }
}