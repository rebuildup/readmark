/**
 * readmark — Button primitive.
 *
 * Intentionally minimal. We don't pull shadcn/ui because the entire design
 * system here is ~30 lines of CSS custom properties (see styles.css).
 * Adding a component library would more than double the bundle for
 * negligible benefit at MVP scale.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'ghost';
	children: ReactNode;
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
} as const;

export function Button({ variant = 'secondary', style, children, ...rest }: ButtonProps) {
	return (
		<button
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
