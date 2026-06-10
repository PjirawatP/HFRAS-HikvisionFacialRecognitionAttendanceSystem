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

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/person/list`, {
            method: "GET",
            headers,
            cache: "no-store",
        })

        if (!res.ok) {
            const errorText = await res.text()

            // console.error("error in backend:", errorText)

            return NextResponse.json(
                { error: "failed to fetch cameras" },
                { status: res.status }
            )
        }

        const resData = await res.json()

        return NextResponse.json(resData, {
            headers: {
                "Cache-Control": "no-store, max-age=0"
            }
        })

    } catch (error) {
        // console.error("error in api route:", error)

        return NextResponse.json(
            { error: "internal server error" },
            { status: 500 }
        )
    }
}