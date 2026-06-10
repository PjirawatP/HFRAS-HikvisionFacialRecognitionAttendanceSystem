import { NextRequest, NextResponse } from "next/server"



const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";



export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    if (!id) {
        return NextResponse.json(
            { message: "id not found" },
            { status: 404 }
        )
    }


    try {
        const body = await req.json()

        const res = await fetch(`${BACKEND_URL}/setting/notification_channel/${id}/edit`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store"
        })

        const resData = await res.json()

        if (!res.ok) {
            return NextResponse.json(
                { message: resData?.detail || "edit notification failed" },
                { status: res.status }
            )
        }

        return NextResponse.json(
            { message: "save notification channel success" },
            { status: 200 }
        )

    } catch (error) {
        console.error("route error:", error);

        return NextResponse.json(
            { message: "internal server error" },
            { status: 500 }
        )
    }
}