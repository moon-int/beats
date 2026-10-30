# beats — mo-tion interactive

**live:** [beats.mo-tion.at](https://beats.mo-tion.at) · **source:** [github.com/moon-int/beats](https://github.com/moon-int/beats) · MIT licence

a one-page drum machine built with next.js 14 and the web audio api, styled in the mo-tion.at mint (`#00ffce`).

## features

- 16-step sequencer, 8 tracks: kick, snare, clap, hat, open hat, tom, rim, perc
- 3 synthesized kits: **808**, **909**, **lo-fi** (no samples, everything is generated live)
- click to toggle, drag to paint, shift/right-click for accents
- 4 pattern slots (a–d) with copy/paste
- presets: house, techno, boom bap, trap, breakbeat, electro, plus a musically weighted randomizer
- transport: play/stop, tempo (50–220 bpm) with tap tempo, swing, master volume
- mixer per track: level, pan, tune (±12 st), decay, mute, solo
- open hat is choked by the closed hat, like on the real machines
- live spectrum visualizer, track leds and playhead synced to what you actually hear
- **wav loop export**: renders 1–16 bars (one pattern or a chain like a→b→c) offline into a seamless, sample-accurate loop. tails from the loop end wrap around to the start, and a `smpl` chunk marks the loop points for samplers. 44.1 khz/16-bit or 48 khz/24-bit; the filename includes kit and bpm
- share link: the whole state is encoded in the url
- autosave in localStorage

### keyboard

| key | action |
| --- | --- |
| space | play / stop |
| 1–8 | play a track's sound |
| a–d | switch pattern (while playing: on the next downbeat · shift: at once) |
| ↑ / ↓ | tempo ±1 (shift: ±10) |

knobs: drag up/down (shift for fine), scroll wheel, arrow keys, double-click to reset.

## live

- **pattern changes land on the one**: while playing, picking a–d queues the pattern (it blinks) and it takes over exactly on the next downbeat; shift switches at once
- **chain** plays the filled patterns one bar each, a → b → c → d — a quick song structure on stage
- **use in tabs** copies the current pattern for [mo-tion tabs](../Tabs): in a tabs session the host picks *instruments → groove → paste beats link*, and the whole band hears the pattern locked to the song they play, with the same kits

## development

```cmd
npm install
npm run dev    # http://localhost:3001 — tabs keeps 3000
```

production build:

```cmd
npm run build
npm start
```

## structure

- `app/` — next.js app router (`layout.tsx`, `page.tsx`, `globals.css`)
- `components/` — `Transport`, `StepGrid`, `Mixer`, `Knob`, `Visualizer`, `ExportDialog`
- `lib/engine.ts` — `Synth` (voices + mix bus, runs live and offline) and `DrumEngine` (live lookahead scheduler, with an `onBarStart` hook for downbeat-quantized pattern changes). tabs ships an unchanged copy of `engine.ts`, `kits.ts` and `patterns.ts` in `Tabs/lib/beats/` — keep them in sync
- `lib/exportLoop.ts` — offline loop rendering and wav encoding
- `lib/kits.ts` — kit definitions and voice parameters
- `lib/patterns.ts` — presets, randomizer, pattern helpers

## notes

- audio starts after a user interaction (browser policy) — press play, space or a track name.
