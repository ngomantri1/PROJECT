type BrandMarkProps = {
  className?: string;
  title?: string;
};

export default function BrandMark({ className, title = 'Thang máy Miền Trung' }: BrandMarkProps) {
  return (
    <span className={className ?? 'brand-logo'} aria-label={title} role='img'>
      <svg viewBox='0 0 64 64' focusable='false' aria-hidden='true'>
        <circle cx='32' cy='32' r='25' fill='none' stroke='currentColor' strokeWidth='3.5' />
        <path
          d='M32 15v18M24 23l8-8 8 8'
          fill='none'
          stroke='currentColor'
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='3.5'
        />
        <path
          d='M32 49V31M24 41l8 8 8-8'
          fill='none'
          stroke='currentColor'
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='3.5'
        />
        <path
          d='M21 29h22M21 35h22'
          fill='none'
          stroke='currentColor'
          strokeLinecap='round'
          strokeWidth='3.5'
        />
      </svg>
    </span>
  );
}
