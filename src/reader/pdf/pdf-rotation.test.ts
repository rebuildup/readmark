/**
 * Tests for composing a page's native `/Rotate` with the reader's
 * runtime rotation (issue #33).
 *
 * Two levels, on purpose.
 *
 * The unit half pins the arithmetic as a table: every native rotation
 * against every runtime rotation, plus the values a real PDF can carry
 * that are not a quarter turn. It is fast and total.
 *
 * The integration half is the one that would catch a wrong *rule* — not
 * a wrong number. It loads real PDFs built by `pdf-lib`, lets the real
 * pdf.js parser read `/Rotate` off the page dictionary, and asks the
 * real `PageViewport` for the transform the composed rotation produces.
 * The claim being tested is not "the function returned 180" but "the
 * matrix pdf.js builds is byte-for-byte the matrix a reader expects for
 * a page turned a quarter turn further", which is the only version of
 * this change that means anything to a reader looking at a sideways
 * book.
 *
 * Why the real parser rather than a hand-written `/Rotate` map: the
 * whole question is what pdf.js *reports* for a page, and a fake that
 * answered the way we hoped would prove nothing. These fixtures also
 * fix pdf.js's own normalisation (a `/Rotate 450` arrives as 90) as a
 * fact about the dependency rather than a comment about it.
 *
 * What is NOT covered here: the pixels. Whether the canvas those
 * transforms produce is upright in a real browser is
 * `scripts/smoke-rotate.mjs`'s job — happy-dom has no canvas, so a
 * test in this file cannot see a glyph.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { loadPdfDocument } from './pdf-document.ts';
import { composePageRotation, normalizePageRotation, type PageRotation } from './pdf-rotation.ts';

const QUARTER_TURNS: readonly PageRotation[] = [0, 90, 180, 270];

/**
 * The whole rule, as a table: `native + runtime` reduced mod 360.
 *
 * Read the first row — with no native rotation the composition is the
 * identity, which is the case the reader had before this change and the
 * one every normally-written book in the wild depends on.
 */
const table: readonly {
	readonly native: PageRotation;
	readonly runtime: PageRotation;
	readonly total: PageRotation;
}[] = [
	{ native: 0, runtime: 0, total: 0 },
	{ native: 0, runtime: 90, total: 90 },
	{ native: 0, runtime: 180, total: 180 },
	{ native: 0, runtime: 270, total: 270 },
	{ native: 90, runtime: 0, total: 90 },
	{ native: 90, runtime: 90, total: 180 },
	{ native: 90, runtime: 180, total: 270 },
	{ native: 90, runtime: 270, total: 0 },
	{ native: 180, runtime: 0, total: 180 },
	{ native: 180, runtime: 90, total: 270 },
	{ native: 180, runtime: 180, total: 0 },
	{ native: 180, runtime: 270, total: 90 },
	{ native: 270, runtime: 0, total: 270 },
	{ native: 270, runtime: 90, total: 0 },
	{ native: 270, runtime: 180, total: 90 },
	{ native: 270, runtime: 270, total: 180 },
];

/** A portrait page, so a quarter turn is visible as a swap of width
 *  and height rather than a number only. */
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 595;

describe('normalizePageRotation', () => {
	it('passes the four quarter turns through unchanged', () => {
		for (const rotation of QUARTER_TURNS) {
			expect(normalizePageRotation(rotation)).toBe(rotation);
		}
	});

	it('reads an absent rotation as 0', () => {
		// A page with no `/Rotate` has no entry at all. There is no
		// "unknown" to report upward: the orientation is 0, and
		// inventing a third state here would put it into a transform
		// somewhere.
		expect(normalizePageRotation(undefined)).toBe(0);
		expect(normalizePageRotation(null)).toBe(0);
	});

	it('rejects every value that is not a finite integer', () => {
		// The `NaN` case is the one that matters. It does not throw and
		// it does not render: `PageViewport` multiplies it straight
		// into its transform, and the canvas and the page box are then
		// sized `NaNpx`, which every browser resolves to no box at all.
		// The page would silently vanish rather than look wrong.
		expect(normalizePageRotation(Number.NaN)).toBe(0);
		expect(normalizePageRotation(Number.POSITIVE_INFINITY)).toBe(0);
		expect(normalizePageRotation(Number.NEGATIVE_INFINITY)).toBe(0);
		expect(normalizePageRotation(45.5)).toBe(0);
	});

	it('rejects a value that is not a quarter turn', () => {
		// A `/Rotate` of 45 is not a page orientation, and pdf.js
		// rejects it to 0 for the same reason. Matching pdf.js keeps
		// this module's answer and the page's real orientation from
		// disagreeing about the same page.
		expect(normalizePageRotation(45)).toBe(0);
		expect(normalizePageRotation(1)).toBe(0);
		expect(normalizePageRotation(89)).toBe(0);
		expect(normalizePageRotation(-45)).toBe(0);
	});

	it('wraps out-of-range and negative values into [0, 360)', () => {
		// A PDF is allowed to say any of these, and pdf.js normalises
		// to the same range. If this module disagreed, a page and this
		// reader would compute two different orientations for it.
		expect(normalizePageRotation(360)).toBe(0);
		expect(normalizePageRotation(450)).toBe(90);
		expect(normalizePageRotation(-90)).toBe(270);
		expect(normalizePageRotation(-450)).toBe(270);
		expect(normalizePageRotation(-360)).toBe(0);
	});

	it('rejects values that are not numbers at all', () => {
		// `unknown` rather than `number` because the input is a number
		// parsed out of an untrusted file. A string that looks like a
		// rotation is still not one.
		expect(normalizePageRotation('90')).toBe(0);
		expect(normalizePageRotation({})).toBe(0);
		expect(normalizePageRotation([])).toBe(0);
		expect(normalizePageRotation(true)).toBe(0);
	});
});

