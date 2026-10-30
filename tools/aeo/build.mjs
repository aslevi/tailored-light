// Hello Shade AEO build: quick answers, structured data, intent pages, llms.txt, feed.json, sitemap.xml.
// Run from the repo root:  node tools/aeo/build.mjs
// Safe to re-run: everything it writes into existing pages sits between <!--aeo:...--> markers and is replaced.
// Prices come from flow/pricing.js and the catalog from catalog.js, so the answers stay in step with the site.
// When a fact changes (price formula, fabrics, shipping time), change it here or in pricing.js and re-run.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as P from '../../flow/pricing.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SITE = 'https://helloshade.co';
const UPDATED = '2026-10-30';                      // bump when the facts below change
const UPDATED_LABEL = 'Updated Oct 30, 2026';
const PHONE = '+1-201-745-3300', PHONE_TXT = '(201) 745-3300';
const SHIP = '2–4 weeks';

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const usd = n => `$${n.toLocaleString('en-US')}`;
const list = a => a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`;

// ---------- Catalog ----------
const ctx = { window: {} };
vm.runInNewContext(read('catalog.js'), ctx);
const CAT = ctx.window.TL_CATALOG;

// Rooms each family suits (from Dana's knowledge doc; same as the room pages).
const ROOMS = {
  'Daylight Weave': ['kitchen', 'living room', 'home office'],
  'Morning Haze': ['kitchen', 'bathroom'],
  'Deep Sleep': ['bedroom', 'nursery'],
  'Clear View': ['kitchen', 'bathroom', 'home office'],
  'Twin Light': ['bathroom', 'living room', 'home office'],
  'Sand Stripe': ['kitchen', 'home office'],
  'Twin Shade': ['bedroom', 'nursery'],
  'Raw Linen': ['bedroom', 'living room', 'home office'],
  'Soft Cotton': ['bedroom', 'nursery', 'bathroom'],
  'Ticking Stripe': ['kitchen', 'bathroom', 'living room'],
  'Sheer Voile': ['living room'],
  'Blackout Linen': ['bedroom', 'nursery'],
  'Natural Reed': ['bedroom', 'kitchen', 'living room', 'home office'],
};
const TYPE = {
  roller: { label: 'Roller', url: '/shades/roller/', blurb: 'Clean and simple. Rolls up tight.' },
  roman: { label: 'Roman', url: '/shades/roman/', blurb: 'Soft folds, tailored look.' },
  zebra: { label: 'Zebra', url: '/shades/zebra/', blurb: 'Two layers of bands slide to go from open view to privacy without raising the shade.' },
  woven: { label: 'Woven', url: '/shades/woven/', blurb: 'Natural woven wood, classic flat fold.' },
};
const M = { w: 36, h: 60 };                        // reference size used in every answer
const price = (style, family, w, h, lining = false) => P.quote({ style, family, width: w, height: h, lining }).price;

const products = [];
for (const [style, s] of Object.entries(CAT)) for (const g of s.groups) {
  const line = P.priceLine(style, g.family);               // roller | roman | woven | zebra
  const type = line === 'woven' ? 'woven' : style;
  const url = `/shades/${type}/${slug(g.family)}/`;
  const file = url.slice(1) + 'index.html';
  if (!fs.existsSync(path.join(ROOT, file))) continue;
  const html = read(file);
  const light = strip((html.match(/<div class="pinfo">\s*<span class="badge">([^<]+)</) || [])[1] || 'Light filtering');
  const colors = g.colors.map(c => c[0]);
  products.push({
    style, type, family: g.family, name: `${g.family} ${TYPE[type].label}`, url, file, light, colors,
    rooms: ROOMS[g.family] || [], lining: P.liningAvailable(style, g.family), screen: !!g.screen,
    from: P.fromPrice(style, g.family), m: price(style, g.family, M.w, M.h),
    mLined: P.liningAvailable(style, g.family) ? price(style, g.family, M.w, M.h, true) : null,
    estimate: line === 'zebra',
    image: `${SITE}/images/p/${slug(g.family)}-${slug(colors[0])}-room.webp`,
    description: strip((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''),
  });
}
const byType = t => products.filter(p => p.type === t);
const fromType = { roller: P.FROM.roller, roman: P.FROM.roman, zebra: P.FROM.zebra, woven: P.FROM.woven };
const mType = { roller: price('roller', null, M.w, M.h), zebra: price('zebra', null, M.w, M.h), roman: price('roman', 'Raw Linen', M.w, M.h), romanLined: price('roman', 'Raw Linen', M.w, M.h, true), woven: price('roman', 'Natural Reed', M.w, M.h) };

const PRICE_SIZES = [[24, 36], [36, 60], [48, 60], [60, 72], [72, 72], [96, 96]];
const PRICE_ROWS = [
  ['Roller', 'roller', null, false], ['Zebra (estimate)', 'zebra', null, false], ['Roman', 'roman', 'Raw Linen', false],
  ['Roman with room-darkening lining', 'roman', 'Raw Linen', true], ['Woven (Natural Reed)', 'roman', 'Natural Reed', false],
].map(([label, s, f, l]) => ({ label, prices: PRICE_SIZES.map(([w, h]) => price(s, f, w, h, l)) }));

// ---------- Structured data ----------
const ORG = {
  '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Hello Shade', url: `${SITE}/`, logo: `${SITE}/icon-512.png`,
  description: 'Custom window shades made to measure and shipped to your door, with designer help by text instead of a home visit.',
  telephone: PHONE,
  contactPoint: { '@type': 'ContactPoint', telephone: PHONE, contactType: 'customer service', availableLanguage: 'English', description: 'Text a designer' },
};
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'Hello Shade', publisher: { '@id': `${SITE}/#org` } };
const crumbs = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + url })) });
const webPage = (url, name, description, type = 'WebPage') => ({ '@type': type, '@id': `${SITE}${url}#page`, url: SITE + url, name, description, dateModified: UPDATED, isPartOf: { '@id': `${SITE}/#website` }, publisher: { '@id': `${SITE}/#org` } });
const faqLd = qas => ({ '@type': 'FAQPage', mainEntity: qas.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });
const productLd = p => ({
  '@type': 'Product', '@id': `${SITE}${p.url}#product`, name: p.name, url: SITE + p.url, image: p.image, description: p.description,
  brand: { '@type': 'Brand', name: 'Hello Shade' }, category: `${TYPE[p.type].label} shades`, color: p.colors.join(', '),
  additionalProperty: [
    { '@type': 'PropertyValue', name: 'Light level', value: p.light },
    { '@type': 'PropertyValue', name: 'Width range', value: '12–96 in' },
    { '@type': 'PropertyValue', name: 'Height range', value: '12–120 in' },
  ],
  offers: {
    '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: p.from, availability: 'https://schema.org/MadeToOrder',
    url: SITE + p.url, seller: { '@id': `${SITE}/#org` },
  },
});
const itemList = ps => ({ '@type': 'ItemList', itemListElement: ps.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + p.url, name: p.name })) });
const ldBlock = graph => `<!--aeo:ld--><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...graph] }).replace(/</g, '\\u003c')}</script><!--/aeo:ld-->`;

