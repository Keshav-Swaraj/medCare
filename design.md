# MedCare Design System & Principles

This document outlines the core design language for the MedCare application, extracted from the reference UI. All future pages, components, and data visualizations must adhere strictly to these guidelines to ensure a cohesive, professional, and trustworthy user experience.

## 1. Typography
- **Primary Font Family:** `Inter`, sans-serif.
- **Handwritten Accent Font:** `Caveat`, cursive (Used sparingly for sticky notes or informal annotations).
- **Hierarchy:**
  - **Hero/Main Titles:** `text-5xl` to `text-7xl`, `font-semibold`, `tracking-tight`. Primary text is dark (`text-gray-900`), secondary or trailing text is muted (`text-gray-400`).
  - **Section Headers (Cards/Widgets):** `text-base` or `text-lg`, `font-semibold`, `text-gray-900`.
  - **Body/Paragraphs:** `text-sm` or `text-base`, `text-gray-500`, `font-medium`.
  - **Microcopy/Dates/Tags:** `text-xs`, `text-gray-400` or `text-gray-500`.

## 2. Color Palette
- **Backgrounds:**
  - App Background: Off-white/Light Gray (`#fafafa` or `bg-gray-50`).
  - Dotted Pattern: Radial gradient with light gray dots (`#d1d5db` or lighter) for empty states or landing hero sections.
- **Surfaces (Cards/Modals):**
  - Pure White (`#ffffff` or `bg-white`).
  - Occasional use of backdrop blur (`backdrop-blur-sm`, `bg-white/95`) for floating elements.
- **Brand & Accent Colors:**
  - **Primary Blue:** `#2e74ff` (Tailwind: `brandBlue` or `blue-600`). Used for primary CTA buttons, active tabs, and primary data points.
  - **Cyan/Teal:** Used as a secondary data color (e.g., progress bars, secondary chart metrics).
  - **Orange:** `#f97316` (Tailwind: `orange-500`). Used for warnings or tertiary data points.
  - **Emerald/Green:** `#10b981` (Tailwind: `emerald-500`). Used for success states, completed tasks, or positive adherence.
  - **Red:** `#ef4444` (Tailwind: `red-500`). Used for missed medications, errors, or alert pins.
- **Text Colors:**
  - Primary: `text-gray-900`
  - Secondary: `text-gray-500`
  - Disabled/Hints: `text-gray-400`

## 3. Shapes, Borders & Shadows
- **Border Radius (Rounding):**
  - The design is highly rounded and soft. Avoid sharp corners.
  - **Buttons & Small Tags:** `rounded-lg` or `rounded-xl`.
  - **Standard Cards/Widgets:** `rounded-2xl`.
  - **Large Panels/Floating Modals:** `rounded-3xl` or `rounded-[2rem]`.
  - **Progress Tracks/Pills:** `rounded-full`.
- **Borders:**
  - Borders are extremely subtle. Use `border border-gray-100` or `border-gray-200` to define edges on white backgrounds, never harsh black or dark gray borders.
- **Shadows (Crucial for the "Floating" Aesthetic):**
  - Avoid harsh, tight shadows. Use wide, soft drop shadows.
  - Standard floating card: `shadow-[0_20px_50px_rgb(0,0,0,0.06)]` or Tailwind's `shadow-xl` / `shadow-2xl` with adjusted opacity.
  - Buttons often have a colored glow: `shadow-lg shadow-blue-500/30`.

## 4. Components & Layouts
- **Spacing & Padding:**
  - Generous internal padding for cards (e.g., `p-5` or `p-6`). Elements should never feel cramped.
- **Dividers:**
  - Use thin, light horizontal rules (`h-px w-full bg-gray-100`) to separate list items (e.g., in the task list or schedule).
- **Sidebars & Navigation:**
  - Sidebar links use rounded pill backgrounds for the active state (e.g., `bg-gray-100 rounded-xl`).
  - Inactive links are muted gray (`text-gray-500`) and turn darker on hover.

## 5. Data Visualization (Charts & Graphs)
Whenever implementing Recharts, Chart.js, or custom CSS charts, follow these rules:
- **Progress Bars:** Background track is `bg-gray-100`. The fill is a solid, vibrant color (Blue, Cyan, or Orange) and is `rounded-full`.
- **Donut/Pie Charts:** 
  - Strokes must have rounded caps (`stroke-linecap: round`).
  - Segments should be separated by a white gap to maintain the clean look.
  - Colors: Brand Blue, Cyan, Orange, Light Gray (for empty/remaining space).
- **Bar Charts:**
  - Bars must have rounded top corners.
  - Use solid colors without heavy gradients.
- **Line Charts (Adherence tracking):**
  - Smooth, curved lines (Bezier) rather than harsh angular lines.
  - Use `brandBlue` with a very soft, semi-transparent area fill beneath the line.

## 6. Icons
- Use simple, stroke-based icons (e.g., **Lucide React**).
- Icon weight should generally be standard (`strokeWidth={2}`), but can be slightly thicker for specific standalone badges.
- Icons in lists are often enclosed in a soft colored square with highly rounded corners (e.g., `w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-brandBlue`).

---
**Summary for AI Agents:** When generating new React components for MedCare, always reference these class names and paradigms. Default to `rounded-2xl`, subtle `border-gray-100`, soft shadows, and the `Inter` font. Do not introduce new dark backgrounds or sharp edges unless explicitly requested.
