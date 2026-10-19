import { FlashcardsProvider } from "@/components/flashcards/FlashcardsProvider";

export default function FlashcardsLayout({ children }: { children: React.ReactNode }) {
  return <FlashcardsProvider>{children}</FlashcardsProvider>;
}
