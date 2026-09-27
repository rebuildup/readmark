/**
 * readmark — Button primitive.
 *
 * Intentionally minimal. We don't pull shadcn/ui because the entire design
 * system here is ~30 lines of CSS custom properties (see styles.css).
 * Adding a component library would more than double the bundle for
 * negligible benefit at MVP scale.
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

const variants = {
	primary: {
		background: 'var(--rm-accent)',
		color: 'var(--rm-accent-fg)',
		border: '1px solid var(--rm-accent)',
	},
	secondary: {
		background: 'var(--rm-bg-surface)',
		color: 'var(--rm-fg)',
		border: '1px solid var(--rm-border)',
	},
	ghost: {
		background: 'transparent',
		color: 'var(--rm-fg)',
		border: '1px solid transparent',
	},
	danger: {
		background: 'var(--rm-danger)',
		color: 'var(--rm-danger-fg)',
		border: '1px solid var(--rm-danger)',
	},
} as const;

export function Button({ variant = 'secondary', style, children, ...rest }: ButtonProps) {
	return (
		<button
			type="button"
			{...rest}
			style={{
				...variants[variant],
				padding: '8px 14px',
				borderRadius: 'var(--rm-radius-md)',
				fontWeight: 500,
				...style,
			}}
		>
			{children}
		</button>
	);
}
