import { defineConfig } from 'vite';
// The studio is published at /studio/ on the site. Shared files (rooms/, swatches/, textures/,
// icons) stay at the site root and the page finds them through <meta name="tl-site-root">,
// so the build ships only index.html + assets/. Copy dist/* into the site's studio/ folder.
export default defineConfig(({command})=>({base:'./',publicDir:command==='serve'?'public':false}));
