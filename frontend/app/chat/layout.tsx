import { ChatProvider } from "@/components/chat/ChatProvider";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatProvider>{children}</ChatProvider>;
}
