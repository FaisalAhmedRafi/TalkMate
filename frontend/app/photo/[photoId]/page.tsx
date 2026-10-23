"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Loader2, Mic, Square, Star, Volume2, X } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { usePhoto } from "@/components/photo/PhotoProvider";
import { api, type PhotoJudgement } from "@/lib/api";
import { SPEECH_LANG } from "@/lib/modes";
import { nextPhotoId, imageToDataUrl, usePhotoId } from "@/lib/photo";
import { PASS_SCORE } from "@/lib/sentence";
import { cancelSpeech, createRecognition, speak, supportsSpeechRecognition } from "@/lib/speech";

type Judged = { result: PhotoJudgement; passed: boolean; bestScore: number };

// One photo: the learner sees the picture, writes (or dictates) a description, and the AI judges it.
export default function PhotoPage() {
  const photoId = usePhotoId();
  const router = useRouter();
  const { progress, units, reloadUnits, setProgress } = usePhoto();
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";
  const photo = units?.units.flatMap((u) => u.photos).find((p) => p.id === photoId);
  const next = nextPhotoId(units, photoId);

  const [text, setText] = useState("");
  const [judged, setJudged] = useState<Judged | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(true);
  const recRef = useRef<any>(null);

  useEffect(() => setCanListen(supportsSpeechRecognition()), []);
  // a new photo (Next photo) starts clean
  useEffect(() => {
    setText(""); setJudged(null); setError(null); setImgFailed(false);
    recRef.current?.abort?.(); cancelSpeech();
  }, [photoId]);
  useEffect(() => () => { recRef.current?.abort?.(); cancelSpeech(); }, []);

  const close = () => router.push("/photo");

  const toggleMic = () => {
    if (listening) return recRef.current?.stop();
    const rec = createRecognition(lang);
    if (!rec) return setError("Speech recognition isn't supported in this browser. Please use Chrome or Edge.");
    setError(null);
    const base = text.trim();
    rec.onresult = (e: any) => {
      let t = "";
      for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript + " ";
      setText((base ? base + " " : "") + t.trim());
    };
    rec.onerror = (e: any) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      setError(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone access was blocked. Allow it in the browser and try again."
        : "Couldn't hear you. Please try again.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const submit = async () => {
    const description = text.trim();
    if (!photo || description.length < 2 || busy) return;
    recRef.current?.abort?.();
    setBusy(true); setError(null);
    try {
      const image = await imageToDataUrl(photo.image);
      const r = await api.photos.judge({ ...learner, photoId, image, description });
      setJudged({ result: r.result, passed: r.passed, bestScore: r.bestScore });
      setProgress(r.progress);
      reloadUnits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const res = judged?.result;

  return (
    <div className="flex min-h-screen flex-col bg-[#222228]">
      <header className="relative flex items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Photo Mode</h1>
        <button onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
      </header>

      <main className="mx-auto flex w-full max-w-[684px] flex-1 flex-col px-5 py-6">
        <p className="text-center text-sm font-semibold text-white/90">Describe what you see</p>

        {!units && <p className="m-auto text-white/60">Loading…</p>}
        {units && !photo && (
          <div className="m-auto text-center">
            <ErrorText text="That photo doesn't exist." />
            <button onClick={close} className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back to photos</button>
          </div>
        )}

        {photo && (
          <>
            <div className="mt-5 overflow-hidden rounded-2xl bg-black/30">
              {imgFailed ? (
                <p className="px-6 py-16 text-center text-sm text-white/60">
                  The picture is missing. Add it as <code>frontend/public{photo.image}</code>.
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.image} alt="Photo to describe" onError={() => setImgFailed(true)} className="max-h-[420px] w-full object-cover" />
              )}
            </div>

            {res && judged && (
              <section className="mt-5 rounded-2xl border border-white/10 bg-[#1f1f27] p-5" aria-label="Feedback">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1" aria-label={`Score ${res.score} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={22} className={n <= res.score ? "fill-yellow-400 text-yellow-400" : "text-white/20"} />
                    ))}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${judged.passed ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-200"}`}>
                    {judged.passed ? "Photo completed" : `Keep practising (needs ${PASS_SCORE})`}
                  </span>
                </div>
                <p className="mt-4 text-sm text-white/90">{res.summary}</p>

                {res.corrections.length > 0 && (
                  <div className="mt-5">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">Corrections</h2>
                    <ul className="mt-2 space-y-3">
                      {res.corrections.map((c, i) => (
                        <li key={i} className="rounded-xl bg-white/5 p-3 text-sm">
                          {c.original && <p className="text-red-300 line-through decoration-red-300/50">{c.original}</p>}
                          <p className="mt-1 flex items-start gap-1.5 text-green-300"><Check size={15} className="mt-0.5 shrink-0" />{c.corrected}</p>
                          {c.explanation && <p className="mt-1 text-white/70">{c.explanation}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {res.better && (
                  <div className="mt-5">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">Better version</h2>
                    <div className="mt-2 rounded-xl bg-white/5 p-3 text-sm">
                      <p className="flex items-start gap-2">
                        <span className="flex-1">{res.better}</span>
                        <button onClick={() => speak(res.better, lang, 0.95)} aria-label="Listen" className="text-white/70 hover:text-white"><Volume2 size={17} /></button>
                      </p>
                      {res.betterTranslation && <p className="mt-1 text-white/60">{res.betterTranslation}</p>}
                    </div>
                  </div>
                )}

                {res.words.length > 0 && (
                  <div className="mt-5">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">New words</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {res.words.map((w, i) => (
                        <span key={i} className="rounded-full bg-indigo-500/20 px-3 py-1 text-sm">
                          {w.word}{w.translation && <span className="text-white/60"> · {w.translation}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => { setJudged(null); setError(null); }} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/5">Try again</button>
                  {next && <button onClick={() => router.push(`/photo/${next}`)} className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold hover:bg-indigo-600">Next photo</button>}
                  <button onClick={close} className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/15">Back to photos</button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {photo && !judged && (
        <footer className="sticky bottom-0 bg-[#222228] px-5 pb-6 pt-3">
          <div className="mx-auto w-full max-w-[684px]">
            <ErrorText text={error} />
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-16 flex-1 items-center rounded-full border border-white/15 bg-[#1f1f27] pl-6 pr-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  maxLength={1000}
                  disabled={busy}
                  placeholder="Aa"
                  aria-label={`Describe the photo in ${progress.language}`}
                  className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
                />
                <button onClick={submit} disabled={busy || text.trim().length < 2} aria-label="Send"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
                </button>
              </div>
              {canListen && (
                <button onClick={toggleMic} disabled={busy} aria-label={listening ? "Stop listening" : "Speak your description"}
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${listening ? "bg-red-500 hover:bg-red-400" : "bg-indigo-500/40 hover:bg-indigo-500/60"}`}>
                  {listening ? <Square size={20} /> : <Mic size={22} />}
                </button>
              )}
            </div>
            {busy && <p className="mt-3 text-center text-xs text-white/60">Judging your description…</p>}
          </div>
        </footer>
      )}
    </div>
  );
}
