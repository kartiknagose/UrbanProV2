# PHASE 2: DESIGN SYSTEM FINALIZATION
**Status:** Complete & Locked  
**Version:** 2.0  
**Date:** March 23, 2026

---

## 1. COLOR SYSTEM (Modern SaaS)

### Primary Brand Palette
```
Brand (Electric Blue) - Core identity
├─ 50:  #eff6ff   (lightest, backgrounds)
├─ 100: #dbeafe   
├─ 200: #bfdbfe   
├─ 300: #93c5fd   
├─ 400: #60a5fa   (lighter variant)
├─ 500: #3b82f6   ★ PRIMARY (use for CTAs, links)
├─ 600: #2563eb   (dark/hover)
├─ 700: #1d4ed8   (darker hover)
├─ 800: #1e40af   
├─ 900: #1e3a8a   
├─ 950: #172554   (darkest)
```

**Use case:** Primary actions, links, focus states, highlights

### Accent Palette  
```
Accent (Vivid Violet/Fuchsia) - Secondary identity
├─ 500: #d946ef   ★ ACCENT (use for special highlights, secondary actions)
├─ 600: #c026d3   (dark/hover)
├─ 700: #a21caf   (darker hover)
```

**Use case:** Secondary CTAs, special badges, accents

### Semantic Colors
```
Success (Emerald Green)
├─ 50:  #f0fdf4
├─ 500: #22c55e   ★ for positive actions, confirmations
├─ 600: #16a34a   (hover)

Warning (Amber/Orange)
├─ 50:  #fffbeb
├─ 500: #f59e0b   ★ for cautions, pending states
├─ 600: #d97706   (hover)

Error (Red)
├─ 50:  #fff1f2
├─ 500: #ef4444   ★ for errors, destructive actions
├─ 600: #dc2626   (hover)

Info (Sky Blue)
├─ 50:  #f0f9ff
├─ 500: #0ea5e9   ★ for informational messages
├─ 600: #0284c7   (hover)
```

### Neutral/Gray Scale
```
Neutral (Surface/Typography)
├─ 50:  #f8fafc   (lightest bg)
├─ 100: #f1f5f9
├─ 200: #e2e8f0   (borders, dividers)
├─ 300: #cbd5e1
├─ 400: #94a3b8   (secondary text)
├─ 500: #64748b   (tertiary text)
├─ 600: #475569   (labels)
├─ 700: #334155   (primary text)
├─ 800: #1e293b   (headings)
├─ 900: #0f172a   (darkest content)

Dark Mode (Dark Surfaces)
├─ 50:  #f8fafc   (doesn't apply in dark)
├─ 800: #1e293b   ★ primary bg
├─ 900: #0f172a   ★ secondary bg
├─ 950: #020617   ★ tertiary (dark cards)
```

### Semantic Color Usage Matrix

| Element | Light Mode | Dark Mode | Hover |
|---------|-----------|----------|-------|
| Primary Button | brand-500 | brand-500 | brand-600 |
| Primary Button Hover | brand-600 | brand-600 | brand-700 |
| Secondary Button | neutral-100 | dark-700 | neutral-200 |
| Link Text | brand-600 | brand-400 | brand-700 |
| Success Alert | success-50 BG + success-600 text | success-500/10 BG + success-400 text | — |
| Error Alert | error-50 BG + error-600 text | error-500/10 BG + error-400 text | — |
| Borders (default) | neutral-200 | dark-700/white-5 | brand-300 |
| Text Primary | neutral-900 | white | — |
| Text Secondary | neutral-600 | neutral-400 | — |
| Text Tertiary | neutral-500 | neutral-500 | — |

---

## 2. TYPOGRAPHY

### Font Stack
```css
font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Scale & Hierarchy

#### Headings
```
H1 (Page Title)
├─ Size: 32px (2rem)
├─ Weight: 700 (bold)
├─ Letter Spacing: -0.02em
├─ Line Height: 1.2
├─ Usage: Page titles, hero section

