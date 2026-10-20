import { CharactersProvider } from "@/components/characters/CharactersProvider";

export default function CharactersLayout({ children }: { children: React.ReactNode }) {
  return <CharactersProvider>{children}</CharactersProvider>;
}
