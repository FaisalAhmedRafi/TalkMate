import { CallProvider } from "@/components/call/CallProvider";

export default function CallLayout({ children }: { children: React.ReactNode }) {
  return <CallProvider>{children}</CallProvider>;
}
