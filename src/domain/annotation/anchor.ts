/**
 * readmark — format-agnostic annotation anchor contract.
 *
 * An `Anchor<P>` locates a positional annotation (Highlight,
 * PositionedNote, the "what text" part of a Bookmark) in a
 * DocumentSource. It is the OUTER contract: generic code persists
 * and routes anchors without inspecting `payload`.
 *
 * The format-specific shape of `payload` is the inner contract.
 * Each format (PDF, EPUB, Markdown, text) defines its own payload
 * type in `reader/<format>/anchor.ts`. The PDF one lives at
 * `reader/pdf/anchor.ts` (see ADR-0007).
 *
 * Why generic + format-specific, not a single union?
 *   - Adding a new format does not touch `domain/`.
 *   - Generic UI can render "this annotation is at page 7" by
 *     asking the format-specific reader for a fallback display,
 *     without parsing the payload itself.
 *   - The storage layer writes bytes opaquely — Dexie / IndexedDB
 *     do not need to know what `payload` looks like.
 *
 * Why `format` is a property of the anchor, not external metadata?
 *   - A Document may have multiple sources in different formats
 *     (post-MVP). The anchor lives inside ONE source and MUST
 *     carry the source's format so the recovery code can pick the
 *     right algorithm.
 *
 * NOTE: `Anchor` is distinct from `DocumentPosition`
 * (`domain/document.ts`). `DocumentPosition` is a sub-page pointer
 * (scroll offset, CFI, …) used by ReadingProgress / Bookmark for
 * "scroll to here" on reopen. `Anchor` is a text-region annotation
 * position. See ADR-0007 for the full split.
 */

import type { DocumentFormat } from '../document.ts';

/** Format-agnostic outer contract for a positional annotation
 *  anchor. `payload` is opaque to generic code. */
export interface Anchor<P = unknown> {
	readonly format: DocumentFormat;
	readonly payload: P;
}

/** Type guard: was this anchor produced by the given format's
 *  reader? */
export function isAnchorOfFormat<P>(anchor: Anchor, format: DocumentFormat): anchor is Anchor<P> {
	return anchor.format === format;
}
