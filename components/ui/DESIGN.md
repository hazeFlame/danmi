---
name: Orbital Workspace
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#46464c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777c'
  outline-variant: '#c6c6cc'
  surface-tint: '#5a5e6a'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#171b26'
  on-primary-container: '#808391'
  inverse-primary: '#c3c6d4'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001c39'
  on-tertiary-container: '#3c86d9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe2f1'
  primary-fixed-dim: '#c3c6d4'
  on-primary-fixed: '#171b26'
  on-primary-fixed-variant: '#434652'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#a4c9ff'
  on-tertiary-fixed: '#001c39'
  on-tertiary-fixed-variant: '#004883'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  rail-width: 4.5rem
  sidebar-width: 18rem
  composer-max-w: 52rem
---

## Brand & Style

This design system delivers an ultra-clean, modern, minimalist AI productivity experience characterized by generous whitespace, subtle tactile surfaces, deep slate contrast anchors, and soft ambient elevation. 

Designed for high-performance knowledge workers, researchers, engineers, and product teams, the interface establishes an effortless cognitive canvas. It rejects visual clutter in favor of crisp delineation, delicate 1px neutral borders, rounded pill primitives, and soft spherical accents. The aesthetic bridges high-utility SaaS precision with the serene, tactile lightness of next-generation intelligent tools.

### Design Movement
- **Minimalist Neo-Tactile:** Pure white elevated cards, light canvas foundation (`#F8FAFC`), and low-contrast borders combined with tactile pill-shaped controls and floating multi-action composers.
- **Deep Contrast Focal Anchors:** High-impact midnight slate pills and featured assistant cards ground the lightweight ambient interface without feeling heavy.
- **Atmospheric Blue Gradients:** Vibrant azure and soft atmospheric spherical gradients signify intelligent runtime presence, focused states, and dynamic capability badges.

## Colors

The color architecture is built around sharp monochrome contrast accented with precise electric blue highlights and subtle pastel category indicators.

### Core Palette
- **Primary (`#0B0F19`):** Deep Obsidian Slate. Used for primary CTA buttons, active state rail icons, high-priority featured assistant cards, and high-emphasis titles.
- **Secondary (`#2563EB`):** Vibrant Azure. Applied to intelligent badges, focus rings, link interactions, and brand markers.
- **Tertiary (`#60A5FA`):** Soft Celestial Blue. Used for ambient glow gradients, interactive hover tints, and secondary chip states.
- **Neutral (`#64748B`):** Cool Slate. Drives secondary micro-copy, inactive icons, breadcrumbs, and subtle inline descriptors.

### Background & Surface Hierarchy
- **Canvas Base:** `#F8FAFC` (Cool Off-White) provides a soft, non-glare foundation across screen edges and split views.
- **Surface Layer 1 (Cards & Input Containers):** `#FFFFFF` (Pure White) with crisp 1px borders for content separation and floating interaction bars.
- **Surface Layer 2 (Hover & Inactive Controls):** `#F1F5F9` to `#F3F4F6` for low-contrast button states, chip backgrounds, and divider strokes.
- **Surface Inverted:** `#0B0F19` to `#111827` for featured modules, primary action buttons, and active status indicators.

### Functional Tint Palette
- **Category Accents (Pastel Pills):**
  - Rose/Calendar: `#FEE2E2` with `#EF4444` icon
  - Sky/Task: `#E0F2FE` with `#0EA5E9` icon
  - Amber/Integrations: `#FEF3C7` with `#F59E0B` icon
  - Mint/Notes: `#D1FAE5` with `#10B981` icon

## Typography

The typographical rhythm relies entirely on **Inter** to ensure maximum digital clarity, structural geometric neutrality, and optimal rendering across responsive viewpoints.

### Hierarchy Guidelines
- **Greeting & Hero Headlines (`display-lg`):** Reserved for conversational prompts ("Hi, there 👋") and key landing view greetings. Employs slight negative tracking (`-0.025em`) for modern editorial cohesion.
- **Section Headers & Card Titles (`headline-md`, `headline-sm`):** Balances strong font weights (`600`) with modest scale to preserve a low-friction, calm density.
- **Interaction Labels & Micro-Pills (`label-md`, `label-sm`):** Styled with medium-to-semibold weights for fast scannability on small interactive elements like badges, category pills, and prompt task rows.
- **Legal & Disclaimers (`caption`):** Muted slate text (`#94A3B8`) providing essential context without drawing attention from the workspace core.

## Layout & Spacing

The layout employs a three-tier horizontal modular structure: an ultra-thin navigation rail, an expandable sidebar panel, and an expansive fluid workspace canvas centered around a floating composer.

### Grid & Layout Structure
1. **Primary Icon Rail (Fixed `4.5rem` / `72px`):** Anchored to the far left. Contains circular icon touch targets, dynamic avatar orb, and bottom utility triggers.
2. **Collapsible Workspace Drawer (Fixed `18rem` / `288px`):** Houses structured list hierarchies (Saved conversations, Today, Yesterday) and secondary CTA actions ("Upgrade to Pro", "New Chat").
3. **Workspace Canvas (Fluid, Centered):** A max-width container (`52rem` to `64rem`) centered within the remaining viewport area, ensuring line lengths remain optimal for conversational prompts, bento task cards, and interactive responses.

