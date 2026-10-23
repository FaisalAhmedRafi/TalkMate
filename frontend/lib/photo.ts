import { useParams, usePathname } from "next/navigation";
import type { PhotoUnits } from "@/lib/api";

/** The photo id from /photo/<photoId>. Reads the URL itself so it still works if the folder is not named exactly [photoId]. */
export function usePhotoId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.photoId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

/** The photo after this one in the grid (the next star), or null at the very end. */
export function nextPhotoId(units: PhotoUnits | null, id: string): string | null {
  const all = units?.units.flatMap((u) => u.photos.map((p) => p.id)) ?? [];
  const i = all.indexOf(id);
  return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
}

/** Loads a same-origin image and shrinks it to a JPEG data URL (max 800 px) so the request stays small. */
export function imageToDataUrl(src: string, max = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Couldn't load the photo. Check that the file exists in frontend/public/photo."));
    img.src = src;
  });
}
