import { PhotoProvider } from "@/components/photo/PhotoProvider";

export default function PhotoLayout({ children }: { children: React.ReactNode }) {
  return <PhotoProvider>{children}</PhotoProvider>;
}
