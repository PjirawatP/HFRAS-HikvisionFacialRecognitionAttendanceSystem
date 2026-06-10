"use client"



import { TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import styles from "@/styles/components/camera-preview.module.css"



export default function CameraPreview({ cameraId }: { cameraId: number }) {
    const containerRef = useRef<HTMLDivElement>(null)

    const [visible, setVisible] = useState(false)
    const [image, setImage] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const hasImageRef = useRef(false)

    // ----------------------------
    // Intersection Observer
    // ----------------------------
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.3 }
        )

        if (containerRef.current) {
            observer.observe(containerRef.current)
        }

        return () => observer.disconnect()
    }, [])

    // ----------------------------
    // WebRTC Capture
    // ----------------------------
    useEffect(() => {
        if (!visible) return

        let pc: RTCPeerConnection | null = null
        let timeoutId: NodeJS.Timeout

        const start = async () => {
            try {
                setLoading(true)
                setError(null)

                pc = new RTCPeerConnection()
                pc.addTransceiver("video", { direction: "recvonly" })

                pc.ontrack = (e) => {
                    const video = document.createElement("video")
                    video.srcObject = e.streams[0]
                    video.muted = true
                    video.playsInline = true

                    video.onloadeddata = () => {
                        try {
                            const canvas = document.createElement("canvas")
                            canvas.width = video.videoWidth
                            canvas.height = video.videoHeight

                            const ctx = canvas.getContext("2d")
                            if (!ctx) throw new Error("Canvas context failed")

                            ctx.drawImage(video, 0, 0)

                            const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
                            setImage(dataUrl)
                            hasImageRef.current = true
                            setLoading(false)

                            pc?.close()
                        } catch (err) {
                            setError("ไม่สามารถสร้างภาพ preview ได้")
                            setLoading(false)
                            pc?.close()
                        }
                    }

                    video.onerror = () => {
                        setError("Video load failed")
                        setLoading(false)
                        pc?.close()
                    }

                    video.play().catch(() => {
                        setError("Video play failed")
                        setLoading(false)
                        pc?.close()
                    })
                }

                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)

                const res = await fetch(`/api/webrtc/${cameraId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/sdp",
                        Accept: "application/sdp",
                    },
                    body: offer.sdp!,
                })

                if (!res.ok) {
                    throw new Error("WHEP request failed")
                }

                const answer = await res.text()
                await pc.setRemoteDescription({ type: "answer", sdp: answer })

                // timeout 8 วิ กันค้าง
                timeoutId = setTimeout(() => {
                    if (!hasImageRef.current) {
                        setError("หมดเวลาในการโหลด preview")
                        setLoading(false)
                        pc?.close()
                    }
                }, 8000)


            } catch (err) {
                setError("ไม่สามารถเชื่อมต่อกล้องได้")
                setLoading(false)
                pc?.close()
            }
        }

        start()

        return () => {
            clearTimeout(timeoutId)
            pc?.close()
        }
    }, [visible, cameraId])

    return (
        <div ref={containerRef} className={styles.container}>
            {loading && <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <span>กำลังโหลด...</span>
            </div>}

            {error && (
                <div className={styles.error}>
                    <TriangleAlert size={40} className={styles.errorIcon} />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && image && (
                <img src={image} className={styles.image} />
            )}
        </div>
    )
}