"use client";

import { useActionState } from "react";

import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/form";
import {
  resetUserPasswordAction,
  revokeSessionsAction,
  toggleUserBanAction,
} from "@/lib/admin/actions";
import { IDLE_ADMIN_STATE } from "@/lib/admin/types";

export function UserActions({
  userId,
  isBanned,
  isSelf,
}: {
  userId: string;
  isBanned: boolean;
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, IDLE_ADMIN_STATE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <form action={toggleUserBanAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={isSelf}
            data-testid="toggle-ban"
            className="glass rounded-xl px-3.5 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
          >
            {isBanned ? "Unban user" : "Ban user"}
          </button>
        </form>

        <form action={revokeSessionsAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="glass rounded-xl px-3.5 py-2 text-sm font-semibold transition hover:opacity-90"
          >
            Revoke all sessions
          </button>
        </form>
      </div>

      {isSelf ? (
        <p className="text-xs text-muted">You cannot ban or lock out your own account.</p>
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <Field
          label="Reset password"
          htmlFor="admin-new-password"
          hint="Signs the user out of every device."
        >
          <TextInput
            id="admin-new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            data-testid="reset-password"
            required
          />
        </Field>
        <Notice status={state.status} message={state.message} />
        <SubmitButton pending={pending} className="sm:w-auto">
          {pending ? "Resetting…" : "Reset password"}
        </SubmitButton>
      </form>
    </div>
  );
}
