"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Transport, { BPM_MAX, BPM_MIN } from '../components/Transport';
import StepGrid from '../components/StepGrid';
import Mixer from '../components/Mixer';
import Visualizer from '../components/Visualizer';
import ExportDialog from '../components/ExportDialog';
import { DrumEngine, type TrackParams } from '../lib/engine';
import { kits, TRACK_COUNT } from '../lib/kits';
import { STEPS, SLOTS, presets, emptyPattern, parseRows, randomPattern } from '../lib/patterns';

type AppState = {
  bpm: number;
  swing: number;
  volume: number;
  kit: number;
  slot: number;
  patterns: number[][][]; // slot x track x step
  tracks: TrackParams[];
};

const STORAGE_KEY = 'beats.v2';
const SLOT_NAMES = ['a', 'b', 'c', 'd'];

const defaultTrack = (): TrackParams => ({ gain: 0.8, pan: 0, tune: 0, decay: 1, mute: false, solo: false });

const initialState = (): AppState => ({
  bpm: presets[0].bpm,
  swing: presets[0].swing,
  volume: 0.8,
  kit: 0,
  slot: 0,
  patterns: [parseRows(presets[0].rows), ...Array.from({ length: SLOTS - 1 }, emptyPattern)],
  tracks: Array.from({ length: TRACK_COUNT }, defaultTrack),
});

