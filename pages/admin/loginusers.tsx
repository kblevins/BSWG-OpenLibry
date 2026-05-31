import Layout from "@/components/layout/Layout";
import { t } from "@/lib/i18n";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";

interface LoginUser {
  id: number;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

interface Props {
  initialUsers: LoginUser[];
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        isAdmin
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {isAdmin && <ShieldCheck className="w-3 h-3" />}
      {isAdmin ? t("loginUsersPage.roleAdmin") : t("loginUsersPage.roleUser")}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        active
          ? "bg-success-light text-success"
          : "bg-destructive-light text-destructive"
      }`}
    >
      {active
        ? t("loginUsersPage.statusActive")
        : t("loginUsersPage.statusInactive")}
    </span>
  );
}

export default function LoginUsersPage({ initialUsers }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<LoginUser[]>(initialUsers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      const res = await fetch("/api/loginusers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || t("loginUsersPage.errorAdd"));
      }
      setEmail("");
      setRole("user");
      router.replace(router.asPath);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("loginUsersPage.errorAdd"));
    } finally {
      setAddLoading(false);
    }
  }

  async function handleToggleActive(user: LoginUser) {
    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/loginusers/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)),
      );
    } catch {
      alert(t("loginUsersPage.errorUpdate"));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRoleChange(user: LoginUser, newRole: string) {
    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/loginusers/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
      );
    } catch {
      alert(t("loginUsersPage.errorUpdate"));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(user: LoginUser) {
    if (!confirm(t("loginUsersPage.deleteConfirm", { email: user.email })))
      return;
    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/loginusers/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      alert(t("loginUsersPage.errorDelete"));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <Layout>
      <Head>
        <title>{t("loginUsersPage.pageTitle")}</title>
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back + heading */}
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("loginUsersPage.backToAdmin")}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
          >
            <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {t("loginUsersPage.heading")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("loginUsersPage.subheading")}
            </p>
          </div>
        </div>

        {/* Add user card */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t("loginUsersPage.addHeading")}
          </h2>

          {addError && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-destructive-light border border-destructive/20 text-sm text-destructive">
              {addError}
            </div>
          )}

          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("loginUsersPage.emailPlaceholder")}
              className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder-muted-foreground"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="user">{t("loginUsersPage.roleUser")}</option>
              <option value="admin">{t("loginUsersPage.roleAdmin")}</option>
            </select>
            <button
              type="submit"
              disabled={addLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {addLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {t("loginUsersPage.addButton")}
            </button>
          </form>
        </div>

        {/* Users table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("loginUsersPage.emptyState")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {t("loginUsersPage.tableEmail")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {t("loginUsersPage.tableRole")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {t("loginUsersPage.tableStatus")}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const loading = actionLoadingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground break-all">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          disabled={loading}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          className="text-xs bg-transparent border-0 outline-none cursor-pointer"
                        >
                          <option value="user">{t("loginUsersPage.roleUser")}</option>
                          <option value="admin">{t("loginUsersPage.roleAdmin")}</option>
                        </select>
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBadge active={user.active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleToggleActive(user)}
                                className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                              >
                                {user.active
                                  ? t("loginUsersPage.disableButton")
                                  : t("loginUsersPage.enableButton")}
                              </button>
                              <button
                                onClick={() => handleDelete(user)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive-light transition-colors"
                                aria-label={t("loginUsersPage.deleteButton")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {t("loginUsersPage.roleNote")}
        </p>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const { getAllLoginUsers } = await import("@/entities/loginuser");
  const { prisma } = await import("@/entities/db");

  const users = await getAllLoginUsers(prisma);
  const initialUsers = users.map(({ password: _pw, ...u }) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return { props: { initialUsers } };
}
