/**
 * readmark — Button primitive.
 *
 * Intentionally minimal. We don't pull shadcn/ui because the entire design
 * system here is ~30 lines of CSS custom properties (see styles.css).
 * Adding a component library would more than double the bundle for
 * negligible benefit at MVP scale.
 *
 * Why the variants are CSS classes instead of inline styles: a
 * navigation that looks like a button must be a `<Link>`, not a
 * `<Link>` wrapping a `<button>`. Nesting interactive elements is
 * invalid HTML and makes keyboard and AT behaviour depend on the
 * browser's willingness to guess. The classes let `Button` and
 * `Link` share one visual definition — see `.rm-button` in
 * `styles.css`.
 */

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/**
	 * `danger` is reserved for irreversible actions (delete). It is
	 * not a general-purpose accent: using it for a merely important
	 * button would dilute the one signal the reader must not miss.
	 */
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
	children: ReactNode;
	/**
	 * React 19 passes `ref` to function components as an ordinary
	 * prop, so no `forwardRef` is needed. Callers that need the node
	 * (e.g. `<ConfirmDialog>` focusing its cancel button on open)
	 * pass it here. We spell it out because `ButtonHTMLAttributes`
	 * does not declare it.
	 */
	readonly ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'secondary', className, children, ...rest }: ButtonProps) {
	const classes =
		className === undefined
			? `rm-button rm-button--${variant}`
			: `rm-button rm-button--${variant} ${className}`;
	return (
		<button type="button" className={classes} {...rest}>
			{children}
		</button>
	);
}
