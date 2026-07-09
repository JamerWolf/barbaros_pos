---
name: color-system
description: "Trigger: colors, color palette, theme, styling, UI colors, background, text color, button color. Standardized color palette for Bárbaro's POS."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Color System — Bárbaro's POS

## Activation Contract

Use this skill when:
- Creating or modifying UI components
- Choosing colors for new elements
- Refactoring hardcoded color values
- Reviewing PRs for color consistency

## Hard Rules

- NEVER use hardcoded hex values outside `colors.ts`
- NEVER use Tailwind gray/blue/green/red utilities — use the palette below
- Import from `utils/colors.ts` when using colors in logic
- Use Tailwind arbitrary values (`bg-[#hex]`) for JSX class strings

## Color Palette

### Backgrounds
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| bg | `#0A0A0A` | `bg-[#0A0A0A]` | Page background, canvas |
| bgCard | `#141414` | `bg-[#141414]` | Cards, inputs, panels |
| bgHover | `#1E1E1E` | `bg-[#1E1E1E]` | Hover states, active inputs |

### Primary (Gold)
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| primary | `#C8A84E` | `bg-[#C8A84E]` | Primary buttons, active states, accents |
| primary text | `#0A0A0A` | `text-[#0A0A0A]` | Text ON gold backgrounds |

### Text
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| text | `#E8E0D0` | `text-[#E8E0D0]` | Main text on dark backgrounds |
| textMuted | `#7A7060` | `text-[#7A7060]` | Labels, placeholders, secondary text |

### Semantic
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| success | `#7CCD7C` | `text-[#7CCD7C]` | Positive amounts, success text |
| successBg | `#2D5A27` | `bg-[#2D5A27]` | Success buttons (open shift) |
| error | `#E85050` | `text-[#E85050]` | Errors, pending amounts, delete |
| errorBg | `#5C1A1A` | `bg-[#5C1A1A]` | Error buttons, danger zones |

### Borders
| Token | Tailwind | Use |
|-------|----------|-----|
| border | `border-[#C8A84E]/20` | Default borders on dark bg |
| borderActive | `border-[#C8A84E]/30` | Active/focus borders |

## Button Standard

All buttons follow this pattern:
```
bg-[#C8A84E] text-[#0A0A0A] active:bg-[#C8A84E]/80   → Primary (gold)
bg-[#141414] text-[#E8E0D0] active:bg-[#1E1E1E]       → Secondary (dark)
bg-[#5C1A1A] text-[#E85050] active:bg-[#5C1A1A]/80    → Danger (red)
bg-[#2D5A27] text-[#7CCD7C] active:bg-[#2D5A27]/80    → Success (green)
```

## Input Standard

```
bg-[#1E1E1E] text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]
```

## Card Standard

```
bg-[#141414] border border-[#C8A84E]/20 rounded-xl
```

## References

- `apps/web/src/utils/colors.ts` — centralized palette constants
- `AGENTS.md` — project conventions
