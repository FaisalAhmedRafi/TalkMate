// Photo Mode catalog: units of photos. The image files live in the FRONTEND at frontend/public/photo/<n>.jpg
// (served as /photo/<n>.jpg), so the backend only stores ids and URL paths.
// Photo ids are the keys saved in PhotoProgress: add new photos with new ids, never renumber one that has progress.
export type PhotoItem = { id: string; image: string };
export type PhotoUnit = { number: number; photos: PhotoItem[] };

/** photo(3) -> /photo/3.jpg. Pass another extension for a file that is not a jpg, e.g. photo(3, 'png'). */
const photo = (n: number, ext = 'jpg'): PhotoItem => ({ id: `photo-${n}`, image: `/photo/${n}.${ext}` });
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => photo(from + i));

// 8 photos per unit (2 rows of 4 stars in the UI). To add Unit 3: put 9 more files in public/photo (17.jpg ...) and add a line here.
export const PHOTO_UNITS: PhotoUnit[] = [
  { number: 1, photos: range(1, 8) },
  { number: 2, photos: range(9, 16) },
];

export const TOTAL_PHOTOS = PHOTO_UNITS.reduce((n, u) => n + u.photos.length, 0);

export const findPhoto = (id: string) => PHOTO_UNITS.flatMap((u) => u.photos).find((p) => p.id === id) ?? null;
