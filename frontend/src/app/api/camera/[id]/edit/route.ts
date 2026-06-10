import { channel } from "diagnostics_channel"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.name || !body.username || !body.ip || !body.port) {
      return NextResponse.json(
        { error: "name, username, ip, and port are required" },
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

    const updateData: any = {
      name: body.name,
      location: body.location || null,
      username: body.username,
      ip: body.ip,
      port: body.port,
      channel: body.channel || 102
    }

    if (body.password) {
      updateData.password = body.password
    }

    const res = await fetch(`${NEXT_PUBLIC_API_URL}/camera/${id}/edit`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updateData),
    })

    if (!res.ok) {
      const errorText = await res.text()

      // console.error("error in backend:", errorText)

      return NextResponse.json(
        { message: errorText },
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