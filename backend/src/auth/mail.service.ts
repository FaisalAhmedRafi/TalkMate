import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Sends mail through Resend's HTTP API (no SDK, so no new dependency).
// Without RESEND_API_KEY the message is printed to the server log, which is enough for local development.
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, text: string, html: string) {
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) {
      this.log.warn(`RESEND_API_KEY is not set, so this email was not sent. To: ${to}\n${subject}\n${text}`);
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
