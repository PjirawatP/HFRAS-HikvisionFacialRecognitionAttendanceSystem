import { NextRequest, NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path } = await context.params

    if (!path || path.length === 0) {
      return NextResponse.json(
        { message: "Invalid image path" },
        { status: 400 }
      )
    }

    const imagePath = path.join("/")
    const upstreamUrl = `${API_URL}/${imagePath}`

    const res = await fetch(upstreamUrl)

    if (!res.ok) {
      return NextResponse.json(
        { message: "File not found" },
        { status: res.status }
      )
    }

    const contentType =
      res.headers.get("content-type") || "application/octet-stream"

    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    })
  } catch (err) {
    // console.error("Image proxy error:", err)

    return NextResponse.json(
      { message: "Cannot load image" },
      { status: 500 }
    )
  }
}
