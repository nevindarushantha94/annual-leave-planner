import { formatLong } from './dateWindow'

const STATUS_LABEL = {
  ongoing: 'On Leave Now',
  upcoming: 'Upcoming',
  past: 'Completed',
}

// Exports exactly the rows currently visible in the management table.
// Deliberately excludes ids / auth_user_id / any internal field — only the
// same human-readable columns already shown on screen.
//
// `xlsx` is dynamically imported so its ~500KB doesn't bloat the main
// bundle for users who never click "Download Excel".
export async function exportLeaveReportToExcel(rows) {
  const XLSX = await import('xlsx')

  const sheetData = rows.map((r) => ({
    'Employee Name': r.employeeName,
    EPF: r.employeeEpf ?? '',
    Role: r.employeeRole ?? '',
    Team: r.teamName ?? '',
    'Seating Group': r.seatGroupLabel ?? '',
    'Leave Start Date': formatLong(r.startDate),
    'Leave End Date': formatLong(r.endDate),
    'Number of Days': r.daysCount,
    Status: STATUS_LABEL[r.status] ?? r.status,
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetData)
  worksheet['!cols'] = [
    { wch: 26 }, // Employee Name
    { wch: 12 }, // EPF
    { wch: 10 }, // Role
    { wch: 14 }, // Team
    { wch: 14 }, // Seating Group
    { wch: 16 }, // Start
    { wch: 16 }, // End
    { wch: 14 }, // Days
    { wch: 14 }, // Status
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Report')

  const now = new Date()
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  XLSX.writeFile(workbook, `Annual_Leave_Report_${yyyyMm}.xlsx`)
}
