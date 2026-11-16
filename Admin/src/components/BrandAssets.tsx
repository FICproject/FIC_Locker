import React, { useState } from 'react';

export interface FicLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'badge' | 'mark' | 'full';
  light?: boolean;
  className?: string;
  showText?: boolean;
}

/**
 * Geometric vector emblem of Forge India Connect (FIC):
 * - Blue outer corner bracket (#0047BA)
 * - Golden yellow box with elephant silhouette (#F7BA1E)
 * - Golden yellow base triangle / pyramid (#F7BA1E)
 */
export function FicEmblem({
  size = 'md',
  light = false,
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
  className?: string;
}) {
  const dim =
    size === 'xs'
      ? 'w-6 h-6'
      : size === 'sm'
      ? 'w-8 h-8'
      : size === 'lg'
      ? 'w-12 h-12'
      : size === 'xl'
      ? 'w-16 h-16'
      : 'w-10 h-10';

  const blueFill = light ? '#FFFFFF' : '#0047BA';
  const goldFill = '#F7BA1E';

  return (
    <svg viewBox="0 0 100 100" fill="none" className={`${dim} ${className}`} aria-label="Forge India Connect Logo">
      {/* Outer L bracket */}
      <path
        d="M 24 20 L 74 20 L 66 30 L 36 30 L 36 78 L 24 78 Z"
        fill={blueFill}
      />
      {/* Yellow box in top-right */}
      <rect x="44" y="34" width="28" height="19" rx="3.5" fill={goldFill} />
      {/* Blue elephant silhouette inside the yellow box */}
      <path
        d="M 64.5 45.2 c -0.6 -1.6 -1.9 -2.5 -3.6 -2.5 c -1.2 0 -2.3 0.6 -2.8 1.5 c -0.6 -0.3 -1.4 -0.5 -2.2 -0.5 c -1.8 0 -3.3 1.2 -3.6 2.8 c -0.4 0.2 -0.9 0.6 -0.9 1.4 l 0 4.2 l 2.2 0 l 0 -2.5 c 0.5 0 1.2 0 1.8 0 l 0 2.5 l 2 0 l 0 -2.5 c 0.6 0 1.2 0 1.8 0 l 0 2.5 l 2 0 l 0 -2.8 c 0.8 0 1.5 -0.5 1.8 -1.2 c 0.8 0.4 1.5 0.8 2 1.5 l 1.4 -1 c -0.7 -0.9 -1.4 -1.4 -2 -1.8 c 0.5 -0.6 0.8 -1.2 0.8 -1.9 c 0 -0.8 -0.4 -1.5 -0.8 -1.8 l -0.8 0.8 c 0.3 0.3 0.4 0.6 0.4 1 c 0 0.8 -0.6 1.4 -1.4 1.4 c -0.3 0 -0.6 -0.1 -0.8 -0.3 Z"
        fill={light ? '#FFFFFF' : '#0047BA'}
      />
      {/* Golden yellow pyramid at base */}
      <polygon points="32,78 76,78 54,52" fill={goldFill} />
    </svg>
  );
}

/**
 * High-fidelity logo badge from the uploaded brand design.
 * Tries the high-res image /fic-logo.jpg first, falls back smoothly to vector badge.
 */
export function FicLogoBadge({
  size = 'md',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const dim =
    size === 'xs'
      ? 'w-8 h-8'
      : size === 'sm'
      ? 'w-10 h-10'
      : size === 'lg'
      ? 'w-16 h-16'
      : size === 'xl'
      ? 'w-24 h-24'
      : size === '2xl'
      ? 'w-32 h-32'
      : 'w-12 h-12';

  if (!imgFailed) {
    return (
      <img
        src="/fic-logo.jpg"
        alt="Forge India Connect"
        onError={() => setImgFailed(true)}
        className={`${dim} rounded-full object-cover shadow-lg border-2 border-white/80 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-[#FFC72C] flex items-center justify-center p-1.5 shadow-lg shrink-0 ${className}`}
    >
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-1 shadow-inner">
        <FicEmblem size={size === '2xl' ? 'xl' : size === 'xl' ? 'lg' : 'md'} />
      </div>
    </div>
  );
}

/**
 * Wordmark: "FIC Locker" styled with brand colors (Blue #0047BA and Gold #F7BA1E).
 */
export function FicWordmark({
  light = false,
  className = '',
  size = 'md',
  subtitle = 'Admin Console',
}: {
  light?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}) {
  const textSize =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl';
  const subSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : 'text-[11px]';

  return (
    <div className={`flex flex-col ${className}`}>
      <div className={`font-black tracking-tight leading-tight ${textSize}`}>
        <span className={light ? 'text-white' : 'text-[#0047BA]'}>FIC </span>
        <span className="text-[#F7BA1E]">Locker</span>
      </div>
      {subtitle && (
        <div
          className={`font-semibold tracking-wider uppercase mt-1 ${subSize} ${
            light ? 'text-blue-200' : 'text-[#0047BA]'
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Drop-in replacement for the legacy DocScanLogo so all existing views inherit
 * the Forge India Connect branding.
 */
export function DocScanLogo({
  light = false,
  size = 'md',
}: {
  light?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return <FicEmblem size={size} light={light} />;
}

export function WelcomeBannerIllustration() {
  return (
    <svg viewBox="0 0 280 130" fill="none" className="w-64 h-28 shrink-0" aria-hidden="true">
      <path
        d="M0 112 C50 75, 110 120, 175 88 C220 65, 250 92, 280 76 L280 130 L0 130 Z"
        fill="url(#waveFicBlue)"
        opacity="0.9"
      />
      <path
        d="M145 130 C190 95, 235 112, 280 86 L280 130 Z"
        fill="url(#waveFicGold)"
        opacity="0.9"
      />
      {/* Back documents */}
      <rect x="115" y="18" width="44" height="54" rx="6" fill="#FFFFFF" stroke="#FDE68A" strokeWidth="1.5" transform="rotate(-8 115 18)" />
      <rect x="148" y="22" width="44" height="54" rx="6" fill="#FFFDF5" stroke="#BFDBFE" strokeWidth="1.5" transform="rotate(6 148 22)" />
      <path d="M158 38h20M158 46h16M158 54h12" stroke="#0047BA" strokeWidth="2" strokeLinecap="round" />
      {/* Folder */}
      <path d="M108 58c0-4 3-7 7-7h18l6 6h36c4 0 7 3 7 7v24c0 4-3 7-7 7h-60c-4 0-7-3-7-7V58Z" fill="#EFF6FF" stroke="#0047BA" strokeWidth="1.5" />
      {/* Cloud upload badge */}
      <path
        d="M196 86h46a14 14 0 0 0 2.5-27.78A19 19 0 0 0 207.8 53.6 15 15 0 0 0 196 86Z"
        fill="#0047BA"
      />
      <circle cx="220" cy="68" r="11" fill="#F7BA1E" />
      <path d="M220 73V63m0 0-4 4m4-4 4 4" stroke="#0047BA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="waveFicBlue" x1="0" y1="70" x2="280" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0047BA" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="waveFicGold" x1="150" y1="90" x2="280" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7BA1E" />
          <stop offset="1" stopColor="#FFD233" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SparklineWave({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 90 26" fill="none" className="w-20 h-6" aria-hidden="true">
      <path
        d="M2 22 C16 20, 24 12, 38 15 C52 18, 62 7, 74 9 C81 10, 85 5, 88 3"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function formatRelativeTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