// ---------- Quick answer markup ----------
// `a` = one short paragraph that answers the question on its own; `facts` = a few scannable lines.
// Written for people first: a plain section near the bottom of the page, in the site's normal type.
// The same text gives answer engines a short, dated, quotable summary.
const qaBox = ({ q, a, facts = [], more = [] }) => `<div class="aeo-about">${q ? `<h2>${q}</h2>` : ''}<p>${a}</p>${facts.length ? `<ul>${facts.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}<p class="aeo-meta">${more.map(([t, u]) => `<a href="${u}">${t}</a>`).join(' · ')}${more.length ? ' · ' : ''}<time datetime="${UPDATED}">${UPDATED_LABEL}</time></p></div>`;
const QA = (inner, wrap) => `<!--aeo:qa-->${wrap === 'section' ? `<section class="section aeo-sec"><div class="container narrow">${inner}</div></section>` : inner}<!--/aeo:qa-->`;

// Links in quick answers are root-relative so they work at any depth (the site is served at the domain root).
const L = { prices: '/prices/', types: '/guides/which-shade-type/', noVisit: '/guides/custom-shades-without-a-home-visit/', mount: '/guides/inside-vs-outside-mount/', measure: '/how-to-measure/', samples: '/swatch-kit/', faq: '/faq/', blackout: '/shades/blackout/' };

const STD_FACTS = [
  `Made to measure: 12–96″ wide, 12–120″ high. Ships ${SHIP} after you order.`,
  `Samples: up to 5 fabrics for $10, credited to your shade order.`,
  `Fit guarantee: measure wrong and we remake it free, once per shade, within 30 days of delivery, when a designer checked your numbers and photos first.`,
];

// ---------- Page edits ----------
function setBlock(html, name, block, anchor) {
  const re = new RegExp(`<!--aeo:${name}-->[\\s\\S]*?<!--/aeo:${name}-->`);
  if (re.test(html)) return html.replace(re, () => block);
  const i = anchor(html);
  if (i < 0) throw new Error(`no anchor for ${name}`);
  return html.slice(0, i) + block + html.slice(i);
}
const beforeHeadEnd = h => h.indexOf('</head>');
const afterFirst = (needle, from = '<main') => h => { const s = h.indexOf(from); const i = h.indexOf(needle, s < 0 ? 0 : s); return i < 0 ? -1 : i + needle.length; };
const afterMatch = re => h => { const m = h.match(re); return m ? m.index + m[0].length : -1; };

const edited = [];
function editPage(file, { ld, qa }) {
  let h = read(file);
  if (ld) h = setBlock(h, 'ld', ldBlock(ld), beforeHeadEnd);
  h = h.replace(/<!--aeo:qa-->[\s\S]*?<!--\/aeo:qa-->/, '');
  if (qa) h = setBlock(h, 'qa', QA(qaBox(qa), 'section'), x => x.lastIndexOf('</main>'));
  write(file, h);
  edited.push(file);
}

// Home
editPage('index.html', {
  ld: [webPage('/', 'Hello Shade · Custom shades without the home visit', 'Custom window shades made to measure, with designer help by text.')],
  qa: {
    q: 'What is Hello Shade?',
    a: `Hello Shade sells custom window shades online: Roller, Roman, Zebra and Woven, made to measure for each window and shipped to your door ${SHIP} after you order. There's no home visit. You try shades on in a room on the site, then text a designer who helps you pick, measure and order. Shades start at ${usd(P.LOWEST_FROM)}; a 36×60″ Roller is ${usd(mType.roller)}. Each one hangs in about 15–20 minutes with a drill.`,
    facts: [
      `From prices: Roller ${usd(fromType.roller)}, Zebra ${usd(fromType.zebra)} (estimate), Roman ${usd(fromType.roman)}, Woven ${usd(fromType.woven)}.`,
      ...STD_FACTS,
      `Text a designer: ${PHONE_TXT}.`,
    ],
    more: [['All prices', L.prices], ['Which type?', L.types], ['How it works without a home visit', L.noVisit]],
  },
});