export default function HomePage() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [engine, setEngine] = useState<DrumEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState({ step: -1, total: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // live: pattern changes while playing wait for the next downbeat; chain walks a→b→c→d
  const [queued, setQueued] = useState<number | null>(null);
  const [chain, setChain] = useState(false);
  const clipboard = useRef<number[][] | null>(null);
  const ledRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const live = useRef({ state, queued: null as number | null, chain: false });
  live.current.state = state;
  live.current.chain = chain;

  const kit = kits[state.kit];
  const pattern = state.patterns[state.slot];

  // ---- engine lifecycle ---------------------------------------------------

  useEffect(() => {
    const e = new DrumEngine();
    e.onStep = (s, total) => setStep({ step: s, total });
    e.onTrigger = (track, vel) => {
      ledRefs.current[track]?.animate(
        [{ opacity: 1, transform: 'scale(1.35)' }, { opacity: 0.18, transform: 'scale(1)' }],
        { duration: 160 + vel * 200, easing: 'ease-out' },
      );
    };
    // runs in the scheduler right before a downbeat — the switch lands exactly on the one
    e.onBarStart = () => {
      const { state: st, queued: q, chain: ch } = live.current;
      const filled = st.patterns.map((p, i) => (p.some(r => r.some(Boolean)) ? i : -1)).filter(i => i >= 0);
      const next = q ?? (ch && filled.length > 1 ? filled[(filled.indexOf(st.slot) + 1) % filled.length] ?? filled[0] : null);
      live.current.queued = null;
      if (next === null || next === st.slot) { setQueued(null); return null; }
      live.current.state = { ...st, slot: next }; // the next bar already asks for the slot after this one
      setState(s => ({ ...s, slot: next }));
      setQueued(null);
      return st.patterns[next];
    };
    setEngine(e);
    return () => e.dispose();
  }, []);

  useEffect(() => { engine?.setBpm(state.bpm); }, [engine, state.bpm]);
  useEffect(() => { engine?.setSwing(state.swing); }, [engine, state.swing]);
  useEffect(() => { engine?.setVolume(state.volume); }, [engine, state.volume]);
  useEffect(() => { engine?.setKit(kit); }, [engine, kit]);
  useEffect(() => { engine?.setPattern(pattern); }, [engine, pattern]);
  useEffect(() => { engine?.setTracks(state.tracks); }, [engine, state.tracks]);
  useEffect(() => { engine?.setSteps(STEPS); }, [engine]);

  // ---- persistence: share link > localStorage > defaults --------------------

  useEffect(() => {
    const fromHash = decodeShare(window.location.hash);
    let saved: unknown = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
    const loaded = fromHash ?? sanitize(saved);
    if (loaded) setState(loaded);
    if (fromHash) history.replaceState(null, '', window.location.pathname);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state, hydrated]);

  // ---- actions ------------------------------------------------------------

  const update = useCallback((patch: Partial<AppState>) => setState(s => ({ ...s, ...patch })), []);

  const setPatternFor = useCallback((fn: (p: number[][]) => number[][]) => {
    setState(s => {
      const patterns = s.patterns.slice();
      patterns[s.slot] = fn(patterns[s.slot]);
      return { ...s, patterns };
    });
  }, []);

  const setCell = useCallback((r: number, c: number, v: number) => {
    setPatternFor(p => p.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  }, [setPatternFor]);

  const setTrack = useCallback((i: number, patch: Partial<TrackParams>) => {
    setState(s => ({ ...s, tracks: s.tracks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 1800);
  };

  const togglePlay = useCallback(async () => {
    if (!engine) return;
    setPlaying(await engine.toggle());
  }, [engine]);

  const audition = useCallback((r: number) => { engine?.preview(r); }, [engine]);

  const loadPreset = (name: string) => {
    const p = presets.find(x => x.name === name);
    if (!p) return;
    setState(s => {
      const patterns = s.patterns.slice();
      patterns[s.slot] = parseRows(p.rows);
      return { ...s, patterns, bpm: p.bpm, swing: p.swing };
    });
    flash(`${p.name} loaded into ${SLOT_NAMES[state.slot]}`);
  };

  const copy = () => { clipboard.current = pattern.map(r => r.slice()); flash(`copied pattern ${SLOT_NAMES[state.slot]}`); };
  const paste = () => {
    const c = clipboard.current;
    if (!c) return;
    setPatternFor(() => c.map(r => r.slice()));
    flash(`pasted into ${SLOT_NAMES[state.slot]}`);
  };

  const share = async (forTabs = false) => {
    const url = `${window.location.origin}${window.location.pathname}#s=${encodeShare(state)}`;
    const done = forTabs ? `pattern ${SLOT_NAMES[state.slot]} copied — in tabs: instruments → groove → paste beats link` : 'share link copied';
    try { await navigator.clipboard.writeText(url); flash(done); }
    catch { window.prompt('copy this link', url); }
  };

  /** while playing, a new pattern waits for the next downbeat (shift switches at once) */
  const selectSlot = useCallback((slot: number, now = false) => {
    if (!playing || now) {
      live.current.queued = null;
      setQueued(null);
      update({ slot });
      return;
    }
    const q = slot === live.current.state.slot ? null : slot;
    live.current.queued = q;
    setQueued(q);
  }, [playing, update]);

  const resetAll = () => {
    if (!window.confirm('reset everything? all four patterns and mixer settings will be lost.')) return;
    setState(initialState());
  };

  // ---- keyboard -----------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea, dialog') || e.metaKey || e.ctrlKey) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
      if (e.repeat) return;
      const n = Number(e.key);
      if (n >= 1 && n <= TRACK_COUNT) { audition(n - 1); return; }
      const slot = SLOT_NAMES.indexOf(e.key.toLowerCase());
      if (slot >= 0) { selectSlot(slot, e.shiftKey); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (el.getAttribute('role') === 'slider') return;
        e.preventDefault();
        const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
        setState(s => ({ ...s, bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, s.bpm + d)) }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, audition, update, selectSlot]);

  // ---- render -------------------------------------------------------------

  const position = playing && step.step >= 0
    ? { bar: Math.floor(step.total / STEPS) + 1, beat: Math.floor(step.step / 4) + 1, sixteenth: (step.step % 4) + 1 }
    : null;

  return (
    <div className="container">
      <header className="header">
        <a className="brand" href="https://mo-tion.at" target="_blank" rel="noreferrer">
          <Logo />
          <span className="brand-name">beats</span>
          <span className="brand-by">by mo-tion</span>
        </a>
        <div className="spacer" />
        <div className="segmented" role="radiogroup" aria-label="kit">
          <span className="segmented-label">kit</span>
          {kits.map((k, i) => (
            <button key={k.id} role="radio" aria-checked={state.kit === i} className={state.kit === i ? 'active' : ''} onClick={() => update({ kit: i })}>
              {k.name}
            </button>
          ))}
        </div>
      </header>

      <section className="panel transport-panel">
        <Transport
          playing={playing} onPlayToggle={togglePlay}
          bpm={state.bpm} onBpm={bpm => update({ bpm })}
          swing={state.swing} onSwing={swing => update({ swing })}
          volume={state.volume} onVolume={volume => update({ volume })}
          position={position}
        />
        <Visualizer engine={engine} />
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="segmented" role="radiogroup" aria-label="pattern">
            <span className="segmented-label">pattern</span>
            {SLOT_NAMES.map((name, i) => (
              <button
                key={name} role="radio" aria-checked={state.slot === i}
                className={`${state.slot === i ? 'active' : ''} ${state.patterns[i].some(r => r.some(Boolean)) ? 'filled' : ''} ${queued === i ? 'queued' : ''}`}
                onClick={e => selectSlot(i, e.shiftKey)}
                title={`pattern ${name} (key ${name}) — while playing it switches on the next bar, shift switches at once`}
              >{name}</button>
            ))}
          </div>
          <button
            className={`btn ${chain ? 'on' : ''}`} onClick={() => setChain(c => !c)} aria-pressed={chain}
            title="play the filled patterns one bar each, a → b → c → d"
          >chain</button>
          <button className="btn" onClick={copy}>copy</button>
          <button className="btn" onClick={paste} disabled={!clipboard.current}>paste</button>
          <div className="spacer" />
          <select className="btn" value="" onChange={e => loadPreset(e.target.value)} aria-label="load preset">
            <option value="" disabled>presets…</option>
            {presets.map(p => <option key={p.name} value={p.name}>{p.name} · {p.bpm}</option>)}
          </select>
          <button className="btn" onClick={() => setPatternFor(() => randomPattern())}>randomize</button>
          <button className="btn warn" onClick={() => setPatternFor(() => emptyPattern())}>clear</button>
          <button className="btn primary" onClick={() => setExportOpen(true)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            wav loop
          </button>
        </div>

        <StepGrid
          labels={kit.voices.map(v => v.label)}
          pattern={pattern}
          steps={STEPS}
          tracks={state.tracks}
          playingStep={playing ? step.step : -1}
          ledRefs={ledRefs}
          onSet={setCell}
          onAudition={audition}
          onMute={i => setTrack(i, { mute: !state.tracks[i].mute })}
          onSolo={i => setTrack(i, { solo: !state.tracks[i].solo })}
        />
        <p className="hint">click to toggle · drag to paint · shift/right-click for accent</p>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>mixer</h2>
          <div className="spacer" />
          <button className="btn" onClick={() => share()}>share link</button>
          <button className="btn" onClick={() => share(true)} title="copy this pattern as a groove for a mo-tion tabs session">use in tabs</button>
          <button className="btn ghost" onClick={resetAll}>reset all</button>
        </div>
        <Mixer labels={kit.voices.map(v => v.label)} tracks={state.tracks} onChange={setTrack} />
      </section>

      <footer className="footer">
        <span><kbd>space</kbd> play/stop</span>
        <span><kbd>1</kbd>–<kbd>8</kbd> play sound</span>
        <span><kbd>a</kbd>–<kbd>d</kbd> pattern (on the next bar · <kbd>shift</kbd> at once)</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> tempo</span>
        <span className="footer-credit">all sounds synthesized live with web audio · <a href="https://mo-tion.at" target="_blank" rel="noreferrer">mo-tion.at</a> · <a href="https://github.com/moon-int/beats" target="_blank" rel="noreferrer">open source on github</a></span>
      </footer>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        kit={kit}
        tracks={state.tracks}
        patterns={state.patterns}
        slot={state.slot}
        slotNames={SLOT_NAMES}
        bpm={state.bpm}
        swing={state.swing}
        volume={state.volume}
      />

      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0b141b" />
      <g fill="#00ffce">
        <rect x="10" y="38" width="8" height="16" rx="2" />
        <rect x="22" y="30" width="8" height="24" rx="2" />
        <rect x="34" y="22" width="8" height="32" rx="2" />
        <rect x="46" y="14" width="8" height="40" rx="2" />
      </g>
    </svg>
  );
}

// ---- validation & share encoding ------------------------------------------

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function sanitizePattern(raw: unknown): number[][] {
  return Array.from({ length: TRACK_COUNT }, (_, r) => {
    const row = Array.isArray(raw) && Array.isArray(raw[r]) ? raw[r] : [];
    return Array.from({ length: STEPS }, (_, c) => (row[c] === 1 || row[c] === 2 ? row[c] : 0));
  });
}

function sanitize(raw: any): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = initialState();
  return {
    bpm: Math.round(num(raw.bpm, BPM_MIN, BPM_MAX, d.bpm)),
    swing: Math.round(num(raw.swing, 0, 100, d.swing)),
    volume: num(raw.volume, 0, 1, d.volume),
    kit: Math.round(num(raw.kit, 0, kits.length - 1, 0)),
    slot: Math.round(num(raw.slot, 0, SLOTS - 1, 0)),
    patterns: Array.from({ length: SLOTS }, (_, i) =>
      Array.isArray(raw.patterns) && raw.patterns[i] ? sanitizePattern(raw.patterns[i]) : d.patterns[i]),
    tracks: Array.from({ length: TRACK_COUNT }, (_, i) => {
      const t = Array.isArray(raw.tracks) ? raw.tracks[i] ?? {} : {};
      return {
        gain: num(t.gain, 0, 1, 0.8),
        pan: num(t.pan, -1, 1, 0),
        tune: Math.round(num(t.tune, -12, 12, 0)),
        decay: num(t.decay, 0.25, 2, 1),
        mute: !!t.mute,
        solo: !!t.solo,
      };
    }),
  };
}

// compact form: patterns as digit strings, tracks as [gain, pan, tune, decay, mute, solo]
function encodeShare(s: AppState) {
  const compact = {
    b: s.bpm, w: s.swing, v: s.volume, k: s.kit, s: s.slot,
    p: s.patterns.map(p => p.map(r => r.join('')).join('.')),
    t: s.tracks.map(t => [t.gain, t.pan, t.tune, t.decay, +t.mute, +t.solo].map(x => Math.round(x * 100) / 100)),
  };
  return btoa(JSON.stringify(compact)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShare(hash: string): AppState | null {
  const m = hash.match(/^#s=([\w-]+)$/);
  if (!m) return null;
  try {
    const c = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    return sanitize({
      bpm: c.b, swing: c.w, volume: c.v, kit: c.k, slot: c.s,
      patterns: (c.p ?? []).map((p: string) => String(p).split('.').map(r => r.split('').map(Number))),
      tracks: (c.t ?? []).map((t: number[]) => ({ gain: t[0], pan: t[1], tune: t[2], decay: t[3], mute: !!t[4], solo: !!t[5] })),
    });
  } catch {
    return null;
  }
}
