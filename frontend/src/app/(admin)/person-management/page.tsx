"use client"




import { AlertTriangle, ArrowUpDown, CirclePlus, Download, FileDown, Filter, Pencil, RefreshCw, Search, Trash2, Upload, UserRound, UserRoundCheck, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/person-management.module.css"

import { useAuth } from "@/lib/auth-context"
import { exportToCSV, exportToPDF } from "@/lib/export-file"
import { ToastState, ToastType } from "@/types/toast"

import SearchBarComponent from "@/components/search-bar"
import ToastComponent from "@/components/toast"
import UserDropdownComponent from "@/components/user-dropdown"



// ===== TYPES ======================================
interface Person {
    id?: number
    external_id?: string
    first_name: string
    last_name?: string
    position?: string
    group?: string
    is_blacklist: boolean
    face_image_path: string | null
    created_at: string
    updated_at: string
}

interface PersonFormData {
    id?: number
    external_id?: string
    first_name: string
    last_name?: string
    position?: string
    group?: string
    is_blacklist?: boolean
    face_image?: File | null
}

type FilterStatus = "all" | "normal" | "blacklist"
type ModalMode = "add" | "edit" | "delete" | "detail" | null
type SortField = "id" | "name" | "external_id" | "position" | "group" | "is_blacklist" | null
type SortOrder = "asc" | "desc"



// ===== CONSTANTS ==================================
const POLL_INTERVAL_MS = 10000
const TOAST_DURATION_MS = 5000
const ROW_HEIGHT = 50
const HEADER_HEIGHT = 40
const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"



export default function PersonManagementPage() {
    // ====== AUTH =====================================
    const { user, signOut: logout } = useAuth()
    const router = useRouter()

    // ====== TOAST ====================================
    const [toast, setToast] = useState<ToastState | null>(null)
    const isMountedRef = useRef(true)

    // ====== SEARCH ===================================
    const [searchQuery, setSearchQuery] = useState("")

    // ====== FILTERS ==================================
    const filterWrapperRef = useRef<HTMLDivElement>(null)
    const [filterOpen, setFilterOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")

    // ====== SORTING ==================================
    const [sortField, setSortField] = useState<SortField>(null)
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

    // ====== FETCH DATA ===============================
    const [persons, setPersons] = useState<Person[]>([])
    const [loadingData, setLoadingData] = useState(true)
    const [fetchError, setFetchError] = useState(false)

    // ====== EXPORT ===================================
    const exportWrapperRef = useRef<HTMLDivElement>(null)
    const [exportOpen, setExportOpen] = useState(false)

    // ====== TABLE ====================================
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // ====== MODAL ====================================
    const [modalMode, setModalMode] = useState<ModalMode>(null)
    const [editingPersonId, setEditingPersonId] = useState<number | null>(null)
    const editingPersonIdRef = useRef<number | null>(null)
    const [deletingPerson, setDeletingPerson] = useState<Person | null>(null)
    const [viewingPerson, setViewingPerson] = useState<Person | null>(null)

    const [preview, setPreview] = useState<string | null>(null)
    const [formData, setFormData] = useState<PersonFormData>({
        external_id: "",
        first_name: "",
        last_name: "",
        position: "",
        group: "",
        is_blacklist: false,
        face_image: null
    })


    // ====== IMPORT ===================================
    const importWrapperRef = useRef<HTMLDivElement>(null)
    const [importOpen, setImportOpen] = useState(false)
    const importFileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)

    const handleDownloadTemplate = () => {
        const headers = ["external_id", "first_name", "last_name", "position", "group", "is_blacklist"]
        const example = ["EMP001", "สมชาย", "ใจดี", "วิศวกร", "IT", "false"]
        const csvContent = [headers, example]
            .map(row => row.join(","))
            .join("\n")
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "persons_template.csv"
        link.click()
        URL.revokeObjectURL(url)
        setImportOpen(false)
    }

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImportOpen(false)
        setImporting(true)
        try {
            const fd = new FormData()
            fd.append("file", file)
            const res = await fetch("/api/person/import", { method: "POST", body: fd })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "นำเข้าข้อมูลไม่สำเร็จ")
            }
            const result = await res.json()
            await fetchPersons()
            showToast(result.message || "นำเข้าข้อมูลสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถนำเข้าข้อมูลได้", "error")
        } finally {
            setImporting(false)
            if (importFileInputRef.current) importFileInputRef.current.value = ""
        }
    }

    // ====== SIGN OUT =================================
    const handleSignOut = () => {
        logout()
        router.replace("/sign-in")
    }


    // ====== TOAST ====================================
    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) setToast({ message, type })
    }, [])

    const hideToast = useCallback(() => {
        if (isMountedRef.current) setToast(null)
    }, [])


    // ====== FILTERS ==================================
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

    const normalCount = persons.filter(p => !p.is_blacklist).length
    const blacklistCount = persons.filter(p => p.is_blacklist).length
    const hasActiveFilters = statusFilter !== "all" || searchQuery !== ""


    // ====== FILTER & SORT DATA =======================
    const filteredPersons = persons
        .filter(person => {
            const haystack = `${person.id} ${person.first_name} ${person.last_name} ${person.external_id} ${person.position} ${person.group} ${person.is_blacklist ? "Blacklist" : "Normal"}`.toLowerCase()
            const matchesSearch = haystack.includes(searchQuery.toLowerCase())
            const matchesStatus =
                statusFilter === "all" ? true
                    : statusFilter === "normal" ? !person.is_blacklist
                        : person.is_blacklist
            return matchesSearch && matchesStatus
        })
        .sort((a, b) => {
            if (!sortField) return 0
            let valueA: any, valueB: any
            switch (sortField) {
                case "id": valueA = a.id; valueB = b.id; break
                case "name": valueA = `${a.first_name} ${a.last_name}`; valueB = `${b.first_name} ${b.last_name}`; break
                case "external_id": valueA = a.external_id || ""; valueB = b.external_id || ""; break
                case "position": valueA = a.position || ""; valueB = b.position || ""; break
                case "group": valueA = a.group || ""; valueB = b.group || ""; break
                case "is_blacklist": valueA = a.is_blacklist ? 1 : 0; valueB = b.is_blacklist ? 1 : 0; break
                default: return 0
            }
            if (valueA < valueB) return sortOrder === "asc" ? -1 : 1
            if (valueA > valueB) return sortOrder === "asc" ? 1 : -1
            return 0
        })

    // ====== PAGINATION ===============================
    const totalPages = Math.max(1, Math.ceil(filteredPersons.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentPersons = filteredPersons.slice(startIndex, endIndex)

    const calculateItemsPerPage = useCallback(() => {
        if (!tableContainerRef.current) return
        const containerHeight = tableContainerRef.current.clientHeight
        const headerElement = tableContainerRef.current.querySelector('thead')
        const actualHeaderHeight = headerElement?.clientHeight || HEADER_HEIGHT
        const firstRow = tableContainerRef.current.querySelector(`tbody tr.${styles.tableRow}`) as HTMLElement | null
        const actualRowHeight = firstRow ? firstRow.getBoundingClientRect().height : ROW_HEIGHT
        const availableHeight = containerHeight - actualHeaderHeight - 2
        const calculatedItems = Math.floor(availableHeight / actualRowHeight)
        const newItemsPerPage = Math.max(1, Math.min(50, calculatedItems))
        if (newItemsPerPage !== itemsPerPage) {
            setItemsPerPage(newItemsPerPage)
            setCurrentPage(1)
        }
    }, [itemsPerPage])

    // ====== EXPORT ===================================
    const handleExportCSV = () => {
        exportToCSV(
            filteredPersons.map(d => [d.id, `${d.first_name} ${d.last_name}`, d.external_id || "-", d.position || "-", d.group || "-", d.is_blacklist ? "แบล็คลิสต์" : "ปกติ"]),
            ["ไอดี", "ชื่อ-นามสกุล", "รหัสพนักงาน", "ตำแหน่ง", "กลุ่ม", "สถานะ"],
            "persons"
        )
    }

    const handleExportPDF = () => {
        exportToPDF(
            filteredPersons.map(d => [d.id, `${d.first_name} ${d.last_name}`, d.external_id || "-", d.position || "-", d.group || "-", d.is_blacklist ? "แบล็คลิสต์" : "ปกติ"]),
            ["ไอดี", "ชื่อ-นามสกุล", "รหัสพนักงาน", "ตำแหน่ง", "กลุ่ม", "สถานะ"],
            "รายการบุคคล",
            "persons"
        )
    }


    // ====== FETCH DATA ===============================
    const fetchPersons = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) { setLoadingData(true); setFetchError(false) }
            const res = await fetch("/api/person/list")
            if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลบุคคลได้")
            const data: Person[] = await res.json()
            console.log("person[0]:", data[0])
            setPersons(data)
            setFetchError(false)
        } catch (err) {
            setFetchError(true)
            if (showLoading) showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
        } finally {
            if (showLoading) setLoadingData(false)
        }
    }, [showToast])


    // ====== API - CRUD ================================
    const handleAddPerson = async () => {
        try {
            setLoadingData(true)
            const fd = new FormData()
            fd.append("external_id", formData.external_id || "")
            fd.append("first_name", formData.first_name || "")
            fd.append("last_name", formData.last_name || "")
            fd.append("position", formData.position || "")
            fd.append("group", formData.group || "")
            fd.append("is_blacklist", String(formData.is_blacklist))
            if (formData.face_image) fd.append("face_image", formData.face_image)

            const res = await fetch("/api/person/add", { method: "POST", body: fd })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "เพิ่มบุคคลไม่สำเร็จ")
            }
            closeModal()
            await fetchPersons()
            showToast("เพิ่มบุคคลสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถเพิ่มบุคคลได้", "error")
        } finally {
            setLoadingData(false)
        }
    }

    const handleEditPerson = async (personId: number) => {
        if (!personId) { showToast("ID บุคคลไม่ถูกต้อง", "error"); return }
        try {
            setLoadingData(true)
            const fd = new FormData()
            fd.append("external_id", formData.external_id || "")
            fd.append("first_name", formData.first_name || "")
            fd.append("last_name", formData.last_name || "")
            fd.append("position", formData.position || "")
            fd.append("group", formData.group || "")
            fd.append("is_blacklist", String(formData.is_blacklist))
            if (formData.face_image) fd.append("face_image", formData.face_image)

            const res = await fetch(`/api/person/${personId}/edit`, { method: "PUT", body: fd })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "แก้ไขบุคคลไม่สำเร็จ")
            }
            closeModal()
            await fetchPersons()
            showToast("แก้ไขบุคคลสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถแก้ไขบุคคลได้", "error")
        } finally {
            setLoadingData(false)
        }
    }

    const handleDeletePerson = async () => {
        if (!deletingPerson) return
        try {
            const res = await fetch(`/api/person/${deletingPerson.id}/delete`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.message || "ลบบุคคลไม่สำเร็จ")
            }
            const willPageBeEmpty = currentPersons.length === 1
            closeModal()
            await fetchPersons()
            if (willPageBeEmpty && currentPage > 1) setCurrentPage(p => p - 1)
            showToast("ลบบุคคลสำเร็จ", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "ไม่สามารถลบบุคคลได้", "error")
        }
    }


    // ====== SORT =====================================
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortOrder("asc")
        }
    }


    // ====== MODAL ====================================
    const closeModal = useCallback(() => {
        setModalMode(null)
        setEditingPersonId(null)
        editingPersonIdRef.current = null
        setFormData({ external_id: "", first_name: "", last_name: "", position: "", group: "", is_blacklist: false, face_image: null })
        setDeletingPerson(null)
        setViewingPerson(null)
        setPreview(null)
    }, [])

    const openDetailModal = (person: Person) => {
        setViewingPerson(person)
        setModalMode("detail")
    }

    const openAddModal = () => {
        setModalMode("add")
        setEditingPersonId(null)
        editingPersonIdRef.current = null
        setFormData({ external_id: "", first_name: "", last_name: "", position: "", group: "", is_blacklist: false, face_image: null })
        setPreview(null)
    }

    const openEditModal = (person: Person, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!person?.id) { showToast("ข้อมูลบุคคลไม่ถูกต้อง", "error"); return }
        setModalMode("edit")
        setEditingPersonId(person.id)
        editingPersonIdRef.current = person.id
        setFormData({
            external_id: person.external_id || "",
            first_name: person.first_name,
            last_name: person.last_name || "",
            position: person.position || "",
            group: person.group || "",
            is_blacklist: person.is_blacklist,
            face_image: null
        })
        setPreview(null)
    }

    const openDeleteModal = (person: Person, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeletingPerson(person)
        setModalMode("delete")
    }

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked
            setFormData(prev => ({ ...prev, [name]: checked }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFormData(prev => ({ ...prev, face_image: file }))
            const reader = new FileReader()
            reader.onloadend = () => setPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (modalMode === "add") {
            await handleAddPerson()
        } else if (modalMode === "edit") {
            const id = editingPersonIdRef.current
            if (!id) { showToast("ไม่พบ ID บุคคล", "error"); return }
            await handleEditPerson(id)
        }
    }

    // ====== EFFECTS ==================================
    useEffect(() => {
        fetchPersons(true)
        const interval = setInterval(() => fetchPersons(false), POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [fetchPersons])

    useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter])

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages)
    }, [currentPage])

    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(hideToast, TOAST_DURATION_MS)
        return () => clearTimeout(timer)
    }, [toast, hideToast])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target as Node)) setFilterOpen(false)
            if (exportWrapperRef.current && !exportWrapperRef.current.contains(e.target as Node)) setExportOpen(false)
            if (importWrapperRef.current && !importWrapperRef.current.contains(e.target as Node)) setImportOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    useEffect(() => {
        const measure = () => calculateItemsPerPage()
        const raf = requestAnimationFrame(measure)
        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(measure))
        if (tableContainerRef.current) resizeObserver.observe(tableContainerRef.current)
        return () => { cancelAnimationFrame(raf); resizeObserver.disconnect() }
    }, [calculateItemsPerPage])

    useEffect(() => {
        if (!loadingData) requestAnimationFrame(() => calculateItemsPerPage())
    }, [loadingData, calculateItemsPerPage])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [closeModal])


    // ====== FORMAT HELPERS ===========================
    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return "-"
        try {
            return new Date(dateString).toLocaleString('th-TH', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            })
        } catch { return "-" }
    }


    // ====== RENDER ===================================
    return (
        <div className={styles.pageContainer}>

            {/* Toast */}
            {toast && <ToastComponent message={toast.message} type={toast.type} onClose={hideToast} />}

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.leftHeader}>
                    <h1 className={styles.title}>บุคคลทั้งหมด ({persons.length})</h1>
                    <p className={styles.subtitle}>ข้อมูลบุคคลทั้งหมดในระบบ</p>
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

                        <div className={styles.filterWrapper} ref={filterWrapperRef}>
                            <button
                                className={statusFilter !== "all" ? styles.filterButtonActive : styles.filterButton}
                                onClick={() => setFilterOpen(prev => !prev)}
                            >
                                <span className={styles.pillButtonIcon}><Filter size={16} /></span>
                                {statusFilter === "all" ? "ตัวกรอง" : statusFilter === "normal" ? "ปกติ" : "บัญชีดำ"}
                            </button>

                            {filterOpen && (
                                <div className={styles.filterDropdown}>
                                    <div className={styles.filterDropdownHeader}>
                                        <span>สถานะบุคคล</span>
                                        {statusFilter !== "all" && (
                                            <button className={styles.clearButton} onClick={clearFilters}>ล้างทั้งหมด</button>
                                        )}
                                    </div>
                                    <button className={statusFilter === "all" ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange("all")}>
                                        <span>ทั้งหมด</span><span className={styles.filterCount}>{persons.length}</span>
                                    </button>
                                    <button className={statusFilter === "normal" ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange("normal")}>
                                        <span>ปกติ</span><span className={styles.filterCount}>{normalCount}</span>
                                    </button>
                                    <button className={statusFilter === "blacklist" ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange("blacklist")}>
                                        <span>บัญชีดำ</span><span className={styles.filterCount}>{blacklistCount}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.rightToolBar}>
                        <button className={styles.addButton} onClick={openAddModal}>
                            <span className={styles.pillButtonIcon}><CirclePlus size={16} /></span>
                            เพิ่มบุคคล
                        </button>

                        <input
                            ref={importFileInputRef}
                            type="file"
                            accept=".csv"
                            style={{ display: "none" }}
                            onChange={handleImportCSV}
                        />

                        <div className={styles.importWrapper} ref={importWrapperRef}>
                            <button
                                className={styles.importButton}
                                onClick={() => setImportOpen(prev => !prev)}
                                disabled={importing}
                            >
                                <span className={styles.pillButtonIcon}>
                                    {importing ? <RefreshCw size={16} className={styles.spinning} /> : <Download size={16} />}
                                </span>
                                {importing ? "กำลังนำเข้า..." : "Import"}
                            </button>

                            {importOpen && (
                                <div className={styles.importDropdown}>
                                    <button onClick={handleDownloadTemplate}>
                                        <FileDown size={15} />
                                        ดาวน์โหลด Template
                                    </button>
                                    <button onClick={() => { importFileInputRef.current?.click(); setImportOpen(false) }}>
                                        <Upload size={15} />
                                        อัปโหลดไฟล์ CSV
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={styles.exportWrapper} ref={exportWrapperRef}>
                            <button className={styles.exportButton} onClick={() => setExportOpen(prev => !prev)} disabled={filteredPersons.length === 0}>
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
                                    <th onClick={() => handleSort("id")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                            ไอดี {sortField === "id" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th>รูปภาพ</th>
                                    <th onClick={() => handleSort("name")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            ชื่อ-นามสกุล {sortField === "name" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("external_id")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            รหัสพนักงาน {sortField === "external_id" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("position")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            ตำแหน่ง {sortField === "position" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("group")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            กลุ่ม {sortField === "group" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort("is_blacklist")} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            สถานะ {sortField === "is_blacklist" && <ArrowUpDown size={14} />}
                                        </div>
                                    </th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>

                            <tbody className={styles.tableBody}>
                                {loadingData && (
                                    <tr className={styles.stateRow}>
                                        <td colSpan={8} className={styles.stateCell}>
                                            <div className={styles.stateInner}>
                                                <div className={styles.spinner} />
                                                <span className={styles.stateText}>กำลังโหลดข้อมูล…</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loadingData && fetchError && (
                                    <tr className={styles.stateRow}>
                                        <td colSpan={8} className={styles.stateCell}>
                                            <div className={styles.stateInner}>
                                                <span className={styles.errorIcon}><AlertTriangle size={48} /></span>
                                                <p className={styles.errorText}>ไม่สามารถโหลดข้อมูลได้</p>
                                                <button className={styles.retryButton} onClick={() => fetchPersons(true)}>
                                                    <RefreshCw size={15} /> ลองใหม่
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loadingData && !fetchError && filteredPersons.length === 0 && (
                                    <tr className={styles.stateRow}>
                                        <td colSpan={8} className={styles.stateCell}>
                                            <div className={styles.stateInner}>
                                                <span className={styles.emptyIcon}><Search size={48} /></span>
                                                <p className={styles.emptyText}>
                                                    {hasActiveFilters ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีข้อมูลบุคคล"}
                                                </p>
                                                {hasActiveFilters && (
                                                    <button className={styles.clearFiltersBtn} onClick={clearFilters}>ล้างตัวกรอง</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loadingData && !fetchError && currentPersons.map(person => (
                                    <tr
                                        key={person.id}
                                        className={styles.tableRow}
                                        onClick={() => openDetailModal(person)}
                                    >
                                        <td>{person.id}</td>

                                        <td>
                                            <div className={styles.imageCell}>
                                                {person.face_image_path ? (
                                                    <img
                                                        src={`/api/image/${person.face_image_path}?v=${new Date(person.updated_at).getTime()}`}
                                                        alt="face"
                                                        className={styles.detectionImage}
                                                    />
                                                ) : (
                                                    <div className={styles.noImage}><span><UserRoundCheck size={16} /></span></div>
                                                )}
                                            </div>
                                        </td>

                                        <td>{person.first_name} {person.last_name}</td>
                                        <td>{person.external_id || "-"}</td>
                                        <td>{person.position || "-"}</td>
                                        <td>{person.group || "-"}</td>

                                        <td>
                                            <span className={`${styles.statusBadge} ${person.is_blacklist ? styles.statusBlacklist : styles.statusNormal}`}>
                                                {person.is_blacklist ? "บัญชีดำ" : "ปกติ"}
                                            </span>
                                        </td>

                                        <td>
                                            <div className={styles.actionGroup}>
                                                <button className={styles.editBtn} onClick={e => openEditModal(person, e)} title="แก้ไข">
                                                    <Pencil size={17} />
                                                </button>
                                                <button className={styles.deleteBtn} onClick={e => openDeleteModal(person, e)} title="ลบ">
                                                    <Trash2 size={17} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!loadingData && !fetchError && filteredPersons.length > 0 && (
                        <div className={styles.pagination}>
                            <span className={styles.paginationInfo}>
                                แสดง {startIndex + 1}–{Math.min(endIndex, filteredPersons.length)} จาก {filteredPersons.length} รายการ
                            </span>
                            <div className={styles.paginationControls}>
                                <button className={styles.paginationBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>ก่อนหน้า</button>
                                <span className={styles.paginationText}>หน้า {currentPage} / {totalPages}</span>
                                <button className={styles.paginationBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>ถัดไป</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* ─── Detail Modal ──────────────────────────────────────────── */}
            {modalMode === "detail" && viewingPerson && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

                        <div className={styles.detailModalHeader}>
                            <div>
                                <h2 className={styles.detailModalTitle}>รายละเอียดบุคคล</h2>
                                <p className={styles.detailModalSubTitle}>ID #{viewingPerson.id}</p>
                            </div>
                            <button className={styles.detailCloseBtn} onClick={closeModal} title="ปิด">
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.detailImageRow}>
                            {viewingPerson.face_image_path ? (
                                <img
                                    src={`/api/image/${viewingPerson.face_image_path}?v=${new Date(viewingPerson.updated_at).getTime()}`}
                                    alt="face"
                                    className={styles.detailImage}
                                />
                            ) : (
                                <div className={styles.detailNoImage}><UserRound size={48} className={styles.detailNoImageIcon} /></div>
                            )}
                        </div>

                        <div className={styles.detailGrid}>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>ชื่อ-นามสกุล</span>
                                <span className={styles.detailValue}>{viewingPerson.first_name} {viewingPerson.last_name}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>สถานะ</span>
                                <span className={`${styles.detailValue} ${viewingPerson.is_blacklist ? styles.statusBlacklist : styles.statusNormal}`}>
                                    {viewingPerson.is_blacklist ? "บัญชีดำ" : "ปกติ"}
                                </span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>รหัสพนักงาน</span>
                                <span className={styles.detailValue}>{viewingPerson.external_id || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>ตำแหน่ง</span>
                                <span className={styles.detailValue}>{viewingPerson.position || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>กลุ่ม</span>
                                <span className={styles.detailValue}>{viewingPerson.group || "-"}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>วันที่เพิ่ม</span>
                                <span className={styles.detailValue}>{formatDateTime(viewingPerson.created_at)}</span>
                            </div>
                            <div className={styles.detailField}>
                                <span className={styles.detailLabel}>แก้ไขล่าสุด</span>
                                <span className={styles.detailValue}>{formatDateTime(viewingPerson.updated_at)}</span>
                            </div>
                        </div>

                        <div className={styles.detailFooter}>
                            <button
                                className={styles.detailDeleteBtn}
                                onClick={e => { closeModal(); openDeleteModal(viewingPerson, e) }}
                            >
                                <Trash2 size={15} /> ลบบุคคล
                            </button>
                            <button
                                className={styles.detailEditBtn}
                                onClick={e => openEditModal(viewingPerson, e)}
                            >
                                <Pencil size={15} /> แก้ไข
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Add / Edit Modal ──────────────────────────────────────── */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                {modalMode === "add" ? "เพิ่มบุคคล" : `แก้ไขบุคคล${editingPersonId ? ` (ID: ${editingPersonId})` : ""}`}
                            </h2>
                            <p className={styles.modalSubTitle}>
                                {modalMode === "add" ? "กรอกข้อมูลเพื่อเพิ่มบุคคล" : "กรอกข้อมูลที่ต้องการแก้ไข"}
                            </p>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label>รูปภาพ {modalMode === "add" && <span className={styles.required}>*</span>}</label>
                                <input type="file" accept="image/*" onChange={handleImageChange} className={styles.fileInput} />
                                {preview && (
                                    <div className={styles.imagePreviewLarge}>
                                        <img src={preview} alt="Preview" />
                                    </div>
                                )}
                            </div>
                            <div className={styles.formGroup}>
                                <label>รหัสประจำตัวบุคคล</label>
                                <input name="external_id" value={formData.external_id ?? ""} onChange={handleFormChange} placeholder="กรอกรหัสประจำตัวบุคคล" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>ชื่อ <span className={styles.required}>*</span></label>
                                <input name="first_name" value={formData.first_name} onChange={handleFormChange} required placeholder="กรอกชื่อ" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>นามสกุล</label>
                                <input name="last_name" value={formData.last_name ?? ""} onChange={handleFormChange} placeholder="กรอกนามสกุล" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>ตำแหน่ง</label>
                                <input name="position" value={formData.position ?? ""} onChange={handleFormChange} placeholder="กรอกตำแหน่ง (ไม่บังคับ)" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>กลุ่ม</label>
                                <input name="group" value={formData.group ?? ""} onChange={handleFormChange} placeholder="กรอกชื่อกลุ่ม (ไม่บังคับ)" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>สถานะ</label>
                                <select
                                    name="is_blacklist"
                                    value={formData.is_blacklist ? "true" : "false"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_blacklist: e.target.value === "true" }))}
                                    className={styles.selectInput}
                                >
                                    <option value="false">Normal</option>
                                    <option value="true">Blacklist</option>
                                </select>
                            </div>
                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                                <button type="submit" className={styles.submitButton} disabled={loadingData}>
                                    {loadingData
                                        ? (modalMode === "add" ? "กำลังเพิ่มบุคคล..." : "กำลังบันทึกข้อมูล...")
                                        : (modalMode === "add" ? "เพิ่มบุคคล" : "บันทึกข้อมูล")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Delete Modal ──────────────────────────────────────────── */}
            {modalMode === "delete" && deletingPerson && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                คุณกำลังจะลบ {deletingPerson.first_name} {deletingPerson.last_name}
                            </h2>
                            <p className={styles.modalSubTitle}>
                                คุณกำลังจะลบข้อมูลการตรวจจับของ <strong>{deletingPerson.first_name} {deletingPerson.last_name}</strong>
                            </p>
                        </div>
                        <div className={styles.deleteHint}>
                            ⚠️ การลบข้อมูลจะ<strong>ไม่สามารถกู้คืนได้</strong> กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
                        </div>
                        <div className={styles.form}>
                            <div className={styles.formActions}>
                                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                                <button type="button" className={styles.submitButtonDelete} onClick={handleDeletePerson}>ลบบุคคล</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}