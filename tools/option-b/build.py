#!/usr/bin/env python3
"""Option B preview pages: home-b.html and shades-b.html (noindex), built from the live pages.

Run from the repo root:  python3 tools/option-b/build.py
Product images come from images/b/ (render with: node tools/render-cards/run.mjs).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
read = lambda p: (ROOT / p).read_text()

def to_b(h, title):
    h = re.sub(r'<!--aeo:ld-->.*?<!--/aeo:ld-->', '', h, flags=re.S)
    h = re.sub(r'<!--aeo:qa-->.*?<!--/aeo:qa-->', '', h, flags=re.S)
    h = re.sub(r'<title>[^<]*</title>', f'<meta name="robots" content="noindex">\n<title>{title} · Hello Shade</title>', h, count=1)
    h = h.replace('<link rel="stylesheet" href="flow/site.css">',
                  '<link rel="stylesheet" href="flow/site.css">\n<link rel="stylesheet" href="flow/site-b.css">\n'
                  '<link rel="preload" href="fonts/fraunces-italic.woff2" as="font" type="font/woff2" crossorigin>')
    h = re.sub(r'<body class="([^"]*)"', r'<body class="\1 b"', h, count=1)
    h = re.sub(r'<body>', '<body class="b">', h, count=1)
    # plain-backdrop product images
    h = re.sub(r'images/p/([a-z0-9-]+?)-sq\.webp', r'images/b/\1.webp', h)
    return h

def sec(body, cls='section'):
    return f'<section class="{cls}">\n <div class="container">\n{body}\n </div>\n</section>\n'

def head(title, link=None):
    l = f'<a class="text-link arrow" href="{link[1]}">{link[0]}</a>' if link else ''
    return f'  <div class="section-head"><div><h2>{title}</h2></div>{l}</div>'

# ---------- Home ----------
src = read('index.html')
h = to_b(src, 'Home option B')
main_start, main_end = h.index('<main id="main">'), h.index('</main>')
m = h[main_start:main_end]

hero = re.search(r'<section class="studio-hero">.*?</section>', m, re.S).group(0)
sun = ('<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M32 12V4M43 14.9L47 8M21 14.9L17 8M51 23L58 19M13 23L6 19" '
       'stroke="#E8AE45" stroke-width="4" stroke-linecap="round"/><path d="M14 34A18 18 0 0 1 50 34Z" fill="#E8AE45"/>'
       '<rect x="2" y="34" width="60" height="3" rx="1.5" fill="#A9594A"/></svg>')
hero = hero.replace('<h1>You don\'t need a designer at your door.</h1>',
                    f'<p class="trust">{sun}Measure wrong? We\'ll remake it free.</p>\n   <h1>You don\'t need a designer <em>at your door.</em></h1>')
hero = re.sub(r'<p class="lede">.*?</p>',
              '<p class="lede">Just a little guidance. Try shades on, then text a designer. <b>Ships in 2–4 weeks.</b></p>', hero, count=1, flags=re.S)
assert '<em>at your door.</em>' in hero

tiles = re.search(r'<div class="tiles four">.*?</div>', m, re.S).group(0)
popular = re.search(r'<div class="grid four compact">.*?</a></div>', m, re.S).group(0).replace('grid four compact', 'grid')
feature = re.search(r'<section class="section">\s*<div class="container feature">.*?</section>', m, re.S).group(0)
feature = feature.replace('<h2>A little guidance, by text.</h2>', '<h2>A little guidance, <em>by text.</em></h2>')

steps = '''  <ol class="steps3">
   <li><span class="n">01</span><h3>Try it on</h3><p>See real shades in a room. Pick a type, a fabric and a color.</p></li>
   <li><span class="n">02</span><h3>Text a designer</h3><p>We help you pick and measure, and we check every number. About 7 minutes.</p></li>
   <li><span class="n">03</span><h3>We make it and ship it</h3><p>Made for your window, ships in 2–4 weeks. Hangs in about 15–20 minutes.</p></li>
  </ol>'''

faq_src = read('faq/index.html')
qas = re.findall(r'<details><summary>(.*?)</summary><div class="answer">(.*?)</div></details>', faq_src)
pick = [q for q in qas if q[0] in ('Do I need someone to come to my house?', 'How much do shades cost?', 'Is measuring hard?',
                                    'Can I see the fabric first?', 'How long does it take?', 'Do you install?')]
faq_items = ''.join(f'<details><summary>{q}</summary><div class="answer">{a.replace("../", "")}</div></details>' for q, a in pick)
faq = f'''  <div class="faq-wrap">
   <div><h2>Good <em>questions.</em></h2><p class="lede" style="margin-top:12px">Something else? <a class="text-link" href="faq/">See all</a> or text a designer.</p></div>
   <div class="faq">{faq_items}</div>
  </div>'''

new_main = ('<main id="main">\n\n' + hero + '\n'
            + sec(head('Four styles. <em>Made to measure.</em>', ('All shades', 'shades-b.html')) + '\n  ' + tiles)
            + sec(head('Start <em>here.</em>', ('Shop all', 'shades-b.html')) + '\n  ' + popular)
            + sec(head('How it <em>works.</em>', ('More', 'how-it-works/')) + '\n' + steps)
            + feature + '\n'
            + sec(faq)
            + '\n')
h = h[:main_start] + new_main + h[main_end:]
h = h.replace('href="shades/"><b>All shades', 'href="shades-b.html"><b>All shades')
(ROOT / 'home-b.html').write_text(h)

# ---------- Shop: all shades ----------
s = read('shades/index.html')
s = s.replace('"../', '"').replace("(../", "(").replace('content="../"', 'content=""')
s = re.sub(r'(<meta name="tl-root" content=")[^"]*', r'\1', s)
s = to_b(s, 'Shop option B')
s = re.sub(r'<!--aeo:qa-->.*?<!--/aeo:qa-->', '', s, flags=re.S)
s = s.replace('<h1>All shades</h1>', '<h1>All <em>shades.</em></h1>')
s = s.replace('<p>Roller, Roman, zebra and woven, made for your window. From $209.</p>',
              '<p>Roller, Roman, Zebra and Woven, made to your window. From $209.</p>')
s = s.replace('<a class="brand" href="">', '<a class="brand" href="home-b.html">')
(ROOT / 'shades-b.html').write_text(s)
print('wrote home-b.html, shades-b.html')
