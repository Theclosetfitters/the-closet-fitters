// Regression guard for the closet elevation / bird's-eye ordering (§4 of the
// Quote-PDF fixes). Run with:  npx tsx scripts/verify-closet-geometry.ts
//
// GROUND TRUTH is the 3D viewer (components/3d/ClosetViewer.tsx). A side wall's
// bays run from the OPEN FRONT (stored index 0) to the corner touching the back
// wall (last index) for the LEFT wall, and mirror-imaged for the RIGHT wall
// (index 0 = corner). Stored order is canonical and is never mutated; the
// elevation draws it as-is (the corner lands at the back-wall seam for both side
// walls), and the bird's-eye reverses only the left column so the corner sits at
// the top of both side columns. There is exactly one .reverse() in the pipeline,
// in birdsEyePlan.
import assert from 'node:assert/strict';
import { catalog } from '../lib/catalog';
import { normalizeConfig } from '../lib/config';
import { elevationPlan, birdsEyePlan } from '../lib/closet-geometry';

function mk(shape: string, sections: Array<{ wall: string; interior: string; widthIn: number }>) {
  return normalizeConfig(catalog, {
    name: 'Test',
    shape,
    materialId: catalog.materials[0].id,
    hardwareStyleId: catalog.hardwareStyles[0].id,
    hardwareColorId: catalog.hardware[0].id,
    rodColorId: catalog.hardware[0].id,
    sections,
  } as never);
}

// U-shape. Stored side-wall order (index 0 = open front, per the 3D viewer):
//   LEFT (B):  [DR, DH, LH]   → LH is the corner (last index, touches back)
//   RIGHT (C): [LH, DH, DR]   → LH is the corner (index 0, touches back)
const u = mk('u_shaped', [
  { wall: 'B', interior: 'drawers', widthIn: 24 },
  { wall: 'B', interior: 'double_hanging', widthIn: 24 },
  { wall: 'B', interior: 'long_hanging', widthIn: 24 },
  { wall: 'A', interior: 'adjustable_shelves', widthIn: 30 },
  { wall: 'C', interior: 'long_hanging', widthIn: 24 },
  { wall: 'C', interior: 'double_hanging', widthIn: 24 },
  { wall: 'C', interior: 'drawers', widthIn: 24 },
]);

const groups = elevationPlan(catalog, u).pages.flatMap((p) => p.groups);
const codesOf = (id: 'left' | 'right') =>
  groups.find((g) => g.id === id)!.bays.map((b) => b.code).join(',');

// Elevation: stored order, corner at the seam adjacent to the back group.
assert.equal(codesOf('left'), 'DR,DH,LH', 'elevation LEFT group, left→right');
assert.equal(codesOf('right'), 'LH,DH,DR', 'elevation RIGHT group, left→right');

// Bird's-eye: corner at the TOP of each side column.
const be = birdsEyePlan(catalog, u);
const columnTopToBottom = (x: number) =>
  be.cells
    .filter((c) => c.rotated && c.x === x)
    .sort((a, b) => a.y - b.y)
    .map((c) => c.code)
    .join(',');
const leftX = 0;
const rightX = Math.max(...be.cells.map((c) => c.x));
assert.equal(columnTopToBottom(leftX), 'LH,DH,DR', "bird's-eye LEFT column, top→bottom");
assert.equal(columnTopToBottom(rightX), 'LH,DH,DR', "bird's-eye RIGHT column, top→bottom");

// The two drawings are consistent: the corner bay (LH) is at the elevation seam
// AND at the bird's-eye column top for BOTH walls.
assert.equal(codesOf('left').split(',').at(-1), 'LH', 'LEFT corner at elevation seam (right edge)');
assert.equal(codesOf('right').split(',')[0], 'LH', 'RIGHT corner at elevation seam (left edge)');

console.log('closet geometry ordering: OK');