describe('composePageRotation', () => {
	it('composes every native rotation with every runtime rotation', () => {
		for (const { native, runtime, total } of table) {
			expect(composePageRotation(native, runtime)).toBe(total);
		}
	});

	it('turns the page further in the same direction, not back', () => {
		// The direction is the decision, not the arithmetic. A page
		// already stored at `/Rotate 90` and a reader pressing "turn
		// clockwise" wants 180. Subtracting here would land back on 90
		// — or 0 — and the button would appear to do nothing.
		expect(composePageRotation(90, 90)).toBe(180);
		expect(composePageRotation(270, 90)).toBe(0);
	});

	it('wraps past a full turn instead of running off the end', () => {
		// 90 + 270 is 360 degrees, which is the same page as 0 — and
		// `getViewport` has a matrix for 0, not for 360. An
		// un-normalised 360 would fall through `PageViewport`'s
		// `rotation % 180` switch to the unrotated matrix by accident
		// rather than by decision.
		expect(composePageRotation(90, 270)).toBe(0);
		expect(composePageRotation(180, 180)).toBe(0);
		expect(composePageRotation(270, 270)).toBe(180);
	});

	it('reads an absent native rotation as 0, not as a broken page', () => {
		// The overwhelmingly common case: a PDF written normally, with
		// no `/Rotate` anywhere in it.
		for (const runtime of QUARTER_TURNS) {
			expect(composePageRotation(undefined, runtime)).toBe(runtime);
		}
	});

	it('does not let a rejected native rotation drag the runtime one down', () => {
		// Both terms are normalised *before* they are summed, so the
		// reader's own rotation survives a page whose `/Rotate` is
		// unreadable. Reading it the other way — total = 0 because the
		// page is malformed — would silently reset the reader's
		// orientation every time they opened such a page.
		expect(composePageRotation(Number.NaN, 90)).toBe(90);
		expect(composePageRotation(45, 90)).toBe(90);
		expect(composePageRotation('nonsense', 270)).toBe(270);
	});

	it('does not let a rejected runtime rotation drag the native one down', () => {
		expect(composePageRotation(180, Number.NaN)).toBe(180);
		expect(composePageRotation(270, undefined)).toBe(270);
	});

	it('is not commutative in its inputs, only in its answer', () => {
		// Stated so the table above is not read as an accident: both
		// operands go through the same normaliser, so the order they
		// are written in cannot change the result. What the order
		// *does* decide is which one is the base — and that is fixed
		// by the call site, not by this function.
		for (const { native, runtime, total } of table) {
			expect(composePageRotation(runtime, native)).toBe(total);
		}
	});
});

