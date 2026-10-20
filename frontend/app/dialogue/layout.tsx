import { DialogueProvider } from "@/components/dialogue/DialogueProvider";

export default function DialogueLayout({ children }: { children: React.ReactNode }) {
  return <DialogueProvider>{children}</DialogueProvider>;
}
