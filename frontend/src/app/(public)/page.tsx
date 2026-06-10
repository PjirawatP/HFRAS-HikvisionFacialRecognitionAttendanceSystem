"use client"



import Link from "next/link"

import { AlertTriangle, MapPin, RefreshCw, Video, Wifi } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import styles from "@/styles/pages/home.module.css"
import layoutStyles from "@/styles/layout/layout-client.module.css"

import CameraPreviewComponent from "@/components/camera-preview"
import SearchBar from "@/components/search-bar"
import ToastComponent from "@/components/toast"
import UserDropdownComponent from "@/components/user-dropdown"
import UserSideBarComponent from "@/components/user-side-bar"

import { useAuth } from "@/lib/auth-context"
import { ToastState, ToastType } from "@/types/toast"



interface CameraData {
  id: number
  name: string
  location: string
  ip: string
  port: string
  is_detect: boolean
  is_notify: boolean
  channel: 101 | 102
}



export default function HomePage() {
  const { user, authLoading, signOut: logout } = useAuth()
  const router = useRouter()

  const [isSideBarOpen, setIsSideBarOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [dataLoading, setDataLoading] = useState(false)
  const [cameras, setCameras] = useState<CameraData[]>([])
  const [fetchError, setFetchError] = useState("")

  const [searchQuery, setSearchQuery] = useState("")


  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace("/sign-in")
  }, [user, authLoading, router])

  // Show nothing while auth is resolving or user is not yet confirmed
  const isAuthorized = !authLoading && !!user

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  // ── Fetch cameras ──────────────────────────────────────────────────────────
  const fetchCameras = useCallback(async (signal?: AbortSignal) => {
    try {
      setDataLoading(true)
      setFetchError("")

      const res = await fetch("/api/camera/list", { signal })
      if (!res.ok) throw new Error(`${res.status}`)

      const data: CameraData[] = await res.json()
      setCameras(data)
      // showToast("โหลดข้อมูลกล้องเรียบร้อย", "success")
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setFetchError("ไม่สามารถโหลดรายการกล้องได้")
      showToast("ไม่สามารถโหลดรายการกล้องได้", "error")
    } finally {
      setDataLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!isAuthorized) return
    const controller = new AbortController()
    fetchCameras(controller.signal)
    return () => controller.abort()
  }, [isAuthorized, fetchCameras])

  // ── Derived state ──────────────────────────────────────────────────────────
  const filteredCameras = cameras.filter((c) => {
    const q = debouncedQuery.toLowerCase()
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.location ?? "").toLowerCase().includes(q) ||
      (c.ip ?? "").includes(q) ||
      (c.port ?? "").includes(q) ||
      String(c.id).padStart(3, "0").includes(q)
    )
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    logout()
    router.replace("/sign-in")
  }

  // ── Render guard ───────────────────────────────────────────────────────────
  if (!isAuthorized) return null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <UserSideBarComponent
        isOpen={isSideBarOpen}
        role={user?.role}
        onToggle={() => setIsSideBarOpen((prev) => !prev)}
      />

      <main
        className={`${layoutStyles.mainLayout} ${isSideBarOpen ? layoutStyles.sidebarOpen : ""}`}
      >
        <div className={styles.pageContainer}>
          {/* ── Toast ─────────────────────────────────────────────────────── */}
          {toast && (
            <ToastComponent
              message={toast.message}
              type={toast.type}
              onClose={hideToast}
            />
          )}

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className={styles.header}>
            <div className={styles.leftHeader}>
              <h1 className={styles.title}>
                กล้องทั้งหมด{" "}
                <span className={styles.titleCount}>
                  ({dataLoading ? "—" : cameras.length})
                </span>
              </h1>
              <p className={styles.subtitle}>
                ระบบตรวจจับใบหน้าและติดตามแบบเรียลไทม์
              </p>
            </div>

            <UserDropdownComponent
              username={user?.username}
              role={user?.role}
              onSignOut={handleSignOut}
            />
          </div>

          {/* ── Content ───────────────────────────────────────────────────── */}
          <div className={styles.content}>
            {/* Toolbar */}
            <div className={styles.toolBar}>
              <div className={styles.toolBarLeft}>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="ค้นหาชื่อกล้อง หรือตำแหน่ง..."
                />
              </div>

              <div className={styles.toolBarRight}>
                <button
                  className={styles.refreshButton}
                  onClick={() => fetchCameras()}
                  disabled={dataLoading}
                  aria-label="รีเฟรชรายการกล้อง"
                >
                  <span className={styles.refreshButtonIcon}>
                    <RefreshCw
                      size={15}
                      className={dataLoading ? styles.spinning : ""}
                    />
                  </span>
                  รีเฟรช
                </button>
              </div>
            </div>

            {/* Table area */}
            <div className={styles.tableArea}>
              {/* Loading */}
              {dataLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <p className={styles.stateLabel}>กำลังโหลดรายการกล้อง...</p>
                </div>

                /* Error */
              ) : fetchError ? (
                <div className={styles.errorState}>
                  <span className={styles.stateIcon}>
                    <AlertTriangle size={40} />
                  </span>
                  <p className={styles.stateLabel}>{fetchError}</p>
                </div>

                /* Empty */
              ) : filteredCameras.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.stateIcon}>
                    <Video size={40} />
                  </span>
                  <p className={styles.stateLabel}>
                    {searchQuery ? "ไม่พบผลการค้นหา" : "ยังไม่มีกล้องในระบบ"}
                  </p>
                </div>

                /* Camera grid */
              ) : (
                <div className={styles.grid}>
                  {filteredCameras.map((camera) => (
                    <CameraCard key={camera.id} camera={camera} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

// ── Camera Card ───────────────────────────────────────────────────────────────
// Extracted to its own component so each card manages its own preview state.
function CameraCard({ camera }: { camera: CameraData }) {
  return (
    <Link href={`/camera/${camera.id}`} className={styles.card}>
      {/* Preview thumbnail */}
      <div className={styles.cameraPreview}>
        {camera.is_detect && (
          <div className={styles.detectBadge}>
            <span className={styles.detectDot} />
            <span className={styles.detectText}>กำลังตรวจจับ</span>
          </div>
        )}

        <span className={styles.cameraIdBadge}>ID: {String(camera.id).padStart(3, "0")}</span>

        <CameraPreviewComponent cameraId={camera.id} />
      </div>

      {/* Card body */}
      <div className={styles.cardBody}>
        <div className={styles.cardNameRow}>
          <p className={styles.cardName}>{camera.name}</p>
          {/* <span className={`${styles.statusPill} ${camera.is_detect ? styles.active : styles.inactive}`}>
            <span className={styles.statusDot} />
            {camera.is_detect ? "ตรวจจับอยู่" : "ไม่ได้ใช้งาน"}
          </span> */}
        </div>

        <div className={styles.cardMeta}>
          <MapPin size={11} className={styles.cardMetaIcon} />
          <span className={styles.cardLocation}>
            {camera.location?.trim() || "—"}
          </span>
        </div>

        <div className={styles.cardMeta}>
          <Wifi size={11} className={styles.cardMetaIcon} />
          <span className={styles.cardIp}>{camera.ip}:{camera.port}</span>
        </div>
      </div>

    </Link>
  )
}