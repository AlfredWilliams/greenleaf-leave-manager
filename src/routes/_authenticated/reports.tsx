import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { STATUS_LABEL, formatDate, isoDate } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const PAGE_SIZE = 25;

function ReportsPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole(["dept_head", "hr_officer", "system_admin"]);

  const [status, setStatus] = useState<string>("all");
  const [leaveTypeId, setLeaveTypeId] = useState<string>("all");
  const [deptId, setDeptId] = useState<string>("all");
  const [employmentType, setEmploymentType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [page, setPage] = useState(0);

  const { data: types = [] } = useQuery({
    queryKey: ["report-types"],
    queryFn: async () => (await supabase.from("leave_types").select("id, name").order("name")).data ?? [],
  });
  const { data: depts = [] } = useQuery({
    queryKey: ["report-depts"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reports", status, leaveTypeId, deptId, employmentType, q, start, end],
    enabled: canView,
    queryFn: async () => {
      let sel = supabase.from("leave_requests")
        .select("id, start_date, end_date, working_days, status, reason, submitted_at, employee:employees!leave_requests_employee_id_fkey(id, full_name, email, employee_code, employment_type, department_id, section_id), leave_types(id, name), departments(name)")
        .order("start_date", { ascending: false }).limit(1000);
      if (status !== "all") sel = sel.eq("status", status as any);
      if (leaveTypeId !== "all") sel = sel.eq("leave_type_id", leaveTypeId);
      if (deptId !== "all") sel = sel.eq("department_id", deptId);
      if (start) sel = sel.gte("start_date", start);
      if (end) sel = sel.lte("end_date", end);
      const data = (await sel).data ?? [];
      let filtered: any[] = data;
      if (employmentType !== "all") filtered = filtered.filter((r) => r.employee?.employment_type === employmentType);
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        filtered = filtered.filter((r) =>
          (r.employee?.full_name ?? "").toLowerCase().includes(t) ||
          (r.employee?.email ?? "").toLowerCase().includes(t) ||
          (r.employee?.employee_code ?? "").toLowerCase().includes(t) ||
          (r.reason ?? "").toLowerCase().includes(t)
        );
      }
      return filtered;
    },
  });

  const paged = useMemo(() => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [rows, page]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const flatten = () => rows.map((r: any) => ({
    Employee: r.employee?.full_name ?? "",
    Code: r.employee?.employee_code ?? "",
    Email: r.employee?.email ?? "",
    Employment: r.employee?.employment_type ?? "",
    Department: r.departments?.name ?? "",
    "Leave Type": r.leave_types?.name ?? "",
    Start: r.start_date,
    End: r.end_date,
    "Working Days": r.working_days,
    Status: STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status,
    Reason: r.reason ?? "",
    Submitted: r.submitted_at ?? "",
  }));

  const exportCSV = () => {
    const rows2 = flatten();
    if (rows2.length === 0) return;
    const headers = Object.keys(rows2[0]);
    const csv = [headers.join(",")].concat(
      rows2.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `bopp-leave-report-${isoDate(new Date())}.csv`);
  };
  const exportXLSX = () => {
    const rows2 = flatten();
    const ws = XLSX.utils.json_to_sheet(rows2);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leave Report");
    XLSX.writeFile(wb, `bopp-leave-report-${isoDate(new Date())}.xlsx`);
  };
  const exportPDF = () => {
    const rows2 = flatten();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text("BOPP Leave Management Report", 14, 15);
    doc.setFontSize(9); doc.text(`Generated ${new Date().toLocaleString("en-GB")} · ${rows2.length} records`, 14, 21);
    const headers = ["Employee", "Code", "Dept", "Type", "Start", "End", "Days", "Status"];
    const body = rows2.map((r) => [r.Employee, r.Code, r.Department, r["Leave Type"], r.Start, r.End, r["Working Days"], r.Status]);
    autoTable(doc, { head: [headers], body, startY: 26, styles: { fontSize: 8 }, headStyles: { fillColor: [22, 163, 74] } });
    doc.save(`bopp-leave-report-${isoDate(new Date())}.pdf`);
  };

  if (!canView) {
    return <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">Reports are available to department heads, HR and administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Filter and export leave data by employee, department, type, status or date range.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          <Button variant="outline" onClick={exportXLSX}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
          <Button onClick={exportPDF}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1.5"><Label>Search</Label><Input placeholder="Name, code, reason…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Leave type</Label>
            <Select value={leaveTypeId} onValueChange={(v) => { setLeaveTypeId(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(types as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Department</Label>
            <Select value={deptId} onValueChange={(v) => { setDeptId(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(depts as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Employment</Label>
            <Select value={employmentType} onValueChange={(v) => { setEmploymentType(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Start on/after</Label><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); setPage(0); }} /></div>
          <div className="space-y-1.5"><Label>End on/before</Label><Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPage(0); }} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{isLoading ? "Loading…" : `${rows.length} records`}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 && (<TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No records match your filters.</TableCell></TableRow>)}
                {paged.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{r.employee?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.employee?.employee_code ?? r.employee?.email}</p>
                    </TableCell>
                    <TableCell>{r.departments?.name ?? "—"}</TableCell>
                    <TableCell>{r.leave_types?.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(r.start_date)} → {formatDate(r.end_date)}</TableCell>
                    <TableCell className="text-right">{r.working_days}</TableCell>
                    <TableCell><LeaveStatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {pageCount}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