H2 (Section Title)
├─ Size: 24px (1.5rem)
├─ Weight: 600 (semibold)
├─ Letter Spacing: -0.01em
├─ Line Height: 1.3
├─ Usage: Major sections on page

H3 (Component Title)
├─ Size: 20px (1.25rem)
├─ Weight: 600 (semibold)
├─ Letter Spacing: 0
├─ Line Height: 1.3
├─ Usage: Card titles, modal headers

H4 (Sub-heading)
├─ Size: 16px (1rem)
├─ Weight: 600 (semibold)
├─ Line Height: 1.4
├─ Usage: Form labels, subsections

H5
├─ Size: 14px (0.875rem)
├─ Weight: 600 (semibold)
├─ Line Height: 1.4
├─ Usage: Table headers, badges
```

#### Body Text
```
Large Body (16px / 1rem)
├─ Weight: 400 (regular)
├─ Line Height: 1.5
├─ Usage: Primary content, paragraphs

Standard Body (14px / 0.875rem) ★ DEFAULT
├─ Weight: 400 (regular)
├─ Line Height: 1.5
├─ Usage: Most UI labels, descriptions, hints

Small Body (12px / 0.75rem)
├─ Weight: 400 (regular)
├─ Line Height: 1.4
├─ Usage: Helper text, timestamps, metadata

X-Small (11px / 0.6875rem)
├─ Weight: 500 (medium)
├─ Line Height: 1.2
├─ Usage: Badges, tags, tiny labels
```

### Font Weight Distribution
```
100: Thin     (NOT USED)
300: Light    (NOT USED)
400: Regular  ★ Primary (bodies, descriptions)
500: Medium   (NOT USED - USE 600 INSTEAD)
600: Semibold ★ Secondary (labels, H4, some UI)
700: Bold     ★ Tertiary (H1, emphasis)
800: ExtraBold (NOT USED)
900: Black    (NOT USED)
```

---

## 3. SPACING SYSTEM

### Base Unit: 8px Grid

```
Spacing Scale (all in multiples of 8px):

xs:  4px   (0.5 * base)  - Avatar borders, tiny gaps
sm:  8px   (1x base)     ★ padding within compact inputs
md:  16px  (2x base)     ★ standard padding, margins
lg:  24px  (3x base)     ★ sections, card gaps
xl:  32px  (4x base)     - major section gaps
2xl: 48px  (6x base)     - hero spacing, large gaps
3xl: 64px  (8x base)     - full page padding spacing

Tailwind class mapping (current config uses these):
- px-3/py-3    = 0.75rem (12px)
- px-4/py-4    = 1rem (16px)
- px-6/py-6    = 1.5rem (24px)
- px-8/py-8    = 2rem (32px)
- gap-2        = 0.5rem (8px)
- gap-3        = 0.75rem (12px)
- gap-4        = 1rem (16px)
- gap-6        = 1.5rem (24px)
```

### Spacing Rules by Component

```
Cards/Containers
├─ Padding: 24px (p-6)
└─ Gap between cards: 16px (gap-4)

Form Fields
├─ Label to input: 8px
├─ Input height: 48px (md), 40px (sm), 56px (lg)
├─ Input padding: 12-16px horizontal
└─ Gap between fields: 20px (2.5rem custom)

Section Spacing
├─ Between major sections: 48px (3xl)
├─ Navbar height: 64px
├─ Sidebar width: 256px (expanded), 72px (collapsed)
└─ Page padding: 24px (md), 32px (xl) on desktop

Button Spacing
├─ Icon + text gap: 8px (gap-2)
├─ Button padding: 10-14px vertical, 16-24px horizontal
└─ Group gap: 12px (gap-3)

List Items
├─ Vertical gap: 12px (gap-3)
├─ Padding per item: 12px (p-3)
└─ Divider: 1px neutral-200
```

---

## 4. COMPONENT SYSTEM SPEC

### Resolution: Don't redesign existing components
**Use existing Button, Input, Card, Badge, Modal as baseline.**
**Refinements only where necessary.**

#### Button Component Spec
```jsx
// Location: /components/ui/Button.jsx (existing ✅)

