import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export default function AppButton({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button className={`app-btn ${variant} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
