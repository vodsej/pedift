import type { JSX } from 'preact'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  class: cls = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      class={`btn btn--${variant} btn--${size} ${block ? 'btn--block' : ''} ${cls}`}
      {...rest}
    >
      {children}
    </button>
  )
}

interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  variant?: Variant
}

/** Square icon button with an accessible label + hover tooltip. */
export function IconButton({
  label,
  active = false,
  variant = 'ghost',
  class: cls = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      class={`iconbtn btn--${variant} ${active ? 'is-active' : ''} ${cls}`}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      {...rest}
    >
      {children}
    </button>
  )
}
