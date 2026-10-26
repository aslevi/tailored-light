// Shared site files (rooms/, swatches/, textures/) live at the site root.
// The studio page says where that is with <meta name="tl-site-root" content="../">.
export const SITE_ROOT=new URL(document.querySelector('meta[name="tl-site-root"]')?.content||'./',document.baseURI).href;
export const site=path=>new URL(path,SITE_ROOT).href;
