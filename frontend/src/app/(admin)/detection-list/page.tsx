"use client"



import { AlertTriangle, ArrowUpDown, Calendar, Filter, RefreshCw, Search, Trash2, Upload, UserRoundCheck, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/detection-list.module.css"

import SearchBarComponent from "@/components/search-bar"
import ToastComponent from "@/components/toast"
import UserDropdownComponent from "@/components/user-dropdown"

import { DetectionData } from "@/types/detection"
import { useAuth } from "@/lib/auth-context"
import { exportToCSV as exportCSVUtil, exportToPDF as exportPDFUtil, } from "@/lib/export-file"
import { ToastState, ToastType } from "@/types/toast"



type FilterStatus = "all" | "normal" | "blacklist"
type FilterDateRange = "all" | "today" | "week" | "month" | "custom"
type SortField = "id" | "name" | "external_id" | "position" | "group" | "similarity" | "is_blacklist" | null
type SortOrder = "asc" | "desc"
type ModalMode = "delete" | "detail" | null



const POLL_INTERVAL_MS = 10000
const TOAST_DURATION_MS = 5000
const ROW_HEIGHT = 50
const HEADER_HEIGHT = 40
const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || ""



export default function DetectionListPage() {
    const { user, signOut: logout } = useAuth()
    const router = useRouter()

    const [toast, setToast] = useState<ToastState | null>(null)
    const isMountedRef = useRef(true)

    const [searchQuery, setSearchQuery] = useState("")

    const filterWrapperRef = useRef<HTMLDivElement>(null)
    const [filterOpen, setFilterOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")

    const dateFilterWrapperRef = useRef<HTMLDivElement>(null)
    const [dateFilterOpen, setDateFilterOpen] = useState(false)
    const [dateRangeFilter, setDateRangeFilter] = useState<FilterDateRange>("all")
    const [customStartDate, setCustomStartDate] = useState("")
    const [customEndDate, setCustomEndDate] = useState("")

    const [sortField, setSortField] = useState<SortField>(null)
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

    const [detections, setDetections] = useState<DetectionData[]>([])
    const [loadingData, setLoadingData] = useState(true)
    const [fetchError, setFetchError] = useState(false)

    const exportWrapperRef = useRef<HTMLDivElement>(null)
    const [exportOpen, setExportOpen] = useState(false)

    const tableContainerRef = useRef<HTMLDivElement>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    const [modalMode, setModalMode] = useState<ModalMode>(null)
    const [deletingDetection, setDeletingDetection] = useState<DetectionData | null>(null)
    const [viewingDetection, setViewingDetection] = useState<DetectionData | null>(null)


    const handleSignOut = () => {
        logout()
        router.replace("/sign-in")
    }

    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) setToast({ message, type })
    }, [])

    const hideToast = useCallback(() => {
        if (isMountedRef.current) setToast(null)
    }, [])


    /* ============================================================
       FILTERS
       ============================================================ */
    const handleFilterChange = (status: FilterStatus) => {
        setStatusFilter(status)
        setFilterOpen(false)
        setCurrentPage(1)
    }

    const handleDateRangeChange = (range: FilterDateRange) => {
        setDateRangeFilter(range)
        if (range !== "custom") setDateFilterOpen(false)
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setStatusFilter("all")
        setDateRangeFilter("all")
        setSearchQuery("")
        setCustomStartDate("")
        setCustomEndDate("")
        setSortField(null)
        setSortOrder("asc")
        setCurrentPage(1)
    }

    const getDateFilterLabel = () => {
        const labels: Record<FilterDateRange, string> = { all: "ทั้งหมด", today: "วันนี้", week: "7 วันที่แล้ว", month: "30 วันที่แล้ว", custom: "กำหนดเอง" }
        return labels[dateRangeFilter]
    }

    const normalCount = detections.filter(d => !d.is_blacklist).length
    const blacklistCount = detections.filter(d => d.is_blacklist).length
    const hasActiveFilters = statusFilter !== "all" || dateRangeFilter !== "all" || searchQuery !== ""


    /* ============================================================
       FILTER & SORT DATA
       ============================================================ */
    const filteredDetections = detections
        .filter(detection => {
            // เพิ่ม group ใน haystack
            const haystack = `${detection.id} ${detection.first_name} ${detection.last_name} ${detection.external_id} ${detection.position} ${detection.group} ${detection.is_blacklist ? "บัญชีดำ" : "ปกติ"}`.toLowerCase()
            const matchesSearch = haystack.includes(searchQuery.toLowerCase())

            const matchesStatus =
                statusFilter === "all" ? true
                    : statusFilter === "normal" ? !detection.is_blacklist
                        : detection.is_blacklist

            let matchesDateRange = true
            if (detection.detected_at && dateRangeFilter !== "all") {
                const detectedDate = new Date(detection.detected_at)
                const now = new Date()
                if (dateRangeFilter === "today") {
                    matchesDateRange = detectedDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
                } else if (dateRangeFilter === "week") {
                    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
                    matchesDateRange = detectedDate >= weekAgo
                } else if (dateRangeFilter === "month") {
                    const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1)
                    matchesDateRange = detectedDate >= monthAgo
                } else if (dateRangeFilter === "custom" && customStartDate && customEndDate) {
                    const endDate = new Date(customEndDate); endDate.setHours(23, 59, 59, 999)
                    matchesDateRange = detectedDate >= new Date(customStartDate) && detectedDate <= endDate
                }
            }

            return matchesSearch && matchesStatus && matchesDateRange
        })
        .sort((a, b) => {
            if (!sortField) return 0
            let comparison = 0
            switch (sortField) {
                case "id": comparison = a.id - b.id; break
                case "name": comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`); break
                case "external_id": comparison = (a.external_id || "").localeCompare(b.external_id || ""); break
                case "position": comparison = (a.position || "").localeCompare(b.position || ""); break
                case "group": comparison = (a.group || "").localeCompare(b.group || ""); break
                case "similarity": comparison = (a.similarity || 0) - (b.similarity || 0); break
                case "is_blacklist": comparison = (a.is_blacklist === b.is_blacklist) ? 0 : a.is_blacklist ? 1 : -1; break
            }
            return sortOrder === "asc" ? comparison : -comparison
        })


    /* ============================================================
       PAGINATION
       ============================================================ */
    const totalPages = Math.max(1, Math.ceil(filteredDetections.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentDetections = filteredDetections.slice(startIndex, endIndex)

    const calculateItemsPerPage = useCallback(() => {
        if (!tableContainerRef.current) return
        const containerHeight = tableContainerRef.current.clientHeight
        const actualHeaderHeight = tableContainerRef.current.querySelector('thead')?.clientHeight || HEADER_HEIGHT
        const firstRow = tableContainerRef.current.querySelector(`tbody tr.${styles.tableRow}`) as HTMLElement | null
        const actualRowHeight = firstRow ? firstRow.getBoundingClientRect().height : ROW_HEIGHT
        const newItemsPerPage = Math.max(1, Math.min(50, Math.floor((containerHeight - actualHeaderHeight - 2) / actualRowHeight)))
        if (newItemsPerPage !== itemsPerPage) { setItemsPerPage(newItemsPerPage); setCurrentPage(1) }
    }, [itemsPerPage])


    /* ============================================================
       EXPORT — เพิ่ม group column
       ============================================================ */
    const handleExportCSV = () => {
        exportCSVUtil(
            filteredDetections.map(d => [d.id, `${d.first_name} ${d.last_name}`, d.external_id || "-", d.position || "-", d.group || "-", d.similarity ? `${(d.similarity * 100).toFixed(2)}%` : "-", d.is_blacklist ? "แบล็คลิสต์" : "ปกติ"]),
            ["ไอดี", "ชื่อ-นามสกุล", "รหัสพนักงาน", "ตำแหน่ง", "กลุ่ม", "ความแม่นยำ", "สถานะ"],
            "detections"
        )
    }

    const handleExportPDF = () => {
        exportPDFUtil(
            filteredDetections.map(d => [d.id, `${d.first_name} ${d.last_name}`, d.external_id || "-", d.position || "-", d.group || "-", d.similarity ? `${(d.similarity * 100).toFixed(2)}%` : "-", d.is_blacklist ? "แบล็คลิสต์" : "ปกติ"]),
            ["ไอดี", "ชื่อ-นามสกุล", "รหัสพนักงาน", "ตำแหน่ง", "กลุ่ม", "ความแม่นยำ", "สถานะ"],
            "รายการตรวจจับ",
            "detections"
        )
    }


    /* ============================================================
       FETCH DATA
       ============================================================ */
    const fetchDetections = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) { setLoadingData(true); setFetchError(false) }
            const res = await fetch("/api/detection/list")
            if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลการตรวจพบได้")
            setDetections(await res.json())
            setFetchError(false)
        } catch (err) {
            setFetchError(true)
            if (showLoading) showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
        } finally {
            if (showLoading) setLoadingData(false)
        }
    }, [showToast])


    /* ============================================================
       SORT / MODAL
       ============================================================ */
    const handleSort = (field: SortField) => {
        if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        else { setSortField(field); setSortOrder("asc") }
    }

    const openDetailModal = (detection: DetectionData) => { setViewingDetection(detection); setModalMode("detail") }
    const openDeleteModal = (detection: DetectionData, e: React.MouseEvent) => { e.stopPropagation(); setDeletingDetection(detection); setModalMode("delete") }
    const closeModal = useCallback(() => { setModalMode(null); setDeletingDetection(null); setViewingDetection(null) }, [])

    const handleDeleteDetection = async () => {
        if (!deletingDetection) return
        try {
            const res = await fetch(`/api/detection/${deletingDetection.id}/delete`, { method: "DELETE" })
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "ลบข้อมูลไม่สำเร็จ") }
            const willPageBeEmpty = currentDetections.length === 1
            closeModal()
            await fetchDetections(false)
            if (willPageBeEmpty && currentPage > 1) setCurrentPage(p => p - 1)
            showToast("ลบข้อมูลสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถลบข้อมูลได้", "error")
        }
    }


    /* ============================================================
       FORMAT HELPERS
       ============================================================ */
    const formatSimilarity = (similarity: number | null) => similarity === null ? "-" : `${(similarity * 100).toFixed(2)}%`

    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return "-"
        try {
            return new Date(dateString).toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        } catch { return "-" }
    }


    /* ============================================================
       EFFECTS
       ============================================================ */
    useEffect(() => {
        fetchDetections(true)
        const interval = setInterval(() => fetchDetections(false), POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [fetchDetections])

    useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter, dateRangeFilter])
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [currentPage, totalPages])
    useEffect(() => { if (!toast) return; const t = setTimeout(hideToast, TOAST_DURATION_MS); return () => clearTimeout(t) }, [toast, hideToast])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target as Node)) setFilterOpen(false)
            if (dateFilterWrapperRef.current && !dateFilterWrapperRef.current.contains(e.target as Node)) setDateFilterOpen(false)
            if (exportWrapperRef.current && !exportWrapperRef.current.contains(e.target as Node)) setExportOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    useEffect(() => {
        const raf = requestAnimationFrame(() => calculateItemsPerPage())
        const ro = new ResizeObserver(() => requestAnimationFrame(() => calculateItemsPerPage()))
        if (tableContainerRef.current) ro.observe(tableContainerRef.current)
        return () => { cancelAnimationFrame(raf); ro.disconnect() }
    }, [calculateItemsPerPage])

    useEffect(() => { if (!loadingData) requestAnimationFrame(() => calculateItemsPerPage()) }, [loadingData, calculateItemsPerPage])
    useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h) }, [closeModal])


    /* ============================================================
       RENDER
       ============================================================ */
    return (
        <div className={styles.pageContainer}>
            {toast && <ToastComponent message={toast.message} type={toast.type} onClose={hideToast} />}

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.leftHeader}>
                    <h1 className={styles.title}>การตรวจจับทั้งหมด ({detections.length})</h1>
                    <p className={styles.subtitle}>ประวัติการตรวจจับใบหน้าและข้อมูลบุคคล</p>
                </div>
                <div className={styles.rightHeader}>
                    <UserDropdownComponent username={user?.username} role={user?.role} onSignOut={handleSignOut} />
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>

                {/* Toolbar */}
                <div className={styles.toolBar}>
                    <div className={styles.leftToolBar}>
                        <SearchBarComponent value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหาบุคคล..." />

                        {/* Status Filter */}
                        <div className={styles.filterWrapper} ref={filterWrapperRef}>
                            <button className={statusFilter !== "all" ? styles.filterButtonActive : styles.filterButton} onClick={() => setFilterOpen(prev => !prev)}>
                                <span className={styles.pillButtonIcon}><Filter size={16} /></span>
                                {statusFilter === "all" ? "สถานะ" : statusFilter === "normal" ? "ปกติ" : "บัญชีดำ"}
                            </button>
                            {filterOpen && (
                                <div className={styles.filterDropdown}>
                                    <div className={styles.filterDropdownHeader}>
                                        <span>สถานะบุคคล</span>
                                        {statusFilter !== "all" && <button className={styles.clearButton} onClick={() => { setStatusFilter("all"); setFilterOpen(false) }}>ล้าง</button>}
                                    </div>
                                    <button className={statusFilter === "all" ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange("all")}><span>ทั้งหมด</span><span className={styles.filterCount}>{detections.length}</span></button>
                                    <button className={statusFilter === "normal" ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange("normal")}><span>ปกติ</span><span className={styles.filterCount}>{normalCount}</span></button>
                                    <button className={statusFilter === "blacklist" ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange("blacklist")}><span>บัญชีดำ</span><span className={styles.filterCount}>{blacklistCount}</span></button>
                                </div>
                            )}
                        </div>

                        {/* Date Filter */}
                        <div className={styles.filterWrapper} ref={dateFilterWrapperRef}>
                            <button className={dateRangeFilter !== "all" ? styles.filterButtonActive : styles.filterButton} onClick={() => setDateFilterOpen(prev => !prev)}>
                                <span className={styles.pillButtonIcon}><Calendar size={16} /></span>
                                {getDateFilterLabel()}
                            </button>
                            {dateFilterOpen && (
                                <div className={styles.filterDropdown}>
                                    <div className={styles.filterDropdownHeader}>
                                        <span>ช่วงเวลา</span>
                                        {dateRangeFilter !== "all" && <button className={styles.clearButton} onClick={() => { setDateRangeFilter("all"); setCustomStartDate(""); setCustomEndDate(""); setDateFilterOpen(false) }}>ล้าง</button>}
                                    </div>
                                    {(["all", "today", "week", "month", "custom"] as FilterDateRange[]).map(range => (
                                        <button key={range} className={dateRangeFilter === range ? styles.filterOptionActive : styles.filterOption} onClick={() => handleDateRangeChange(range)}>
                                            <span>{{ all: "ทั้งหมด", today: "วันนี้", week: "7 วันที่แล้ว", month: "30 วันที่แล้ว", custom: "กำหนดเอง" }[range]}</span>
                                        </button>
                                    ))}
                                    {dateRangeFilter === "custom" && (
                                        <div className={styles.customDateRange}>
                                            <div className={styles.dateInputGroup}><label>จาก</label><input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className={styles.dateInput} /></div>
                                            <div className={styles.dateInputGroup}><label>ถึง</label><input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className={styles.dateInput} /></div>
                                            <button className={styles.applyDateButton} onClick={() => setDateFilterOpen(false)} disabled={!customStartDate || !customEndDate}>ใช้งาน</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.rightToolBar}>
                        <div className={styles.exportWrapper} ref={exportWrapperRef}>
                            <button className={styles.exportButton} onClick={() => setExportOpen(prev => !prev)} disabled={filteredDetections.length === 0}>
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

                {/* Table */}
                <div className={styles.tableArea}>
                    <div className={styles.tableContainer} ref={tableContainerRef}>
                        <table className={styles.table}>
                            <thead className={styles.tableHeader}>
                                <tr>
                                    {/* ไอดี */}
                                    <th onClick={() => handleSort("id")} style={{ cursor: "pointer" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
                                            ไอดี {sortField === "id" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th>รูปภาพ</th>
                                    {/* Sortable columns — เพิ่ม group */}
                                    {([
                                        ["name", "ชื่อ-นามสกุล"],
                                        ["external_id", "รหัสพนักงาน"],
                                        ["position", "ตำแหน่ง"],
                                        ["group", "กลุ่ม"],
                                        ["similarity", "ความแม่นยำ"],
                                        ["is_blacklist", "สถานะ"],
                                    ] as [SortField, string][]).map(([field, label]) => (
                                        <th key={field} onClick={() => handleSort(field)} style={{ cursor: "pointer" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                {label} {sortField === field && <ArrowUpDown size={14} />}
                                            </div>
                                        </th>
                                    ))}
                                    <th>เวลาตรวจจับ</th>
                                    <th>กล้อง</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>

                            <tbody className={styles.tableBody}>
                                {loadingData && (
                                    <tr className={styles.stateRow}><td colSpan={11} className={styles.stateCell}><div className={styles.stateInner}><div className={styles.spinner} /><span className={styles.stateText}>กำลังโหลดข้อมูล…</span></div></td></tr>
                                )}
                                {!loadingData && fetchError && (
                                    <tr className={styles.stateRow}><td colSpan={11} className={styles.stateCell}><div className={styles.stateInner}><span className={styles.errorIcon}><AlertTriangle size={48} /></span><p className={styles.errorText}>ไม่สามารถโหลดข้อมูลได้</p><button className={styles.retryButton} onClick={() => fetchDetections(true)}><RefreshCw size={15} /> ลองใหม่</button></div></td></tr>
                                )}
                                {!loadingData && !fetchError && filteredDetections.length === 0 && (
                                    <tr className={styles.stateRow}><td colSpan={11} className={styles.stateCell}><div className={styles.stateInner}><span className={styles.emptyIcon}><Search size={48} /></span><p className={styles.emptyText}>{hasActiveFilters ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีข้อมูลการตรวจจับ"}</p>{hasActiveFilters && <button className={styles.clearFiltersBtn} onClick={clearFilters}>ล้างตัวกรอง</button>}</div></td></tr>
                                )}

                                {!loadingData && !fetchError && currentDetections.map(detection => (
                                    <tr key={detection.id} className={styles.tableRow} onClick={() => openDetailModal(detection)}>
                                        <td>{detection.id}</td>
                                        <td>
                                            <div className={styles.imageCell}>
                                                {detection.detect_image_path
                                                    ? <img src={`/api/image/${detection.detect_image_path}`} alt="Detection" className={styles.detectionImage} />
                                                    : <div className={styles.noImage}><span><UserRoundCheck size={16} /></span></div>
                                                }
                                            </div>
                                        </td>
                                        <td>{detection.first_name} {detection.last_name}</td>
                                        <td>{detection.external_id || "-"}</td>
                                        <td>{detection.position || "-"}</td>
                                        <td>{detection.group || "-"}</td>
                                        <td>{formatSimilarity(detection.similarity)}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${detection.is_blacklist ? styles.statusBlacklist : styles.statusNormal}`}>
                                                {detection.is_blacklist ? "บัญชีดำ" : "ปกติ"}
                                            </span>
                                        </td>
                                        <td className={styles.dateTimeCell}>{formatDateTime(detection.detected_at)}</td>
                                        <td>{detection.camera_name}</td>
                                        <td>
                                            <div className={styles.actionGroup}>
                                                <button className={styles.deleteBtn} onClick={e => openDeleteModal(detection, e)} title="ลบ"><Trash2 size={17} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!loadingData && !fetchError && filteredDetections.length > 0 && (
                        <div className={styles.pagination}>
                            <span className={styles.paginationInfo}>แสดง {startIndex + 1}–{Math.min(endIndex, filteredDetections.length)} จาก {filteredDetections.length} รายการ</span>
                            <div className={styles.paginationControls}>
                                <button className={styles.paginationBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>ก่อนหน้า</button>
                                <span className={styles.paginationText}>หน้า {currentPage} / {totalPages}</span>
                                <button className={styles.paginationBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>ถัดไป</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* ─── Detail Modal ─────────────────────────────────────── */}
            {modalMode === "detail" && viewingDetection && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

                        <div className={styles.detailModalHeader}>
                            <div>
                                <h2 className={styles.detailModalTitle}>รายละเอียดการตรวจจับ</h2>
                                <p className={styles.detailModalSubTitle}>ID #{viewingDetection.id}</p>
                            </div>
                            <button className={styles.detailCloseBtn} onClick={closeModal} title="ปิด"><X size={18} /></button>
                        </div>

                        <div className={styles.detailImageRow}>
                            {viewingDetection.detect_image_path
                                ? <img src={`/api/image/${viewingDetection.detect_image_path}`} alt="Detection" className={styles.detailImage} />
                                : <div className={styles.detailNoImage}><UserRoundCheck size={40} /></div>
                            }
                        </div>

                        {/* Info Grid — เพิ่ม group */}
                        <div className={styles.detailGrid}>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>ชื่อ-นามสกุล</span>
                                <span className={styles.detailValue}>{viewingDetection.first_name} {viewingDetection.last_name}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>สถานะ</span>
                                <span className={`${styles.detailValue} ${viewingDetection.is_blacklist ? styles.statusBlacklist : styles.statusNormal}`}>
                                    {viewingDetection.is_blacklist ? "บัญชีดำ" : "ปกติ"}
                                </span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>รหัสพนักงาน</span>
                                <span className={styles.detailValue}>{viewingDetection.external_id || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>ตำแหน่ง</span>
                                <span className={styles.detailValue}>{viewingDetection.position || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>กลุ่ม</span>
                                <span className={styles.detailValue}>{viewingDetection.group || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>ความแม่นยำ</span>
                                <span className={styles.detailValue}>{formatSimilarity(viewingDetection.similarity)}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>กล้อง</span>
                                <span className={styles.detailValue}>{viewingDetection.camera_name || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>เวลาตรวจจับ</span>
                                <span className={styles.detailValue}>{formatDateTime(viewingDetection.detected_at)}</span>
                            </div>
                        </div>

                        <div className={styles.detailFooter}>
                            <button className={styles.detailDeleteBtn} onClick={e => { closeModal(); openDeleteModal(viewingDetection, e) }}>
                                <Trash2 size={15} /> ลบรายการนี้
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Delete Modal ─────────────────────────────────────── */}
            {modalMode === "delete" && deletingDetection && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>ยืนยันการลบข้อมูล</h2>
                            <p className={styles.deleteDescription}>
                                คุณกำลังจะลบข้อมูลการตรวจจับของ <strong>{deletingDetection.first_name} {deletingDetection.last_name}</strong>
                            </p>
                        </div>
                        <div className={styles.deleteHint}>
                            ⚠️ การลบข้อมูลจะ<strong>ไม่สามารถกู้คืนได้</strong> กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
                        </div>
                        <div className={styles.form}>
                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                                <button type="button" className={styles.submitButtonDelete} onClick={handleDeleteDetection}>ลบข้อมูล</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}