### Responsive Breakpoints & Adaptive Rules
- **Desktop (>= 1280px):** Full three-column view visible by default (Rail + Open Drawer + Main Canvas).
- **Laptop / Tablet Landscape (1024px - 1279px):** Sidebar drawer collapses into an overlay off-canvas drawer triggered from the rail.
- **Mobile (< 768px):** Rail tucks into a persistent bottom bar or top navigation header. Bento grid reflows into a single-column stack, and the floating composer pins directly above the mobile keyboard safe area.

## Elevation & Depth

This system avoids heavy drop shadows, opting for subtle ambient diffusion, ultra-clean surface borders, and layered planar elevation.

### Elevation Hierarchy
- **Level 0 (Flat Canvas):** `#F8FAFC`. Base surface upon which all structures float.
- **Level 1 (Subtle Inset / Base Cards):** `#FFFFFF` surfaces with a 1px solid border (`#E2E8F0`) and soft zero-bleed drop shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Floating Composer & Action Pills):** Pure white container with multi-stop diffused ambient shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03)` wrapped with 1px border (`#E2E8F0`).
- **Level 3 (Modals, Contextual Dropdowns & Popovers):** Elevated floating menus with higher spread: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Level Inverted (Deep Obsidian Elements):** Featured agent cards and active pills use depth via rich solid background fill (`#0B0F19`) coupled with deep tint ambient shadow: `0 12px 24px -4px rgba(11, 15, 25, 0.25)`.

## Shapes

The design system embraces a tactile, pill-forward shape language (`roundedness: 3`). Soft curves humanize the interface, signaling responsiveness and natural conversation.

### Corner Radii Specifications
- **Pill Primitives (`rounded-full`):** All primary buttons, action pills, category badges, chip filters, dropdown selectors, and round action controls.
- **Modular Cards (`rounded-2xl` / `1.25rem` - `1.5rem`):** Bento grid containers, assistant info modules, and contextual prompt suggestion blocks.
- **Floating Main Composer (`rounded-3xl` / `1.75rem` - `2rem`):** Large multi-line chat input shell, creating an organic, floating console appearance.
- **System Icons & Micro Indicators:** Enclosed in circular containers or `rounded-xl` icon backdrops.

## Components

### Buttons & Pills
- **Primary Dark Action Button:** Fully rounded pill (`rounded-full`) in `#0B0F19`, featuring crisp white text (`#FFFFFF`) and an optional trailing sparkle icon. Subtle scale-down effect (`active:scale-[0.98]`) on tap.
- **Secondary Glass / Outline Pill:** Pure white or transparent background, 1px border (`#E2E8F0`), primary slate text (`#0F172A`). Hover transitions to `#F1F5F9`.
- **Circular Icon Action:** 40px × 40px round button used for send triggers, microphone dictation, and attachments. Primary active state uses `#0B0F19` with a white icon; neutral state uses transparent background with `#64748B` icon.

### Quick Action Category Chips
- **Structure:** Pill container (`rounded-full`) with a 1px border (`#E2E8F0`), containing an ultra-soft circular icon badge (`32px`) on the left paired with a concise label (`13px medium`).
- **Color Pairings:**
  - Calendar: Rose icon container (`#FEE2E2`) + `#0F172A` text.
  - Task: Sky blue icon container (`#E0F2FE`) + `#0F172A` text.
  - Integrations: Amber icon container (`#FEF3C7`) + `#0F172A` text.
  - Notes: Mint icon container (`#D1FAE5`) + `#0F172A` text.

### Floating AI Composer
- **Shell:** Large floating container (`max-w-3xl`, `rounded-3xl`, `#FFFFFF`, border `#E2E8F0`, Level 2 shadow).
- **Header Prompt Trigger:** Sparkle icon prefix (`#94A3B8`) followed by subtle placeholder text ("Ask me anything...").
- **Lower Control Bar:** Flex row containing:
  - Left: "Select Source" dropdown pill with down caret.
  - Right: "Attach" button, "Voice" button, and circular "Send" button.

### Bento Prompt & Assistant Cards
- **Featured Agent Card:** Obsidian slate fill (`#0B0F19`), white text, featuring an avatar tag, an electric blue badge (`#2563EB`, "Data Assistant"), and a high-clarity 2-line description.
- **Structured Task Card:** Pure white background, containing a vertically stacked list of clickable tasks with document icons, bordered by `#E2E8F0`, capped with a "View All" tertiary link (`#2563EB`).
- **Suggested Prompt Card:** Crisp white card with prompt query in bold (`#0F172A`), three-dot context menu at top right, and "Suggested prompt" metadata caption in muted slate (`#94A3B8`).

### Navigation Rail & Drawer Lists
- **Active Navigation Indicator:** 44px × 44px dark pill (`#0B0F19`) housing a white icon, contrasting against inactive monochrome icons (`#64748B`).
- **Notification Pips:** Pill-shaped badge ("New") rendered in vibrant azure (`#2563EB`) with white micro-text.
- **History Drawer List:** Grouped under uppercase or clean title headings ("Today", "Yesterday"). Rows feature subtle icon prefixes, truncated titles, and right-aligned overflow action dots on hover.