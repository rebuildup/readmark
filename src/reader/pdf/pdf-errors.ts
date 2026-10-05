/**
 * readmark — PDF reader error vocabulary.
 *
 * Single responsibility:
 *   - Define a stable, format-specific error surface that
 *     `extractPdfMetadata()` and (in #11) `PdfReaderHandle`
 *     throw on failure.
 *   - Hide pdf.js's exception class names from upstream layers.
 *
 * Why a custom error class:
 *   - ADR-0004 §Boundary: the only pdf.js types that escape
 *     `src/reader/pdf/` are format-portable shapes. pdf.js's
 *     `InvalidPDFException` / `MissingPDFException` /
 *     `PasswordException` are NOT exported through the package
 *     boundary in a way generic code can reference. Letting raw
 *     pdf.js exceptions bubble out of this folder forces upstream
 *     code (`library/`, future `ui/`) to discriminate by the
 *     string `error.name`, which is fragile (pdf.js could rename
 *     an exception in a minor release and silently break our
 *     error taxonomy).
 *   - Wrapping once at this boundary means `library/` only sees
 *     `PdfInvalidError`. We swap implementations, change pdf.js
 *     versions, or even replace pdf.js with a fork — and the
 *     library layer does not notice.
 *
 * Why a single `PdfInvalidError` class for three pdf.js errors:
 *   - From the library's perspective all three mean the same
 *     thing: "this claimed to be a PDF, and we could not read it."
 *     Surfacing the specific pdf.js reason in the UI adds
 *     complexity for no MVP value.
 *   - We keep the original `cause` so logs / debug surfaces can
 *     still see the pdf.js-level reason.
 *
 * Why `PdfUnsupportedFormatError` is a sibling, not another pdf.js
 *   name: pdf.js reports "these bytes are not a PDF" with the same
 *   `InvalidPDFException` it uses for "these bytes are a broken
 *   PDF". Folding the two together loses a distinction the user
 *   acts on, so the non-PDF case is caught by our own header sniff
 *   before pdf.js ever runs.
 *
 * Why `QuotaExceededError` is NOT wrapped here:
 *   - That error originates in the storage layer
 *     (`src/storage/`), not in the PDF reader.
 *   - Its `name` is a stable W3C standard
 *     (`QuotaExceededError`, with `NS_ERROR_DOM_QUOTA_REACHED`
 *     for Firefox), so detecting by name is defensible and the
 *     single storage-side caller is the natural place to wrap
 *     it if the spec ever changes.
 */

/**
 * Thrown by `extractPdfMetadata()` and (later) by `PdfReaderHandle`
 * when the bytes cannot be turned into a usable PDF document.
 *
 * Covers pdf.js's `InvalidPDFException`, `MissingPDFException`,
 * and `PasswordException` (we do not support password-protected
 * PDFs in MVP — surface as `invalid-pdf` for now).
 *
 * The original pdf.js exception is preserved on `cause` for
 * diagnostics. Callers in `library/` switch on `instanceof
 * PdfInvalidError` and never need to read the underlying pdf.js
 * name.
 */
export class PdfInvalidError extends Error {
	override readonly name = 'PdfInvalidError';

	constructor(message: string, options: { cause: unknown } = { cause: undefined }) {
		super(message);
		// `cause` is an ES2022 Error field. Setting it explicitly
		// keeps the original pdf.js exception reachable through
		// `error.cause` for logging.
		if (options.cause !== undefined) {
			(this as { cause?: unknown }).cause = options.cause;
		}
	}
}

/**
 * Thrown by `extractPdfMetadata()` when the bytes do not look like a
 * PDF *at all* — no `%PDF-` header in the first 1 KiB.
 *
 * Why this is a separate class from `PdfInvalidError`:
 *   - They are different facts and the user needs different advice.
 *     A JPEG is not a broken PDF; a truncated PDF is not an
 *     unsupported format. pdf.js reports both as
 *     `InvalidPDFException`, so without this class every wrong file
 *     type would be answered with "your PDF is corrupt or
 *     password-protected", which is simply false for a photo.
 *   - `library/` discriminates on `instanceof` and maps this to
 *     `ImportError.kind = 'unsupported-format'`, which the UI
 *     already has a distinct branch for.
 *
 * Detected by a header sniff in `pdf-metadata.ts` BEFORE
 * `loadPdfDocument()` is called, so no pdf.js worker is ever opened
 * for a file that cannot be one.
 */
export class PdfUnsupportedFormatError extends Error {
	override readonly name = 'PdfUnsupportedFormatError';
}

/**
 * Detect whether an unknown `cause` is one of pdf.js's three
 * "this is not a usable PDF" exceptions. Used inside the
 * `extractPdfMetadata()` boundary to decide whether to wrap as
 * `PdfInvalidError`. Duck-types on `name` because the classes
 * themselves are not exported across the pdf.js package boundary.
 *
 * If pdf.js 6.x renames any of these, the change is contained
 * to this file.
 */
export function isPdfJsInvalidException(cause: unknown): boolean {
	if (cause === null || typeof cause !== 'object') return false;
	const name = (cause as { name?: unknown }).name;
	return (
		name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'PasswordException'
	);
}
