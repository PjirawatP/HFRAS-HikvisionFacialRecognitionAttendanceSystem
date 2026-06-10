"use client"



import { Cctv, Gauge, Home, Loader2, WifiOff, } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import styles from "@/styles/components/hover-side-bar.module.css"

import { UserRole } from "@/types/auth"



interface CameraData {
    id: number
    name: string
    location: string
    is_detect: boolean
}

type HoverSideBarProps = {
    role?: UserRole
    onOpenChange?: (open: boolean) => void
}



const CAMERA_POLL_MS = 10000



export default function HoverSideBarComponent({ role, onOpenChange }: HoverSideBarProps) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)

    const [cameras, setCameras] = useState<CameraData[]>([])
    const [cameraLoading, setCameraLoading] = useState(true)
    const [cameraError, setCameraError] = useState(false)

    const isAdminOrSuperAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN

    const staticMenuItems = [
        { name: "หน้าแรก", href: "/", icon: Home },
    ]

    const isActive = (href: string) =>
        pathname === href || pathname?.startsWith(href + "/")

    /* ── Fetch cameras ───────────────────────────────── */
    const fetchCameras = async (showLoading = true) => {
        try {
            if (showLoading) { setCameraLoading(true); setCameraError(false) }
            const res = await fetch("/api/camera/list")
            if (!res.ok) throw new Error()
            const data: CameraData[] = await res.json()
            setCameras(data)
            setCameraError(false)
        } catch {
            setCameraError(true)
        } finally {
            if (showLoading) setCameraLoading(false)
        }
    }

    useEffect(() => {
        fetchCameras(true)
        const interval = setInterval(() => fetchCameras(false), CAMERA_POLL_MS)
        return () => clearInterval(interval)
    }, [])

    /* ── Mobile ──────────────────────────────────────── */
    const toggleMobile = () => {
        const next = !mobileOpen
        setMobileOpen(next)
        onOpenChange?.(next)
    }

    useEffect(() => { setMobileOpen(false); onOpenChange?.(false) }, [pathname])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && mobileOpen) toggleMobile() }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [mobileOpen])

    return (
        <>
            <div
                className={`${styles.sidebarWrapper} ${mobileOpen ? styles.mobileOpen : ""}`}
                role="navigation"
                aria-label="แถบเมนู"
            >
                <div className={styles.peekBar} aria-hidden="true" />

                <aside className={styles.sidebar}>
                    {/* Header */}
                    <div className={styles.header}>
                        <h2 className={styles.title}>
                            <span className={styles.titleText}>FDAR System</span>
                        </h2>
                    </div>

                    {/* Nav */}
                    <nav className={styles.nav}>
                        <ul className={styles.menuList}>

                            {/* Static items */}
                            {staticMenuItems.map((item) => {
                                const Icon = item.icon
                                const active = isActive(item.href)
                                return (
                                    <li key={item.href} className={styles.menuItem}>
                                        <Link
                                            href={item.href}
                                            className={`${styles.menuLink} ${active ? styles.active : ""}`}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            <span className={styles.icon}><Icon size={20} strokeWidth={2} /></span>
                                            <span className={styles.menuText}>{item.name}</span>
                                        </Link>
                                    </li>
                                )
                            })}

                            {/* Section: กล้อง */}
                            <li className={styles.sectionDivider}>
                                <div className={styles.sectionHeader}>
                                    <Cctv size={14} />
                                    <span>กล้องทั้งหมด</span>
                                    {!cameraLoading && !cameraError && cameras.length > 0 && (
                                        <span className={styles.cameraCount}>{cameras.length}</span>
                                    )}
                                </div>
                            </li>

                            {/* Loading state */}
                            {cameraLoading && (
                                <li className={styles.cameraStateItem}>
                                    <Loader2 size={15} className={styles.spinnerIcon} />
                                    <span>กำลังโหลด...</span>
                                </li>
                            )}

                            {/* Error state */}
                            {!cameraLoading && cameraError && (
                                <li className={styles.cameraStateItem}>
                                    <WifiOff size={15} className={styles.errorIcon} />
                                    <span>โหลดไม่สำเร็จ</span>
                                    <button className={styles.retryBtn} onClick={() => fetchCameras(true)}>
                                        ลองใหม่
                                    </button>
                                </li>
                            )}

                            {/* Empty state */}
                            {!cameraLoading && !cameraError && cameras.length === 0 && (
                                <li className={styles.cameraStateItem}>
                                    <span>ไม่พบกล้องในระบบ</span>
                                </li>
                            )}

                            {/* Camera items */}
                            {!cameraLoading && !cameraError && cameras.map((camera) => {
                                const href = `/camera/${camera.id}`
                                const active = isActive(href)
                                return (
                                    <li key={camera.id} className={styles.menuItem}>
                                        <Link
                                            href={href}
                                            className={`${styles.menuLink} ${styles.cameraLink} ${active ? styles.active : ""}`}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            <span className={styles.icon}>
                                                <Cctv size={18} strokeWidth={1.8} />
                                                {camera.is_detect && (
                                                    <span className={styles.liveDot} aria-label="กำลังตรวจจับ" />
                                                )}
                                            </span>
                                            <span className={styles.cameraInfo}>
                                                <span className={styles.cameraName}>{camera.name}</span>
                                                {camera.location && (
                                                    <span className={styles.cameraLocation}>{camera.location}</span>
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                )
                            })}

                        </ul>
                    </nav>

                    {/* Admin quick link */}
                    {isAdminOrSuperAdmin && (
                        <Link href="/overview" className={styles.dashboardLink} title="Dashboard">
                            <Gauge size={20} />
                            <span>Dashboard</span>
                        </Link>
                    )}
                </aside>
            </div>

            {mobileOpen && (
                <div
                    className={styles.overlay}
                    onClick={toggleMobile}
                    role="button"
                    aria-label="ปิดแถบด้านข้าง"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleMobile() }}
                />
            )}
        </>
    )
}