import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-white/25 bg-white/50 px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted/70 focus:border-primary/60 focus:ring-2 focus:ring-[var(--ring)] dark:border-white/10 dark:bg-white/5";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(base, className)} {...props} />;
}

export function SelectInput({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(base, "appearance-none", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-24 resize-y", className)} {...props} />;
}

export function Notice({
  status,
  message,
  testId = "form-notice",
}: {
  status: string;
  message?: string;
  testId?: string;
}) {
  if (!message || status === "idle") return null;
  return (
    <p
      role="status"
      data-testid={testId}
      className={cn(
        "rounded-xl border px-3 py-2 text-sm font-medium",
        status === "success"
          ? "border-success/30 bg-success/10 text-success"
          : "border-danger/30 bg-danger/10 text-danger",
      )}
    >
      {message}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pending,
  className,
  ...props
}: ComponentProps<"button"> & { pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[var(--ring)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:transform-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
