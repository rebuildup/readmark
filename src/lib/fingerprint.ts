/**
 * readmark — stable document fingerprint from raw bytes.
 *
 * Uses Web Crypto's SubtleCrypto.digest with SHA-256. The output is a
 * 64-char lowercase hex string. We key every reading-state record by this
 * fingerprint so re-imports dedupe and survive (ADR-0002).
 *
 * Why SHA-256 and not (e.g.) xxhash / blake3?
 *   - SubtleCrypto is built into every browser, no WASM dependency.
 *   - SHA-256 is collision-resistant enough for "this PDF is the same as
 *     that PDF" — we are not defending against adversarial collisions.
 *
 * Why the whole blob, not a streaming hash?
 *   - pdfjs-dist needs the whole blob anyway to load a PDFDocumentProxy.
 *   - For the multi-hundred-MB case we'll add a chunked fingerprint later
 *     (size + first 1 MiB SHA + last 1 MiB SHA) — out of MVP scope.
 *
 * IMPORTANT: this MUST run on the main thread or a worker, but NEVER block
 * the UI. Callers should treat it as an `await`-able side effect.
 */

import type { DocumentFingerprint } from '../domain/document.ts';

export async function fingerprintBytes(bytes: ArrayBuffer): Promise<DocumentFingerprint> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hex = bytesToHex(new Uint8Array(digest));
	return hex as DocumentFingerprint;
}

export async function fingerprintBlob(blob: Blob): Promise<DocumentFingerprint> {
	return fingerprintBytes(await blob.arrayBuffer());
}

function bytesToHex(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i++) {
		const byte = bytes[i];
		if (byte === undefined) continue;
		out += byte.toString(16).padStart(2, '0');
	}
	return out;
}
