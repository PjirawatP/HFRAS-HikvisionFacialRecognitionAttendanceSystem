import { NextResponse } from "next/server"



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export async function GET() {
  try {
    const res = await fetch(`${API_URL}/setting/notification_channel/list`, {
      cache: "no-store"
    })

    if (!res.ok) {
      const text = await res.text()

      return NextResponse.json({
        error: "Backend error", detail: text
      }, {
        status: res.status
      }
      )
    }

    const resData = await res.json()

    return NextResponse.json(resData)

  } catch (error: any) {
    return NextResponse.json({
      error: "Cannot connect to backend", detail: error.message
    }, {
      status: 500
    }
    )
  }
}