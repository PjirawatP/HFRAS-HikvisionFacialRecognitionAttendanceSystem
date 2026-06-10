import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import { fontBase64 } from "@/lib/fonts/sarabun"



export function exportToCSV(
    data: any[],
    headers: string[],
    filename: string = "export"
) {
    if (!data.length) return false

    const BOM = "\uFEFF"
    const csv = [headers, ...data]
        .map(row =>
            row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n")

    const blob = new Blob([BOM + csv], {
        type: "text/csv;charset=utf-8;"
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}_${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)

    return true
}

export function exportToPDF(
    data: any[],
    headers: string[],
    title: string = "Export",
    filename: string = "export",
    options: {
        orientation?: "portrait" | "landscape"
        fontSize?: number
        showDate?: boolean
    } = {}
) {
    if (!data.length) return false

    const {
        orientation = "landscape",
        fontSize = 14,
        showDate = true
    } = options

    const doc = new jsPDF({ orientation })

    doc.addFileToVFS("Sarabun-Regular.ttf", fontBase64)
    doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal")
    doc.setFont("Sarabun", "normal")

    doc.setFontSize(fontSize + 2)
    doc.text(title, 14, 15)

    let startY = 22

    if (showDate) {
        doc.setFontSize(fontSize - 4)
        doc.text(
            `วันที่: ${new Date().toLocaleString("th-TH")}`,
            14,
            22
        )
        startY = 28
    }

    autoTable(doc, {
        startY,
        head: [headers],
        body: data,
        styles: {
            font: "Sarabun",
            fontStyle: "normal",
            fontSize: fontSize - 4,
            cellPadding: 3
        },
        headStyles: {
            font: "Sarabun",
            fontStyle: "normal",
            fillColor: [45, 45, 45],
            textColor: 255
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        }
    })

    doc.save(`${filename}_${new Date().toISOString()}.pdf`)
    return true
}



export function formatDateThai(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date
    return d.toLocaleString("th-TH")
}



export function formatNumberThai(num: number, decimals = 2): string {
    return num.toLocaleString("th-TH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })
}



export function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9ก-๙._-]/g, "_").substring(0, 100)
}