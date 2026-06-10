import { NextRequest, NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function PUT(req: NextRequest) {
    try {
        const body = await req.json()

        const res = await fetch(`${API_URL}/setting/save`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            cache: "no-store"
        })

        if (!res.ok) {
            const errText = await res.text()

            return NextResponse.json(
                { message: "Save setting failed", detail: errText },
                { status: res.status }
            )
        }

        const resData = await res.json()

        return NextResponse.json(
            { message: "Save setting success", resData },
            { status: 200 }
        )

    } catch (error) {
        // console.error("Error in /api/setting/save:", error)

        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
