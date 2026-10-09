/** Brand logo — ፋስት ቢንጎ / Fast Bingo (SVG — matches bingo ball theme) */
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#0a1628"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#bg)"/>
  <circle cx="28" cy="36" r="14" fill="#ef4444"/>
  <text x="28" y="41" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="system-ui">7</text>
  <circle cx="100" cy="40" r="14" fill="#3b82f6"/>
  <text x="100" y="45" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="system-ui">23</text>
  <circle cx="32" cy="100" r="12" fill="#22c55e"/>
  <text x="32" y="105" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="system-ui">42</text>
  <circle cx="98" cy="98" r="12" fill="#a855f7"/>
  <text x="98" y="103" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="system-ui">58</text>
  <path d="M52 18 L56 28 L66 28 L58 34 L61 44 L52 38 L43 44 L46 34 L38 28 L48 28 Z" fill="url(#gold)"/>
  <text x="64" y="72" text-anchor="middle" font-size="18" font-weight="900" fill="#fff" font-family="Noto Sans Ethiopic, system-ui">ፋስት</text>
  <text x="64" y="96" text-anchor="middle" font-size="22" font-weight="900" fill="url(#gold)" font-family="Noto Sans Ethiopic, system-ui">ቢንጎ</text>
</svg>
`.trim();

export const LOGO_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