Variants:
├─ primary    → brand-500 (solid blue)
├─ secondary  → neutral-100 (gray background)
├─ outline    → brand-500 with transparent bg
├─ ghost      → transparent (hover: light bg)
├─ danger     → error-500 (red)
├─ success    → success-500 (green)
└─ gradient   → brand-500 to accent-500 animated

Sizes:
├─ sm     → 32px height, 14px font
├─ md     → 40px height, 14px font ★ DEFAULT
├─ lg     → 48px height, 16px font
└─ xl     → 56px height, 16px font

Props:
├─ icon: Icon component (left/right)
├─ loading: boolean (shows spinner)
├─ disabled: boolean
├─ fullWidth: boolean
└─ type: 'button' | 'submit' | 'reset'

States:
├─ Default: Full color
├─ Hover: Darker shade + enhanced shadow
├─ Focus: Ring outline (ring-brand-500)
├─ Disabled: opacity-50
├─ Loading: Spinner overlay, disabled
└─ Active: Pressed appearance
```

#### Input Component Spec
```jsx
// Location: /components/ui/Input.jsx (existing ✅)

Features:
├─ Floating labels (label animates on focus)
├─ Left icon slot
├─ Right element slot (clear button, validation icon)
├─ Error state (red border, error icon, error text)
├─ Success state (green border, checkmark icon)
├─ Hint text (helper text below)
├─ Required indicator (red asterisk)
└─ Disabled state (grayed out)

Sizes:
├─ compact → 48px height
└─ default → 64px height ★ MAIN

Focus Behavior:
├─ Glow effect (shadow-lg shadow-brand-500/20)
├─ Icon color change (neutral-400 → brand-500)
├─ Label scales/animates
└─ Ring-4 ring-brand-500/20
```

#### Card Component Spec
```jsx
// Location: /components/ui/Card.jsx (existing ✅)

Structure:
├─ Card (wrapper)
├─ CardHeader (optional heading area)
├─ CardTitle (h3 inside header)
├─ CardDescription (small text in header)
└─ CardFooter (optional footer)

Styling:
├─ Padding: 24px (p-6)
├─ Background: white (light) / dark-800 (dark)
├─ Border: 1px neutral-200 (light) / dark-700 (dark)
├─ Border radius: 12px (rounded-xl)
├─ Shadow: 0 1px 3px rgba(0,0,0,0.1)
├─ Hover shadow: 0 10px 15px rgba(0,0,0,0.1)
└─ Dark mode: Invert colors with subtle border

Variants (via props):
├─ hoverable: shadow-md on hover
├─ elevated: shadow-lg always
└─ flat: no shadow, light border
```

#### Badge Component Spec
```jsx
// Location: /components/ui/Badge.jsx (existing ✅)

Variants (semantic):
├─ default   → neutral-100 / neutral-800 text
├─ primary   → brand-100 / brand-700 text
├─ success   → success-100 / success-700 text
├─ warning   → warning-100 / warning-700 text
├─ error    → error-100 / error-700 text
└─ accent   → accent-100 / accent-700 text

Sizes:
├─ sm  → 12px, rounded-md
├─ md  → 14px, rounded-lg ★ DEFAULT
└─ lg  → 16px, rounded-xl

Features:
├─ Icon support (left side)
├─ Dismissible (close button)
└─ Animated (pulse option)
```

#### Modal Component Spec
```jsx
// Location: /components/ui/Modal.jsx (existing ✅)

Structure:
├─ Overlay (dark semi-transparent)
├─ Modal panel (centered, max-w-md/lg/2xl)
├─ Header (title + close icon)
├─ Body (content area)
└─ Footer (actions, usually buttons)

Sizing:
├─ sm        → max-w-sm (384px)
├─ md        → max-w-md (448px) ★ DEFAULT
├─ lg        → max-w-lg (512px)
└─ 2xl       → max-w-2xl (672px)

