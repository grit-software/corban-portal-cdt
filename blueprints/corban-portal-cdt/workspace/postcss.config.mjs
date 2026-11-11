// Tailwind v4 por PostCSS (no por el loader de Turbopack): funciona igual con `next build`
// (Turbopack) y con el respaldo `next build --webpack`, donde el loader de Turbopack no hace nada.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
