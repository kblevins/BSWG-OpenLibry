import Layout from "@/components/layout/Layout";
import { CheckoutRequestStatus } from "@/entities/checkoutrequest";
import {
  ArrowLeft,
  BookMarked,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface RequestBook {
  id: number;
  title: string;
  author: string;
}

interface CheckoutRequest {
  id: number;
  createdAt: string;
  bookId: number;
  book: RequestBook;
  requesterEmail: string;
  requesterName: string | null;
  status: string;
  note: string | null;
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pending: {
    label: "Pending",
    classes: "bg-warning-light text-warning border border-warning/30",
  },
  approved: {
    label: "Approved",
    classes: "bg-success-light text-success border border-success/30",
  },
  denied: {
    label: "Denied",
    classes: "bg-destructive/10 text-destructive border border-destructive/30",
  },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? {
    label: status,
    classes: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<CheckoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setRequests(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatus = useCallback(
    async (id: number, status: CheckoutRequestStatus) => {
      setActionLoading(id);
      try {
        const res = await fetch(`/api/requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? "Update failed");
        }
        const updated: CheckoutRequest = await res.json();
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? updated : r)),
        );
        toast.success(`Request marked as ${status}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      } finally {
        setActionLoading(null);
      }
    },
    [],
  );

  const handleDelete = useCallback(async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Delete failed");
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Request deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <Layout>
      <Head>
        <title>Checkout Requests | OpenLibry</title>
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/admin")}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Back to admin"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-primary" />
              Checkout Requests
            </h1>
            <p className="text-sm text-muted-foreground">
              Member requests from the public catalog
            </p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {loading && !requests.length ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading requests…</span>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Pending
                {pending.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning text-white text-xs">
                    {pending.length}
                  </span>
                )}
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
                  No pending requests
                </p>
              ) : (
                <div className="space-y-3">
                  {pending.map((r) => (
                    <RequestRow
                      key={r.id}
                      request={r}
                      actionLoading={actionLoading}
                      onApprove={() => handleStatus(r.id, "approved")}
                      onDeny={() => handleStatus(r.id, "denied")}
                      onDelete={() => handleDelete(r.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {resolved.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  Resolved
                </h2>
                <div className="space-y-3">
                  {resolved.map((r) => (
                    <RequestRow
                      key={r.id}
                      request={r}
                      actionLoading={actionLoading}
                      onApprove={() => handleStatus(r.id, "approved")}
                      onDeny={() => handleStatus(r.id, "denied")}
                      onDelete={() => handleDelete(r.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function RequestRow({
  request,
  actionLoading,
  onApprove,
  onDeny,
  onDelete,
}: {
  request: CheckoutRequest;
  actionLoading: number | null;
  onApprove: () => void;
  onDeny: () => void;
  onDelete: () => void;
}) {
  const isBusy = actionLoading === request.id;
  const requester = request.requesterName
    ? `${request.requesterName} (${request.requesterEmail})`
    : request.requesterEmail;
  const date = new Date(request.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-foreground text-sm truncate">
            {request.book.title}
          </span>
          <StatusChip status={request.status} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          by {request.book.author} · #{request.bookId}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {requester} · {date}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {request.status === "pending" && (
          <>
            <button
              onClick={onApprove}
              disabled={isBusy}
              title="Approve"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-success text-white hover:bg-success/80 disabled:opacity-50 transition-colors"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Approve
            </button>
            <button
              onClick={onDeny}
              disabled={isBusy}
              title="Deny"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive text-white hover:bg-destructive/80 disabled:opacity-50 transition-colors"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              Deny
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          disabled={isBusy}
          title="Delete"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
