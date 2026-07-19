import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, RotateCcw, Send, Upload, FileText, Trash2, Download, Loader2, MessageSquare, User, Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDate, formatDateTime, fileSize, ALLOWED_DOC_TYPES, ALLOWED_DOC_EXTENSIONS, MAX_DOC_SIZE } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/leave-requests/$id")({
  component: LeaveRequestDetail,
});

function LeaveRequestDetail() {
  const { id } = Route.useParams();
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: request, isLoading } = useQuery({
    queryKey: ["leave-request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          *,
          leave_types(name, is_paid, requires_document),
          employee:employees!leave_requests_employee_id_fkey(id, full_name, email, employee_code, leave_balance, department_id, departments(name)),
          supervisor:employees!leave_requests_supervisor_id_fkey(id, full_name)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["leave-approvals", id],
    queryFn: async () =>
      (await supabase
        .from("leave_approvals")
        .select("*, approver:employees!leave_approvals_approver_id_fkey(full_name)")
        .eq("leave_request_id", id)
        .order("created_at")).data ?? [],
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["leave-documents", id],
    queryFn: async () =>
      (await supabase.from("leave_documents").select("*").eq("leave_request_id", id).order("created_at")).data ?? [],
  });

  const isOwner = request?.employee_id === user?.id;
  const isSupervisor = request?.supervisor_id === user?.id && request?.status === "pending_supervisor";
  const isDeptHead =
    request?.status === "pending_dept_head" &&
    hasAnyRole(["dept_head", "hr_officer", "system_admin"]);
  const isHR = request?.status === "pending_hr" && hasAnyRole(["hr_officer", "system_admin"]);
  const canApprove = isSupervisor || isDeptHead || isHR;

  const canEdit = isOwner && (request?.status === "draft" || request?.status === "changes_requested");
  const canCancel = isOwner && request && !["approved", "rejected", "cancelled"].includes(request.status);
  const canSubmit = isOwner && (request?.status === "draft" || request?.status === "changes_requested");

  const rpc = useMutation({
    mutationFn: async ({ fn, comment }: { fn: string; comment?: string }) => {
      const { error } = await supabase.rpc(fn as any, { _id: id, ...(comment !== undefined ? { _comment: comment } : {}) });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-request", id] });
      qc.invalidateQueries({ queryKey: ["leave-approvals", id] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["approvals-inbox"] });
      qc.invalidateQueries({ queryKey: ["me-balance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leave_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      toast.success("Draft deleted");
      navigate({ to: "/leave-requests" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED_DOC_TYPES.includes(file.type)) throw new Error("File type not allowed");
      if (file.size > MAX_DOC_SIZE) throw new Error("File too large (max 10 MB)");
      const path = `${user!.id}/${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("leave-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("leave_documents").insert({
        leave_request_id: id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: path,
        uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-documents", id] });
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDoc = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("leave-documents").remove([doc.storage_path]);
      const { error } = await supabase.from("leave_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-documents", id] });
      toast.success("Document deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage.from("leave-documents").createSignedUrl(doc.storage_path, 60);
    if (error || !data) return toast.error("Could not fetch file");
    window.open(data.signedUrl, "_blank");
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!request) return (
    <div className="text-center py-16">
      <p>Leave request not found.</p>
      <Button asChild variant="link" className="mt-2"><Link to="/leave-requests">Back to list</Link></Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/leave-requests"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{request.leave_types?.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(request.start_date)} → {formatDate(request.end_date)}
            </p>
          </div>
          <LeaveStatusBadge status={request.status} className="text-sm" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Calendar" value={request.total_calendar_days} />
        <Stat label="Weekends" value={request.weekend_days} />
        <Stat label="Holidays" value={request.holiday_days} />
        <Stat label="Working days" value={request.working_days} tone="primary" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row icon={User} label="Employee" value={`${request.employee?.full_name}${request.employee?.employee_code ? ` (${request.employee.employee_code})` : ""}`} />
          <Row icon={Building2} label="Department" value={request.employee?.departments?.name ?? "—"} />
          <Row icon={User} label="Supervisor" value={request.supervisor?.full_name ?? "—"} />
          <Row icon={MessageSquare} label="Reason" value={request.reason ?? "—"} />
          <Row icon={FileText} label="Submitted" value={request.submitted_at ? formatDateTime(request.submitted_at) : "Not submitted"} />
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supporting Documents</CardTitle>
          <CardDescription>PDF, DOC, DOCX, PNG, JPG — up to 10 MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
          {documents.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{fileSize(d.file_size)} · {formatDateTime(d.created_at)}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => downloadDoc(d)}><Download className="h-4 w-4" /></Button>
                {isOwner && canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => deleteDoc.mutate(d)} disabled={deleteDoc.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isOwner && (
            <div>
              <input
                id="file-upload"
                type="file"
                accept={ALLOWED_DOC_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadDoc.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button asChild variant="outline" size="sm" disabled={uploadDoc.isPending}>
                <label htmlFor="file-upload" className="cursor-pointer">
                  {uploadDoc.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload document
                </label>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
        <CardContent>
          <ApprovalTimeline approvals={approvals} status={request.status} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <Button onClick={() => rpc.mutate({ fn: "submit_leave_request" })} disabled={rpc.isPending}>
            <Send className="mr-2 h-4 w-4" /> Submit for approval
          </Button>
        )}
        {canEdit && (
          <>

            {request.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">Delete draft</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
        {canCancel && request.status !== "draft" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Cancel request</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel leave request?</AlertDialogTitle>
                <AlertDialogDescription>This will withdraw your request from the approval process.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => rpc.mutate({ fn: "cancel_leave_request" })}>Cancel request</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {canApprove && (
          <>
            <ActionDialog
              label="Approve"
              variant="default"
              icon={<CheckCircle2 className="mr-2 h-4 w-4" />}
              title="Approve this request?"
              onConfirm={(comment) => rpc.mutateAsync({ fn: "approve_leave_request", comment })}
            />
            <ActionDialog
              label="Request changes"
              variant="outline"
              icon={<RotateCcw className="mr-2 h-4 w-4" />}
              title="Request changes"
              requireComment
              onConfirm={(comment) => rpc.mutateAsync({ fn: "request_leave_changes", comment })}
            />
            <ActionDialog
              label="Reject"
              variant="destructive"
              icon={<XCircle className="mr-2 h-4 w-4" />}
              title="Reject this request?"
              requireComment
              onConfirm={(comment) => rpc.mutateAsync({ fn: "reject_leave_request", comment })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "primary" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "primary" ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "primary" ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words">{value}</p>
      </div>
    </div>
  );
}

function ApprovalTimeline({ approvals, status }: { approvals: any[]; status: string }) {
  const steps = [
    { key: "submit", role: "Employee", label: "Submitted" },
    { key: "supervisor", role: "Supervisor", label: "Supervisor" },
    { key: "dept_head", role: "Department Head", label: "Department Head" },
    { key: "hr_officer", role: "HR Officer", label: "HR Officer" },
  ];

  return (
    <div className="space-y-3">
      {approvals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not yet submitted.</p>
      ) : (
        approvals.map((a) => (
          <div key={a.id} className="flex gap-3">
            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              a.action === "approve" ? "bg-emerald-500" :
              a.action === "reject" ? "bg-red-500" :
              a.action === "cancel" ? "bg-muted-foreground" :
              a.action === "request_changes" ? "bg-blue-500" : "bg-primary"
            }`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{a.approver?.full_name ?? "—"}</span>
                <span className="text-muted-foreground"> ({a.approver_role.replace("_", " ")})</span>
                {" "}
                <span className="font-medium text-foreground">{actionLabel(a.action)}</span>
              </p>
              {a.comment && <p className="mt-0.5 text-sm text-muted-foreground">"{a.comment}"</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
            </div>
          </div>
        ))
      )}
      <div className="mt-2 border-t pt-3 text-xs text-muted-foreground">
        Current status: <LeaveStatusBadge status={status as any} className="ml-1" />
      </div>
    </div>
  );
}

function actionLabel(a: string) {
  return ({
    submit: "submitted the request",
    approve: "approved",
    reject: "rejected",
    request_changes: "requested changes",
    cancel: "cancelled the request",
    comment: "commented",
  } as Record<string, string>)[a] ?? a;
}

function ActionDialog({
  label, icon, title, variant, requireComment, onConfirm,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  variant: "default" | "outline" | "destructive";
  requireComment?: boolean;
  onConfirm: (comment: string) => Promise<any>;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (requireComment && comment.trim().length < 3) {
      toast.error("A comment (min 3 chars) is required");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(comment);
      toast.success(`${label} — done`);
      setOpen(false);
      setComment("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>{icon}{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{requireComment ? "Please provide a comment explaining your decision." : "You can optionally add a comment."}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          rows={4}
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={variant} onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
