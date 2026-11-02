/**
 * The pads' fill: the pattern as it is for the first half of the bar, then a snare build in 8ths and
 * 16ths with the toms answering at the end — kick and the closed hat thin out, the open hat goes.
 * Rows: kick 0 · snare 1 · clap 2 · hat 3 · open hat 4 · tom 5 · rim 6 · perc 7.
 */
export function fillOf(p: number[][]): number[][] {
  const steps = p[0]?.length ?? 16;
  const half = Math.floor(steps / 2), last = Math.floor((steps * 3) / 4);
  const f = p.map(r => r.slice());
  for (let c = half; c < steps; c++) {
    const late = c >= last;
    if (f[1]) f[1][c] = late ? (c % 2 ? 1 : 2) : c % 2 ? 0 : 1;
    if (f[2]) f[2][c] = 0;
    if (f[3]) f[3][c] = late ? 0 : f[3][c];
    if (f[4]) f[4][c] = 0;
    if (f[5]) f[5][c] = c >= steps - 2 ? 2 : c === last + 1 ? 1 : 0;
    if (f[0]) f[0][c] = c === half || c === last ? f[0][c] || 1 : 0;
  }
  return f;
}
