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
 *     thing: "we could not turn this Blob into a PDF document."
 *     Surfacing the specific pdf.js reason in the UI adds
 *     complexity for no MVP value.
 *   - We keep the original `cause` so logs / debug surfaces can
 *     still see the pdf.js-level reason.
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
