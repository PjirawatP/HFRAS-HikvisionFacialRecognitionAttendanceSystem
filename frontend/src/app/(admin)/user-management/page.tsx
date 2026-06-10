"use client"




import { AlertTriangle, ArrowUpDown, Filter, KeyRound, Lock, LockOpen, Pencil, Plus, Power, PowerOff, RefreshCw, Search, Trash2, Upload, X, } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/user-management.module.css"

import SearchBarComponent from "@/components/search-bar"
import ToastComponent from "@/components/toast"
import UserDropdownComponent from "@/components/user-dropdown"

import { useAuth } from "@/lib/auth-context"

import { exportToCSV, exportToPDF } from "@/lib/export-file"
import { UserRole } from "@/types/auth"
import { ToastState, ToastType } from "@/types/toast"
import { UserData, UserFormData } from "@/types/user"



type FilterStatus = "all" | "active" | "inactive"
type FilterRole = "all" | "superadmin" | "admin" | "user"
type ModalMode = "create" | "edit" | "delete" | "unlock" | "reset-password" | "detail" | null
type SortField = "id" | "username" | "role" | "is_active" | "is_locked" | null
type SortOrder = "asc" | "desc"



const POLL_INTERVAL_MS = 5000
const TOAST_DURATION_MS = 5000
const ROW_HEIGHT = 50
const HEADER_HEIGHT = 40



