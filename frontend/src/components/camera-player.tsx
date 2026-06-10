"use client"



import { VideoOff } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import styles from "@/styles/components/camera-player.module.css"



export type Props = { cameraId: number }

type Status = "loading" | "playing" | "error"



export default function CameraPlayerComponent({ cameraId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>("loading")
  const pcRef = useRef<RTCPeerConnection | null>(null)

  const isMobile =
    typeof navigator !== "undefined" && /iPhone|Android/i.test(navigator.userAgent)

  const connectWebRTC = () => {
    // cleanup previous
    pcRef.current?.close()

    setStatus("loading")

    const pc = new RTCPeerConnection()
    pcRef.current = pc

    pc.ontrack = (e) => {
      if (videoRef.current) {
        videoRef.current.srcObject = e.streams[0]
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("error")
      }
    }

    pc.addTransceiver("video", { direction: "recvonly" });

    (async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const res = await fetch(`/api/webrtc/${cameraId}`, {
          method: "POST",
          headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
          body: offer.sdp!,
        })

        if (!res.ok) throw new Error(await res.text())

        const answer = await res.text()
        await pc.setRemoteDescription({ type: "answer", sdp: answer })

        setStatus("playing")
      } catch (err) {
        console.error(err)
        setStatus("error")
      }
    })()
  }

  useEffect(() => {
    if (isMobile) {
      setStatus("playing")
      return
    }

    connectWebRTC()

    return () => {
      pcRef.current?.close()
    }
  }, [cameraId])

  return (
    <div className={styles.wrapper}>

      {/* ───── Mobile: iframe ───── */}
      {isMobile && (
        <iframe
          src={`/api/hls/camera_${cameraId}/`}
          className={styles.iframe}
          allow="autoplay"
        />
      )}

      {/* ───── Desktop: WebRTC video ───── */}
      {!isMobile && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={true}
          className={styles.video}
          style={{ display: status === "playing" ? "block" : "none" }}
        />
      )}

      {/* ───── Loading overlay ───── */}
      {status === "loading" && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>กำลังเชื่อมต่อกล้อง...</span>
        </div>
      )}

      {/* ───── Error overlay ───── */}
      {status === "error" && (
        <div className={styles.error}>
          <VideoOff size={32} className={styles.errorIcon} />
          <span>ไม่สามารถเชื่อมต่อกล้องได้</span>
          <button
            className={styles.retryButton}
            onClick={connectWebRTC}
          >
            ลองใหม่
          </button>
        </div>
      )}

    </div>
  )
}