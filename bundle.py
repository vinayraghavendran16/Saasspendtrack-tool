#!/usr/bin/env python3
"""Bundle index.src.html + external js/css into one self-contained HTML.

Reads  : index.src.html (source template with <script src>/<link href>)
Writes : /home/claude/saasspendtrack_app.html  (artifact / QA bundle)
         saasspendtrack-tool/index.html        (deployable, committed to git)
"""
import re, os

src = '/home/claude/saasspendtrack-tool'
source_html = os.path.join(src, 'index.src.html')

with open(source_html, 'r') as f:
    html = f.read()

def inline_css(m):
    href = m.group(1)
    p = os.path.join(src, href)
    if not os.path.exists(p): return m.group(0)
    with open(p) as fh: body = fh.read()
    return f'<style>\n{body}\n</style>'

def inline_js(m):
    src_attr = m.group(1)
    if src_attr.startswith('http'): return m.group(0)
    p = os.path.join(src, src_attr)
    if not os.path.exists(p): return m.group(0)
    with open(p) as fh: body = fh.read()
    return f'<script>\n{body}\n</script>'

html = re.sub(r'<link[^>]+href="([^"]+\.css)"[^>]*>', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

out_qa = '/home/claude/saasspendtrack_app.html'
out_deploy = os.path.join(src, 'index.html')
for out in (out_qa, out_deploy):
    with open(out, 'w') as f: f.write(html)
    print(f'wrote {out} ({os.path.getsize(out)} bytes)')
