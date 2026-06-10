"use client"



import { AlertTriangle, ArrowUpDown, BellOff, BellRing, CirclePlus, Filter, Pencil, Power, PowerOff, RefreshCw, Search, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/camera-management.module.css"

import ToastComponent from "@/components/toast"
import SearchBarComponent from "@/components/search-bar"
import UserDropdownComponent from "@/components/user-dropdown"

import { useAuth } from "@/lib/auth-context"
import { exportToCSV, exportToPDF } from "@/lib/export-file"
import { ToastState } from "@/types/toast"



/* ================================================================
   TYPES
   ================================================================ */
interface Camera {
    id: number
    name: string
    location: string
    username: string
    password: string
    ip: string
    port: string
    is_detect: boolean
    is_notify: boolean
    channel: 101 | 102
}

interface CameraFormData {
    id?: number
    name: string
    location: string
    username: string
    password: string
    ip: string
    port: string
    channel: 101 | 102
}

type ModalMode = "add" | "edit" | "delete" | null
type ToastType = "error" | "success" | "warning" | "info"
type FilterStatus = "all" | "detecting" | "idle"
type SortField = "id" | "name" | "location" | "ip" | "port" | null
type SortOrder = "asc" | "desc"
interface ToastData {
    message: string
    type: ToastType
}



/* ================================================================
   CONSTANTS
   ================================================================ */
const POLL_INTERVAL_MS = 5000
const TOAST_DURATION_MS = 5000
const ROW_HEIGHT = 50
const HEADER_HEIGHT = 40
const PENDING_DURATION_MS = 2000 // ระยะเวลาเก็บ pending state

const defaultForm = {
    name: "", location: "", username: "",
    password: "", ip: "", port: "",
    channel: 102 as 101 | 102,  // ✅
}



export default function CameraManagementPage() {
    const { user, signOut: logout } = useAuth()
    const router = useRouter()

    /* ---------- state: data ---------------------------------------- */
    const [cameras, setCameras] = useState<Camera[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState(false)

    /* ---------- state: search & filter ----------------------------- */
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")

    /* ---------- state: pagination ---------------------------------- */
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    /* ---------- state: dropdowns ----------------------------------- */
    const [filterOpen, setFilterOpen] = useState(false)
    const [exportOpen, setExportOpen] = useState(false)

    /* ---------- state: toggling a single camera -------------------- */
    const [togglingNotifyId, setTogglingNotifyId] = useState<number | null>(null)
    const [togglingDetectId, setTogglingDetectId] = useState<number | null>(null)

    /* ---------- state: toast --------------------------------------- */
    const [toast, setToast] = useState<ToastState | null>(null)
    const isMountedRef = useRef(true)

    /* ---------- state: modal + form -------------------------------- */
    const [modalMode, setModalMode] = useState<ModalMode>(null)
    const [editingCameraId, setEditingCameraId] = useState<number | null>(null)
    const [formData, setFormData] = useState<CameraFormData>({
        name: "",
        location: "",
        username: "",
        password: "",
        ip: "",
        port: "",
        channel: 102,
    })

    /* ---------- state: delete confirmation ------------------------- */
    const [deletingCamera, setDeletingCamera] = useState<Camera | null>(null)
    const [deleteConfirmName, setDeleteConfirmName] = useState("")

    /* ---------- refs: keep editingCameraId in sync for async ------- */
    const editingCameraIdRef = useRef<number | null>(null)

    /* ---------- refs: click-outside for dropdowns ------------------ */
    const filterWrapperRef = useRef<HTMLDivElement>(null)
    const exportWrapperRef = useRef<HTMLDivElement>(null)

    /* ---------- refs: measure table container ---------------------- */
    const tableContainerRef = useRef<HTMLDivElement>(null)

    /* ---------- refs: pending operations (KEY FIX!) ------------- */
    const pendingNotifyTogglesRef = useRef<Set<number>>(new Set())
    const pendingDetectTogglesRef = useRef<Set<number>>(new Set())
    const isFetchingRef = useRef(false)

    // ====== SIGN OUT =================================
    const handleSignOut = () => {
        logout()
        router.replace("/sign-in")
    }
    const [sortField, setSortField] = useState<SortField>(null)
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
    // ====== SORT =====================================
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortOrder("asc")
        }
    }
    /* ============================================================
       DERIVED / COMPUTED
       ============================================================ */
    const filteredCameras = cameras.filter(camera => {
        const haystack = `${camera.id} ${camera.name} ${camera.location} ${camera.ip} ${camera.port} ${camera.username} ${camera.is_detect ? "detecting" : "idle"}`.toLowerCase()
        const matchesSearch = haystack.includes(searchQuery.toLowerCase())

        const matchesStatus =
            statusFilter === "all"
                ? true
                : statusFilter === "detecting"
                    ? camera.is_detect
                    : !camera.is_detect

        return matchesSearch && matchesStatus
    }).sort((a, b) => {
        if (!sortField) return 0

        let valueA: any
        let valueB: any

        switch (sortField) {
            case "id":
                valueA = a.id
                valueB = b.id
                break
            case "name":
                valueA = a.name
                valueB = b.name
                break
            case "location":
                valueA = a.location || ""
                valueB = b.location || ""
                break
            case "ip":
                valueA = a.ip
                valueB = b.ip
                break
            case "port":
                valueA = a.port
                valueB = b.port
                break
            default:
                return 0
        }

        if (valueA < valueB) return sortOrder === "asc" ? -1 : 1
        if (valueA > valueB) return sortOrder === "asc" ? 1 : -1
        return 0
    })

    const totalPages = Math.max(1, Math.ceil(filteredCameras.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentCameras = filteredCameras.slice(startIndex, endIndex)

    const detectingCount = cameras.filter(c => c.is_detect).length
    const idleCount = cameras.filter(c => !c.is_detect).length
    const hasActiveFilters = statusFilter !== "all" || searchQuery !== ""

    /* ============================================================
     CALCULATE ITEMS PER PAGE based on container height
     ============================================================ */
    const calculateItemsPerPage = useCallback(() => {
        if (!tableContainerRef.current) return

        const containerHeight = tableContainerRef.current.clientHeight
        const headerElement = tableContainerRef.current.querySelector('thead')
        const actualHeaderHeight = headerElement?.clientHeight || HEADER_HEIGHT

        // วัดความสูง row จริงจาก DOM ถ้ามี ถ้าไม่มีใช้ค่า default
        const firstRow = tableContainerRef.current.querySelector(`tbody tr.${styles.tableRow}`) as HTMLElement | null
        const actualRowHeight = firstRow
            ? firstRow.getBoundingClientRect().height
            : ROW_HEIGHT

        // หัก 2px safety buffer ป้องกัน row สุดท้ายโดนซ่อนครึ่งนึง
        const availableHeight = containerHeight - actualHeaderHeight - 2
        const calculatedItems = Math.floor(availableHeight / actualRowHeight)
        const newItemsPerPage = Math.max(1, Math.min(50, calculatedItems))

        if (newItemsPerPage !== itemsPerPage) {
            setItemsPerPage(newItemsPerPage)
            setCurrentPage(1)
        }
    }, [itemsPerPage])

    /* ============================================================
       TOAST helpers
       ============================================================ */

    /* ============================================================
 TOAST
 ============================================================ */
    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) {
            setToast({ message, type })
        }
    }, [])


    const hideToast = useCallback(() => {
        if (isMountedRef.current) {
            setToast(null)
        }
    }, [])

    /* ============================================================
       MODAL helpers
       ============================================================ */
    const closeModal = useCallback(() => {
        setModalMode(null)
        setEditingCameraId(null)
        editingCameraIdRef.current = null
        setFormData({
            name: "",
            location: "",
            username: "",
            password: "",
            ip: "",
            port: "",
            channel: 102,
        })
        setDeletingCamera(null)
        setDeleteConfirmName("")
    }, [])

    const openAddModal = () => {
        setModalMode("add")
        setEditingCameraId(null)
        editingCameraIdRef.current = null
        setFormData({
            name: "",
            location: "",
            username: "",
            password: "",
            ip: "",
            port: "",
            channel: 102,
        })
    }

    const openEditModal = (camera: Camera, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!camera?.id) {
            showToast("ข้อมูลกล้องไม่ถูกต้อง", "error")
            return
        }
        setModalMode("edit")
        setEditingCameraId(camera.id)
        editingCameraIdRef.current = camera.id
        setFormData({
            id: camera.id,
            name: camera.name,
            location: camera.location,
            username: camera.username,
            password: "",
            ip: camera.ip,
            port: camera.port,
            channel: camera.channel ?? 102,
        })
    }

    const openDeleteModal = (camera: Camera, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeletingCamera(camera)
        setDeleteConfirmName("")
        setModalMode("delete")
    }

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    /* ============================================================
       FILTER helpers
       ============================================================ */
    const handleFilterChange = (status: FilterStatus) => {
        setStatusFilter(status)
        setFilterOpen(false)
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setStatusFilter("all")
        setSearchQuery("")
        setCurrentPage(1)
    }

    /* ============================================================
       API – fetch (🔥 แก้ไขเพื่อไม่ update กล้องที่ pending)
       ============================================================ */
    const fetchCameras = useCallback(async (showLoading = true) => {
        // ป้องกัน concurrent fetches
        if (isFetchingRef.current) return

        // ไม่ fetch ระหว่าง toggle (optional - เพื่อความปลอดภัยเพิ่มเติม)
        if (togglingDetectId !== null || togglingNotifyId !== null) {
            return
        }

        try {
            isFetchingRef.current = true

            if (showLoading) {
                setLoading(true)
                setFetchError(false)
            }

            const res = await fetch("/api/camera/list")
            if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลกล้องได้")

            const data: Camera[] = await res.json()

            // 🔥 KEY FIX: ไม่ update กล้องที่กำลัง pending
            setCameras(prev => {
                const hasPending =
                    pendingNotifyTogglesRef.current.size > 0 ||
                    pendingDetectTogglesRef.current.size > 0

                if (!hasPending) {
                    // ไม่มี pending → update ทั้งหมด
                    return data
                }

                // มี pending → รักษาค่าเดิมของกล้องที่ pending
                return data.map(newCam => {
                    const isPendingNotify = pendingNotifyTogglesRef.current.has(newCam.id)
                    const isPendingDetect = pendingDetectTogglesRef.current.has(newCam.id)

                    if (!isPendingNotify && !isPendingDetect) {
                        return newCam // ไม่ pending → ใช้ข้อมูลใหม่
                    }

                    // กล้องนี้กำลัง pending → รักษาค่าเดิม
                    const oldCam = prev.find(c => c.id === newCam.id)
                    if (!oldCam) return newCam

                    return {
                        ...newCam,
                        is_notify: isPendingNotify ? oldCam.is_notify : newCam.is_notify,
                        is_detect: isPendingDetect ? oldCam.is_detect : newCam.is_detect,
                    }
                })
            })

            setFetchError(false)
        } catch (err) {
            setFetchError(true)
            if (showLoading) {
                showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
            }
        } finally {
            if (showLoading) setLoading(false)
            isFetchingRef.current = false
        }
    }, [showToast, togglingDetectId, togglingNotifyId])


    /* ============================================================
       API – CRUD
       ============================================================ */
    const handleAddCamera = async () => {
        try {
            setLoading(true)

            const res = await fetch("/api/camera/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "เพิ่มกล้องไม่สำเร็จ")
            }

            closeModal()

            await fetchCameras()

            showToast("เพิ่มกล้องสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถเพิ่มกล้องได้", "error")
        } finally {
            setLoading(false)
        }
    }

    const handleEditCamera = async (cameraId: number) => {
        if (!cameraId) {
            showToast("ID กล้องไม่ถูกต้อง", "error")
            return
        }
        try {
            const { id: _, ...payload } = formData
            const updatePayload = formData.password
                ? payload
                : { ...payload, password: undefined }

            const res = await fetch(`/api/camera/${cameraId}/edit`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "แก้ไขกล้องไม่สำเร็จ")
            }
            closeModal()
            await fetchCameras()
            showToast("แก้ไขกล้องสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถแก้ไขกล้องได้", "error")
        }
    }

    const handleDeleteCamera = async () => {
        if (!deletingCamera) return
        if (deleteConfirmName.trim() !== deletingCamera.name.trim()) {
            showToast("ชื่อกล้องไม่ตรงกัน", "error")
            return
        }
        try {
            const res = await fetch(`/api/camera/${deletingCamera.id}/delete`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "ลบกล้องไม่สำเร็จ")
            }

            const willPageBeEmpty = currentCameras.length === 1
            closeModal()
            await fetchCameras()
            if (willPageBeEmpty && currentPage > 1) setCurrentPage(p => p - 1)

            showToast("ลบกล้องสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถลบกล้องได้", "error")
        }
    }

    /* ============================================================
       API – toggle detection on/off (🔥 ใช้ Pending Set)
       ============================================================ */
    const toggleDetection = async (camera: Camera, e: React.MouseEvent) => {
        e.stopPropagation()

        // ป้องกันการกดซ้ำ
        if (togglingDetectId === camera.id) return
        if (pendingDetectTogglesRef.current.has(camera.id)) return

        const endpoint = camera.is_detect ? "stop_detect" : "start_detect"
        const actionLabel = camera.is_detect ? "หยุดตรวจจับ" : "เริ่มตรวจจับ"
        const previousState = camera.is_detect

        // เพิ่มเข้า pending set
        pendingDetectTogglesRef.current.add(camera.id)
        setTogglingDetectId(camera.id)

        // optimistic update
        setCameras(prev =>
            prev.map(c => (c.id === camera.id ? { ...c, is_detect: !c.is_detect } : c))
        )

        try {
            const res = await fetch(`/api/camera/${camera.id}/${endpoint}`, { method: "PATCH" })
            if (!res.ok) {
                // rollback
                setCameras(prev =>
                    prev.map(c => (c.id === camera.id ? { ...c, is_detect: previousState } : c))
                )
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "เปลี่ยนสถานะไม่สำเร็จ")
            }
            showToast(`${actionLabel}สำเร็จ`, "success")
        } catch (err) {
            showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
        } finally {
            setTogglingDetectId(null)
            // ลบออกจาก pending หลังรอให้ API process เสร็จ
            setTimeout(() => {
                pendingDetectTogglesRef.current.delete(camera.id)
            }, PENDING_DURATION_MS)
        }
    }

    /* ============================================================
       API – toggle notification (🔥 ใช้ Pending Set แทนหยุด polling)
       ============================================================ */
    const toggleNofification = async (camera: Camera, e: React.MouseEvent) => {
        e.stopPropagation()

        // ป้องกันการกดซ้ำ
        if (togglingNotifyId === camera.id) return
        if (pendingNotifyTogglesRef.current.has(camera.id)) return

        const endpoint = camera.is_notify ? "stop_notify" : "start_notify"
        const actionLabel = camera.is_notify ? "หยุดการแจ้งเตือน" : "เริ่มการแจ้งเตือน"
        const previousState = camera.is_notify

        // 🔥 เพิ่มเข้า pending set (แทนการหยุด polling)
        pendingNotifyTogglesRef.current.add(camera.id)
        setTogglingNotifyId(camera.id)

        // optimistic update
        setCameras(prev =>
            prev.map(c => (c.id === camera.id ? { ...c, is_notify: !c.is_notify } : c))
        )

        try {
            const res = await fetch(`/api/camera/${camera.id}/${endpoint}`, { method: "PATCH" })
            if (!res.ok) {
                // rollback
                setCameras(prev =>
                    prev.map(c => (c.id === camera.id ? { ...c, is_notify: previousState } : c))
                )
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "เปลี่ยนสถานะไม่สำเร็จ")
            }
            showToast(`${actionLabel}สำเร็จ`, "success")
        } catch (err) {
            showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
        } finally {
            setTogglingNotifyId(null)
            // 🔥 ลบออกจาก pending หลังรอให้ API process เสร็จ
            setTimeout(() => {
                pendingNotifyTogglesRef.current.delete(camera.id)
            }, PENDING_DURATION_MS)
        }
    }

    /* ============================================================
       EXPORT helpers
       ============================================================ */
    const handleExportCSV = () => {
        if (!filteredCameras.length) return

        exportToCSV(
            filteredCameras.map(c => [
                c.id,
                c.name,
                c.location || "-",
                c.ip,
                c.port
            ]),
            ["ไอดี", "ชื่อ", "ตำแหน่ง", "IP", "Port"],
            "persons"
        )
    }
    const handleExportPDF = () => {
        if (!filteredCameras.length) return
        exportToPDF(
            filteredCameras.map(c => [
                c.id,
                c.name,
                c.location || "-",
                c.ip,
                c.port
            ]),
            ["ไอดี", "ชื่อ", "ตำแหน่ง", "IP", "Port"],
            "รายการกล้อง",
            "persons"
        )
    }

    /* ============================================================
       FORM submit dispatcher
       ============================================================ */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (modalMode === "add") {
            await handleAddCamera()
        } else if (modalMode === "edit") {
            const id = editingCameraIdRef.current
            if (!id) {
                showToast("ไม่พบ ID กล้อง", "error")
                return
            }
            await handleEditCamera(id)
        }
    }

    /* ============================================================
       EFFECTS
       ============================================================ */

    // 1. initial fetch + polling
    useEffect(() => {
        fetchCameras(true)
        const interval = setInterval(() => fetchCameras(false), POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [fetchCameras])

    // 2. reset page on search change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    // 3. clamp page when totalPages shrinks
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages)
    }, [currentPage, totalPages])

    // 4. auto-dismiss toast
    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(hideToast, TOAST_DURATION_MS)
        return () => clearTimeout(timer)
    }, [toast, hideToast])

    // 5. click-outside closes dropdowns
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target as Node)) {
                setFilterOpen(false)
            }
            if (exportWrapperRef.current && !exportWrapperRef.current.contains(e.target as Node)) {
                setExportOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])


    // 6. คำนวณ itemsPerPage เมื่อ mount, resize — ใช้ rAF ให้ DOM paint เสร็จก่อนวัด
    useEffect(() => {
        const measure = () => calculateItemsPerPage()
        const raf = requestAnimationFrame(measure)

        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(measure)
        })

        if (tableContainerRef.current) {
            resizeObserver.observe(tableContainerRef.current)
        }

        return () => {
            cancelAnimationFrame(raf)
            resizeObserver.disconnect()
        }
    }, [calculateItemsPerPage])

    // 7. วัดใหม่หลัง data โหลดเสร็จ เพราะ row จริงถึงจะ render ให้วัดได้
    useEffect(() => {
        if (!loading) {
            requestAnimationFrame(() => calculateItemsPerPage())
        }
    }, [loading, calculateItemsPerPage])

    /* ============================================================
       RENDER
       ============================================================ */
    return (
        <div className={styles.pageContainer}>
            {/* ====== TOAST ===================================== */}
            {toast && (
                <ToastComponent
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            {/* ====== HEADER ==================================== */}
            <div className={styles.header}>
                <div className={styles.leftHeader}>
                    <h1 className={styles.title}>กล้องทั้งหมด ({cameras.length})</h1>
                    <p className={styles.subtitle}>ข้อมูลและการจัดการกล้องทั้งหมดภายในระบบ</p>
                </div>

                <div className={styles.rightHeader}>
                    <UserDropdownComponent
                        username={user?.username}
                        role={user?.role}
                        onSignOut={handleSignOut}
                    />
                </div>
            </div>

            {/* ─── Content Card ────────────────────────────────────── */}
            <div className={styles.content}>

                {/* ── Toolbar ──────────────────────────────────────── */}
                <div className={styles.toolBar}>

                    {/* left: search + filter */}
                    <div className={styles.leftToolBar}>
                        <SearchBarComponent
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="ค้นหากล้อง..."
                        />

                        <div className={styles.filterWrapper} ref={filterWrapperRef}>
                            <button
                                className={statusFilter !== "all" ? styles.filterButtonActive : styles.filterButton}
                                onClick={() => setFilterOpen(prev => !prev)}
                            >
                                <span className={styles.pillButtonIcon}><Filter size={16} /></span>
                                {statusFilter === "all" ? "ตัวกรอง" : statusFilter === "detecting" ? "กำลังตรวจจับ" : "ไม่ได้ตรวจจับ"}
                            </button>

                            {filterOpen && (
                                <div className={styles.filterDropdown}>
                                    <div className={styles.filterDropdownHeader}>
                                        <span>สถานะการตรวจจับ</span>
                                        {statusFilter !== "all" && (
                                            <button className={styles.clearButton} onClick={clearFilters}>ล้างทั้งหมด</button>
                                        )}
                                    </div>

                                    <button
                                        className={statusFilter === "all" ? styles.filterOptionActive : styles.filterOption}
                                        onClick={() => handleFilterChange("all")}
                                    >
                                        <span>ทั้งหมด</span>
                                        <span className={styles.filterCount}>{cameras.length}</span>
                                    </button>

                                    <button
                                        className={statusFilter === "detecting" ? styles.filterOptionActive : styles.filterOption}
                                        onClick={() => handleFilterChange("detecting")}
                                    >
                                        <span>กำลังตรวจจับ</span>
                                        <span className={styles.filterCount}>{detectingCount}</span>
                                    </button>

                                    <button
                                        className={statusFilter === "idle" ? styles.filterOptionActive : styles.filterOption}
                                        onClick={() => handleFilterChange("idle")}
                                    >
                                        <span>ไม่ได้ตรวจจับ</span>
                                        <span className={styles.filterCount}>{idleCount}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* right: export + add */}
                    <div className={styles.rightToolBar}>
                        <button className={styles.addButton} onClick={openAddModal}>
                            <span className={styles.pillButtonIcon}><CirclePlus size={16} /></span>
                            เพิ่ม
                        </button>

                        <div className={styles.exportWrapper} ref={exportWrapperRef}>
                            <button
                                className={styles.exportButton}
                                onClick={() => setExportOpen(prev => !prev)}
                                disabled={filteredCameras.length === 0}
                            >
                                <span className={styles.pillButtonIcon}><Upload size={16} /></span>
                                Export
                            </button>

                            {exportOpen && (
                                <div className={styles.exportDropdown}>
                                    <button onClick={handleExportCSV}>Export CSV</button>
                                    <button onClick={handleExportPDF}>Export PDF</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Table Area ── */}
                <div className={styles.tableArea}>
                    <div className={styles.tableContainer} ref={tableContainerRef}>
                        <table className={styles.table}>

                            <thead className={styles.tableHeader}>
                                <tr>
                                    <th onClick={() => handleSort("id")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                            ไอดี
                                            {sortField === "id" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("name")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            ชื่อ
                                            {sortField === "name" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("location")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            ตำแหน่ง
                                            {sortField === "location" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("ip")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            IP
                                            {sortField === "ip" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("port")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            Port
                                            {sortField === "port" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    {/* <th>สถานะการตรวจจับ</th>
                                    <th>สถานะการแจ้งเตือน</th> */}
                                    <th>จัดการ</th>
                                </tr>
                            </thead>

                            <tbody className={styles.tableBody}>

                                {loading && (
                                    <tr className={styles.stateRow}>
                                        <td colSpan={8} className={styles.stateCell}>
                                            <div className={styles.stateInner}>
                                                <div className={styles.spinner} />
                                                <span className={styles.stateText}>กำลังโหลดข้อมูล…</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loading && fetchError && (
                                    <tr className={styles.stateRow}>
                                        <td colSpan={8} className={styles.stateCell}>
                                            <div className={styles.stateInner}>
                                                <span className={styles.errorIcon}><AlertTriangle size={48} /></span>
                                                <p className={styles.errorText}>ไม่สามารถโหลดข้อมูลได้</p>
                                                <button className={styles.retryButton} onClick={() => fetchCameras(true)}>
                                                    <RefreshCw size={15} /> ลองใหม่
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loading && !fetchError && filteredCameras.length === 0 && (
                                    <tr className={styles.stateRow}>
                                        <td colSpan={8} className={styles.stateCell}>
                                            <div className={styles.stateInner}>
                                                <span className={styles.emptyIcon}><Search size={48} /></span>
                                                <p className={styles.emptyText}>
                                                    {hasActiveFilters
                                                        ? "ไม่พบกล้องที่ตรงกับเงื่อนไข"
                                                        : "ยังไม่มีกล้องในระบบ"}
                                                </p>
                                                {hasActiveFilters && (
                                                    <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                                                        ล้างตัวกรอง
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loading && !fetchError && currentCameras.map(camera => (
                                    <tr
                                        key={camera.id}
                                        className={styles.tableRow}
                                        onClick={() => router.push(`/camera-management/${camera.id}`)}
                                    >
                                        <td>{camera.id}</td>
                                        <td>{camera.name}</td>
                                        <td>{camera.location || "–"}</td>
                                        <td className={styles.ipCell}>{camera.ip}</td>
                                        <td className={styles.portCell}>{camera.port}</td>

                                        {/* <td>
                                            <span className={`${styles.statusBadge} ${camera.is_detect ? styles.statusDetecting : styles.statusIdle}`}>
                                                {camera.is_detect ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                            </span>
                                        </td>

                                        <td>
                                            <span className={`${styles.statusBadge} ${camera.is_notify ? styles.statusDetecting : styles.statusIdle}`}>
                                                {camera.is_notify ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                            </span>
                                        </td> */}

                                        <td>
                                            <div className={styles.actionGroup}>
                                                <button
                                                    className={[
                                                        camera.is_detect ? styles.toggleOn : styles.toggleOff,
                                                        togglingDetectId === camera.id ? styles.toggleLoading : "",
                                                    ].join(" ")}
                                                    onClick={e => toggleDetection(camera, e)}
                                                    disabled={togglingDetectId === camera.id}
                                                    title={camera.is_detect ? "หยุดตรวจจับ" : "เริ่มตรวจจับ"}
                                                >
                                                    {camera.is_detect ? <Power size={17} /> : <PowerOff size={17} />}
                                                </button>

                                                <button
                                                    className={[
                                                        camera.is_notify ? styles.toggleOn : styles.toggleOff,
                                                        togglingNotifyId === camera.id ? styles.toggleLoading : "",
                                                    ].join(" ")}
                                                    onClick={e => toggleNofification(camera, e)}
                                                    disabled={togglingNotifyId === camera.id}
                                                    title={camera.is_notify ? "หยุดการแจ้งเตือน" : "เริ่มการแจ้งเตือน"}
                                                >
                                                    {camera.is_notify ? <BellRing size={17} /> : <BellOff size={17} />}
                                                </button>

                                                <button
                                                    className={styles.editBtn}
                                                    onClick={e => openEditModal(camera, e)}
                                                    title="แก้ไข"
                                                >
                                                    <Pencil size={17} />
                                                </button>

                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={e => openDeleteModal(camera, e)}
                                                    title="ลบ"
                                                >
                                                    <Trash2 size={17} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!loading && !fetchError && filteredCameras.length > 0 && (
                        <div className={styles.pagination}>
                            <span className={styles.paginationInfo}>
                                แสดง {startIndex + 1}–{Math.min(endIndex, filteredCameras.length)} จาก {filteredCameras.length} รายการ
                            </span>
                            <div className={styles.paginationControls}>
                                <button
                                    className={styles.paginationBtn}
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    ก่อนหน้า
                                </button>
                                <span className={styles.paginationText}>หน้า {currentPage} / {totalPages}</span>
                                <button
                                    className={styles.paginationBtn}
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modals (Add/Edit/Delete) ─────────────────────── */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                {modalMode === "add"
                                    ? "เพิ่มกล้อง"
                                    : `แก้ไขกล้อง${editingCameraId ? ` (ID: ${editingCameraId})` : ""}`}
                            </h2>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label>ชื่อ <span className={styles.required}>*</span></label>
                                <input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                    placeholder="กรอกชื่อกล้อง"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>ตำแหน่งที่ตั้ง</label>
                                <input
                                    name="location"
                                    value={formData.location || ""}
                                    onChange={handleFormChange}
                                    placeholder="กรอกตำแหน่งที่ตั้ง (ไม่บังคับ)"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Username <span className={styles.required}>*</span></label>
                                <input
                                    name="username"
                                    value={formData.username || ""}
                                    onChange={handleFormChange}
                                    required
                                    placeholder="กรอก username สำหรับ RTSP"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>
                                    Password
                                    {modalMode === "add" && <span className={styles.required}>*</span>}
                                    {modalMode === "edit" && <span className={styles.optional}> (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</span>}
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleFormChange}
                                    required={modalMode === "add"}
                                    placeholder={modalMode === "add" ? "กรอก password สำหรับ RTSP" : "กรอก password ใหม่ (ถ้าต้องการเปลี่ยน)"}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>IP Address <span className={styles.required}>*</span></label>
                                <input
                                    name="ip"
                                    value={formData.ip}
                                    onChange={handleFormChange}
                                    required
                                    placeholder="เช่น 192.168.1.100"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Port <span className={styles.required}>*</span></label>
                                <input
                                    name="port"
                                    value={formData.port}
                                    onChange={handleFormChange}
                                    required
                                    placeholder="เช่น 554"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Stream <span className={styles.required}>*</span></label>
                                <select
                                    name="channel"
                                    value={formData.channel}
                                    onChange={e => setFormData(prev => ({
                                        ...prev,
                                        channel: Number(e.target.value) as 101 | 102
                                    }))}
                                    className={styles.selectInput}
                                >
                                    <option value={102}>Sub Stream (102)</option>
                                    <option value={101}>Main Stream (101)</option>
                                </select>
                            </div>

                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                                <button
                                    type="submit"
                                    className={styles.submitButton}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span>
                                            {modalMode === "add" ? "กำลังเพิ่ม..." : "กำลังบันทึก..."}
                                        </span>
                                    ) : (
                                        <span>
                                            {modalMode === "add" ? "เพิ่ม" : "บันทึก"}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalMode === "delete" && deletingCamera && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>ยืนยันการลบกล้อง</h2>
                        </div>

                        <div className={styles.form}>
                            <p className={styles.deleteDescription}>
                                คุณกำลังจะลบกล้อง <strong>{deletingCamera.name}</strong>
                            </p>
                            <p className={styles.deleteHint}>
                                กรุณาพิมพ์ชื่อกล้อง <strong>"{deletingCamera.name}"</strong> เพื่อยืนยันการลบ
                            </p>

                            <div className={styles.formGroup}>
                                <label>ชื่อกล้อง <span className={styles.required}>*</span></label>
                                <input
                                    type="text"
                                    value={deleteConfirmName}
                                    onChange={e => setDeleteConfirmName(e.target.value)}
                                    placeholder={`พิมพ์ "${deletingCamera.name}" เพื่อยืนยัน`}
                                    autoFocus
                                />
                            </div>

                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                                <button
                                    type="button"
                                    className={styles.submitButtonDelete}
                                    onClick={handleDeleteCamera}
                                    disabled={deleteConfirmName.trim() !== deletingCamera.name.trim()}
                                >
                                    ลบกล้อง
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}