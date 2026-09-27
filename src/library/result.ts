/**
 * readmark — minimal `Result<T, E>` for library flows.
 *
 * Why a hand-rolled union instead of `neverthrow` (or similar):
 *   - Two lines of types, zero bundle cost. The library flows
 *     (`import-document.ts`, `remove-document.ts`) each return one
 *     union; a library that ships an `isErr()` helper per call site
 *     would be larger than the flows themselves.
 *   - The shape is the one the flows need: an `ok` discriminant the
 *     UI can switch on, and a `cause` on the error arm for logging.
 *     It deliberately carries no error class — callers match on
 *     `kind`, never on `instanceof`.
 *
 * This module used to live inside `import-document.ts` with a note
 * to promote it "when the second use site appears". #4 is that
 * second use site.
 *
 * Scope: library flows only. Domain types, storage repositories, and
 * the reader contract keep plain `Promise<T>` / `throw` semantics.
 */

export type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };
