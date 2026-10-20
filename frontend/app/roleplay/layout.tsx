import { RoleplayProvider } from "@/components/roleplay/RoleplayProvider";

export default function RoleplayLayout({ children }: { children: React.ReactNode }) {
  return <RoleplayProvider>{children}</RoleplayProvider>;
}
