// NOD Makeup Design System — Apple-inspired Design Tokens
// Single source of truth for colors, spacing, typography, shadows, radii.
// Used by both admin-panel (CRA) and main-website (Next.js).

export const colors = {
  // --- Semantic colors (light mode) ---
  light: {
    // Backgrounds
    bg: {
      primary: '#FFFFFF',      // Main canvas
      secondary: '#F5F5F7',    // Cards, sections
      tertiary: '#EBEBF0',     // Subtle dividers, disabled
      elevated: '#FFFFFF',     // Modals, popovers
    },

    // Text
    text: {
      primary: '#1D1D1F',      // Headlines, primary labels
      secondary: '#86868B',    // Secondary labels, captions
      tertiary: '#C7C7CC',     // Placeholders, disabled text
      inverse: '#FFFFFF',      // On dark backgrounds
      link: '#0071E3',         // Links, interactive elements
      linkHover: '#0077ED',
    },

    // Brand
    brand: {
      primary: '#0071E3',      // Apple Blue
      primaryHover: '#0077ED',
      primaryPressed: '#0066CC',
      secondary: '#FF9F0A',    // Apple Orange (accents)
      success: '#34C759',      // Green
      warning: '#FF9F0A',      // Orange
      error: '#FF3B30',        // Red
    },

    // Borders & Dividers
    border: {
      light: '#D1D1D6',        // Default borders
      medium: '#86868B',       // Focused borders
      focus: '#0071E3',        // Focus ring
    },

    // Shadows
    shadow: {
      sm: 'rgba(0, 0, 0, 0.04)',
      md: 'rgba(0, 0, 0, 0.08)',
      lg: 'rgba(0, 0, 0, 0.12)',
      xl: 'rgba(0, 0, 0, 0.16)',
      focus: 'rgba(0, 113, 227, 0.3)',
    },

    // Overlays
    overlay: {
      light: 'rgba(0, 0, 0, 0.4)',
      heavy: 'rgba(0, 0, 0, 0.6)',
    },
  },

  // --- Semantic colors (dark mode) ---
  dark: {
    bg: {
      primary: '#000000',
      secondary: '#1D1D1F',
      tertiary: '#2C2C2E',
      elevated: '#2C2C2E',
    },
    text: {
      primary: '#F5F5F7',
      secondary: '#98989D',
      tertiary: '#636366',
      inverse: '#000000',
      link: '#0A84FF',
      linkHover: '#4DA6FF',
    },
    brand: {
      primary: '#0A84FF',
      primaryHover: '#4DA6FF',
      primaryPressed: '#0066CC',
      secondary: '#FF9F0A',
      success: '#30D158',
      warning: '#FF9F0A',
      error: '#FF453A',
    },
    border: {
      light: '#38383A',
      medium: '#48484A',
      focus: '#0A84FF',
    },
    shadow: {
      sm: 'rgba(0, 0, 0, 0.2)',
      md: 'rgba(0, 0, 0, 0.3)',
      lg: 'rgba(0, 0, 0, 0.4)',
      xl: 'rgba(0, 0, 0, 0.5)',
      focus: 'rgba(10, 132, 255, 0.4)',
    },
    overlay: {
      light: 'rgba(0, 0, 0, 0.5)',
      heavy: 'rgba(0, 0, 0, 0.7)',
    },
  },
};

// --- Spacing scale (4px base) ---
export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
};

// --- Typography ---
export const typography = {
  fontFamilies: {
    sans: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace",
    arabic: "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },

  fontSizes: {
    xs: '11px',     // Captions, labels
    sm: '13px',     // Secondary text
    base: '15px',   // Body text
    lg: '17px',     // Large body
    xl: '20px',     // Small headings
    '2xl': '24px',  // Medium headings
    '3xl': '32px',  // Large headings
    '4xl': '40px',  // Hero headings
    '5xl': '48px',  // Display
  },

  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeights: {
    tight: 1.1,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },

  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
  },
};

// --- Border radius ---
export const radii = {
  none: '0',
  sm: '4px',     // Buttons, inputs
  md: '8px',     // Cards, dropdowns
  lg: '12px',    // Modals, sheets
  xl: '16px',    // Large containers
  '2xl': '20px', // Hero sections
  full: '9999px', // Pills, badges
};

// --- Shadows (elevation) ---
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.02)',
  md: '0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
  lg: '0 12px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
  xl: '0 20px 40px rgba(0, 0, 0, 0.16), 0 8px 16px rgba(0, 0, 0, 0.08)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
  focus: '0 0 0 3px rgba(0, 113, 227, 0.3)',
};

// --- Transitions ---
export const transitions = {
  fast: '120ms ease-out',
  normal: '200ms ease-out',
  slow: '300ms ease-out',
  spring: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
};

// --- Z-index layers ---
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
};

// --- Breakpoints ---
export const breakpoints = {
  sm: '375px',   // Mobile
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1440px',  // Large desktop
  '2xl': '1920px', // Ultra-wide
};

// --- Motion / Animation ---
export const motion = {
  durations: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
  },
  easings: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
};

// --- Opacity ---
export const opacity = {
  0: '0',
  10: '0.1',
  20: '0.2',
  30: '0.3',
  40: '0.4',
  50: '0.5',
  60: '0.6',
  70: '0.7',
  80: '0.8',
  90: '0.9',
  100: '1',
};

// --- Layout ---
export const layout = {
  maxWidth: {
    xs: '320px',
    sm: '375px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1440px',
    full: '100%',
  },
  containerPadding: {
    mobile: '16px',
    tablet: '24px',
    desktop: '32px',
  },
};

export default {
  colors,
  spacing,
  typography,
  radii,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  motion,
  opacity,
  layout,
};