import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || ""



export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        if (!id) {
            return NextResponse.json(
                { message: "Person ID ไม่ถูกต้อง" },
                { status: 400 }
            )
        }

        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const body = await req.json()

        const res = await fetch(`${API_URL}/user/${id}/status`, {
            method: "PATCH",
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