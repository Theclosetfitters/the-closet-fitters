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
import { normalizeConfig, isCornerBay, cornerBayIds, guardedSections } from '../lib/config';
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

// --- Corner-bay rule (positional, asymmetric) ------------------------------
// Wall B: corner = last index. Wall C: corner = index 0. A / straight: none.
assert.equal(isCornerBay('B', 2, 3), true, 'B last index is corner');
assert.equal(isCornerBay('B', 0, 3), false, 'B index 0 (open front) is not corner');
assert.equal(isCornerBay('C', 0, 3), true, 'C index 0 is corner');
assert.equal(isCornerBay('C', 2, 3), false, 'C last index (open front) is not corner');
assert.equal(isCornerBay('A', 0, 3), false, 'back wall has no corner');

// Drawer allowed at the open front, blocked at the rear (corner) — both walls.
const drawerCase = (walls: Array<[string, string]>) =>
  normalizeConfig(catalog, {
    name: 'D', shape: 'u_shaped', materialId: catalog.materials[0].id,
    hardwareStyleId: catalog.hardwareStyles[0].id, hardwareColorId: catalog.hardware[0].id,
    rodColorId: catalog.hardware[0].id,
    sections: [
      ...walls.map(([wall, interior]) => ({ wall, interior, widthIn: 24 })),
      { wall: 'A', interior: 'adjustable_shelves', widthIn: 30 },
    ],
  } as never);

// Wall B: [front, rear]; rear (index 1 = last) is the corner.
const bWall = drawerCase([['B', 'drawers'], ['B', 'long_hanging']]); // rear = LH here
const bRearDrawer = drawerCase([['B', 'long_hanging'], ['B', 'drawers']]); // rear = DR (illegal)
const bCornerIds = cornerBayIds(bRearDrawer);
const bRear = bRearDrawer.sections.filter((s) => s.wall === 'B').at(-1)!;
const bFront = bRearDrawer.sections.filter((s) => s.wall === 'B')[0];
assert.ok(bCornerIds.has(bRear.id), 'B rear bay is flagged corner');
assert.ok(!bCornerIds.has(bFront.id), 'B front bay is not corner');
// The guard coerces the rear drawer to the fallback; a front drawer survives.
const bGuarded = guardedSections(bRearDrawer);
assert.equal(bGuarded.find((s) => s.id === bRear.id)!.interior, 'long_hanging', 'B rear drawer coerced');
const bFrontDrawer = drawerCase([['B', 'drawers'], ['B', 'long_hanging']]);
const bFrontId = bFrontDrawer.sections.filter((s) => s.wall === 'B')[0].id;
assert.equal(
  guardedSections(bFrontDrawer).find((s) => s.id === bFrontId)!.interior, 'drawers',
  'B front drawer allowed'
);

// Wall C: [rear, front]; rear (index 0) is the corner.
const cRearDrawer = drawerCase([['C', 'drawers'], ['C', 'long_hanging']]);
const cRear = cRearDrawer.sections.filter((s) => s.wall === 'C')[0];
assert.ok(cornerBayIds(cRearDrawer).has(cRear.id), 'C rear bay (index 0) is corner');
assert.equal(guardedSections(cRearDrawer).find((s) => s.id === cRear.id)!.interior, 'long_hanging', 'C rear drawer coerced');
const cFrontDrawer = drawerCase([['C', 'long_hanging'], ['C', 'drawers']]);
const cFrontId = cFrontDrawer.sections.filter((s) => s.wall === 'C').at(-1)!.id;
assert.equal(guardedSections(cFrontDrawer).find((s) => s.id === cFrontId)!.interior, 'drawers', 'C front drawer allowed');
void bWall;

// Bay-count shift: append a bay to Wall B → the corner moves to the new last bay.
const b3 = drawerCase([['B', 'long_hanging'], ['B', 'long_hanging'], ['B', 'long_hanging']]);
const bBays = b3.sections.filter((s) => s.wall === 'B');
const b3corners = cornerBayIds(b3);
assert.ok(b3corners.has(bBays.at(-1)!.id) && !b3corners.has(bBays[0].id), 'B corner tracks the last bay as count grows');

// The guard actually reaches the renderers: a rear-corner drawer on Wall B shows
// as LH (not DR) in BOTH the elevation and the bird's-eye.
const guardPlan = elevationPlan(catalog, bRearDrawer).pages.flatMap((p) => p.groups).find((g) => g.id === 'left')!;
assert.ok(!guardPlan.bays.map((b) => b.code).includes('DR'), 'corner drawer coerced in elevation');
const guardBe = birdsEyePlan(catalog, bRearDrawer);
const beLeftTop = guardBe.cells.filter((c) => c.rotated && c.x === 0).sort((a, b) => a.y - b.y)[0];
assert.equal(beLeftTop.code, 'LH', "corner drawer coerced in bird's-eye (top-left cell)");

console.log('closet geometry ordering + corner rule: OK');
