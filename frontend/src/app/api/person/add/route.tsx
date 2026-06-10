import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()

        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const headers: HeadersInit = {}

        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/person/add`, {
            method: "POST",
            headers,
            body: formData
        })

        if (!res.ok) {
            const errorText = await res.text()

            // console.error("error in backend:", errorText)

            return NextResponse.json(
                { error: "failed to add camera" },
                { status: res.status }
            )
        }

        const resData = await res.json()

        return NextResponse.json(resData, { status: 200 })

    } catch (error) {
        // console.error("error in api route:", error)

        return NextResponse.json(
            { error: "internal server error" },
            { status: 500 }
        )
    }
}