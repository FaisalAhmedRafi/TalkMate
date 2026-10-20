import { DebateProvider } from "@/components/debate/DebateProvider";

export default function DebateLayout({ children }: { children: React.ReactNode }) {
  return <DebateProvider>{children}</DebateProvider>;
}
