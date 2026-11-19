import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy and cookies | TalkMate",
  description: "What TalkMate stores, which services see it, and how Google ads and cookies work on this site.",
};

const UPDATED = "19 November 2026";

// Public page (no sign-in): Google's AdSense rules require a privacy policy that
// explains third-party advertising cookies. Keep it in step with docs/security.md.
const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "account",
    title: "Your account",
    body: (
      <>
        <p>
          TalkMate stores your name, email address, country, phone number and a hashed password (never the password
          itself). If you sign in with Google, Google tells TalkMate your name and verified email address; TalkMate does
          not receive your Google password.
        </p>
        <p>
          Your sign-in token is kept in your browser&apos;s storage: until you close the browser, or on this device if
          you tick &quot;Remember this device&quot;.
        </p>
      </>
    ),
  },
  {
    id: "practice",
    title: "Practice and AI",
    body: (
      <>
        <p>
          TalkMate saves your progress, XP, streaks, settings and the conversations you have in each mode, so you can
          continue later. What you type or say in a mode, and photos you describe, are sent to OpenRouter and the AI
          model it routes to, which write the replies and reviews. Do not include personal details you would not want
          an AI provider to process.
        </p>
        <p>
          Speaking uses your browser&apos;s own speech recognition and voices. Chrome and Edge send the microphone audio
          to Google or Microsoft to recognise it, and Safari may use Apple&apos;s servers. TalkMate receives only the
          recognised text.
        </p>
      </>
    ),
  },
  {
    id: "ads",
    title: "Advertising and cookies",
    body: (
      <>
        <p>
          TalkMate shows ads from Google AdSense. Google and its partners use cookies and similar technology to show
          ads, measure them and prevent fraud, and may show ads based on your earlier visits to this and other sites.
          TalkMate does not share your account details, conversations or progress with advertisers.
        </p>
        <p>
          In the EEA, the UK and Switzerland, Google asks for your consent before using cookies for personalised ads;
          you can change that choice from the privacy link Google shows on the page. Anywhere, you can turn off
          personalised ads in{" "}
          <a className="text-violet-400 hover:text-violet-300" href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google&apos;s Ad Settings
          </a>{" "}
          or at{" "}
          <a className="text-violet-400 hover:text-violet-300" href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">
            aboutads.info
          </a>
          . Read{" "}
          <a className="text-violet-400 hover:text-violet-300" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            how Google uses information from sites that use its services
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "services",
    title: "Who else processes data",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Hostinger</strong>: hosts the site, the API and the database.</li>
        <li><strong>Google</strong>: sign-in if you choose it, and AdSense ads.</li>
        <li><strong>OpenRouter</strong> and its AI model providers: practice text and photos.</li>
        <li><strong>Email provider</strong>: verification and password emails.</li>
        <li><strong>Pixabay, Pexels and Wikipedia</strong>: practice pictures (only English search words are sent).</li>
        <li><strong>Your browser&apos;s speech service</strong>: microphone audio while you speak.</li>
      </ul>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <p>
        You can change privacy preferences in Account &gt; Profile &gt; Privacy preferences, delete your account from
        Account, and ask anything through Account &gt; Support. Clearing this site&apos;s data in your browser signs you
        out. TalkMate is part of{" "}
        <a className="text-violet-400 hover:text-violet-300" href="https://edsol.academy">EdSol Academy</a>, which itself
        shows no ads and has its own privacy policy.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0e0e12] px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-violet-400 hover:text-violet-300">
          TalkMate home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Privacy and cookies</h1>
        <p className="mt-2 text-sm text-white/50">Last updated: {UPDATED}</p>
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`} className="text-lg font-semibold">
                {section.title}
              </h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-white/75">{section.body}</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
