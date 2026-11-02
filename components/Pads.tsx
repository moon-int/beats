"use client";
import React, { useEffect, useRef, useState } from 'react';
import { ACCENT_VEL, NORMAL_VEL, type DrumEngine } from '../lib/engine';
import { fillOf } from '../lib/fill';

/**
 * The pads: a 3 × 3 drum pad panel to play the kit with your fingers (or the keyboard), like the pads
 * of an mpc. Eight pads are the eight tracks, laid out like a drum kit — kick and snare at the bottom,
 * hats above, toms and percussion around them — the ninth is *fill*: hold it while the beat runs and
 * the second half of the bar turns into a snare-and-tom fill, let go and the pattern is back.
 *
 * - **rec**: hits while the sequencer plays are written into the current pattern, on the nearest 16th
 * - **repeat**: holding a pad repeats it in time — 8ths, 16ths or 32nds (with rec, they're written too)
 * - **full**: every hit at full level (accent) — otherwise shift, or pressing harder on a pen/touch screen
 */

export const FILL = -1;
// top row first; numbers are tracks (kick 0 · snare 1 · clap 2 · hat 3 · open hat 4 · tom 5 · rim 6 · perc 7)
const LAYOUT = [4, 7, FILL, 3, 2, 5, 0, 1, 6];
// the same 3 × 3 on the keyboard: the number block, or u i o / j k l / m , .
const NUMPAD = ['Numpad7', 'Numpad8', 'Numpad9', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad1', 'Numpad2', 'Numpad3'];
const LETTERS = ['KeyU', 'KeyI', 'KeyO', 'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'Comma', 'Period'];
const KEY_LABEL = ['u', 'i', 'o', 'j', 'k', 'l', 'm', ',', '.'];

/** which pad (position in the panel) plays a track — to light it when the sequencer plays that track */
export const padOf = (track: number) => LAYOUT.indexOf(track);

type Repeat = 0 | 8 | 16 | 32;

type Props = {
  engine: DrumEngine | null;
  playing: boolean;
  labels: string[];
  pattern: number[][];
  padRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  /** rec: a hit lands on a step of the current pattern (value 1, or 2 for an accent) */
  onRecord: (track: number, step: number, value: 1 | 2) => void;
};

export default function Pads({ engine, playing, labels, pattern, padRefs, onRecord }: Props) {
  const [rec, setRec] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>(0);
  const [full, setFull] = useState(false);
  const [down, setDown] = useState<Set<number>>(() => new Set()); // pad positions held
  const held = useRef(new Map<number, number>()); // track → velocity, held for note repeat
  const live = useRef({ rec, repeat, playing, pattern, onRecord, filling: false });
  live.current = { ...live.current, rec, repeat, playing, pattern, onRecord };

  // note repeat runs on the sequencer's own clock: every 16th it schedules, held pads play along
  useEffect(() => {
    if (!engine) return;
    engine.onSchedule = (step, time, sixteenth) => {
      const { repeat: r, rec: recording, onRecord: write } = live.current;
      if (!r || !held.current.size) return;
      if (r === 8 && step % 2) return;
      held.current.forEach((vel, track) => {
        engine.hit(track, vel, time);
        if (r === 32) engine.hit(track, vel * 0.85, time + sixteenth / 2);
        if (recording) write(track, step, vel >= ACCENT_VEL ? 2 : 1);
      });
    };
    return () => { engine.onSchedule = undefined; };
  }, [engine]);

  // the fill pattern follows the pattern while it is held (an edit, a recorded hit)
  useEffect(() => { if (live.current.filling) engine?.setPattern(fillOf(pattern)); }, [engine, pattern]);

  const press = (pos: number, accent: boolean) => {
    const track = LAYOUT[pos];
    setDown(d => new Set(d).add(pos));
    if (!engine) return;
    if (track === FILL) {
      if (!live.current.playing) return;
      live.current.filling = true;
      engine.setPattern(fillOf(live.current.pattern));
      return;
    }
    const vel = accent || full ? ACCENT_VEL : NORMAL_VEL;
    const { repeat: r, playing: running, rec: recording } = live.current;
    if (r && running) { held.current.set(track, vel); return; } // the next 16th (or 8th) plays it
    engine.hit(track, vel);
    if (recording && running) {
      const at = engine.heardPosition();
      if (at) live.current.onRecord(track, (at.step + (at.frac > 0.5 ? 1 : 0)) % live.current.pattern[0].length, vel >= ACCENT_VEL ? 2 : 1);
    }
  };

  const release = (pos: number) => {
    const track = LAYOUT[pos];
    setDown(d => { const n = new Set(d); n.delete(pos); return n; });
    if (track === FILL) {
      if (!live.current.filling) return;
      live.current.filling = false;
      engine?.setPattern(live.current.pattern);
      return;
    }
    held.current.delete(track);
  };

  // keys: the number block and u i o / j k l / m , . — held keys hold the pad (repeat, fill)
  const keys = useRef({ press, release });
  keys.current = { press, release };
  useEffect(() => {
    const pos = (e: KeyboardEvent) => { const i = NUMPAD.indexOf(e.code); return i >= 0 ? i : LETTERS.indexOf(e.code); };
    const onDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || el.closest('input, select, textarea, dialog')) return;
      const i = pos(e);
      if (i < 0) return;
      e.preventDefault();
      keys.current.press(i, e.shiftKey);
    };
    const onUp = (e: KeyboardEvent) => { const i = pos(e); if (i >= 0) keys.current.release(i); };
    // a lost focus must not leave a pad held (repeating forever)
    const onBlur = () => { for (let i = 0; i < 9; i++) keys.current.release(i); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', onBlur); };
  }, []);

  // stopping ends a fill and any repeat
  useEffect(() => {
    if (playing) return;
    held.current.clear();
    live.current.filling = false;
  }, [playing]);

  const onPointerDown = (e: React.PointerEvent, pos: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    // pressure only means something on pens and pressure-sensitive screens (a mouse reports 0.5)
    const hard = e.pointerType !== 'mouse' && e.pressure > 0 && e.pressure !== 0.5 && e.pressure > 0.6;
    press(pos, e.shiftKey || e.button === 2 || hard);
  };

  return (
    <div className="pads-wrap">
      <div className="pads" onContextMenu={e => e.preventDefault()}>
        {LAYOUT.map((track, pos) => {
          const fill = track === FILL;
          return (
            <button
              key={pos}
              ref={el => { padRefs.current[pos] = el; }}
              className={`pad ${fill ? 'pad-fill' : ''} ${down.has(pos) ? 'down' : ''}`}
              data-track={fill ? undefined : track}
              disabled={fill && !playing}
              onPointerDown={e => onPointerDown(e, pos)}
              onPointerUp={() => release(pos)}
              onPointerCancel={() => release(pos)}
              onLostPointerCapture={() => { if (down.has(pos)) release(pos); }}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); press(pos, e.shiftKey); } }}
              onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); release(pos); } }}
              title={fill ? 'hold while the beat runs: the rest of the bar becomes a fill' : `${labels[track]} — shift or right-click: accent`}
            >
              <span className="pad-name">{fill ? 'fill' : labels[track]}</span>
              <span className="pad-key"><kbd>{KEY_LABEL[pos]}</kbd></span>
            </button>
          );
        })}
      </div>

      <div className="pads-side">
        <button
          className={`btn pad-rec ${rec ? 'on rec' : ''}`} onClick={() => setRec(r => !r)} aria-pressed={rec}
          title="while the beat runs, what you play on the pads is written into the pattern — on the nearest 16th"
        ><span className="rec-dot" />rec</button>
        <div className="segmented" role="radiogroup" aria-label="note repeat">
          <span className="segmented-label">repeat</span>
          {([[0, 'off'], [8, '1/8'], [16, '1/16'], [32, '1/32']] as [Repeat, string][]).map(([v, l]) => (
            <button key={v} role="radio" aria-checked={repeat === v} className={repeat === v ? 'active' : ''} onClick={() => setRepeat(v)}>{l}</button>
          ))}
        </div>
        <button className={`btn ${full ? 'on' : ''}`} onClick={() => setFull(f => !f)} aria-pressed={full} title="every hit at full level (accent)">full level</button>
        <p className="hint pads-hint">
          {rec && !playing ? 'rec is armed — press play, then play the pads.' : repeat && !playing ? 'note repeat plays in time while the beat runs — press play.' : (
            <>tap the pads or use the number block / <kbd>u</kbd><kbd>i</kbd><kbd>o</kbd> <kbd>j</kbd><kbd>k</kbd><kbd>l</kbd> <kbd>m</kbd><kbd>,</kbd><kbd>.</kbd> — hold <em>fill</em> for a fill</>
          )}
        </p>
      </div>
    </div>
  );
}
