export const THEME = {
  bg: '#0b0e11',
  bgCard: '#1e2128',
  bgHover: '#2b2f36',
  border: '#2b2f36',
  borderAccent: '#f0b90b33',
  text: '#eaecef',
  textSecondary: '#848e9c',
  textMuted: '#5e6673',
  gold: '#f0b90b',
  goldLight: '#ffe082',
  goldDark: '#c8940a',
  green: '#0ecb81',
  red: '#f6465d',
  blue: '#1e88e5',
  purple: '#7b61ff'
};

export function injectThemeVars(root) {
  Object.entries(THEME).forEach(([key, val]) => {
    root.style.setProperty('--sbsc-' + key, val);
  });
}
