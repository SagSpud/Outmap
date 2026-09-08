const { app, BrowserWindow } = require('electron');
const fs = require('fs');

// Premium High-DPI Anti-Aliased Open Hand Cursor (grab)
// Tilted natural ergonomic pose, 24x24 viewBox, hotspot at (10, 10)
// Features dual-layer rendering: soft contrast shadow + crisp white fill with dark slate border
const openHandSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M7 11V4.5a1.5 1.5 0 0 1 3 0V10a1.5 1.5 0 0 1 3 0V3.5a1.5 1.5 0 0 1 3 0V10a1.5 1.5 0 0 1 3 0V5.5a1.5 1.5 0 0 1 3 0v8a6.5 6.5 0 0 1-6.5 6.5h-1a6.5 6.5 0 0 1-5-2.4l-2.6-3.2a1.4 1.4 0 0 1 2.2-1.8L7 13.5V11z"
        fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7 11V4.5a1.5 1.5 0 0 1 3 0V10a1.5 1.5 0 0 1 3 0V3.5a1.5 1.5 0 0 1 3 0V10a1.5 1.5 0 0 1 3 0V5.5a1.5 1.5 0 0 1 3 0v8a6.5 6.5 0 0 1-6.5 6.5h-1a6.5 6.5 0 0 1-5-2.4l-2.6-3.2a1.4 1.4 0 0 1 2.2-1.8L7 13.5V11z"
        fill="#ffffff" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Premium High-DPI Anti-Aliased Closed Fist Cursor (grabbing)
// Firm grasping fist, 24x24 viewBox, hotspot at (10, 10)
const closedHandSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M6 10.5c0-1.7 1.3-3 3-3h6.5c2.5 0 4.5 2 4.5 4.5v1.5c0 3.3-2.7 6-6 6h-2c-2.1 0-4-.9-5.3-2.4l-2-2.3a1.8 1.8 0 0 1 .3-2.5 1.8 1.8 0 0 1 2.5.3L9 14V10.5H6z"
        fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 10.5c0-1.7 1.3-3 3-3h6.5c2.5 0 4.5 2 4.5 4.5v1.5c0 3.3-2.7 6-6 6h-2c-2.1 0-4-.9-5.3-2.4l-2-2.3a1.8 1.8 0 0 1 .3-2.5 1.8 1.8 0 0 1 2.5.3L9 14V10.5H6z"
        fill="#ffffff" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.5 8.5v4M12.5 8.5v4M15.5 8.5v4" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

// Precision Pointing Crosshair (for route point picking)
const reticleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="5" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.9"/>
  <circle cx="12" cy="12" r="5" fill="none" stroke="#0284c7" stroke-width="1.5"/>
  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="1.5" fill="#0284c7" stroke="#ffffff" stroke-width="0.8"/>
</svg>`;

function toDataUri(svg) {
  const min = svg.replace(/\s+/g, ' ').trim();
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(min);
}

module.exports = { openHandSvg, closedHandSvg, reticleSvg, toDataUri };

if (require.main === module) {
  console.log('Open Hand URI length:', toDataUri(openHandSvg).length);
  console.log('Closed Hand URI length:', toDataUri(closedHandSvg).length);
  console.log('Reticle URI length:', toDataUri(reticleSvg).length);
}
