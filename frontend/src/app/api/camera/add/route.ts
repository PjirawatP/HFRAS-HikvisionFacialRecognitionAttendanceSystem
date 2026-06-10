import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        if (!body.name || !body.username || !body.password || !body.ip || !body.port) {
            return NextResponse.json(
                { error: "name, username, password, ip, and port are required" },
                { status: 400 }
            )
        }

        const cookieStore = await cookies()
        const token = cookieStore.get("access_token")?.value

        const headers: HeadersInit = {
            "Content-Type": "application/json",
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/camera/add`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                name: body.name,
                location: body.location || null,
                username: body.username,
                password: body.password,
                ip: body.ip,
                port: body.port,
                channel: body.channel || 102
            })
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