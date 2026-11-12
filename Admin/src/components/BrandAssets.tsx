import React from 'react';

export function DocScanLogo({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const strokeColor = light ? '#FFFFFF' : '#1D63DC';
  const accentColor = light ? '#93C5FD' : '#0EA5E9';

  return (
    <svg viewBox="0 0 48 48" fill="none" className={iconSize} aria-hidden="true">
      <path
        d="M14 36h21a8 8 0 0 0 1.4-15.87A11 11 0 0 0 15.2 17.5 8.5 8.5 0 0 0 14 36Z"
        stroke={strokeColor}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="18" y="18" width="12" height="14" rx="2" fill={light ? 'rgba(255,255,255,0.16)' : '#EFF6FF'} stroke={strokeColor} strokeWidth="2" />
      <path d="M21 23h6M21 27h4" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function WelcomeBannerIllustration() {
  return (
    <svg viewBox="0 0 280 130" fill="none" className="w-64 h-28 shrink-0" aria-hidden="true">
      <path
        d="M0 112 C50 75, 110 120, 175 88 C220 65, 250 92, 280 76 L280 130 L0 130 Z"
        fill="url(#waveBlue)"
        opacity="0.9"
      />
      <path
        d="M145 130 C190 95, 235 112, 280 86 L280 130 Z"
        fill="url(#waveAmber)"
        opacity="0.9"
      />
      {/* Back documents */}
      <rect x="115" y="18" width="44" height="54" rx="6" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1.5" transform="rotate(-8 115 18)" />
      <rect x="148" y="22" width="44" height="54" rx="6" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1.5" transform="rotate(6 148 22)" />
      <path d="M158 38h20M158 46h16M158 54h12" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
      {/* Folder */}
      <path d="M108 58c0-4 3-7 7-7h18l6 6h36c4 0 7 3 7 7v24c0 4-3 7-7 7h-60c-4 0-7-3-7-7V58Z" fill="#DCEAFE" stroke="#60A5FA" strokeWidth="1.5" />
      {/* Cloud upload badge */}
      <path
        d="M196 86h46a14 14 0 0 0 2.5-27.78A19 19 0 0 0 207.8 53.6 15 15 0 0 0 196 86Z"
        fill="#1D63DC"
      />
      <circle cx="220" cy="68" r="11" fill="#FFFFFF" />
      <path d="M220 73V63m0 0-4 4m4-4 4 4" stroke="#1D63DC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="waveBlue" x1="0" y1="70" x2="280" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="waveAmber" x1="150" y1="90" x2="280" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#FBBF24" />
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
