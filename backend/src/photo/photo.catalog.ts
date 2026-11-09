// Photo Mode types and lookups. The photos themselves live in the database, table ContentItem (see src/content).
// Photo Mode catalog: units of photos. The image files live in the FRONTEND at frontend/public/photo/<n>.jpg
// (served as /photo/<n>.jpg), so the backend only stores ids and URL paths.
// Photo ids are the keys saved in PhotoProgress: add new photos with new ids, never renumber one that has progress.
export type PhotoItem = { id: string; image: string };
export type PhotoUnit = { number: number; photos: PhotoItem[] };

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const PHOTO_UNITS: PhotoUnit[] = [];

// A function, not a constant: the admin panel adds photos at runtime (see src/admin).
export const totalPhotos = () => PHOTO_UNITS.reduce((n, u) => n + u.photos.length, 0);

export const findPhoto = (id: string) => PHOTO_UNITS.flatMap((u) => u.photos).find((p) => p.id === id) ?? null;