// Type listings
const TYPE_LIGHT = {
  roller: `Daylight Weave and Morning Haze filter light, Clear View is a screen weave that keeps your view, and Deep Sleep is blackout.`,
  zebra: `All three are light filtering: slide the bands to go from open view to privacy without raising the shade.`,
  roman: `Raw Linen, Soft Cotton and Ticking Stripe filter light and can add a room-darkening lining (${usd(mType.romanLined)} at 36×60″). Sheer Voile is sheer. Blackout Linen is blackout.`,
  woven: `Natural Reed is natural woven wood in Natural, Honey and Driftwood, made as a flat-fold Roman. Light filtering.`,
};
for (const t of Object.keys(TYPE)) {
  const ps = byType(t), T = TYPE[t];
  editPage(`shades/${t}/index.html`, {
    ld: [webPage(T.url, `${T.label} shades`, `${T.label} shades made to measure. From ${usd(fromType[t])}.`, 'CollectionPage'), itemList(ps), crumbs([['Home', '/'], ['Shop', '/shades/'], [T.label, T.url]])],
    qa: {
      q: `How much are custom ${T.label} shades?`,
      a: `Hello Shade ${T.label} shades start at ${usd(fromType[t])} (24×24″) and are ${usd(mType[t])} at 36×60″${t === 'zebra' ? ', an estimate until we confirm by text' : ''}. ${T.blurb} Choose from ${ps.length === 1 ? ps[0].name : list(ps.map(p => p.family))}. ${TYPE_LIGHT[t]}`,
      facts: STD_FACTS,
      more: [['Prices by size', L.prices], ['Roller vs Roman vs Zebra vs Woven', L.types]],
    },
  });
}

// Blackout
const blackout = products.filter(p => /blackout/i.test(p.light));
editPage('shades/blackout/index.html', {
  ld: [webPage('/shades/blackout/', 'Blackout shades', 'Custom blackout shades for bedrooms and nurseries.', 'CollectionPage'), itemList(blackout), crumbs([['Home', '/'], ['Shop', '/shades/'], ['Blackout shades', '/shades/blackout/']])],
  qa: {
    q: 'Which shades block the most light?',
    a: `For a dark bedroom or nursery, Hello Shade's blackout picks are the Deep Sleep Roller (from ${usd(products.find(p => p.family === 'Deep Sleep').from)}, ${usd(mType.roller)} at 36×60″) and the Blackout Linen Roman (from ${usd(fromType.roman)}, ${usd(mType.roman)} at 36×60″). Mounted outside the frame, on the wall above the window, a shade blocks the most light because it covers the gaps at the edges.`,
    facts: [`Want it darker than light filtering but softer than blackout? Raw Linen, Soft Cotton and Ticking Stripe Romans can add a room-darkening lining.`, ...STD_FACTS],
    more: [['Inside vs outside mount', L.mount], ['Prices by size', L.prices]],
  },
});

// All shades
editPage('shades/index.html', {
  ld: [webPage('/shades/', 'All shades', 'Every Hello Shade type and fabric.', 'CollectionPage'), itemList(products), crumbs([['Home', '/'], ['Shop', '/shades/']])],
  qa: {
    q: 'What shades does Hello Shade make?',
    a: `Four types, all made to measure: Roller (from ${usd(fromType.roller)}), Zebra (from ${usd(fromType.zebra)}, estimate), Roman (from ${usd(fromType.roman)}) and Woven (from ${usd(fromType.woven)}), in ${products.length} fabrics. Light levels are light filtering, blackout and sheer. Fabric and color don't change the price within a type; size does.`,
    facts: STD_FACTS,
    more: [['Which type?', L.types], ['Prices by size', L.prices], ['Blackout shades', L.blackout]],
  },
});

// Rooms
const ROOM_QA = {
  bedroom: ['What are the best shades for a bedroom?', `For a bedroom that gets really dark, pick a blackout fabric: the Deep Sleep Roller or the Blackout Linen Roman. Mounted outside the frame, on the wall above the window, it blocks the most light. For a softer look, a Raw Linen or Soft Cotton Roman with the room-darkening lining, or a Natural Reed Woven.`],
  nursery: ['What are the best shades for a nursery?', `For naps, pick a blackout fabric: the Deep Sleep Roller or the Blackout Linen Roman, mounted outside the frame for the darkest room. Keep cords and chains out of reach, and always install the chain tensioner that comes with a chain shade.`],
  'living-room': ['What are the best shades for a living room?', `For a finished look, a Roman (Raw Linen, Soft Cotton or Ticking Stripe) or the Natural Reed Woven. For soft daylight, the Sheer Voile Roman. To adjust light through the day without raising the shade, a Zebra like Twin Light.`],
  kitchen: ['What are the best shades for a kitchen?', `The Natural Reed Woven adds warmth; a Roller like Daylight Weave, Morning Haze or Clear View is easy to wipe and keeps things simple. Clear View is a screen weave, so you keep the view.`],
  bathroom: ['What are the best shades for a bathroom?', `You want privacy without a dark room: a light filtering fabric listed for bathrooms, like the Morning Haze or Clear View Roller, the Twin Light Zebra, or a Soft Cotton or Ticking Stripe Roman.`],
  'home-office': ['What are the best shades for a home office?', `Cut glare and keep the light: the Clear View Roller (screen weave, keeps your view), the Daylight Weave Roller, or a Zebra like Twin Light or Sand Stripe so you can adjust the light during calls.`],
};
for (const [room, [q, a]] of Object.entries(ROOM_QA)) {
  const name = room.replace('-', ' ').replace(/^./, c => c.toUpperCase());
  const ps = products.filter(p => p.rooms.includes(room.replace('-', ' ')));
  editPage(`rooms/${room}/index.html`, {
    ld: [webPage(`/rooms/${room}/`, `${name} shades`, q, 'CollectionPage'), itemList(ps), crumbs([['Home', '/'], ['Rooms', '/rooms/'], [name, `/rooms/${room}/`]])],
    qa: { q, a: `${a} Prices start at ${usd(P.LOWEST_FROM)}; at 36×60″ a Roller is ${usd(mType.roller)} and a Roman ${usd(mType.roman)}.`, facts: STD_FACTS, more: [['Prices by size', L.prices], ['Which type?', L.types]] },
  });
}

