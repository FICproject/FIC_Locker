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
 * - Outer corner L-bracket: #FFFFFF when light=true, #0646A0 when light=false
 * - Golden yellow box with elephant silhouette: #FFC400
 * - Golden yellow base triangle / pyramid: #FFC400
 */
export function FicEmblem({
  size = 'md',
  light = true,
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

  const bracketFill = light ? '#FFFFFF' : '#0646A0';
  const goldFill = '#FFC400';
  const elephantFill = light ? '#073B83' : '#FFFFFF';

  return (
    <svg viewBox="0 0 100 100" fill="none" className={`${dim} ${className}`} aria-label="Forge India Connect Logo">
      {/* Outer L bracket */}
      <path
        d="M 24 20 L 74 20 L 66 30 L 36 30 L 36 78 L 24 78 Z"
        fill={bracketFill}
      />
      {/* Yellow box in top-right */}
      <rect x="44" y="34" width="28" height="19" rx="3.5" fill={goldFill} />
      {/* Elephant silhouette inside the yellow box */}
      <path
        d="M 64.5 45.2 c -0.6 -1.6 -1.9 -2.5 -3.6 -2.5 c -1.2 0 -2.3 0.6 -2.8 1.5 c -0.6 -0.3 -1.4 -0.5 -2.2 -0.5 c -1.8 0 -3.3 1.2 -3.6 2.8 c -0.4 0.2 -0.9 0.6 -0.9 1.4 l 0 4.2 l 2.2 0 l 0 -2.5 c 0.5 0 1.2 0 1.8 0 l 0 2.5 l 2 0 l 0 -2.5 c 0.6 0 1.2 0 1.8 0 l 0 2.5 l 2 0 l 0 -2.8 c 0.8 0 1.5 -0.5 1.8 -1.2 c 0.8 0.4 1.5 0.8 2 1.5 l 1.4 -1 c -0.7 -0.9 -1.4 -1.4 -2 -1.8 c 0.5 -0.6 0.8 -1.2 0.8 -1.9 c 0 -0.8 -0.4 -1.5 -0.8 -1.8 l -0.8 0.8 c 0.3 0.3 0.4 0.6 0.4 1 c 0 0.8 -0.6 1.4 -1.4 1.4 c -0.3 0 -0.6 -0.1 -0.8 -0.3 Z"
        fill={elephantFill}
      />
      {/* Golden yellow pyramid at base */}
      <polygon points="32,78 76,78 54,52" fill={goldFill} />
    </svg>
  );
}

/**
 * High-fidelity logo badge from the uploaded brand design.
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
        className={`${dim} rounded-full object-cover shadow-sm border-2 border-white/80 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-[#FFC400] flex items-center justify-center p-1.5 shadow-sm shrink-0 ${className}`}
    >
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-1">
        <FicEmblem size={size === '2xl' ? 'xl' : size === 'xl' ? 'lg' : 'md'} light={false} />
      </div>
    </div>
  );
}

/**
 * Official circular Forge India Connect brand logo for Sidebar Header.
 * Uses the exact brand badge uploaded by the user.
 */
export function SidebarLogoBadge({ className = '' }: { className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      <div className={`relative flex items-center justify-center p-1 rounded-full bg-white shadow-md border-2 border-white/90 ${className}`}>
        <img
          src="/assets/forge-india-circle-logo.png"
          alt="Forge India Connect"
          onError={() => setImgFailed(true)}
          className="w-16 h-16 rounded-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-16 h-16 rounded-full bg-white border-2 border-white/90 flex items-center justify-center p-2 shadow-md ${className}`}
    >
      <FicEmblem size="lg" light={false} />
    </div>
  );
}

/**
 * Wordmark: "FIC Locker" styled with brand colors.
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
        <span className={light ? 'text-white' : 'text-[#0646A0]'}>FIC </span>
        <span className="text-[#FFC400]">Locker</span>
      </div>
      {subtitle && (
        <div
          className={`font-semibold tracking-wider uppercase mt-1 ${subSize} ${
            light ? 'text-blue-200' : 'text-[#0646A0]'
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function DocScanLogo({
  light = false,
  size = 'md',
}: {
  light?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return <FicEmblem size={size} light={light} />;
}

/**
 * High-definition 3D illustration for Welcome Banner.
 * Uses 2x supersampled artwork with a smooth gradient alpha mask on the left
 * to ensure 100% seamless blending into the white card with zero hard lines.
 */
export function WelcomeBannerIllustration() {
  return (
    <div className="relative w-full h-full min-h-[160px] flex items-center justify-end select-none pointer-events-none overflow-hidden">
      <img
        src="/assets/welcome-banner-hd.jpg"
        alt="Platform Overview"
        className="h-full w-full object-cover object-right"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 100%)',
        }}
      />
    </div>
  );
}

export function SecurityCardIllustration() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-56 sm:w-64 md:w-72 pointer-events-none overflow-hidden select-none flex items-center justify-end">
      {!imgFailed ? (
        <img
          src="/assets/security-card-hd.jpg"
          alt="Platform Security & Reliability"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover object-right"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 100%)',
          }}
        />
      ) : (
        <svg
          viewBox="0 0 240 170"
          fill="none"
          className="w-full h-full object-cover object-right"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="secCardYellow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFD54F" />
              <stop offset="100%" stopColor="#FFB300" />
            </linearGradient>
            <linearGradient id="secCardBlue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0646A0" />
              <stop offset="100%" stopColor="#032D6B" />
            </linearGradient>
            <linearGradient id="shieldFaceGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#EFF6FF" />
            </linearGradient>
            <linearGradient id="shieldBorderGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0852B8" />
              <stop offset="100%" stopColor="#042F6E" />
            </linearGradient>
            <filter id="shieldShadowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#0A2540" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* Dynamic sweeping wave ribbons on the bottom-right corner */}
          <path
            d="M 120 170 C 145 115 180 60 240 30 L 240 170 Z"
            fill="url(#secCardYellow)"
          />
          <path
            d="M 145 170 C 185 135 215 90 240 65 L 240 170 Z"
            fill="url(#secCardBlue)"
          />

          {/* Fully intact prominent 3D Shield with Checkmark */}
          <g transform="translate(62, 42)" filter="url(#shieldShadowFilter)">
            <path
              d="M 32 0 C 20 0 3 6 0 8 C 0 34 10 56 32 70 C 54 56 64 34 64 8 C 61 6 44 0 32 0 Z"
              fill="url(#shieldFaceGrad)"
              stroke="url(#shieldBorderGrad)"
              strokeWidth="3.6"
              strokeLinejoin="round"
            />
            <path
              d="M 19 35 L 29 45 L 46 25"
              fill="none"
              stroke="#0646A0"
              strokeWidth="4.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      )}
    </div>
  );
}

export function SparklineWave({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 90 26" fill="none" className="w-20 h-6 shrink-0" aria-hidden="true">
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
