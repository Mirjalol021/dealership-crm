import type { SVGProps } from 'react';

// Minimal inline SVG icon set (stroke-based). 24×24 viewBox, inherits currentColor.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Dashboard: (p: IconProps) => (
    <Base {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="10" width="7" height="11" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></Base>
  ),
  Leads: (p: IconProps) => (
    <Base {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Base>
  ),
  Pool: (p: IconProps) => (
    <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>
  ),
  Today: (p: IconProps) => (
    <Base {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 16l2 2 4-4" /></Base>
  ),
  Kanban: (p: IconProps) => (
    <Base {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></Base>
  ),
  Calendar: (p: IconProps) => (
    <Base {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Base>
  ),
  Car: (p: IconProps) => (
    <Base {...p}><path d="M5 17h14M3 17l1.5-5.5A2 2 0 0 1 6.4 10h11.2a2 2 0 0 1 1.9 1.5L21 17" /><path d="M4 17v2M20 17v2" /><circle cx="7.5" cy="14" r="0.6" /><circle cx="16.5" cy="14" r="0.6" /></Base>
  ),
  Bookmark: (p: IconProps) => (
    <Base {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></Base>
  ),
  Wrench: (p: IconProps) => (
    <Base {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.7-2.7z" /></Base>
  ),
  Box: (p: IconProps) => (
    <Base {...p}><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></Base>
  ),
  Truck: (p: IconProps) => (
    <Base {...p}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></Base>
  ),
  Coin: (p: IconProps) => (
    <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4.5" /></Base>
  ),
  Receipt: (p: IconProps) => (
    <Base {...p}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></Base>
  ),
  Chart: (p: IconProps) => (
    <Base {...p}><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></Base>
  ),
  Users: (p: IconProps) => (
    <Base {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></Base>
  ),
  Settings: (p: IconProps) => (
    <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Base>
  ),
  Upload: (p: IconProps) => (
    <Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></Base>
  ),
  Form: (p: IconProps) => (
    <Base {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Base>
  ),
  Bell: (p: IconProps) => (
    <Base {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Base>
  ),
  Logout: (p: IconProps) => (
    <Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Base>
  ),
  Chevron: (p: IconProps) => (
    <Base {...p}><path d="M6 9l6 6 6-6" /></Base>
  ),
  Search: (p: IconProps) => (
    <Base {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Base>
  ),
  Spark: (p: IconProps) => (
    <Base {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></Base>
  ),
  TrendUp: (p: IconProps) => (
    <Base {...p}><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></Base>
  ),
  TrendDown: (p: IconProps) => (
    <Base {...p}><path d="M23 18l-9.5-9.5-5 5L1 6" /><path d="M17 18h6v-6" /></Base>
  ),
};

export type IconName = keyof typeof Icon;
