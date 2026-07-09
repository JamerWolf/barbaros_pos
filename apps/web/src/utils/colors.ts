/** Centralized color palette for Bárbaro's POS */
export const colors = {
  // Backgrounds
  bg: '#0A0A0A',
  bgCard: '#141414',
  bgHover: '#1E1E1E',

  // Primary (gold)
  primary: '#C8A84E',
  primaryHover: '#C8A84ECC', // 80% opacity

  // Text
  text: '#E8E0D0',
  textMuted: '#7A7060',

  // Success
  success: '#7CCD7C',
  successBg: '#2D5A27',

  // Error
  error: '#E85050',
  errorBg: '#5C1A1A',

  // Shape defaults
  shapeDefault: '#C8A84E',
} as const;

/** Tailwind arbitrary value helpers */
export const tw = {
  bg: 'bg-[#0A0A0A]',
  bgCard: 'bg-[#141414]',
  bgHover: 'bg-[#1E1E1E]',
  text: 'text-[#E8E0D0]',
  textMuted: 'text-[#7A7060]',
  primary: 'text-[#C8A84E]',
  primaryBg: 'bg-[#C8A84E]',
  success: 'text-[#7CCD7C]',
  successBg: 'bg-[#2D5A27]',
  error: 'text-[#E85050]',
  errorBg: 'bg-[#5C1A1A]',
} as const;
