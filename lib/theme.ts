// StudIA "liquid glass" design tokens. Text contrast never depends on blur: every
// surface has an opaque-enough fill on the near-black canvas (AA targets verified in tests).
export const colors = {
  bg: '#08090D',
  bgTop: '#12111F',
  surface: 'rgba(255,255,255,0.055)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.14)',
  borderStrong: 'rgba(255,255,255,0.24)',
  text: '#F7F7FB',
  muted: '#A3A4B2',
  faint: '#6E6F7D',
  violet: '#5B5DF5',
  violetDeep: '#4148F5',
  lilac: '#B8A7FF',
  selected: 'rgba(100,93,255,0.16)',
  selectedBorder: 'rgba(170,160,255,0.9)',
  mint: '#48E0B1',
  warning: '#F4C45E',
  danger: '#FF7A85',
  dangerFill: 'rgba(255,90,110,0.14)',
} as const;

export const radii = { sm: 12, md: 18, lg: 25, pill: 999 } as const;
export const space = (n: number) => n * 4;

/** Minimum touch target (Apple HIG 44pt / Material 48dp). */
export const TOUCH = 48;

export const gradients = {
  canvas: ['#14132A', '#0B0B14', '#08090D'] as const,
  primary: ['#4148F5', '#6A66FF'] as const,
  orb: ['#F2C27A', '#B58CFF', '#5B5DF5', '#2A2160'] as const,
  progress: ['#5B5DF5', '#B8A7FF', '#FFFFFF'] as const,
};

/** WCAG relative-luminance contrast ratio for #RRGGBB colors. */
export function contrastRatio(fg: string, bg: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
