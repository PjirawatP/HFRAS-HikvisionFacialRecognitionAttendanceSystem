"use client"



import { use, useEffect, useMemo, useRef, useState } from "react"

import styles from "@/styles/pages/camera-management-id.module.css"

import ToastComponent from "@/components/toast"
import CameraPlayerComponent from "@/components/camera-player"

import { ToastState, ToastType } from "@/types/toast"



/* ================= TYPES ================= */
interface CameraData {
    id: number
    name: string
    location: string
    username: string
    ip: string
    port: string
    is_detect: boolean
    is_notify: boolean
    created_at: string
    updated_at: string
}
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



const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || ""



const getPersonStatus = (person: Detection) => {
    if (person.is_blacklist) return "blacklist"
    return "normal"
}



export default function CameraManagementIdPage({ params }: PageProps) {
    const resolvedParams = use(params)
    const cameraId = Number(resolvedParams.id)

    const [camera, setCamera] = useState<CameraData | null>(null)
    const [loading, setLoading] = useState(false)
    const [toast, setToast] = useState<ToastState | null>(null)

    const abortRef = useRef<AbortController | null>(null)

    const [loadingData, setLoadingData] = useState(true)
    const [error, setError] = useState<string | null>(null)
    /* ---------- helpers ---------- */
    const isValidId = (value?: number) => {
        const num = Number(value)
        return Number.isInteger(num) && num > 0
    }

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type })
    }

    useEffect(() => {
        if (!cameraId || isNaN(cameraId)) {
            setError("Invalid camera ID")
            setLoadingData(false)
            return
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
        fetchData()
        const timer = setInterval(fetchData, 5000)
        return () => clearInterval(timer)
    }, [cameraId])

    /* ---------- fetch ---------- */
    const fetchCamera = async () => {
        if (!isValidId(cameraId)) {
            showToast("ไอดีกล้องไม่ถูกต้อง", "error")
            return
        }

        abortRef.current?.abort()
        abortRef.current = new AbortController()

        try {
            setLoading(true)

            const res = await fetch(`/api/camera/${cameraId}/info`, {
                signal: abortRef.current.signal,
            })

            if (!res.ok) {
                if (res.status === 404) {
                    showToast("ไม่พบกล้องที่ต้องการ", "error")
                    return
                }
                showToast("ไม่สามารถโหลดข้อมูลกล้องได้", "error")
                return
            }

            const data: CameraData = await res.json()
            setCamera(data)

        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return
            showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error")
        } finally {
            setLoading(false)
        }
    }
    const [detections, setDetections] = useState<Detection[]>([])

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

    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return "-"
        try {
            return new Date(dateString).toLocaleString('th-TH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        } catch {
            return "-"
        }
    }
    /* ---------- effects ---------- */
    useEffect(() => {
        fetchCamera()

        const interval = setInterval(fetchCamera, 60000)

        return () => {
            abortRef.current?.abort()
            clearInterval(interval)
        }
    }, [cameraId])

    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(null), 5000)
        return () => clearTimeout(timer)
    }, [toast])

    /* ---------- render ---------- */
    return (
        <div className={styles.pageContainer}>
            {toast && (
                <ToastComponent
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {camera ? (
                <>
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.title}>
                                {camera.name || "รายละเอียดกล้อง"}
                            </h1>
                            <p className={styles.subtitle}>
                                ระบบตรวจจับใบหน้าและติดตามแบบเรียลไทม์
                            </p>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.leftPanel}>
                            <div className={styles.video}>
                                <CameraPlayerComponent cameraId={camera.id} />
                            </div>

                            <div className={styles.cameraDetail}>
                                {loading ? (
                                    <>loading...</>
                                )
                                    : (
                                        <>
                                            <div className={styles.detailGrid}>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>ไอดี</span>
                                                    <span className={styles.detailValue}>{camera.id}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>ชื่อ</span>
                                                    <span className={styles.detailValue}>{camera.name}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>ตำแหน่ง</span>
                                                    <span className={styles.detailValue}>{camera.location || "-"}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>IP</span>
                                                    <span className={styles.detailValue}>{camera.ip}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>Port</span>
                                                    <span className={styles.detailValue}>{camera.port}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>ตรวจจับ</span>
                                                    <span className={styles.detailValue}>{camera.is_detect ? "ใช้งาน" : "ไม่ใช้งาน"}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>แจ้งเตือน</span>
                                                    <span className={styles.detailValue}>{camera.is_notify ? "ใช้งาน" : "ไม่ใช้งาน"}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>วันที่เพิ่ม</span>
                                                    <span className={styles.detailValue}>{formatDateTime(camera.created_at)}</span>
                                                </div>
                                                <div className={styles.detailField}>
                                                    <span className={styles.detailLabel}>แก้ไขล่าสุด</span>
                                                    <span className={styles.detailValue}>{formatDateTime(camera.updated_at)}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                            </div>
                        </div>

                        <div className={styles.rightPanel} >
                            <div className={styles.statsContainer}>
                                <h2 className={styles.statsTitle}>สถิติการตรวจจับ</h2>
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
                            <div className={styles.personListContainer}>
                                <div className={styles.personListHeader}>
                                    <h2 className={styles.personListTitle}>การตรวจจับล่าสุด</h2>
                                </div>

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
                </>
            ) : (
                <>
                    ไม่พบข้อมูลกล้อง
                </>
            )}
        </div>
    )
}