import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailProviderName = "console" | "file" | "resend" | "smtp";

export interface Mailer {
  name: MailProviderName;
  send(message: MailMessage): Promise<boolean>;
}

/** Where the `file` provider appends outgoing mail (local testing only). */
export const OUTBOX_PATH = path.join(process.cwd(), ".mail-outbox.log");

const consoleMailer: Mailer = {
  name: "console",
  async send(message) {
    console.info(
      [
        "",
        "─── email (console provider) ───",
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "────────────────────────────────",
        "",
      ].join("\n"),
    );
    return true;
  },
};

/**
 * Appends messages to a file so end-to-end tests can read the OTP that was
 * "sent". Never enable this outside a test environment.
 */
const fileMailer: Mailer = {
  name: "file",
  async send(message) {
    await mkdir(path.dirname(OUTBOX_PATH), { recursive: true });
    await appendFile(
      OUTBOX_PATH,
      `${JSON.stringify({ ...message, at: new Date().toISOString() })}\n`,
      "utf8",
    );
    return true;
  },
};

/** Real delivery through Resend, using plain `fetch` so there is no dependency. */
const resendMailer: Mailer = {
  name: "resend",
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const from = process.env.MAIL_FROM ?? "Wordle Arena <onboarding@resend.dev>";

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });

      if (!response.ok) {
        console.error("[mail] resend rejected the message", response.status);
        return false;
      }
      return true;
    } catch (error) {
      console.error("[mail] resend request failed", error);
      return false;
    }
  },
};

/**
 * Generic SMTP delivery. With Gmail this works without owning a domain: create
 * an App Password and send from your own address to any recipient.
 *
 *   MAIL_PROVIDER=smtp
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465
 *   SMTP_USER=you@gmail.com   SMTP_PASSWORD=<app password>
 *   MAIL_FROM="Wordle Arena <you@gmail.com>"
 */
const smtpMailer: Mailer = {
  name: "smtp",
  async send(message) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) {
      console.error("[mail] SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set");
      return false;
    }

    const port = Number(process.env.SMTP_PORT ?? 465);
    const from = process.env.MAIL_FROM ?? user;

    try {
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      await transport.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return true;
    } catch (error) {
      console.error("[mail] SMTP send failed", error);
      return false;
    }
  },
};

export function mailProviderName(): MailProviderName {
  const configured = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  if (configured === "resend") return "resend";
  if (configured === "smtp") return "smtp";
  if (configured === "file") return "file";
  return "console";
}

export function isMailTestMode(): boolean {
  return process.env.MAIL_TEST_MODE === "1";
}

/**
 * Pluggable mailer. Defaults to the console provider so the OTP flow is fully
 * usable in development without any credentials; switch with `MAIL_PROVIDER`.
 */
export function getMailer(): Mailer {
  switch (mailProviderName()) {
    case "resend":
      return resendMailer;
    case "smtp":
      return smtpMailer;
    case "file":
      return fileMailer;
    default:
      return consoleMailer;
  }
}
