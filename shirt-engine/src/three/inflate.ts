// Pure maths for the 3D preview (no DOM / three.js), unit-tested.

/** Inflation heights on a grid over the silhouette: solves ∇²h = −1 with
 *  h = 0 outside, by successive over-relaxation (converges in ~N sweeps). */
export function inflate(inside: Uint8Array, cols: number, rows: number, cell: number, sweeps = 900): Float32Array {
  const h = new Float32Array((cols + 1) * (rows + 1));
  const rhs = cell * cell; // pixel units
  const omega = 1.94;
  for (let it = 0; it < sweeps; it++) {
    for (let j = 1; j < rows; j++) for (let i = 1; i < cols; i++) {
      const k = j * (cols + 1) + i;
      if (!inside[k]) continue;
      const gs = (h[k - 1] + h[k + 1] + h[k - cols - 1] + h[k + cols + 1] + rhs) / 4;
      h[k] += omega * (gs - h[k]);
    }
  }
  return h;
}
