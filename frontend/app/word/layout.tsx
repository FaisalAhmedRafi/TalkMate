import { WordProvider } from "@/components/word/WordProvider";

export default function WordLayout({ children }: { children: React.ReactNode }) {
  return <WordProvider>{children}</WordProvider>;
}
