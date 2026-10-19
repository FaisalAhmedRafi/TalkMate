"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Learner, type PronunciationResult } from "@/lib/api";
import { createRecognition, supportsSpeechRecognition } from "@/lib/speech";

export type MicState = "idle" | "listening" | "evaluating";
const NO_SPEECH = "I didn't hear anything. Tap the mic and try again.";

/**
 * Microphone to 1-5 rating, the same flow as Sentence Mode: the browser transcribes what was said,
 * the server compares it with the sentence (POST /sentence/evaluate) and the AI rates it.
 */
export function usePronunciation(opts: { lang: string; learner: Learner; onResult: (r: PronunciationResult) => void }) {
  const [mic, setMic] = useState<MicState>("idle");
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canListen, setCanListen] = useState(true);
  const recRef = useRef<any>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    setCanListen(supportsSpeechRecognition());
    return () => recRef.current?.abort?.();
  }, []);

  const start = useCallback((sentence: string) => {
    const { lang, learner } = optsRef.current;
    const rec = createRecognition(lang);
    if (!rec) return setError("Speech recognition isn't supported in this browser. Please use Chrome or Edge.");
    setError(null);
    setLive("");

    let transcript = "", confidence: number | undefined, failed = false;
    rec.onresult = (e: any) => {
      let t = "";
      const conf: number[] = [];
      for (let k = 0; k < e.results.length; k++) {
        t += e.results[k][0].transcript + " ";
        if (e.results[k].isFinal && e.results[k][0].confidence > 0) conf.push(e.results[k][0].confidence);
      }
      transcript = t.trim();
      confidence = conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : undefined;
      setLive(transcript);
    };
    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      failed = true;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser's address bar, then try again."
          : e.error === "no-speech" ? NO_SPEECH
          : e.error === "network" ? "Speech recognition needs an internet connection."
          : e.error === "audio-capture" ? "No microphone was found."
          : "Couldn't listen. Please try again.",
      );
    };
    rec.onend = () => {
      recRef.current = null;
      if (failed) return setMic("idle");
      if (!transcript) { setError(NO_SPEECH); return setMic("idle"); }
      setMic("evaluating");
      api.sentence
        .evaluate({ ...learner, sentence, transcript, confidence })
        .then((r) => optsRef.current.onResult(r))
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't check your pronunciation"))
        .finally(() => { setMic("idle"); setLive(""); });
    };
    recRef.current = rec;
    try { rec.start(); setMic("listening"); } catch { setError("Couldn't start the microphone. Please try again."); }
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);
  return { mic, live, error, setError, canListen, start, stop };
}
