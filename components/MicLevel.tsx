"use client";

import { useEffect, useRef, useState } from "react";

export default function MicLevel({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const [levels, setLevels] = useState<number[]>([0.15, 0.15, 0.15, 0.15, 0.15]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevels([0.15, 0.15, 0.15, 0.15, 0.15]);
      return;
    }
    if (stream.getAudioTracks().length === 0) return;

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtxCtor();
      source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const bars = 5;
      const chunkSize = Math.max(1, Math.floor(data.length / bars));

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next: number[] = [];
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = i * chunkSize; j < (i + 1) * chunkSize; j++) sum += data[j] ?? 0;
          const avg = sum / chunkSize / 255;
          next.push(Math.max(0.12, Math.min(1, avg * 1.8)));
        }
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Web Audio unsupported/blocked — bars just stay idle
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        source?.disconnect();
        audioCtx?.close();
      } catch {
        /* noop */
      }
    };
  }, [stream, active]);

  return (
    <div className="flex h-6 items-end gap-1">
      {levels.map((l, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-emerald-400 transition-all duration-100"
          style={{ height: `${Math.round(l * 100)}%` }}
        />
      ))}
    </div>
  );
}
