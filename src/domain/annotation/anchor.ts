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
 *
 * IMPORTANT — payload validation lives in the format-specific
 * layer, NOT here. `isAnchorOfFormat` is a discriminator check on
 * the `format` field only. A format-specific guard (e.g.
 * `isPdfAnchor` in `reader/pdf/anchor.ts`) must validate the
 * payload shape before any payload field is read. Returning
 * `anchor is Anchor<PdfAnchor>` from this layer would be a lie —
 * the `format` string is not enough to prove the payload is
 * well-formed.
 */

import type { DocumentFormat } from '../document.ts';

/** Format-agnostic outer contract for a positional annotation
 *  anchor. `payload` is opaque to generic code. */
export interface Anchor<P = unknown> {
	readonly format: DocumentFormat;
	readonly payload: P;
}

/** Type guard: was this anchor produced by the given format's
 *  reader?
 *
 *  Reads the `format` field only — does NOT validate that the
 *  payload has the right shape for that format. A malformed /
 *  older-version / hand-edited payload from storage will pass
 *  this check.
 *
 *  Return type is `boolean` (not `anchor is Anchor<P>`) on
 *  purpose: at the domain layer we cannot know what the right
 *  payload shape is for each format, so we cannot honestly narrow
 *  `payload` to a typed shape here. Returning a typed guard
 *  (`anchor is Anchor<PdfAnchor>`) would be a lie — it would
 *  convince callers that they can read payload fields when in
 *  fact only the format string was verified.
 *
 *  Callers that need typed access to `payload` MUST use a
 *  format-specific guard, e.g.:
 *
 *      if (isAnchorOfFormat(anchor, 'pdf') && isPdfAnchor(anchor)) {
 *        // safe to read anchor.payload.rects etc.
 *      }
 *
 *  The format-specific guard lives in the format-specific layer
 *  (`isPdfAnchor` at `reader/pdf/anchor.ts`). Domain code does
 *  not know what PDF / EPUB / Markdown payloads look like. */
export function isAnchorOfFormat(anchor: Anchor, format: DocumentFormat): boolean {
	return anchor.format === format;
}
