import { SentenceProvider } from "@/components/sentence/SentenceProvider";

export default function SentenceLayout({ children }: { children: React.ReactNode }) {
  return <SentenceProvider>{children}</SentenceProvider>;
}
