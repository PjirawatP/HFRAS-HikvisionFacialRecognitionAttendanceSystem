import { NextRequest } from "next/server"



const MEDIAMTX_WEBRTC_API_BASE_URL = process.env.MEDIAMTX_WEBRTC_API_BASE_URL || "http://localhost:8889"

const USER = process.env.MEDIAMTX_USERNAME
const PASS = process.env.MEDIAMTX_PASSWORD



export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const sdp = await request.text()

        // สร้าง Basic Auth header
        const authHeader =
            USER && PASS
                ? "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64")
                : undefined

        const mediamtxRes = await fetch(
            `${MEDIAMTX_WEBRTC_API_BASE_URL}/camera_${id}/whep`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/sdp",
                    Accept: "application/sdp",
                    ...(authHeader && { Authorization: authHeader }),
                },
                body: sdp,
                cache: "no-store",
            }
        )

        if (!mediamtxRes.ok) {
            return new Response(await mediamtxRes.text(), {
                status: mediamtxRes.status,
            })
        }

        const answer = await mediamtxRes.text()

        return new Response(answer, {
            status: 200,
            headers: {
                "Content-Type": "application/sdp",
            },
        })
    } catch (err: any) {
        return new Response(err.message, { status: 500 })
    }
}