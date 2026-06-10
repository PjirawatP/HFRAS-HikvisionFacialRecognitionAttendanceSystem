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

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/person/import`, {
            method: "POST",
            headers,
            body: formData
        })

        if (!res.ok) {
            const errorText = await res.text()

            // console.error("error in backend:", errorText)

            let errorMessage = "นำเข้าข้อมูลไม่สำเร็จ"

            try {
                const errorJson = JSON.parse(errorText)
                errorMessage = errorJson.message || errorJson.error || errorMessage
            } catch {
            }

            return NextResponse.json(
                { message: errorMessage },
                { status: res.status }
            )
        }

        const resData = await res.json()

        return NextResponse.json(resData, { status: 200 })

    } catch (error) {
        // console.error("error in api route:", error)

        return NextResponse.json(
            { message: "internal server error" },
            { status: 500 }
        )
    }
}