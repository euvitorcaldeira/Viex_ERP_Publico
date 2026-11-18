import './brand.css';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'viex-brand viex-brand-compact' : 'viex-brand'} aria-label="VIEX ERP">
    <img src="/brand/viex-icon.svg" width={40} height={40} alt="" />
    {!compact && <div className="viex-wordmark"><strong>VIEX</strong><span>ERP</span></div>}
  </div>;
}
