import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MASTER_W, MASTER_H } from '../src/model/zones';

// The approved master must never change. If this fails, the stencil file was
// altered — restore it from the original ZIP, do not update the hash.
const APPROVED_SHA256 = '207cde2e9beaff8ad2c3419736c490716ee881438381dc2c567e133848d3d2c2';

describe('master stencil', () => {
  const bytes = readFileSync(new URL('../public/master-stencil.png', import.meta.url));
  it('is byte-identical to the approved master', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(APPROVED_SHA256);
  });
  it('has the dimensions the app uses', () => {
    expect(bytes.readUInt32BE(16)).toBe(MASTER_W);
    expect(bytes.readUInt32BE(20)).toBe(MASTER_H);
  });
});