// Product pages
for (const p of products) {
  const lining = p.lining ? ` Add a room-darkening lining for ${usd(p.mLined)} at 36×60″.` : '';
  editPage(p.file, {
    ld: [webPage(p.url, p.name, p.description, 'ItemPage'), productLd(p), crumbs([['Home', '/'], ['Shop', '/shades/'], [TYPE[p.type].label, TYPE[p.type].url], [p.family, p.url]])],
    qa: {
      q: `About the ${p.name}`,
      a: `<b>${p.name}</b> is a ${p.light.toLowerCase()}${p.screen ? ' screen-weave' : ''} ${TYPE[p.type].label} shade in ${list(p.colors)}${p.rooms.length ? `, best for ${list(p.rooms)}` : ''}. From ${usd(p.from)}; ${usd(p.m)} at 36×60″${p.estimate ? ' (estimate until we confirm by text)' : ''}.${lining} Made to your size, ships in ${SHIP}. Samples $10, credited to your order.`,
    },
  });
}

// FAQ: FAQPage from the questions on the page (and fix an escaped apostrophe).
{
  let h = read('faq/index.html').replace(/we\\'ll/g, "we'll");
  write('faq/index.html', h);
  const qas = [...h.matchAll(/<details><summary>([\s\S]*?)<\/summary><div class="answer">([\s\S]*?)<\/div><\/details>/g)].map(m => [m[1], m[2]]);
  editPage('faq/index.html', {
    ld: [{ ...webPage('/faq/', 'FAQ', 'Answers about Hello Shade custom shades.', 'FAQPage'), mainEntity: faqLd(qas).mainEntity }],
    qa: {
      q: 'In short',
      a: `Hello Shade makes custom Roller, Roman, Zebra and Woven shades from ${usd(P.LOWEST_FROM)}, with no home visit: you text a designer who helps you pick, measure and order. Measuring takes about 7 minutes and a designer checks every number. Shades ship ${SHIP} after you order and hang in 15–20 minutes. Custom shades can't be returned for a change of mind, but a measuring mistake is remade free.`,
      more: [['Prices by size', L.prices], ['Which type?', L.types], ['No home visit', L.noVisit], ['Inside vs outside mount', L.mount]],
    },
  });
}

// How it works
editPage('how-it-works/index.html', {
  ld: [webPage('/how-it-works/', 'How it works', 'Custom shades without a home visit: try on, text a designer, we make it and ship it.')],
  qa: {
    q: 'How does Hello Shade work?',
    a: `Three steps. 1) Try on: see real shades in a room on the site and pick a type, fabric and color. 2) Text a designer: send a window photo; the designer helps you pick, measure (about 7 minutes) and order, and checks every number. 3) We make it and ship it: ${SHIP} after you order, and it hangs in about 15–20 minutes. You pay in full when you approve a written summary of each window.`,
    facts: STD_FACTS.slice(1),
    more: [['How to measure', L.measure], ['No home visit', L.noVisit]],
  },
});

// Samples
editPage('swatch-kit/index.html', {
  ld: [webPage('/swatch-kit/', 'Samples', 'Up to 5 fabric samples for $10, credited to your shade order.')],
  qa: { q: 'About samples', a: `Pick up to 5 fabrics and we mail you samples for $10, shipping included. The $10 is credited to your shade order. One set per household. Tip: tape them to the window and look in the morning and the evening.` },
});

// How to measure: the wizard renders with JavaScript, so add the full written guide as plain HTML below it.
{
  const steps = [
    ['Take a photo of the window', 'Stand back and take one straight-on photo of the whole window with a little wall around it.'],
    ['Find your tape’s case length', 'Use a metal tape, not a sewing tape. Most tapes print the case length on the back, like 3″. Inside the frame you measure with the back of the case against one side, and we add the case length for you.'],
    ['Measure the width three times', 'Inside the frame, at the top, middle and bottom. Read to the closest eighth below. We use the narrowest.'],
    ['Measure the height three times', 'Inside the frame, on the left, middle and right. We use the longest.'],
    ['Measure the depth', 'From the glass to the front edge of the frame. Roller and Zebra need about 2″, Roman and Woven about 2½″ to mount inside. Less than that means an outside mount, on the wall above the window.'],
    ['Note anything in the way', 'Cranks, handles, locks and alarm sensors: measure how far they stick out. If they block the shade, mount outside or use a crank extender.'],
    ['Send your numbers', 'Text the numbers, the window photo and one photo of the tape. Don’t subtract anything; a designer does the math, checks every number and confirms inside or outside mount in writing.'],
  ];
  const html = `<!--aeo:qa--><section class="aeo-guide" aria-labelledby="g-h"><style>.aeo-guide{max-width:560px;margin:8px auto 40px;padding:0 16px;color:#4A3530}.aeo-guide h2{font-family:"Fraunces",Georgia,serif;font-weight:500;font-size:24px;margin:24px 0 8px}.aeo-guide .aeo-meta{font-size:13px;color:#7A5F57}.aeo-guide ol{padding-left:22px}.aeo-guide li{margin:0 0 10px}.aeo-guide a{color:#A9594A}</style>
${qaBox({ q: 'Measuring in short', a: `Measure inside the window frame with a metal tape: three widths (top, middle, bottom) and three heights (left, middle, right), to the closest eighth below. We order the narrowest width and the longest height. Measure the depth too: Roller and Zebra need about 2″ and Roman and Woven about 2½″ to mount inside the frame. It takes about 7 minutes, and a Hello Shade designer checks every number before we make your shade. If you measured with this guide and we checked it, a measuring mistake is remade free.` })}
<h2 id="g-h">How to measure a window for shades</h2>
<ol>${steps.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join('')}</ol>
<h2>How to install</h2>
<p>About 15–20 minutes a shade: mark and screw in two brackets, then hang the shade on them. In the box: the shade, brackets, screws and instructions. You need a drill, a pencil and a tape measure. Shades over 50″ wide may come with a center bracket. Always install the chain tensioner on a chain shade and keep cords and chains away from children.</p>
<p>Questions? Text a designer at ${PHONE_TXT}. More: <a href="/guides/inside-vs-outside-mount/">inside vs outside mount</a> · <a href="/prices/">prices by size</a>.</p>
</section><!--/aeo:qa-->`;
  const howto = {
    '@type': 'HowTo', '@id': `${SITE}/how-to-measure/#howto`, name: 'How to measure a window for custom shades', totalTime: 'PT7M',
    tool: ['Metal tape measure', 'Phone camera', 'Pencil'].map(name => ({ '@type': 'HowToTool', name })),
    step: steps.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })),
  };
  let h = read('how-to-measure/index.html');
  h = setBlock(h, 'ld', ldBlock([webPage('/how-to-measure/', 'How to measure', 'Measure your window for custom shades in about 7 minutes.'), howto]), beforeHeadEnd);
  h = setBlock(h, 'qa', html, h2 => h2.indexOf('<div class="scrim"'));
  write('how-to-measure/index.html', h);
  edited.push('how-to-measure/index.html');
}

