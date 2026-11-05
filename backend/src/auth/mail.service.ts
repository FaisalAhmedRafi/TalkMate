import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// Sends mail through Gmail SMTP when GMAIL_USER + GMAIL_APP_PASSWORD are set (nodemailer),
// else through Resend's HTTP API when RESEND_API_KEY is set (no SDK).
// With neither, the message is printed to the server log, which is enough for local development.
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private gmail: Transporter | null = null;
  constructor(private readonly config: ConfigService) {}

  // built once, on first use; an App Password is shown with spaces ("abcd efgh ijkl mnop"), so they are dropped
  private gmailTransport() {
    const user = this.config.get<string>('GMAIL_USER')?.trim();
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '');
    if (!user || !pass) return null;
    if (!this.gmail) {
      this.gmail = createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
    return { transport: this.gmail, user };
  }

  async send(to: string, subject: string, text: string, html: string) {
    const gmail = this.gmailTransport();
    if (gmail) {
      // Gmail always sends from the signed-in account, whatever "from" says
      await gmail.transport.sendMail({ from: `TalkMate <${gmail.user}>`, to, subject, text, html });
      return;
    }
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) {
      this.log.warn(`No GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY is set, so this email was not sent. To: ${to}\n${subject}\n${text}`);
      return;
    }
    const from = this.config.get<string>('MAIL_FROM') ?? 'TalkMate <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
}
