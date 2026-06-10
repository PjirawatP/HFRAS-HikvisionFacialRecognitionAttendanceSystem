import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"


const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || id === "undefined") {
      return NextResponse.json(
        { error: "invalid person id" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const token = cookieStore.get("access_token")?.value

    const headers: HeadersInit = {}

    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const res = await fetch(`${NEXT_PUBLIC_API_URL}/person/${id}/delete`, {
      method: "DELETE",
      headers
    })

    if (!res.ok) {
      const errorText = await res.text()

      // console.error("error in backend:", errorText)

      return NextResponse.json(
        { error: "failed to delete person" },
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