// About, rooms index, fabrics: structured data only.
editPage('about/index.html', { ld: [webPage('/about/', 'About Hello Shade', 'Custom shades with designer help by text.', 'AboutPage')] });
editPage('rooms/index.html', { ld: [webPage('/rooms/', 'Shades by room', 'Shade picks for every room.', 'CollectionPage')] });
editPage('fabrics/index.html', { ld: [webPage('/fabrics/', 'Fabrics', 'Every Hello Shade fabric and color.', 'CollectionPage'), itemList(products)] });

// ---------- Intent pages ----------
const TEMPLATE = read('faq/index.html').replace(/<!--aeo:ld-->[\s\S]*?<!--\/aeo:ld-->/, '');
function intentPage({ url, title, description, h1, lede, qa, body, ld }) {
  const depth = url.split('/').filter(Boolean).length;
  const rel = '../'.repeat(depth);
  let h = TEMPLATE;
  const head = h.slice(0, h.indexOf('<main')), foot = h.slice(h.indexOf('</main>'));
  const fix = s => s.replace(/(["(=])\.\.\//g, `$1${rel}`)                                   // faq is one level deep
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} · Hello Shade</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)} · Hello Shade`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}${url}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}${url}`)
    .replace(/(<meta name="tl-root" content=")[^"]*/, `$1${rel}`)
    .replace(/ aria-current="page"/g, '');
  const main = `<main id="main">
<section class="page-hero"><div class="container narrow"><p class="crumbs"><a href="${rel}">Home</a> / <a href="${rel}faq/">Help</a></p><h1>${h1}</h1><p class="lede">${lede}</p></div></section>
<section class="section tight" style="padding-top:0"><div class="container narrow prose">
<!--aeo:qa-->${qaBox(qa)}<!--/aeo:qa-->
${body}
<div class="band" style="margin-top:36px"><h2>Want a hand?</h2><p>Text a designer. We'll help you pick, measure and order.</p><div class="btn-row"><a class="btn gold" data-dana data-body="Hi Dana! I have a question." href="sms:+12017453300?body=Hi%20Dana%21%20I%20have%20a%20question.">Text a designer</a><a class="btn" href="${rel}studio/">Try on shades</a></div></div>
</div></section>
`;
  let out = fix(head) + main + fix(foot);
  out = setBlock(out, 'ld', ldBlock(ld), beforeHeadEnd);
  write(url.slice(1) + 'index.html', out);
  edited.push(url.slice(1) + 'index.html');
}
const table = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const faqHtml = qas => `<div class="faq">${qas.map(([q, a]) => `<details><summary>${q}</summary><div class="answer"><p>${a}</p></div></details>`).join('')}</div>`;