export default function Page() {
  const { user, signOut: logout } = useAuth()
  const router = useRouter()

  const [toast, setToast] = useState<ToastState | null>(null)
  const isMountedRef = useRef(true)

  const [searchQuery, setSearchQuery] = useState("")

  const filterWrapperRef = useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [roleFilter, setRoleFilter] = useState<FilterRole>("all")
  const [filterOpen, setFilterOpen] = useState(false)

  const [sortField, setSortField] = useState<SortField>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const [users, setUsers] = useState<UserData[]>([])

  const exportWrapperRef = useRef<HTMLDivElement>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const hasActiveFilters = statusFilter !== "all" || roleFilter !== "all"

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const editingUserIdRef = useRef<number | null>(null)

  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    password: "",
    role: "",
    is_active: true,
  })

  const [deletingUser, setDeletingUser] = useState<UserData | null>(null)
  const [unlockingUser, setUnlockingUser] = useState<UserData | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [viewingUser, setViewingUser] = useState<UserData | null>(null)

  const [togglingUserId, setTogglingUserId] = useState<number | null>(null)
  const [unlockingUserId, setUnlockingUserId] = useState<number | null>(null)

  /* ===== SIGN OUT ===================================================== */
  const handleSignOut = () => { logout(); router.replace("/sign-in") }

  /* ===== TOAST ======================================================== */
  const showToast = useCallback((message: string, type: ToastType) => {
    if (isMountedRef.current) setToast({ message, type })
  }, [])

  const hideToast = useCallback(() => {
    if (isMountedRef.current) setToast(null)
  }, [])

  /* ===== FILTERS ====================================================== */
  const clearFilters = () => {
    setStatusFilter("all"); setRoleFilter("all"); setSearchQuery("")
    setSortField(null); setSortOrder("asc"); setCurrentPage(1)
  }

  const handleFilterChange = (status: FilterStatus, role?: FilterRole) => {
    if (status) setStatusFilter(status)
    if (role !== undefined) setRoleFilter(role)
    setFilterOpen(false); setCurrentPage(1)
  }

  const superadminCount = users.filter(u => u.role.toLowerCase() === "superadmin").length
  const adminCount = users.filter(u => u.role.toLowerCase() === "admin").length
  const userCount = users.filter(u => u.role.toLowerCase() === "user").length
  const activeCount = users.filter(u => u.is_active).length
  const inactiveCount = users.filter(u => !u.is_active).length

  /* ===== SORTING ====================================================== */
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortOrder("asc") }
  }

  const filteredUsers = users
    .filter(u => {
      const haystack = `${u.id} ${u.username} ${u.role} ${u.is_active ? "active" : "inactive"}`.toLowerCase()
      const matchesSearch = haystack.includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? u.is_active : !u.is_active
      const matchesRole = roleFilter === "all" ? true : u.role.toLowerCase() === roleFilter.toLowerCase()
      return matchesSearch && matchesStatus && matchesRole
    })
    .sort((a, b) => {
      if (!sortField) return 0
      let comparison = 0
      switch (sortField) {
        case "id": comparison = a.id - b.id; break
        case "username": comparison = a.username.localeCompare(b.username); break
        case "role": comparison = a.role.localeCompare(b.role); break
        case "is_active": comparison = (a.is_active === b.is_active) ? 0 : a.is_active ? -1 : 1; break
        case "is_locked": comparison = (a.is_locked === b.is_locked) ? 0 : a.is_locked ? -1 : 1; break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })

  /* ===== PAGINATION =================================================== */
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  const calculateItemsPerPage = useCallback(() => {
    if (!tableContainerRef.current) return
    const containerHeight = tableContainerRef.current.clientHeight
    const actualHeaderHeight = tableContainerRef.current.querySelector("thead")?.clientHeight || HEADER_HEIGHT
    const firstRow = tableContainerRef.current.querySelector(`tbody tr.${styles.tableRow}`) as HTMLElement | null
    const actualRowHeight = firstRow ? firstRow.getBoundingClientRect().height : ROW_HEIGHT
    const newItemsPerPage = Math.max(1, Math.min(50, Math.floor((containerHeight - actualHeaderHeight - 2) / actualRowHeight)))
    if (newItemsPerPage !== itemsPerPage) { setItemsPerPage(newItemsPerPage); setCurrentPage(1) }
  }, [itemsPerPage])

  const handleExportCSV = () => {
    exportToCSV(
      filteredUsers.map(u => [
        u.id,
        u.username,
        getRoleLabel(u.role),
        u.is_active ? "ปกติ" : "ถูกระงับ",
        u.is_locked ? "ถูกล็อก" : "ปกติ",
        u.reset_requested_at ? "มีคำขอ" : "—",
      ]),
      ["ไอดี", "ชื่อผู้ใช้งาน", "บทบาท", "สถานะการใช้งาน", "สถานะการล็อก", "คำขอรีเซ็ต"],
      "users"
    )
    setExportOpen(false)
    showToast("ส่งออกข้อมูลสำเร็จ", "success")
  }

  const handleExportPDF = () => {
    exportToPDF(
      filteredUsers.map(u => [
        u.id,
        u.username,
        getRoleLabel(u.role),
        u.is_active ? "ปกติ" : "ถูกระงับ",
        u.is_locked ? "ถูกล็อก" : "ปกติ",
        u.reset_requested_at ? "มีคำขอ" : "—",
      ]),
      ["ไอดี", "ชื่อผู้ใช้งาน", "บทบาท", "สถานะการใช้งาน", "สถานะการล็อก", "คำขอรีเซ็ต"],
      "รายการผู้ใช้งาน",
      "users"
    )
    setExportOpen(false)
    showToast("ส่งออกข้อมูลสำเร็จ", "success")
  }

  /* ===== FETCH DATA =================================================== */
  const fetchUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) { setLoadingData(true); setFetchError(false) }
      const res = await fetch("/api/user/list")
      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลได้")
      setUsers(await res.json())
      setFetchError(false)
    } catch (err) {
      setFetchError(true)
      if (showLoading) showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
    } finally {
      if (showLoading) setLoadingData(false)
    }
  }, [showToast])

  /* ===== TOGGLE USER STATUS =========================================== */
  const toggleUserStatus = async (targetUser: UserData, e: React.MouseEvent) => {
    e.stopPropagation()
    if (togglingUserId) return
    try {
      setTogglingUserId(targetUser.id)
      const res = await fetch(`/api/user/${targetUser.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !targetUser.is_active }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "ไม่สามารถเปลี่ยนสถานะได้") }
      await fetchUsers(false)
      showToast(`${targetUser.is_active ? "ระงับ" : "เปิดใช้งาน"}ผู้ใช้งานสำเร็จ`, "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะได้", "error")
    } finally {
      setTogglingUserId(null)
    }
  }

  /* ===== UNLOCK USER ================================================== */
  const handleUnlockUser = async () => {
    if (!unlockingUser) return
    try {
      setUnlockingUserId(unlockingUser.id)
      const res = await fetch(`/api/user/${unlockingUser.id}/unlock`, { method: "POST" })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "ไม่สามารถปลดล็อกได้") }
      closeModal(); await fetchUsers(false)
      showToast("ปลดล็อกผู้ใช้งานสำเร็จ", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ไม่สามารถปลดล็อกได้", "error")
    } finally {
      setUnlockingUserId(null)
    }
  }

  /* ===== RESET PASSWORD =============================================== */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordUser || !newPassword.trim()) { showToast("กรุณากรอกรหัสผ่านใหม่", "error"); return }
    try {
      const res = await fetch(`/api/user/${resetPasswordUser.id}/admin-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ") }
      closeModal(); await fetchUsers(false)
      showToast("รีเซ็ตรหัสผ่านสำเร็จ", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ไม่สามารถรีเซ็ตรหัสผ่านได้", "error")
    }
  }

  /* ===== FORM ========================================================= */
  const handleFormChange = (field: keyof UserFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  /* ===== MODAL ======================================================== */
  const openDetailModal = (u: UserData) => { setViewingUser(u); setModalMode("detail") }
  const openCreateModal = () => { setModalMode("create"); setFormData({ username: "", password: "", role: "", is_active: true }) }
  const openDeleteModal = (u: UserData, e: React.MouseEvent) => { e.stopPropagation(); setDeletingUser(u); setModalMode("delete") }
  const openUnlockModal = (u: UserData, e: React.MouseEvent) => { e.stopPropagation(); setUnlockingUser(u); setModalMode("unlock") }
  const openResetPasswordModal = (u: UserData, e: React.MouseEvent) => { e.stopPropagation(); setResetPasswordUser(u); setNewPassword(""); setModalMode("reset-password") }

  const openEditModal = (u: UserData, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!u?.id) { showToast("ข้อมูลผู้ใช้งานไม่ถูกต้อง", "error"); return }
    setModalMode("edit"); setEditingUserId(u.id); editingUserIdRef.current = u.id
    setFormData({ id: u.id, username: u.username, role: u.role, is_active: u.is_active })
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.username || !formData.password || !formData.role) { showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error"); return }
    try {
      const res = await fetch("/api/user/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.username, password: formData.password, role: formData.role }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "สร้างผู้ใช้งานไม่สำเร็จ") }
      closeModal(); await fetchUsers(false)
      showToast("สร้างผู้ใช้งานสำเร็จ", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ไม่สามารถสร้างผู้ใช้งานได้", "error")
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUserId || !formData.username || !formData.role) { showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error"); return }
    try {
      const res = await fetch(`/api/user/${editingUserId}/edit`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.username, role: formData.role }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "แก้ไขข้อมูลไม่สำเร็จ") }
      closeModal(); await fetchUsers(false)
      showToast("แก้ไขข้อมูลสำเร็จ", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ไม่สามารถแก้ไขข้อมูลได้", "error")
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    try {
      const res = await fetch(`/api/user/${deletingUser.id}/delete`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "ลบผู้ใช้งานไม่สำเร็จ") }
      const willPageBeEmpty = currentUsers.length === 1
      closeModal(); await fetchUsers(false)
      if (willPageBeEmpty && currentPage > 1) setCurrentPage(p => p - 1)
      showToast("ลบผู้ใช้งานสำเร็จ", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ไม่สามารถลบผู้ใช้งานได้", "error")
    }
  }

  const closeModal = useCallback(() => {
    setModalMode(null); setEditingUserId(null); editingUserIdRef.current = null
    setFormData({ username: "", password: "", role: "", is_active: true })
    setDeletingUser(null); setUnlockingUser(null); setResetPasswordUser(null)
    setNewPassword(""); setViewingUser(null)
  }, [])

  /* ===== EFFECTS ====================================================== */
  useEffect(() => {
    fetchUsers(true)
    const interval = setInterval(() => fetchUsers(false), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchUsers])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter, roleFilter])
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [currentPage, totalPages])
  useEffect(() => { if (!toast) return; const t = setTimeout(hideToast, TOAST_DURATION_MS); return () => clearTimeout(t) }, [toast, hideToast])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target as Node)) setFilterOpen(false)
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

  /* ===== HELPERS ====================================================== */
  const getRoleLabel = (role: string) => {
    if (role === UserRole.SUPERADMIN) return "Super Admin"
    if (role === UserRole.ADMIN) return "Admin"
    return "User"
  }

  /* ===== RENDER ======================================================= */
  return (
    <div className={styles.pageContainer}>

      {toast && <ToastComponent message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.leftHeader}>
          <h1 className={styles.title}>ผู้ใช้งานทั้งหมด ({users.length})</h1>
          <p className={styles.subtitle}>จัดการผู้ใช้งานและสิทธิ์การเข้าถึงระบบ</p>
        </div>
        <div className={styles.headerRight}>
          <UserDropdownComponent username={user?.username} role={user?.role} onSignOut={handleSignOut} />
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>

        {/* Toolbar */}
        <div className={styles.toolBar}>
          <div className={styles.leftToolBar}>
            <SearchBarComponent value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหาผู้ใช้งาน..." />

            <div className={styles.filterWrapper} ref={filterWrapperRef}>
              <button className={hasActiveFilters ? styles.filterButtonActive : styles.filterButton} onClick={() => setFilterOpen(prev => !prev)}>
                <span className={styles.pillButtonIcon}><Filter size={16} /></span>
                ตัวกรอง
              </button>
              {filterOpen && (
                <div className={styles.filterDropdown}>
                  <div className={styles.filterDropdownHeader}>
                    <span>ตัวกรอง</span>
                    {hasActiveFilters && <button className={styles.clearButton} onClick={clearFilters}>ล้างทั้งหมด</button>}
                  </div>
                  <div className={styles.filterSection}>
                    <div className={styles.filterSectionTitle}>สถานะการใช้งาน</div>
                    {([
                      { value: "all", label: "ทั้งหมด", count: users.length },
                      { value: "active", label: "ปกติ", count: activeCount },
                      { value: "inactive", label: "ถูกระงับ", count: inactiveCount },
                    ] as { value: FilterStatus; label: string; count: number }[]).map(opt => (
                      <button key={opt.value} className={statusFilter === opt.value ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange(opt.value)}>
                        <span>{opt.label}</span><span className={styles.filterCount}>{opt.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.filterSection}>
                    <div className={styles.filterSectionTitle}>ตำแหน่ง</div>
                    {([
                      { value: "all", label: "ทั้งหมด", count: users.length },
                      { value: "superadmin", label: "Super Admin", count: superadminCount },
                      { value: "admin", label: "Admin", count: adminCount },
                      { value: "user", label: "User", count: userCount },
                    ] as { value: FilterRole; label: string; count: number }[]).map(opt => (
                      <button key={opt.value} className={roleFilter === opt.value ? styles.filterOptionActive : styles.filterOption} onClick={() => handleFilterChange(statusFilter, opt.value)}>
                        <span>{opt.label}</span><span className={styles.filterCount}>{opt.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.rightToolBar}>
            {/* <button className={styles.addButton} onClick={openCreateModal}>
              <span className={styles.pillButtonIcon}><Plus size={16} /></span>
              เพิ่มผู้ใช้งาน
            </button> */}

            <div className={styles.exportWrapper} ref={exportWrapperRef}>
              <button className={styles.exportButton} onClick={() => setExportOpen(prev => !prev)} disabled={filteredUsers.length === 0}>
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
                  {/* <th onClick={() => handleSort("id")} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
                      ไอดี {sortField === "id" && <ArrowUpDown size={14} />}
                    </div>
                  </th> */}
                  {([
                    ["username", "ชื่อผู้ใช้งาน"],
                    ["role", "บทบาท"],
                    ["is_active", "สถานะการใช้งาน"],
                    ["is_locked", "สถานะการล็อก"],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th key={field} onClick={() => handleSort(field)} style={{ cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        {label} {sortField === field && <ArrowUpDown size={14} />}
                      </div>
                    </th>
                  ))}
                  <th>คำขอรีเซ็ตรหัสผ่าน</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody className={styles.tableBody}>
                {loadingData && (
                  <tr className={styles.stateRow}><td colSpan={7} className={styles.stateCell}><div className={styles.stateInner}><div className={styles.spinner} /><span className={styles.stateText}>กำลังโหลดข้อมูล…</span></div></td></tr>
                )}
                {!loadingData && fetchError && (
                  <tr className={styles.stateRow}><td colSpan={7} className={styles.stateCell}><div className={styles.stateInner}><span className={styles.errorIcon}><AlertTriangle size={48} /></span><p className={styles.errorText}>ไม่สามารถโหลดข้อมูลได้</p><button className={styles.retryButton} onClick={() => fetchUsers(true)}><RefreshCw size={15} /> ลองใหม่</button></div></td></tr>
                )}
                {!loadingData && !fetchError && filteredUsers.length === 0 && (
                  <tr className={styles.stateRow}><td colSpan={7} className={styles.stateCell}><div className={styles.stateInner}><span className={styles.emptyIcon}><Search size={48} /></span><p className={styles.emptyText}>{hasActiveFilters ? "ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข" : "ยังไม่มีผู้ใช้งานในระบบ"}</p>{hasActiveFilters && <button className={styles.clearFiltersBtn} onClick={clearFilters}>ล้างตัวกรอง</button>}</div></td></tr>
                )}

                {!loadingData && !fetchError && currentUsers.map(targetUser => (
                  <tr
                    key={targetUser.id}
                    className={`${styles.tableRow} ${targetUser.reset_requested_at ? styles.rowHasResetRequest : ""}`}
                    onClick={() => openDetailModal(targetUser)}
                  >
                    <td>{targetUser.id}</td>
                    <td>{targetUser.username}</td>
                    <td>{getRoleLabel(targetUser.role)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${targetUser.is_active ? styles.statusActive : styles.statusInactive}`}>
                        {targetUser.is_active ? "ปกติ" : "ถูกระงับ"}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${targetUser.is_locked ? styles.statusLocked : styles.statusActive}`}>
                        {targetUser.is_locked ? "ถูกล็อก" : "ปกติ"}
                      </span>
                    </td>
                    <td>
                      {targetUser.reset_requested_at
                        ? <span className={`${styles.statusBadge} ${styles.statusLocked}`}>มีคำขอ</span>
                        : <span className={styles.dashText}>—</span>}
                    </td>
                    <td>
                      {targetUser.role.toLowerCase() !== "superadmin" ? (
                        <div className={styles.actionGroup}>
                          <button
                            className={[targetUser.is_active ? styles.toggleOn : styles.toggleOff, togglingUserId === targetUser.id ? styles.toggleLoading : ""].join(" ")}
                            onClick={e => toggleUserStatus(targetUser, e)}
                            disabled={togglingUserId === targetUser.id}
                            title={targetUser.is_active ? "ระงับผู้ใช้งาน" : "เปิดใช้งาน"}
                          >
                            {targetUser.is_active ? <Power size={17} /> : <PowerOff size={17} />}
                          </button>
                          <button className={styles.resetBtn} disabled={!targetUser.is_locked} onClick={e => openUnlockModal(targetUser, e)} title="ปลดล็อกผู้ใช้งาน">
                            <LockOpen size={17} />
                          </button>
                          <button className={styles.resetBtn} onClick={e => openResetPasswordModal(targetUser, e)} disabled={!targetUser.reset_requested_at} title={targetUser.reset_requested_at ? "รีเซ็ตรหัสผ่าน" : "ไม่มีคำขอรีเซ็ต"}>
                            <KeyRound size={17} />
                          </button>
                          <button className={styles.editBtn} onClick={e => openEditModal(targetUser, e)} title="แก้ไข">
                            <Pencil size={17} />
                          </button>
                          <button className={styles.deleteBtn} onClick={e => openDeleteModal(targetUser, e)} title="ลบ">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ) : (
                        <span className={styles.dashText}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loadingData && !fetchError && filteredUsers.length > 0 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>แสดง {startIndex + 1}–{Math.min(endIndex, filteredUsers.length)} จาก {filteredUsers.length} รายการ</span>
              <div className={styles.paginationControls}>
                <button className={styles.paginationBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>ก่อนหน้า</button>
                <span className={styles.paginationText}>หน้า {currentPage} / {totalPages}</span>
                <button className={styles.paginationBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Detail Modal ───────────────────────────────────────────── */}
      {modalMode === "detail" && viewingUser && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.detailModalHeader}>
              <div>
                <h2 className={styles.modalTitle}>รายละเอียดผู้ใช้งาน</h2>
                <p className={styles.modalSubTitle}>ID #{viewingUser.id}</p>
              </div>
              <button className={styles.detailCloseBtn} onClick={closeModal} title="ปิด"><X size={18} /></button>
            </div>
            <div className={styles.detailGrid}>
              <div className={styles.detailField}><span className={styles.detailLabel}>ชื่อผู้ใช้งาน</span><span className={styles.detailValue}>{viewingUser.username}</span></div>
              <div className={styles.detailField}><span className={styles.detailLabel}>บทบาท</span><span className={styles.detailValue}>{getRoleLabel(viewingUser.role)}</span></div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>สถานะการใช้งาน</span>
                <span className={`${styles.detailValue} ${viewingUser.is_active ? styles.statusActive : styles.statusInactive}`}>{viewingUser.is_active ? "ปกติ" : "ถูกระงับ"}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>สถานะการล็อก</span>
                <span className={`${styles.detailValue} ${viewingUser.is_locked ? styles.statusLocked : styles.statusActive}`}>{viewingUser.is_locked ? "ถูกล็อก" : "ปกติ"}</span>
              </div>
              <div className={styles.detailField} style={{ gridColumn: "span 2" }}>
                <span className={styles.detailLabel}>คำขอรีเซ็ตรหัสผ่าน</span>
                <span className={styles.detailValue}>
                  {viewingUser.reset_requested_at ? <span className={`${styles.detailValue} ${styles.statusLocked}`}>มีคำขอ</span> : "—"}
                </span>
              </div>
              <div className={styles.detailField}><span className={styles.detailLabel}>สร้างเมื่อ</span><span className={styles.detailValue}>{new Date(viewingUser.created_at).toLocaleString("th-TH")}</span></div>
              <div className={styles.detailField}><span className={styles.detailLabel}>อัปเดตล่าสุด</span><span className={styles.detailValue}>{new Date(viewingUser.updated_at).toLocaleString("th-TH")}</span></div>
            </div>
            {viewingUser.role.toLowerCase() !== "superadmin" ? (
              <div className={styles.detailFooter}>
                <button className={styles.detailDeleteBtn} onClick={e => { closeModal(); openDeleteModal(viewingUser, e) }}><Trash2 size={15} /> ลบผู้ใช้งาน</button>
                <button className={styles.detailEditBtn} onClick={e => openEditModal(viewingUser, e)}><Pencil size={15} /> แก้ไข</button>
              </div>
            ) : (
              <div className={styles.detailFooter} style={{ justifyContent: "flex-end" }}>
                <button className={styles.detailCancelButton} onClick={closeModal}>ปิด</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Create Modal ──────────────────────────────────────────── */}
      {modalMode === "create" && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>เพิ่มผู้ใช้งานใหม่</h2></div>
            <form className={styles.form} onSubmit={handleCreateUser}>
              <div className={styles.formGroup}><label>ชื่อผู้ใช้งาน <span className={styles.required}>*</span></label><input type="text" value={formData.username} onChange={e => handleFormChange("username", e.target.value)} placeholder="กรอกชื่อผู้ใช้งาน" required /></div>
              <div className={styles.formGroup}><label>รหัสผ่าน <span className={styles.required}>*</span></label><input type="password" value={formData.password || ""} onChange={e => handleFormChange("password", e.target.value)} placeholder="กรอกรหัสผ่าน" required /></div>
              <div className={styles.formGroup}>
                <label>ตำแหน่ง <span className={styles.required}>*</span></label>
                <select value={formData.role} onChange={e => handleFormChange("role", e.target.value)} required>
                  <option value="">เลือกตำแหน่ง</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                <button type="submit" className={styles.submitButton}>สร้างผู้ใช้งาน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ────────────────────────────────────────────── */}
      {modalMode === "edit" && editingUserId && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>แก้ไขข้อมูลผู้ใช้งาน</h2></div>
            <form className={styles.form} onSubmit={handleEditUser}>
              <div className={styles.formGroup}><label>ชื่อผู้ใช้งาน <span className={styles.required}>*</span></label><input type="text" value={formData.username} onChange={e => handleFormChange("username", e.target.value)} placeholder="กรอกชื่อผู้ใช้งาน" required /></div>
              <div className={styles.formGroup}>
                <label>ตำแหน่ง <span className={styles.required}>*</span></label>
                <select value={formData.role} onChange={e => handleFormChange("role", e.target.value)} required>
                  <option value="">เลือกตำแหน่ง</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                <button type="submit" className={styles.submitButton}>บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Unlock Modal ──────────────────────────────────────────── */}
      {modalMode === "unlock" && unlockingUser && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>ยืนยันการปลดล็อกผู้ใช้งาน</h2><p className={styles.deleteDescription}>คุณกำลังจะปลดล็อกผู้ใช้งาน <strong>{unlockingUser.username}</strong></p></div>
            <div className={styles.deleteHint} style={{ borderLeftColor: "var(--warning-color)" }}>🔓 ผู้ใช้งานนี้ถูกล็อกเนื่องจากเข้าสู่ระบบผิดพลาดหลายครั้ง</div>
            <div className={styles.form}><div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
              <button type="button" className={styles.submitButtonWarning} onClick={handleUnlockUser} disabled={unlockingUserId === unlockingUser.id}><LockOpen size={16} /> ปลดล็อก</button>
            </div></div>
          </div>
        </div>
      )}

      {/* ─── Reset Password Modal ──────────────────────────────────── */}
      {modalMode === "reset-password" && resetPasswordUser && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>รีเซ็ตรหัสผ่าน</h2><p className={styles.deleteDescription}>ตั้งรหัสผ่านใหม่สำหรับ <strong>{resetPasswordUser.username}</strong></p></div>
            {resetPasswordUser.reset_requested_at && <div className={styles.deleteHint}>⚠️ ผู้ใช้งานนี้มีคำขอรีเซ็ตรหัสผ่านที่รอดำเนินการ</div>}
            <form className={styles.form} onSubmit={handleResetPassword}>
              <div className={styles.formGroup}><label>รหัสผ่านใหม่ <span className={styles.required}>*</span></label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="กรอกรหัสผ่านใหม่" required /></div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
                <button type="submit" className={styles.submitButton}><KeyRound size={16} /> รีเซ็ตรหัสผ่าน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ──────────────────────────────────────────── */}
      {modalMode === "delete" && deletingUser && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>ยืนยันการลบผู้ใช้งาน</h2><p className={styles.deleteDescription}>คุณกำลังจะลบผู้ใช้งาน <strong>{deletingUser.username}</strong></p></div>
            <div className={styles.deleteHint}>⚠️ การลบผู้ใช้งานจะ<strong>ไม่สามารถกู้คืนได้</strong></div>
            <div className={styles.form}><div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={closeModal}>ยกเลิก</button>
              <button type="button" className={styles.submitButtonDelete} onClick={handleDeleteUser}>ลบผู้ใช้งาน</button>
            </div></div>
          </div>
        </div>
      )}
    </div>
  )
}