import dotenv from "dotenv";
import express, { Request, Response } from "express";
import nodemailer from "nodemailer";

// Load env from project root .env (defaults to process.cwd())
dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// Basic CORS to allow frontend dev server
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const port = process.env.NOTIFY_PORT ? Number(process.env.NOTIFY_PORT) : 5174;

function isEmailAlertsEnabled(): boolean {
  const v = String(process.env.ENABLE_EMAIL_ALERTS ?? "true").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(v);
}

const emailAlertsEnabled = isEmailAlertsEnabled();
if (!emailAlertsEnabled) {
  console.warn("ENABLE_EMAIL_ALERTS is off: POST /api/notifications will not send email.");
}

const host = process.env.SMTP_HOST as string | undefined;
const user = process.env.SMTP_USER as string | undefined;
const pass = process.env.SMTP_PASS as string | undefined;
const from = process.env.SMTP_FROM as string | undefined;
const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;

if (emailAlertsEnabled && (!host || !user || !pass || !from)) {
  console.warn("SMTP environment variables are missing. Email notifications will fail.");
}

const transporter = nodemailer.createTransport({
  host,
  port: smtpPort,
  secure,
  auth: { user, pass },
});

interface NotificationBody {
  to: string;
  subject: string;
  text: string;
}

app.post("/api/notifications", async (req: Request, res: Response) => {
  const { to, subject, text } = (req.body || {}) as Partial<NotificationBody>;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: "Missing to/subject/text" });
  }
  if (!emailAlertsEnabled) {
    return res.json({ ok: true, skipped: true, reason: "ENABLE_EMAIL_ALERTS is disabled" });
  }
  if (!host || !user || !pass || !from) {
    return res.status(500).json({ error: "SMTP not configured" });
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, text });
    return res.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error("Email send failed:", error);
    return res.status(500).json({ error: "Email send failed" });
  }
});

app.listen(port, () => {
  console.log(`Notification server running on http://localhost:${port}`);
});