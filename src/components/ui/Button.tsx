import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  variant?: ButtonVariant
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-loyalty-fresh text-white shadow-loyalty hover:bg-loyalty-fresh-strong focus-visible:outline-loyalty-fresh active:scale-[0.97]',
  secondary:
    'bg-loyalty-jungle text-white hover:bg-loyalty-jungle-muted focus-visible:outline-loyalty-jungle active:scale-[0.97] dark:bg-loyalty-fresh-soft dark:text-loyalty-jungle dark:hover:bg-white',
  ghost:
    'bg-transparent text-loyalty-jungle hover:bg-loyalty-fresh-soft/60 focus-visible:outline-loyalty-cool-gray active:scale-[0.98] dark:text-slate-200 dark:hover:bg-loyalty-jungle-muted/50',
}

export function Button({
  children,
  className = '',
  isLoading = false,
  type = 'button',
  variant = 'primary',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-[transform,background-color,box-shadow,color] duration-loyalty ease-loyalty-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${className}`}
      disabled={props.disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Procesando...' : children}
    </button>
  )
}