// 1. Prices
{
  const qas = [
    ['Why isn’t my shade $209?', `${usd(P.LOWEST_FROM)} is the smallest Roller, 24×24″. Size and type set the price; fabric and color within a type don’t.`],
    ['Is the price shown the price I pay?', 'The price shown for your size is held unless our measurement check finds a different size. Your written quote shows the full price, including any shipping and sales tax, before you pay.'],
    ['Do you offer discounts?', 'Prices are the same for everyone. To lower the price, try another type, skip the lining or start with fewer windows.'],
    ['How do I get an exact price?', 'Add your window width and height on any shade page under Your price. Sizes outside 12–96″ wide or 12–120″ high are quoted by text.'],
  ];
  intentPage({
    url: '/prices/', title: 'How much do custom shades cost?', description: `Hello Shade prices by size: Roller from ${usd(fromType.roller)}, Roman from ${usd(fromType.roman)}. A 36×60″ Roller is ${usd(mType.roller)}. Full price table.`,
    h1: 'How much do custom shades cost?', lede: 'Every price, by type and window size.',
    qa: {
      a: `Hello Shade custom shades cost ${usd(P.LOWEST_FROM)} to about ${usd(Math.max(...PRICE_ROWS.flatMap(r => r.prices)))} each, depending on type and size. For a common 36×60″ window: Roller ${usd(mType.roller)}, Zebra ${usd(mType.zebra)} (estimate), Roman ${usd(mType.roman)} (${usd(mType.romanLined)} with a room-darkening lining) and Woven ${usd(mType.woven)}. Each window is priced separately. That's about half of in-home studio prices, because there's no showroom and no home visit.`,
      facts: STD_FACTS,
    },
    body: `<h2>Prices by window size</h2><p>Width × height in inches, price per shade.</p>${table(['Type', ...PRICE_SIZES.map(([w, h]) => `${w}×${h}″`)], PRICE_ROWS.map(r => [r.label, ...r.prices.map(usd)]))}
<p class="small">Zebra prices are an estimate until we confirm by text. Roman prices are the same for Raw Linen, Soft Cotton, Ticking Stripe, Sheer Voile and Blackout Linen; only Raw Linen, Soft Cotton and Ticking Stripe can add the lining.</p>
<h2>What sets the price</h2><ul><li><b>Type:</b> Roller costs least, then Zebra, Roman and Woven.</li><li><b>Size:</b> width × height. Bigger windows cost more.</li><li><b>Lining:</b> a room-darkening lining adds a little to a Roman.</li><li>Fabric and color don’t change the price within a type.</li></ul>
<h2>Questions about price</h2>${faqHtml(qas)}`,
    ld: [webPage('/prices/', 'How much do custom shades cost?', 'Hello Shade prices by type and window size.'), crumbs([['Home', '/'], ['Prices', '/prices/']]), faqLd(qas)],
  });
}

// 2. Which type
{
  const rows = [
    ['Roller', usd(fromType.roller), usd(mType.roller), 'Clean, simple, rolls up tight', 'Light filtering, screen, blackout', 'Kitchens, bathrooms, offices, bedrooms (blackout)'],
    ['Zebra', usd(fromType.zebra), `${usd(mType.zebra)} (est.)`, 'Adjust light without raising it', 'Light filtering', 'Living rooms, offices, bathrooms'],
    ['Roman', usd(fromType.roman), usd(mType.roman), 'Soft folds, tailored look', 'Light filtering, sheer, blackout, optional lining', 'Living rooms, bedrooms, nurseries'],
    ['Woven', usd(fromType.woven), usd(mType.woven), 'Natural woven wood, flat fold', 'Light filtering', 'Living rooms, kitchens, bedrooms'],
  ];
  const qas = [
    ['Roller or Roman?', 'Roller for a clean, simple look and the lowest price. Roman for soft folds and a finished, tailored look. For a dark bedroom both come in blackout: Deep Sleep Roller or Blackout Linen Roman.'],
    ['What is a Zebra shade?', 'Two layers of fabric bands. Slide them to line up the open bands for a view, or the solid bands for privacy, without raising the shade.'],
    ['Which is darkest?', 'A blackout fabric (Deep Sleep Roller or Blackout Linen Roman) mounted outside the frame, on the wall above the window.'],
    ['Which is easiest to clean?', 'Roller shades: a flat fabric you can wipe or dust, which is why they suit kitchens and bathrooms.'],
  ];
  intentPage({
    url: '/guides/which-shade-type/', title: 'Roller vs Roman vs Zebra vs Woven shades', description: 'Which shade type to get: Roller, Roman, Zebra or Woven compared by look, light, rooms and price.',
    h1: 'Roller, Roman, Zebra or Woven?', lede: 'How the four shade types compare, and which room each suits.',
    qa: {
      a: `Pick a Roller for a clean look at the lowest price (from ${usd(fromType.roller)}), a Roman for soft folds and a tailored look (from ${usd(fromType.roman)}), a Zebra to adjust light during the day without raising the shade (from ${usd(fromType.zebra)}), or a Woven for natural texture (from ${usd(fromType.woven)}). For a dark bedroom or nursery, choose a blackout fabric: the Deep Sleep Roller or the Blackout Linen Roman.`,
    },
    body: `<h2>Side by side</h2>${table(['Type', 'From', '36×60″', 'Look', 'Light', 'Best rooms'], rows)}<h2>Common questions</h2>${faqHtml(qas)}<p>Still deciding? <a href="../../studio/">Try them on in a room</a>, or order <a href="../../swatch-kit/">samples</a> ($10, credited to your order).</p>`,
    ld: [webPage('/guides/which-shade-type/', 'Roller vs Roman vs Zebra vs Woven shades', 'How the four shade types compare.', 'Article'), crumbs([['Home', '/'], ['Guides', '/faq/'], ['Which shade type?', '/guides/which-shade-type/']]), faqLd(qas)],
  });
}

