"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { jam, type CompactGroove, type JamMe, type SavedGroove } from '../lib/jam';
import { kits } from '../lib/kits';

type Props = {
  open: boolean;
  onClose: () => void;
  /** what is on the grid now, in the share-link form */
  current: () => CompactGroove;
  onLoad: (data: CompactGroove, name: string) => void;
  flash: (text: string) => void;
};

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};

/** the band's grooves: kept by tabs next door, a copy in havoc */
export default function GrooveLibrary({ open, onClose, current, onLoad, flash }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [me, setMe] = useState<JamMe | null>(null);
  const [items, setItems] = useState<SavedGroove[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** the groove loaded last — "save" updates it instead of making a new one */
  const [loaded, setLoaded] = useState<SavedGroove | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const who = await jam.me();
      setMe(who);
      if (who.auth && !who.user) { setItems(null); return; }
      setItems(await jam.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'the grooves could not be loaded');
    }
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); refresh(); }
    if (!open && d.open) d.close();
  }, [open, refresh]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'that did not work'); } finally { setBusy(null); }
  };

  const saveNew = () => run('new', async () => {
    const g = await jam.create(name.trim(), current());
    setLoaded(g);
    setName('');
    flash(`saved “${g.name}”`);
    await refresh();
  });

  const overwrite = (g: SavedGroove) => run(g.id, async () => {
    await jam.update(g.id, { data: current() });
    flash(`“${g.name}” updated`);
    await refresh();
  });

  const load = (g: SavedGroove) => run(g.id, async () => {
    const full = await jam.get(g.id);
    onLoad(full.data, full.name);
    setLoaded(g);
    onClose();
  });

  const remove = (g: SavedGroove) => {
    if (!window.confirm(`delete “${g.name}”? the band loses it too.`)) return;
    run(g.id, async () => {
      await jam.remove(g.id);
      if (loaded?.id === g.id) setLoaded(null);
      await refresh();
    });
  };

  const signedOut = me?.auth && !me.user;

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>grooves</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="close">✕</button>
        </div>

        {signedOut ? (
          <>
            <p className="dialog-text">the band’s grooves are kept with tabs — sign in once with havoc, then everyone in the band finds what you save here (and in a tabs session under instruments → groove).</p>
            <button className="btn primary wide" onClick={jam.signIn}>sign in with havoc</button>
          </>
        ) : (
          <>
            <p className="dialog-text">
              all four patterns, tempo, swing, kit and mixer — for the whole band{me?.user ? <>, signed in as <b className="who">{me.user.name}</b></> : ''}.
            </p>

            <form className="save-row" onSubmit={e => { e.preventDefault(); if (name.trim()) saveNew(); }}>
              <input
                className="input" value={name} onChange={e => setName(e.target.value)} maxLength={120}
                placeholder={loaded ? `name — or update “${loaded.name}” below` : 'name this groove'} aria-label="groove name"
              />
              <button className="btn primary" type="submit" disabled={!name.trim() || busy !== null}>{busy === 'new' ? 'saving…' : 'save'}</button>
            </form>

            {error && <p className="dialog-error">{error}</p>}

            <div className="groove-list" aria-busy={items === null}>
              {items === null && !error && <p className="dialog-text">loading…</p>}
              {items?.length === 0 && <p className="dialog-text">nothing saved yet — the first groove is yours.</p>}
              {items?.map(g => (
                <div key={g.id} className={`groove ${loaded?.id === g.id ? 'current' : ''}`}>
                  <button className="groove-main" onClick={() => load(g)} disabled={busy !== null} title="load into beats">
                    <span className="groove-name">{g.name}</span>
                    <span className="groove-meta">
                      {g.bpm ? `${g.bpm} bpm` : ''}{g.kit !== null && kits[g.kit] ? ` · ${kits[g.kit].name}` : ''} · {g.patterns} pattern{g.patterns === 1 ? '' : 's'}
                      {' · '}{g.mine ? 'you' : g.ownerName || 'someone'}, {ago(g.updatedAt)}
                    </span>
                  </button>
                  {g.editable && (
                    <>
                      <button className="btn sm" onClick={() => overwrite(g)} disabled={busy !== null} title="replace it with what is on the grid now">
                        {busy === g.id ? '…' : 'update'}
                      </button>
                      <button className="btn sm warn" onClick={() => remove(g)} disabled={busy !== null} aria-label={`delete ${g.name}`}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
