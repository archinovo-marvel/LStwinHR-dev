# Design System: LStwinHR — Blue White Premium Tech

## 1. Visual Theme & Atmosphere

冷调蓝白科技感。灵感来源: Linear.app 的克制美学 + Vercel 的极简技术感 + Apple Human Interface 的精致触感。大量留白、精确的阴影层次、克制的蓝作为唯一强调色。整体传达: 冷静、精准、高端、有执行力。

**Density:** 4 (Gallery Airy — 大量留白呼吸感)
**Variance:** 6 (Offset Asymmetric — 非对称但可控)
**Motion:** 7 (Fluid CSS — 流畅但克制，非cinematic)

## 2. Color Palette & Roles

| Role | Hex | Name | Usage |
|------|-----|------|-------|
| Canvas | `#F8FAFC` | 冰白 | 主背景 |
| Surface | `#FFFFFF` | 纯白 | 卡片、容器 |
| Ink | `#0F172A` | 深墨蓝 | 主文字 |
| Steel | `#64748B` | 钢铁蓝灰 | 次级文字、描述 |
| Whisper | `#E2E8F0` | 薄雾灰 | 边框、分隔线 |
| Frost | `#F1F5F9` | 霜蓝灰 | Hover态背景、表级 |
| **Accent** | `#2563EB` | 科技蓝 | CTAs、Active态、Focus环 |
| AccentHover | `#1D4ED8` | 深科技蓝 | 按钮悬停 |
| AccentSubtle | `#EFF6FF` | 淡蓝 | Accent背景色 |
| Glow | `rgba(37,99,235,0.08)` | 蓝辉光 | 卡片悬停阴影基色 |

**禁止:** 紫色/青色渐变背景、霓虹外发光、高饱和单一颜色。

## 3. Typography Rules

- **Display:** `Cabinet Grotesk` — Track-tight, controlled scale, weight-driven hierarchy. English headlines only.
- **Chinese Display:** `Noto Serif SC` — 衬线中文, weight 400/500, 用于首页大标题。
- **Body:** `Noto Sans SC` — 中文正文, relaxed leading (1.75), 65ch max line length.
- **Mono:** `JetBrains Mono` — 数字、代码、时间戳。
- **Scale:** `--text-xs: 12px` / `--text-sm: 14px` / `--text-base: 16px` / `--text-lg: 18px` / `--text-xl: 20px` / `--text-2xl: 24px` / `--text-3xl: 30px` / `--text-4xl: 36px` / `--text-5xl: 48px` / `--text-display: clamp(56px, 8vw, 96px)`
- **Banned:** Inter (禁止用于英文Premium上下文), 纯黑 #000000, system-ui 太随意。

## 4. Component Stylings

### Buttons

**Primary Button:**
- Background: `#2563EB`, Color: `#FFFFFF`
- Border-radius: `10px`
- Padding: `12px 24px`
- Font-weight: `500`, letter-spacing: `0.01em`
- **Hover:** Background `#1D4ED8`, translateY(-1px), box-shadow `0 4px 16px rgba(37,99,235,0.25)`
- **Active:** translateY(0), box-shadow `0 2px 8px rgba(37,99,235,0.2)`
- **Disabled:** opacity `0.5`, cursor not-allowed
- **Transition:** all `0.2s cubic-bezier(0.16, 1, 0.3, 1)`

**Ghost Button (Secondary):**
- Background: `transparent`, Color: `#2563EB`
- Border: `1px solid #E2E8F0`
- Border-radius: `10px`
- **Hover:** Background `#EFF6FF`, border-color `#2563EB`

**Text Link:**
- Color: `#2563EB`, no underline default
- **Hover:** underline expand from left, `0.3s ease`
- **Active:** scale `0.98`

### Cards

- Background: `#FFFFFF`
- Border-radius: `16px`
- Border: `1px solid #E2E8F0`
- Padding: `24px`
- **Hover (if interactive):** border-color `#2563EB`, box-shadow `0 8px 32px rgba(37,99,235,0.08)`, translateY(-2px)
- **Transition:** all `0.25s cubic-bezier(0.16, 1, 0.3, 1)`
- Non-interactive cards: no hover state change.

### Navigation (Top Nav)

- Height: `72px`
- Background: `rgba(248,250,252,0.92)` + `backdrop-filter: blur(16px)`
- Border-bottom: `1px solid #E2E8F0`
- Logo left, nav links right
- **Scroll behavior:** 向下滚 > 60px 时背景从不透明变为半透明毛玻璃
- Nav links: 14px, color Steel → Ink on hover, `::after` underline expand animation

### Inputs

- Height: `44px`
- Border: `1px solid #E2E8F0`
- Border-radius: `10px`
- Padding: `0 16px`
- **Focus:** border-color `#2563EB`, box-shadow `0 0 0 3px rgba(37,99,235,0.12)`
- **Error:** border-color `#EF4444`, box-shadow `0 0 0 3px rgba(239,68,68,0.1)`
- Label: above, 14px, Steel, margin-bottom `6px`