Animations:
├─ Overlay: fade-in/out
├─ Modal: scale-up + fade-in from center
└─ Duration: 200ms
```

#### Skeleton Component Spec
```jsx
// Location: /components/ui/Skeleton.jsx (existing ✅)

Variants:
├─ Default (w-full h-12 rounded)
├─ Text (h-4, full width)
├─ Circle (w-12 h-12 rounded-full)
├─ BookingCardSkeleton (full card)
├─ StatGridSkeleton (2-3 stat placeholders)
└─ ListItemSkeleton (repeated list item)

Animation:
├─ Pulse effect (opacity animation)
├─ Duration: 1.5s infinite
└─ Color: neutral-200 base / neutral-300 on hover
```

---

## 5. ELEVATION SYSTEM (Shadows)

### Shadow Specifications
```
Elevation 0 (Flat - default surfaces)
- box-shadow: none
- Use for: Main backgrounds, disabled states

Elevation 1 (Subtle - cards, inputs)
- box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)
- Use for: Cards, input focus, badges

Elevation 2 (Cards with hover)
- box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
- Use for: Card hover, button hover

Elevation 3 (Modals, overlays)
- box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
- Use for: Modals, dropdowns when visible

Elevation 4 (Floating elements)
- box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)
- Use for: Floating action buttons, sticky elements

Glow/Colored Shadows (interactive)
- Button primary: shadow-[0_4px_14px_0_rgba(59,130,246,0.35)]
- Error: shadow-[0_4px_14px_0_rgba(239,68,68,0.30)]
- Success: shadow-[0_4px_14px_0_rgba(34,197,94,0.30)]
```

### Dark Mode Shadow Adjustment
```
Light Mode: rgba(0, 0, 0, 0.10)
Dark Mode:  rgba(0, 0, 0, 0.40) (stronger for contrast)
```

---

## 6. BORDER SYSTEM

### Radius System
```
Rounded (border-radius):
├─ xs  → 4px  (rounded-sm) - small buttons, tags
├─ sm  → 6px  (rounded) - edges only
├─ md  → 8px  (rounded-lg) - input fields, badges
├─ lg  → 12px (rounded-xl) - cards, modals
└─ xl  → 16px (rounded-2xl) - hero sections, large cards

