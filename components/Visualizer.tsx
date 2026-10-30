"use client";
import React, { useEffect, useRef } from 'react';
import type { DrumEngine } from '../lib/engine';

const BARS = 48;

// log-spaced spectrum bars from the master analyser, drawn in mint
export default function Visualizer({ engine }: { engine: DrumEngine | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !engine) return;
    const g = cv.getContext('2d')!;
    const levels = new Float32Array(BARS);
    let data: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const an = engine.analyser;
      if (an) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const nyquist = (engine.ctx?.sampleRate ?? 44100) / 2;
        for (let i = 0; i < BARS; i++) {
          const f0 = 30 * Math.pow(16000 / 30, i / BARS);
          const f1 = 30 * Math.pow(16000 / 30, (i + 1) / BARS);
          const b0 = Math.floor((f0 / nyquist) * data.length);
          const b1 = Math.max(b0 + 1, Math.floor((f1 / nyquist) * data.length));
          let peak = 0;
          for (let b = b0; b < b1 && b < data.length; b++) peak = Math.max(peak, data[b]);
          const v = peak / 255;
          levels[i] = v > levels[i] ? v : levels[i] * 0.9;
        }
      } else {
        levels.fill(0);
      }

      const gap = 2;
      const bw = (w - gap * (BARS - 1)) / BARS;
      const grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, 'rgba(0,255,206,0.15)');
      grad.addColorStop(1, 'rgba(0,255,206,0.95)');
      g.fillStyle = grad;
      for (let i = 0; i < BARS; i++) {
        const bh = Math.max(2, Math.pow(levels[i], 1.6) * (h - 2));
        g.fillRect(i * (bw + gap), h - bh, bw, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return <canvas ref={canvas} className="viz" aria-hidden="true" />;
}
