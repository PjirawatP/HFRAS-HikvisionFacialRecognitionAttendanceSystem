"use client"



import { use, useEffect, useMemo, useState } from "react"

import styles from "@/styles/pages/camera.module.css"

import CameraPlayerComponent from "@/components/camera-player"
import HoverSideBarComponent from "@/components/hover-side-bar"

import { useAuth } from "@/lib/auth-context"



interface Detection {
    id: number
    face_image_path: string
    detect_image_path: string
    external_id: string
    first_name: string
    last_name: string
    position: string
    is_blacklist: boolean
    similarity: number
    detected_at: string
    camera_name: string
}

interface PageProps {
    params: Promise<{ id: string }>
}



const getPersonStatus = (person: Detection) => {
    if (person.is_blacklist) return "blacklist"
    return "normal"
}



export default function CameraPage({ params }: PageProps) {
    const { user, authLoading: loading, signOut: logout } = useAuth()
    const resolvedParams = use(params)
    const cameraId = Number(resolvedParams.id)

    const [cameraName, setCameraName] = useState<string>("")
    const [detections, setDetections] = useState<Detection[]>([])
    const [loadingData, setLoadingData] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!cameraId || isNaN(cameraId)) {
            setError("Invalid camera ID")
            setLoadingData(false)
            return
        }

        const fetchCameraName = async () => {
            try {
                const res = await fetch(`/api/camera/${cameraId}/name`)
                if (!res.ok) return
                const data = await res.json()
                if (data?.name) setCameraName(data.name)
            } catch {
            }
        }

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/detection/list/${cameraId}`)
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
                setDetections(await res.json())
                setError(null)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch data")
            } finally {
                setLoadingData(false)
            }
        }

        fetchCameraName()
        fetchData()
        const timer = setInterval(fetchData, 2000)
        return () => clearInterval(timer)
    }, [cameraId])

    const blacklistCount = detections.filter(d => d.is_blacklist).length

    const todayCount = useMemo(() => {
        const today = new Date().toDateString()
        return detections.filter(d => new Date(d.detected_at).toDateString() === today).length
    }, [detections])

    const lastDetected = useMemo(() => {
        if (detections.length === 0) return null
        const sorted = [...detections].sort((a, b) =>
            new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
        )
        return new Date(sorted[0].detected_at)
    }, [detections])

    const formatRelativeTime = (date: Date) => {
        const diff = Math.floor((Date.now() - date.getTime()) / 1000)
        if (diff < 60) return `${diff} วินาทีที่แล้ว`
        if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
        return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
    }

    const pageTitle = cameraName || `กล้อง #${cameraId}`

    const cards = [
        {
            label: "ทั้งหมด",
            value: `${detections.length} คน`,
            color: "var(--secondary-color)",
            dot: false,
        },
        {
            label: "ตรวจจับวันนี้",
            value: `${todayCount} คน`,
            color: "var(--secondary-color)",
            dot: false,
        },
        {
            label: "ล่าสุดเมื่อ",
            value: lastDetected ? formatRelativeTime(lastDetected) : "—",
            color: "var(--secondary-color)",
            dot: false,
        },
        {
            label: "บัญชีดำ",
            value: `${blacklistCount} คน`,
            color: blacklistCount > 0 ? "var(--error-color)" : "var(--secondary-color)",
            dot: false,
        },
    ]

    if (error) {
        return (
            <div className={styles.cameraPageLayout}>
                <div className={styles.cameraContainer}>
                    <div style={{ padding: "24px", textAlign: "center", color: "#ef4444" }}>
                        <h2>⚠️ เกิดข้อผิดพลาด</h2>
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.cameraPageLayout}>
            <HoverSideBarComponent role={user?.role} onOpenChange={() => { }} />
            <div className={styles.cameraContainer}>
                <div className={styles.content}>
                    {/* LEFT PANEL */}
                    <div className={styles.leftPanel}>
                        <div className={styles.header}>
                            <div className={styles.leftHeader}>
                                <h1 className={styles.title}>
                                    {loading ? "กำลังโหลด..." : pageTitle}
                                </h1>
                            </div>
                        </div>

                        <div className={styles.realTimeStreamingContainer}>
                            <div className={styles.streamingDisplay}>
                                {!loading && <CameraPlayerComponent cameraId={cameraId} />}
                            </div>
                        </div>

                        <div className={styles.statsContainer}>
                            <div className={styles.statsCard}>
                                {cards.map(card => (
                                    <div key={card.label} className={styles.statsCardItem}>
                                        <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: 0, marginBottom: "0.2rem" }}>
                                            {card.label}
                                        </p>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: card.color }}>
                                                {card.value}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className={styles.rightPanel}>
                        {loading ? (
                            <div style={{ padding: "24px", textAlign: "center" }}>
                                กำลังโหลดข้อมูล...
                            </div>
                        ) : detections.length > 0 ? (
                            <div className={styles.personList}>
                                {detections.map((person, index) => {
                                    const status = getPersonStatus(person)
                                    return (
                                        <div
                                            key={`${person.id}-${index}`}
                                            className={`${styles.personCard} ${styles[status]}`}
                                        >
                                            <div className={`${styles.statusIndicator} ${styles[status]}`} />

                                            <div className={styles.personImages}>
                                                <img
                                                    src={`/api/image/${person.face_image_path}`}
                                                    alt="Face"
                                                    onError={(e) => { e.currentTarget.src = "/placeholder-face.png" }}
                                                />
                                                <img
                                                    src={`/api/image/${person.detect_image_path}`}
                                                    alt="Detection"
                                                    onError={(e) => { e.currentTarget.src = "/placeholder-detection.png" }}
                                                />
                                            </div>

                                            <div className={styles.personInfo}>
                                                <div className={styles.personHeader}>
                                                    <p className={styles.personName}>
                                                        {person.first_name} {person.last_name}
                                                    </p>
                                                    {status === "blacklist" && (
                                                        <span className={styles.blacklistBadge}>บัญชีดำ</span>
                                                    )}
                                                    {status === "normal" && (
                                                        <span className={styles.normalBadge}>ลงชื่อสำเร็จ</span>
                                                    )}
                                                </div>
                                                <p className={styles.personDetail}>
                                                    <strong>ตำแหน่ง:</strong> {person.position}
                                                </p>
                                                <p className={styles.personDetail}>
                                                    <strong>ความแม่นยำ:</strong>
                                                    <span className={`${styles.similarityValue} ${styles[status]}`}>
                                                        {(person.similarity * 100).toFixed(2)}%
                                                    </span>
                                                </p>
                                                <p className={styles.personDetail}>
                                                    <strong>ลงชื่อเมื่อ:</strong>{" "}
                                                    {new Date(person.detected_at).toLocaleString("th-TH")}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
                                ไม่มีข้อมูลการตรวจจับ
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}