// 3. No home visit
{
  const qas = [
    ['What if I measure wrong?', 'If you measured with our guide and a designer checked your numbers and photos first, we remake the shade free, once per shade, within 30 days of delivery. The remake can change size and mount.'],
    ['Who installs it?', 'You do, and most people don’t need help: two brackets, a few screws and a drill, about 15–20 minutes a shade.'],
    ['Can I see the fabric first?', 'Yes. Up to 5 fabric samples for $10, mailed to you and credited to your shade order.'],
    ['How do I pay?', 'A designer texts a written summary of each window. Reply YES and we text a secure Stripe payment link. Nothing is made until you approve and pay.'],
  ];
  intentPage({
    url: '/guides/custom-shades-without-a-home-visit/', title: 'Custom shades without a home visit', description: 'How to buy custom window shades without an in-home consultation: try on online, text a designer, measure in 7 minutes.',
    h1: 'Custom shades without a home visit', lede: 'You don’t need a designer at your door. Just a little guidance.',
    qa: {
      a: `Yes, you can get custom-made shades without an in-home consultation. With Hello Shade you try shades on in a room on the site, then text a designer a photo of your window. The designer helps you choose, walks you through measuring (about 7 minutes with a metal tape) and checks every number. Shades ship ${SHIP} after you order and hang in about 15–20 minutes. Without a showroom or home visits, prices are about half of in-home studio prices: a 36×60″ Roller is ${usd(mType.roller)}.`,
      facts: STD_FACTS,
    },
    body: `<h2>How it works</h2><ol><li><b>Try on.</b> See real shades in a room and pick a type, fabric and color.</li><li><b>Text a designer.</b> Send a window photo or a look you like. We help you pick, measure and order, all by text.</li><li><b>We make it and ship it.</b> Made for your window, ships ${SHIP} after you order.</li></ol><h2>Common questions</h2>${faqHtml(qas)}`,
    ld: [webPage('/guides/custom-shades-without-a-home-visit/', 'Custom shades without a home visit', 'Buying custom shades without an in-home consultation.', 'Article'), crumbs([['Home', '/'], ['Guides', '/faq/'], ['No home visit', '/guides/custom-shades-without-a-home-visit/']]), faqLd(qas)],
  });
}

// 4. Inside vs outside mount
{
  const qas = [
    ['How deep does the window need to be for an inside mount?', 'From the glass to the front edge of the frame: about 2″ for Roller and Zebra, about 2½″ for Roman and Woven.'],
    ['Which mount is darker?', 'Outside. Covering the frame and the gaps at the edges blocks the most light, so it’s the pick for a blackout bedroom or nursery.'],
    ['What if a crank or handle is in the way?', 'Measure how far it sticks out. If it blocks the shade, mount outside or use a crank extender (about $10 at a hardware store).'],
    ['Who decides the mount?', 'You choose, and a designer checks your depth measurement and confirms inside or outside in writing before we make the shade.'],
  ];
  intentPage({
    url: '/guides/inside-vs-outside-mount/', title: 'Inside vs outside mount shades', description: 'Inside or outside mount for window shades: depth needed, which is darker, and how to choose.',
    h1: 'Inside or outside mount?', lede: 'Where the shade goes, and how to choose.',
    qa: {
      a: `An inside mount sits within the window frame for a clean, built-in look; it needs about 2″ of depth for a Roller or Zebra and about 2½″ for a Roman or Woven. An outside mount hangs on the wall above the window and covers the frame, which blocks the most light and works for shallow windows or ones with cranks and handles in the way. For blackout, go outside.`,
    },
    body: `${table(['', 'Inside mount', 'Outside mount'], [['Look', 'Clean, shows the frame', 'Covers the frame'], ['Light', 'Thin light gaps at the edges', 'Darkest'], ['Depth needed', '≈2″ Roller/Zebra, ≈2½″ Roman/Woven', 'Any'], ['Measure', '3 widths, 3 heights inside the frame', 'The size you want covered'], ['Best for', 'Most windows', 'Blackout, shallow frames, obstructions']])}<h2>Common questions</h2>${faqHtml(qas)}<p><a href="../../how-to-measure/">How to measure</a> · <a href="../../shades/blackout/">Blackout shades</a></p>`,
    ld: [webPage('/guides/inside-vs-outside-mount/', 'Inside vs outside mount shades', 'Choosing inside or outside mount.', 'Article'), crumbs([['Home', '/'], ['Guides', '/faq/'], ['Inside vs outside mount', '/guides/inside-vs-outside-mount/']]), faqLd(qas)],
  });
}

