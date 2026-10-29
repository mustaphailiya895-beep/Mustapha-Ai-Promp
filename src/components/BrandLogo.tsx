import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  stacked?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  stacked = true
}) => {
  const dimensions = size === 'sm' ? 30 : size === 'lg' ? 42 : 34;

  return (
    <div className="inline-flex items-center gap-2.5 select-none shrink-0">
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#14967F] to-[#0F6E66] text-white shadow-xs shrink-0"
        style={{ width: dimensions, height: dimensions }}
        aria-hidden="true"
      >
        <svg
          width={Math.round(dimensions * 0.68)}
          height={Math.round(dimensions * 0.68)}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.5 24V9.5L16 19L26.5 9.5V24"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="7.5" r="2.3" fill="#A7F3D0" />
          <circle cx="5.5" cy="9.5" r="2.2" fill="currentColor" />
          <circle cx="26.5" cy="9.5" r="2.2" fill="currentColor" />
        </svg>
      </div>
      {showText && (
        stacked ? (
          <div className="flex flex-col leading-none">
            <span
              className={`font-display font-extrabold tracking-tight whitespace-nowrap ${
                size === 'lg'
                  ? 'text-lg'
                  : size === 'sm'
                  ? 'text-[13px]'
                  : 'text-sm'
              }`}
            >
              MUSTAPHA
            </span>
            <span
              className={`font-display font-semibold tracking-[0.16em] text-[#14967F] dark:text-[#2DD4BF] whitespace-nowrap mt-0.5 ${
                size === 'lg'
                  ? 'text-[11px]'
                  : size === 'sm'
                  ? 'text-[9px]'
                  : 'text-[10px]'
              }`}
            >
              AI STUDIO
            </span>
          </div>
        ) : (
          <span
            className={`font-display font-bold tracking-tight whitespace-nowrap ${
              size === 'lg'
                ? 'text-xl'
                : size === 'sm'
                ? 'text-sm'
                : 'text-base'
            }`}
          >
            MUSTAPHA AI STUDIO
          </span>
        )
      )}
    </div>
  );
};
