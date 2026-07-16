# OpenGlyphs

OpenGlyphs is an advanced, high-fidelity web-to-Illustrator bridge built as an Adobe Illustrator CEP (Common Extensibility Platform) Extension. It embeds a fully-functional, sandboxed Chromium browser directly inside Illustrator, allowing designers to instantly extract and import SVG icons, images, and raw HTML/CSS nodes from any website directly onto their artboards.

## Core Features

- **WYSIWYG Vector Capture Engine:** Accurately reverse-engineers DOM elements (including complex nested structures, background colors, borders, and border-radius pill shapes) into native, editable vector paths in Illustrator.
- **Deep Network Interception:** Employs a custom local Node.js proxy server that intercepts stealth API downloads (e.g., from Google Fonts or Lucide). It actively hijacks `Content-Disposition: attachment` TCP streams and synthetic JavaScript dispatch events, bypassing the native Chrome download manager and beaming assets directly to your Illustrator project.
- **Shadow DOM Isolation:** Utilizes a closed Shadow DOM host to inject its UI (like asset highlighters and toast notifications) directly into Single Page Applications (SPAs) like React or Next.js, preventing React hydration engines from deleting or interfering with the extension's interface.
- **High-Fidelity Raster-to-Vector Pipeline:** Imports pixel-perfect assets without relying on destructive Auto-Trace for pure images. It perfectly translates HTML/CSS coordinates and padding to guarantee visual accuracy.
- **Smart Navigation:** Automatically re-routes cross-origin asset requests (like CSS and JS files) through an internal memory-state proxy to bypass Chromium's strict third-party sandboxing and CORS restrictions, ensuring websites render exactly as they do in a standard browser.

## Tech Stack

- **Adobe CEP (ExtendScript):** Interacts natively with Adobe Illustrator's COM interface to generate groups, raster items, and editable vector paths.
- **Node.js (Proxy Server):** Strips CSP headers, handles CORS proxying, manages relative asset URL resolutions in memory, and acts as a network interceptor for native downloads.
- **Vanilla JS & Shadow DOM:** Injected payload scripts that map DOM coordinate geometries and intercept native browser prototype APIs (`HTMLElement.prototype.click`, `EventTarget.prototype.dispatchEvent`, `window.open`).