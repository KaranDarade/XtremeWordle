import type { Metadata } from "next";

import { listAuditLogs } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AdminAuditPage() {
  const logs = await listAuditLogs();

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted">Every admin mutation is recorded here.</p>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/10">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">{log.admin?.name ?? log.admin?.email ?? "system"}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">
                    {log.targetType ? `${log.targetType}` : "—"}
                    {log.targetId ? `: ${log.targetId}` : ""}
                  </td>
                  <td className="max-w-64 truncate px-4 py-2.5 font-mono text-[11px] text-muted">
                    {JSON.stringify(log.meta)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No admin activity recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
