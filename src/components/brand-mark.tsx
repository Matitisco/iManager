const BRAND = {
  isotipo: '/brand/isotipo.svg',
  horizontal: '/brand/logotipo-horizontal.svg',
  dark: '/brand/logotipo-oscuro.svg',
  tagline: '/brand/logotipo-horizontal-tagline.svg',
} as const;

export function BrandIsotipo({ size = 38, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={BRAND.isotipo}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
    />
  );
}

export function BrandLockup({
  variant,
  className = '',
}: {
  variant: 'horizontal' | 'dark' | 'tagline';
  className?: string;
}) {
  const src = variant === 'dark' ? BRAND.dark : variant === 'tagline' ? BRAND.tagline : BRAND.horizontal;
  const alt = variant === 'tagline' ? 'iManager. Gestión para tiendas de celulares' : 'iManager';
  return <img src={src} alt={alt} draggable={false} className={className} />;
}