describe('composePageRotation against the real pdf.js PageViewport', () => {
	/**
	 * The transforms pdf.js 5.7 actually builds for a 420x595 page at
	 * scale 1, one per quarter turn.
	 *
	 * These are the ground truth this whole change stands on. They were
	 * read out of the pinned dependency rather than derived from the
	 * matrix maths, because the test's job is to notice when pdf.js
	 * changes them — a hard-coded expectation is what makes that
	 * visible, where a re-derivation would agree with whatever the
	 * library did today.
	 */
	const realTransforms: Record<PageRotation, readonly number[]> = {
		0: [1, 0, 0, -1, 0, 595],
		90: [0, 1, 1, 0, 0, 0],
		180: [-1, 0, 0, 1, 420, 0],
		270: [0, -1, -1, 0, 595, 420],
	};

	/** A PDF whose single page carries `rotate` in its dictionary, or
	 *  no `/Rotate` at all when `rotate` is `null`. */
	async function pageWithRotate(rotate: number | null) {
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
		if (rotate !== null) page.setRotation(degrees(rotate));
		const doc = await loadPdfDocument(await pdf.save());
		try {
			return await doc.getPage(1);
		} finally {
			await doc.destroy();
		}
	}

	/** A quarter turn swaps the page's own dimensions; that is the
	 *  shape a reader sees, and the reason orientation is not a
	 *  detail. */
	const realSize = (rotation: PageRotation) =>
		rotation === 90 || rotation === 270
			? { width: PAGE_HEIGHT, height: PAGE_WIDTH }
			: { width: PAGE_WIDTH, height: PAGE_HEIGHT };

	// One document per native rotation, loaded once and shared by the
	// cases below. Loading a PDF spins up pdf.js's parser, which is the
	// slow part; there are four of them and the cases are cheap.
	const fixtures = new Map<number, Awaited<ReturnType<typeof pageWithRotate>>>();

	async function nativePage(rotate: number | null) {
		if (!fixtures.has(rotate ?? -1)) {
			fixtures.set(rotate ?? -1, await pageWithRotate(rotate));
		}
		// Non-null: the map is populated on the line above whenever the
		// key is absent, so a miss here is not reachable.
		return fixtures.get(rotate ?? -1) as Awaited<ReturnType<typeof pageWithRotate>>;
	}

	it('builds the expected transform for every native/runtime pair', async () => {
		for (const { native, runtime, total } of table) {
			const page = await nativePage(native);
			// The reader's own number must survive the round trip
			// through the file: this is the value the page dictionary
			// actually yields, not the value the fixture was written
			// with.
			expect(page.rotate).toBe(native);

			const viewport = page.getViewport({
				scale: 1,
				rotation: composePageRotation(page.rotate, runtime),
			});

			expect(viewport.rotation).toBe(total);
			expect([...viewport.transform]).toEqual(realTransforms[total]);
			expect(viewport.width).toBe(realSize(total).width);
			expect(viewport.height).toBe(realSize(total).height);
		}
	});

	it('produces a finite transform for every input, including malformed ones', async () => {
		// The claim is not "does not throw". It is that every number
		// reaching a CSS length is finite, because `NaNpx` is a
		// silently missing box and `Infinitypx` is the same.
		const page = await nativePage(90);
		const malformed: readonly unknown[] = [
			undefined,
			null,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			45,
			-45,
			450,
			-450,
			'90',
			{},
		];
		for (const native of malformed) {
			for (const runtime of [...QUARTER_TURNS, ...malformed]) {
				const rotation = composePageRotation(native, runtime);
				const viewport = page.getViewport({ scale: 1, rotation });
				for (const [index, value] of viewport.transform.entries()) {
					expect(Number.isFinite(value), `${String(native)} + ${String(runtime)}`).toBe(true);
					expect(value, `${String(native)} + ${String(runtime)} [${index}]`).not.toBeNaN();
				}
				expect(Number.isFinite(viewport.width)).toBe(true);
				expect(Number.isFinite(viewport.height)).toBe(true);
			}
		}
	});

	it('gives the same transform whichever side the quarter turn came from', async () => {
		// The strongest form of "the composition is a sum": two pages
		// that arrived at the same total by different routes — one
		// natively 90 and turned once, one natively 0 and turned twice
		// — are indistinguishable to pdf.js. Any rule that were not a
		// plain sum (a difference, a sign flip, a double application)
		// would separate them here.
		const natively90 = await nativePage(90);
		const natively0 = await nativePage(0);

		const fromNative = natively90.getViewport({ scale: 1, rotation: composePageRotation(90, 90) });
		const fromRuntime = natively0.getViewport({ scale: 1, rotation: composePageRotation(0, 180) });

		expect([...fromNative.transform]).toEqual([...fromRuntime.transform]);
		expect(fromNative.width).toBe(fromRuntime.width);
		expect(fromNative.height).toBe(fromRuntime.height);
	});

	it('lands on the identity transform when the two rotations cancel', async () => {
		// 90 native + 270 runtime is a whole turn. pdf.js has a matrix
		// for 0, not for 360, so the composition has to wrap or the
		// page would be sent an angle it has no transform for.
		const page = await nativePage(90);
		const viewport = page.getViewport({ scale: 1, rotation: composePageRotation(90, 270) });

		expect(viewport.rotation).toBe(0);
		expect([...viewport.transform]).toEqual(realTransforms[0]);
	});

	it('reads a page with no /Rotate as 0, and renders it as pdf.js would', async () => {
		// The pre-existing behaviour, pinned so the composition cannot
		// have quietly changed the case every normal book is in.
		const page = await nativePage(null);
		expect(page.rotate).toBe(0);

		const viewport = page.getViewport({ scale: 1, rotation: composePageRotation(page.rotate, 0) });
		expect([...viewport.transform]).toEqual(realTransforms[0]);
	});

	it('reads an out-of-range /Rotate the way pdf.js normalises it', async () => {
		// `/Rotate 450` is 90, and `/Rotate -90` is 270 — pdf.js already
		// does this reduction, so the composition's own normaliser is a
		// second line of defence rather than a second opinion. It has
		// to agree with the library about the same page, which is what
		// this asserts.
		const tooLarge = await pageWithRotate(450);
		const negative = await pageWithRotate(-90);

		expect(tooLarge.rotate).toBe(90);
		expect(negative.rotate).toBe(270);
		expect(composePageRotation(tooLarge.rotate, 0)).toBe(90);
		expect(composePageRotation(negative.rotate, 0)).toBe(270);
	});
});
