import { NextRequest } from "next/server"



const MEDIAMTX_HLS_API_BASE_URL = process.env.MEDIAMTX_HLS_API_BASE_URL || "http://localhost:8888"

const USER = process.env.MEDIAMTX_USERNAME
const PASS = process.env.MEDIAMTX_PASSWORD



export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params
    const joinedPath = path.join("/")

    const targetUrl = `${MEDIAMTX_HLS_API_BASE_URL}/${joinedPath}`

    const authHeader =
      USER && PASS
        ? "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64")
        : undefined

    const res = await fetch(targetUrl, {
      headers: authHeader
        ? { Authorization: authHeader }
        : undefined,
    })

    if (!res.ok) {
      return new Response(await res.text(), {
        status: res.status,
      })
    }

    const contentType =
      res.headers.get("content-type") || "application/octet-stream"

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    })
  } catch (err: any) {
    return new Response(err.message, { status: 500 })
  }
}