import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/admin/pagination";
import { SelectInput, TextInput } from "@/components/ui/form";
import type { Role } from "@/generated/prisma/client";
import { listUsers, ROLE_VALUES } from "@/lib/admin/queries";
import { buildQuery } from "@/lib/admin/url";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const roleParam = typeof sp.role === "string" ? sp.role : "ALL";
  const role = (ROLE_VALUES as readonly string[]).includes(roleParam) ? (roleParam as Role) : "ALL";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);

  const data = await listUsers({ q, role, page });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted">Account information and play history.</p>
        </div>
      </header>

      <form
        method="get"
        action="/admin/users"
        className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-semibold text-muted uppercase">
            Search
          </label>
          <TextInput id="q" name="q" defaultValue={q} placeholder="Email or name" />
        </div>
        <div>
          <label htmlFor="role" className="mb-1 block text-xs font-semibold text-muted uppercase">
            Role
          </label>
          <SelectInput id="role" name="role" defaultValue={role}>
            <option value="ALL">All roles</option>
            {ROLE_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectInput>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Filter
        </button>
      </form>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Plays</th>
                <th className="px-4 py-3 text-right">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium text-primary hover:underline"
                      data-testid={`user-row-${user.id}`}
                    >
                      {user.name ?? "Unnamed"}
                    </Link>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        user.role === "ADMIN"
                          ? "bg-primary/15 text-primary"
                          : "bg-white/10 text-muted",
                      )}
                    >
                      {user.role}
                    </span>
                    {user.isBanned ? (
                      <span className="ml-1 inline-flex rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">
                        BANNED
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(user.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">{user._count.gameResults}</td>
                  <td className="px-4 py-3 text-right">{user._count.sessions}</td>
                </tr>
              ))}
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No users match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        total={data.total}
        buildHref={(nextPage) =>
          `/admin/users${buildQuery({ q, role: role === "ALL" ? undefined : role, page: nextPage })}`
        }
      />
    </>
  );
}