// ---------- feed.json (public, live catalog and prices) ----------
const feed = {
  name: 'Hello Shade', url: `${SITE}/`, updated: UPDATED, currency: 'USD',
  about: 'Custom window shades made to measure and shipped to your door. Designer help by text instead of a home visit.',
  contact: { text_a_designer: PHONE, hours: 'New texts 9am–8pm local time, Monday to Saturday' },
  policies: {
    sizes_in: { width: [P.LIMITS.minW, P.LIMITS.maxW], height: [P.LIMITS.minH, P.LIMITS.maxH], outside_range: 'quoted by text' },
    ships: `${SHIP} after you order`, install: 'About 15–20 minutes a shade with a drill; we don’t install',
    samples: { price: 10, max_fabrics: 5, credited_to_order: true, url: `${SITE}/swatch-kit/` },
    fit_guarantee: 'Measure wrong and we remake it free, once per shade, within 30 days of delivery, when a designer checked your numbers and photos first.',
    returns: 'Custom shades can’t be returned for a change of mind. Measuring mistakes are remade free; defects are fixed or replaced; shipping damage is replaced.',
    pricing: 'Price by type and width × height; fabric and color don’t change it. Zebra prices are an estimate until confirmed by text. Prices are the same for everyone.',
  },
  types: Object.fromEntries(Object.entries(TYPE).map(([t, T]) => [t, { name: T.label, url: SITE + T.url, description: T.blurb, from_price: fromType[t], price_36x60: mType[t] }])),
  price_table: { sizes_in: PRICE_SIZES.map(([w, h]) => `${w}x${h}`), rows: PRICE_ROWS.map(r => ({ type: r.label, prices: r.prices })) },
  products: products.map(p => ({
    name: p.name, type: p.type, url: SITE + p.url, light: p.light, colors: p.colors, best_rooms: p.rooms,
    from_price: p.from, price_36x60: p.m, price_36x60_with_lining: p.mLined, price_is_estimate: p.estimate, image: p.image,
  })),
};
write('feed.json', JSON.stringify(feed, null, 2) + '\n');

// ---------- llms.txt ----------
const page = (t, u, d) => `- [${t}](${SITE}${u}): ${d}`;
const llms = `# Hello Shade

> Hello Shade sells custom window shades online (Roller, Roman, Zebra, Woven), made to measure for each window and shipped to the customer's door ${SHIP} after ordering. No showroom and no home visit: customers try shades on in a room on the site, then text a designer who helps them pick, measure and order. Shades start at ${usd(P.LOWEST_FROM)}; a 36×60″ Roller is ${usd(mType.roller)}. Facts on this page were updated ${UPDATED}. Live prices and products as JSON: ${SITE}/feed.json

Key facts:
- Types and From prices (24×24″): Roller ${usd(fromType.roller)}, Zebra ${usd(fromType.zebra)} (estimate), Roman ${usd(fromType.roman)}, Woven ${usd(fromType.woven)}.
- At 36×60″: Roller ${usd(mType.roller)}, Zebra ${usd(mType.zebra)} (estimate), Roman ${usd(mType.roman)}, Roman with room-darkening lining ${usd(mType.romanLined)}, Woven ${usd(mType.woven)}.
- Price is set by type and size; fabric and color don't change it. Each window is priced separately. Same prices for everyone.
- Sizes: 12–96″ wide, 12–120″ high. Larger or unusual windows are quoted by text.
- Samples: up to 5 fabrics for $10, credited to the shade order.
- Fit guarantee: measure wrong and the shade is remade free, once per shade, within 30 days of delivery, when a designer checked the numbers and photos first.
- Customers measure themselves (about 7 minutes) and install themselves (about 15–20 minutes a shade). Hello Shade doesn't install.
- Text a designer: ${PHONE_TXT}.

## Guides
${page('How much do custom shades cost?', L.prices, 'full price table by type and window size')}
${page('Roller vs Roman vs Zebra vs Woven', L.types, 'which shade type to choose')}
${page('Custom shades without a home visit', L.noVisit, 'how buying by text works')}
${page('Inside vs outside mount', L.mount, 'depth needed and which is darker')}
${page('How to measure', L.measure, 'step-by-step measuring and install guide')}
${page('FAQ', L.faq, 'common questions')}

## Shop
${Object.entries(TYPE).map(([t, T]) => page(`${T.label} shades`, T.url, `${T.blurb} From ${usd(fromType[t])}.`)).join('\n')}
${page('Blackout shades', '/shades/blackout/', 'for bedrooms and nurseries')}
${products.map(p => page(p.name, p.url, `${p.light}, ${p.colors.join('/')}. From ${usd(p.from)}; ${usd(p.m)} at 36×60″.`)).join('\n')}

## Rooms
${Object.entries(ROOM_QA).map(([r, [q]]) => page(r.replace('-', ' ').replace(/^./, c => c.toUpperCase()), `/rooms/${r}/`, q)).join('\n')}

## Optional
${page('How it works', '/how-it-works/', 'try on, text a designer, we make it and ship it')}
${page('Samples', '/swatch-kit/', '$10 for up to 5 fabrics')}
${page('About', '/about/', 'who we are')}
${page('Terms of sale', '/terms.html', 'returns, Fit guarantee, payment')}
`;
write('llms.txt', llms);

// ---------- sitemap.xml ----------
const urls = ['/', '/shades/', ...Object.values(TYPE).map(t => t.url), '/shades/blackout/', ...products.map(p => p.url),
  '/rooms/', ...Object.keys(ROOM_QA).map(r => `/rooms/${r}/`), '/fabrics/', '/swatch-kit/', '/prices/', L.types, L.noVisit, L.mount,
  '/how-to-measure/', '/how-it-works/', '/faq/', '/about/', '/studio/', '/try-your-window/', '/contact.html', '/terms.html', '/privacy.html', '/sms.html'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);

console.log(`products ${products.length}, pages edited/written ${edited.length}`);
