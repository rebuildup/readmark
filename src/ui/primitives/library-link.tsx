/**
 * readmark — "back to the library" link.
 *
 * A navigation that looks like a button, so it is a `<Link>` with the
 * button classes rather than a `<Link>` wrapping a `<Button>`.
 * Nesting interactive elements is invalid HTML, and the resulting
 * keyboard and assistive-technology behavior is left to whichever
 * browser happens to be in use — a review on #4 caught exactly that
 * shape in the library row.
 */

import { Link } from 'react-router-dom';

interface LibraryLinkProps {
	readonly label?: string;
	readonly variant?: 'ghost' | 'secondary' | 'primary';
	readonly testId?: string;
}

export function LibraryLink({ label = '← Library', variant = 'ghost', testId }: LibraryLinkProps) {
	return (
		<Link className={`rm-button rm-button--${variant}`} to="/" data-testid={testId}>
			{label}
		</Link>
	);
}
