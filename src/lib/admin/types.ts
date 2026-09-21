export type AdminActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const IDLE_ADMIN_STATE: AdminActionState = { status: "idle" };