### Message Bubbles (Chat)

- **User bubble:** background `#2563EB`, color `#FFFFFF`, border-radius `16px 16px 4px 16px`
- **Bot bubble:** background `#FFFFFF`, color `#0F172A`, border-radius `16px 16px 16px 4px`, border `1px solid #E2E8F0`
- Max-width: `72%`
- Padding: `12px 16px`

### Tags / Badges

- Border-radius: `8px`
- Padding: `4px 10px`
- Font-size: `12px`, font-weight: `500`
- Background `#F1F5F9`, color `#64748B` (default)
- Accent tags: background `#EFF6FF`, color `#2563EB`

### Skeleton Loaders

- Background: linear-gradient(`#F1F5F9` → `#E2E8F0`)
- Border-radius: match component shape
- Shimmer animation: left-to-right, 1.5s infinite

### Empty States

- Centered composition
- Icon: `#E2E8F0` (muted), size 48px
- Title: 18px, Ink, weight 500
- Description: 14px, Steel

## 5. Layout Principles

- **Container:** max-width `1400px`, centered, padding `0 48px`
- **Grid:** CSS Grid first, avoid flexbox percentage hacks
- **Section spacing:** `clamp(80px, 10vw, 140px)` vertical gap
- **Mobile (< 768px):** All multi-column → single column, padding `0 24px`
- **No horizontal overflow** on any viewport
- **Touch targets:** All interactive elements minimum `44px` tap area
- **Typography scaling:** `clamp()` for all display/headline sizes

## 6. Motion & Interaction

### Spring Physics Default
```css
--spring: cubic-bezier(0.16, 1, 0.3, 1); /* stiffness feel, damping */
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
```

### Entrances
- **Page mount:** fade-in + translateY(16px), staggered 60ms per element
- **List items:** cascade reveal, delay 40ms between items
- **Modal/Drawer:** scale 0.96 → 1 + fade, 300ms

### Hover Micro-interactions
- Buttons: translateY(-1px) + shadow lift
- Cards (interactive): border-color shift + shadow + translateY(-2px)
- Nav links: underline expand left-to-right
- Icons: subtle scale(1.05) on parent hover

### Perpetual Loops
- **Loading shimmer:** 1.5s ease-in-out infinite, left-to-right gradient sweep
- **Typing indicator:** 3 dots with staggered scale pulse, 1.2s infinite
- **Live indicator:** subtle pulse on live chat badges, 2s infinite

### Performance Rule
Animate **only** `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in UI
- No `Inter` font
- No pure black `#000000` for text
- No purple/cyan/green neon glows or gradients
- No 3-column equal card grids
- No centered hero sections (use asymmetric split)
- No generic placeholder names ("John Doe", "Acme")
- No fake round numbers (`99.99%`, `50%`)
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No bouncing chevrons, "Scroll to explore" filler text
- No circular spinners (use skeleton or dot pulse)
- No custom mouse cursors
- No overlapping elements
- No `h-screen` — use `min-h-[100dvh]`

## 8. Existing Project Tokens

```javascript
// 要迁移的现有token (旧值 → 新值)
const tokenMigration = {
  // colors.js
  primary:       '#005DA9'  →  '#2563EB',   // 主蓝更现代
  primaryDark:   '#004080'  →  '#1D4ED8',   // Hover态
  primaryLight:  '#E8F4FC'  →  '#EFF6FF',   // 淡蓝背景
  accent:        '#00C2A8'  →  (删除/保留仅用于secondary accent),
  text:          '#1A1A1A'  →  '#0F172A',   // 更深的蓝黑
  textSecondary: '#6B7C8D'  →  '#64748B',   // Steel
  border:        '#E8E8E8'  →  '#E2E8F0',   // Whisper
  background:    '#F5F7FA'  →  '#F8FAFC',   // Canvas
  shadow:        'rgba(0,0,0,0.08)' → 'rgba(15,23,42,0.06)',
}

// App.css
// 全局背景 #f5f5f5 → #F8FAFC
// scrollbar thumb #c1c1c1 → #94A3B8
// custom-card shadow → 蓝辉光版
// button hover → translateY(-1px) + 蓝阴影
```

## 9. Implementation Priority

1. **Phase 1 — Core tokens:** Update `theme/colors.js` + `App.css` globals
2. **Phase 2 — Buttons & Inputs:** Re-skin all form controls
3. **Phase 3 — Navigation:** Update `Layout.js` nav with new hover/frost effects
4. **Phase 4 — Cards & Surfaces:** Migrate card styles to new system
5. **Phase 5 — Chat bubbles:** Style `ChatMessages.jsx` message bubbles
6. **Phase 6 — Animation polish:** Add entrance stagger, micro-interactions