Default rule:
├─ Buttons: rounded-lg (8px)
├─ Cards: rounded-xl (12px)
├─ Inputs: rounded-2xl (16-20px) - more rounded on focus
├─ Modals: rounded-2xl (16px)
└─ Images: rounded-xl or rounded-2xl
```

### Border Color System
```
Neutral Borders (default)
├─ Light mode: border-neutral-200 (#e2e8f0)
├─ Dark mode: border-dark-700 or border-white/5

Colored Borders (interactive)
├─ Brand: border-brand-300 (focus states)
├─ Error: border-error-500
├─ Success: border-success-500
├─ Warning: border-warning-500

Border Width:
├─ Subtle: border (1px)
├─ Medium: border-2 (2px, used on focus)
└─ Heavy: border-4 (4px, rarely used)
```

---

## 7. STATE PATTERNS (CRITICAL)

### Loading State Pattern
```
Visual Pattern:
├─ Skeleton placeholder (preferred for cards/lists)
├─ Spinner overlay (for buttons/modals)
├─ Disabled state (input fields during fetch)
└─ Progress bar (for long operations)

Duration: 300-500ms minimum (if faster, hide spinner)

Component Pattern:
<div>
  {isLoading ? <Skeleton /> : <Content />}
</div>
```

### Error State Pattern
```
Visual Pattern:
├─ Error border on input (ring-error-500/20)
├─ Red icon (AlertCircle)
├─ Error text below field (text-error-600, 12px)
├─ Optional: Full page error banner

Error Banner:
├─ Background: error-50 (light) / error-500/10 (dark)
├─ Border: border-error-200 / border-error-500/30
├─ Icon: AlertCircle (error-600/400)
├─ Text: error-700/400
├─ Padding: p-4
└─ Border-radius: rounded-xl
```

### Empty State Pattern
```
Visual Pattern:
├─ Icon: Large lucide icon (64px, neutral-300)
├─ Title: "No results" (16px semibold)
├─ Description: "Try searching for..." (14px regular, neutral-500)
├─ Optional: CTA button

Component Location:
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Icon size={64} className="text-neutral-300 mb-4" />
  <h3 className="text-lg font-semibold mb-2">No items</h3>
  <p className="text-sm text-neutral-500 mb-6">Try adjusting your filters</p>
  <Button>Go back</Button>
</div>
```

### Success State Pattern
```
Visual Pattern:
├─ Toast (primary feedback)
├─ Checkmark icon (inline confirmation)
├─ Green accent color
├─ Optional: Success banner

Component Pattern (inline):
<div className="flex items-center gap-2 text-success-600">
  <CheckCircle size={16} />
  <span>Successfully updated!</span>
</div>
```

### Disabled State Pattern
```
Visual Rules:
├─ Opacity: opacity-50
├─ Cursor: cursor-not-allowed
├─ Color: grayed out (neutral-400)
├─ No hover effects
└─ No focus ring
```

---

## 8. INTERACTION & ANIMATION SPEC

### Transition Durations
```
Micro (instant feedback):
├─ 75ms   - icon color changes, text highlight
├─ 100ms  - small element fades
└─ 150ms  ★ STANDARD (button hover, input focus)

Regular (noticeable but not slow):
├─ 200ms  - modal/menu slide-in, form transition
├─ 250ms  - page transitions, significant layouts
└─ 300ms  ★ COMMON (list reordering, page changes)

Slow (emphasis, storytelling):
├─ 500ms  - hero animations, entrance of major elements
├─ 750ms  - cascading item animations
└─ 1000ms - background animations, parallax
```

### Easing Functions
```
Ease Functions (via Framer Motion):
├─ easeOut          → quick start, slow end (exit animations)
├─ easeInOut        → slow, slow (motion with rhythm)
├─ [0.16, 1, 0.3, 1] ★ CUSTOM SPRING (landing page elements)
└─ linear (NOT USED - feels robotic)

Button Hover:
- Use: transition-all duration-200
- Not: 500ms or slow animations

Input Focus:
- Use: transition duration-300
- Effect: Scale 1 → 1.01 (subtle), color change
```

### Animation Rules
```
✅ DO:
- Hover over buttons → color/shadow change (150ms)
- Load content → skeleton fade to content (300ms)
- Modal open → scale-up from center (200ms)
- List item add → slide-in from top (300ms)

❌ DON'T:
- Bounce animations (too playful for SaaS)
- Rotation/flip animations (confusing)
- Multiple simultaneous animations (overwhelming)
- Animations > 500ms on UI actions (feels slow)
```

---

## 9. ICON SYSTEM & USAGE

### Icon Library
```
Primary: lucide-react (140+ professional icons)
├─ Already imported throughout project ✅
├─ Consistent sizing: 16px (default), 20px (headings), 24px (hero)
└─ Consistent stroke-width: 2-2.5px

Icon Sizing Rules:
├─ Tiny (12px): badges, inline status
├─ Small (16px): form labels, list items, button icons
├─ Medium (20px): card headers, navigation
├─ Large (24px): hero icons, section headers
├─ XL (32px): empty states, illustrations
└─ XXL (64px): full empty state displays
```

### Icon Color Rules
```
Icon Colors:
├─ Default: neutral-400 / neutral-500 (secondary)
├─ Active: brand-500 (brand color)
├─ Error: error-500 (red)
├─ Success: success-500 (green)
├─ Warning: warning-500 (amber)
└─ Disabled: opacity-50 neutral-300

Icon Opacity:
├─ Full: 1.0 (always visible icons)
├─ Focus: 1.0 (interactive icons)
├─ Hover: 1.0 (maintain visibility on hover)
└─ Disabled: 0.5
```

---

## 10. RESPONSIVE BREAKPOINTS

### Tailwind Breakpoints (existing)
```
Mobile-first strategy:
├─ base (0px)     → mobile
├─ sm (640px)     → small tablet
├─ md (768px)     → tablet
├─ lg (1024px)    → desktop
├─ xl (1280px)    → large desktop
└─ 2xl (1536px)   → ultra-wide

Sidebar Breakpoints:
├─ < lg: hidden by default, drawer-based
├─ ≥ lg: visible, 256px wide
└─ lg + collapsed: 72px wide

Grid Patterns:
├─ Mobile (base): 1 column
├─ Tablet (md): 2 columns
├─ Desktop (lg): 3-4 columns
└─ Large (xl): 4-5 columns

Container Queries (advanced):
├─ Use for card-in-grid responsiveness
└─ Future enhancement (not Phase 2)
```

---

## 11. ACCESSIBILITY BASELINE

### WCAG 2.1 Level AA Compliance Target

```
Color Contrast:
├─ Normal text: 4.5:1 (brand-600 on white ✅)
├─ Large text: 3:1 (18px+ or 14px bold)
├─ Graphics: 3:1
└─ Disabled: 3:1 (use border if < 3:1)

Focus Management:
├─ Focus ring: ring-brand-500 (2px visible ring)
├─ Focus rect: rounded, 4px offset
├─ Tab order: logical flow
└─ Skip links: available (existing ✅)

ARIA Labels:
├─ Buttons: use aria-label for icon-only buttons
├─ Forms: use htmlFor on labels + aria-required
├─ Status: aria-live for dynamic content
└─ Modals: aria-modal="true", aria-labelledby
```

---

## 12. DARK MODE SPEC

### Dark Mode Colors (Dark 950 Base)
```
Dark Mode Overrides:
├─ Background: #020617 or #0f172a (dark-950/900)
├─ Surface: #1e293b (dark-800)
├─ Secondary: #334155 (dark-700)
├─ Border: rgba(255, 255, 255, 0.05) OR dark-700
├─ Text primary: white
├─ Text secondary: neutral-400
└─ Text tertiary: neutral-500

Brand colors (same across modes):
├─ brand-500: #3b82f6 (slightly lighter in dark)
├─ accent-500: #d946ef (same)
├─ success-500: #22c55e (same)
└─ error-500: #ef4444 (same)

Images in Dark Mode:
├─ Hero gradients: Slightly darker overlays
├─ Service images: opacity-90 or subtle dark overlay
├─ Icons: Use invert or brightness filter if needed
└─ Logos: Ensure white variant exists
```

---

## 13. DESIGN SYSTEM STATUS CHECKLIST

| Component | Status | Notes |
|-----------|--------|-------|
| Color System | ✅ FINALIZED | Brand + semantic defined |
| Typography | ✅ FINALIZED | Scale, weights, usage locked |
| Spacing | ✅ FINALIZED | 8px grid, rules per component |
| Shadows | ✅ FINALIZED | 5 elevation levels |
| Border | ✅ FINALIZED | Radius + color rules |
| Button | ✅ EXISTING | Variants solid, refine only |
| Input | ✅ EXISTING | Floating labels, states good |
| Card | ✅ EXISTING | Use as baseline |
| Badge | ✅ EXISTING | Semantic variants |
| Modal | ✅ EXISTING | Dimensions, animations |
| Skeleton | ✅ EXISTING | Pulse animation |
| State Patterns | ✅ DESIGNED | Loading/error/empty/success |
| Animation | ✅ FINALIZED | Duration + easing rules |
| Icons | ✅ FINALIZED | lucide-react 16-24px |
| Responsive | ✅ FINALIZED | Mobile-first breakpoints |
| Accessibility | ✅ TARGET | WCAG 2.1 AA goal |
| Dark Mode | ✅ FINALIZED | Color mapping |

---

## PHASE 2 CONCLUSION

**Status:** Design System **LOCKED & FINALIZED** ✅

All visual decisions documented. Ready for Phase 3 (Architecture) → Phase 4 (Component Creation) → Phase 5+ (Implementation).

**No more design decisions needed** — only consistent application.
