"use client";
import { useState } from "react";
import { ErrorText, Modal } from "./Modal";
import { api, type Learner } from "@/lib/api";

// Shrink the photo so the request stays small.
function toDataUrl(file: File, max = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("That file isn't a readable image."));
    img.src = url;
  });
}

export function PhotoPanel({ learner, onPractice, onClose }: {
  learner: Learner; onPractice: (text: string) => void; onClose: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (f?: File) => {
    if (!f) return;
    setError(null); setFeedback("");
    try { setImage(await toDataUrl(f)); } catch (e) { setError((e as Error).message); }
  };

  const submit = async () => {
    if (!image || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api.photo({ ...learner, image, description: description.trim() || undefined });
      setFeedback(r.feedback);
      if (description.trim()) onPractice(description.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Photo Mode" wide>
      <h2 className="text-xl font-semibold">Photo Mode</h2>
      <p className="mt-1 text-sm text-white/60">Upload a photo, describe it in {learner.targetLanguage}, get feedback.</p>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.target.files?.[0])}
        className="mt-4 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="Your upload" className="mt-4 max-h-56 rounded-xl" />}
      <textarea
        value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1500}
        placeholder={`Describe the photo in ${learner.targetLanguage} (leave empty for a sample description)`}
        className="mt-4 w-full rounded-xl bg-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button onClick={submit} disabled={!image || busy}
        className="mt-3 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
        {busy ? "Checking…" : "Get feedback"}
      </button>
      <ErrorText text={error} />
      {feedback && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-white/5 p-4 text-sm">{feedback}</div>}
    </Modal>
  );
}
