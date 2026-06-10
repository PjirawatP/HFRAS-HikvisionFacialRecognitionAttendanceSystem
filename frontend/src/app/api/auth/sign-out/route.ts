import { NextResponse } from "next/server"



export async function POST() {
    const response = NextResponse.json({ ok: true })

    response.headers.set(
        "set-cookie",
        "access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    )
    
    return response
}
