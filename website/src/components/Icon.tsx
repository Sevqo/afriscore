import type { SVGProps } from 'react';
export type IconName =
  | 'users' | 'box' | 'bag' | 'bolt' | 'bell'
  | 'right'
  | 'left'
  | 'down'
  | 'menu'
  | 'close'
  | 'search'
  | 'user'
  | 'grid'
  | 'chart'
  | 'document'
  | 'payment'
  | 'shield'
  | 'code'
  | 'settings'
  | 'network'
  | 'check'
  | 'external'
  | 'eye'
  | 'eye-off';
const paths: Record<IconName, string> = {
 users:'M16 21v-2a5 5 0 0 0-10 0v2M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 4a4 4 0 0 1 0 7M21 21v-3a5 5 0 0 0-3-4',
 box:'m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5',
 bag:'M4 7h16l1 15H3zM8 8V6a4 4 0 0 1 8 0v2',
 bolt:'m13 2-9 12h7l-1 8 10-13h-7z',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  'eye-off': 'm3 3 18 18M9 5.5A12 12 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3 4M6 6C3 8 2 12 2 12s3 7 10 7c2 0 4-.5 5-1.5M10 10a3 3 0 0 0 4 4',
  right: 'm9 5 7 7-7 7',
  left: 'm15 5-7 7 7 7',
  down: 'm5 9 7 7 7-7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  chart: 'M4 3v17h17M8 15l4-5 4 2 5-7',
  document: 'M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h6',
  payment: 'M3 5h18v14H3zM3 10h18M7 15h3',
  shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  network: 'M12 4v6M5 18l7-8 7 8M9 2h6v5H9zM2 17h6v5H2zM16 17h6v5h-6z',
  check: 'm5 12 4 4L19 6',
  external: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      className="icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
