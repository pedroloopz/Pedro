#!/usr/bin/env python3
"""Gera dist/language-master.html a partir de src/ (layout, dados e app)."""
import pathlib
ROOT = pathlib.Path(__file__).parent
DATA = ["ja-n3.js","ja-n2a.js","ja-n2b.js","ja-n2c.js","ja-n2d.js","de-a2b1.js","de-b2.js",
        "vocab-ja.js","vocab-ja2.js","vocab-ja3.js","kanji-ja.js","kanji-ja2.js","vocab-de.js","vocab-de2.js","vocab-de3.js","readings.js","poems.js"]
head = (ROOT/"src/head.html").read_text(encoding="utf8")
data = "\n".join((ROOT/"src/data"/f).read_text(encoding="utf8") for f in DATA)
app = (ROOT/"src/app.js").read_text(encoding="utf8")
out = head + "\n<script>\n" + data + "\n</script>\n<script>\n" + app + "</script>\n"
(ROOT/"dist").mkdir(exist_ok=True)
(ROOT/"dist/language-master.html").write_text(out, encoding="utf8")
SKELETON = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
            'body{margin:0}[hidden]{display:none!important}</style></head><body>')
(ROOT/"dist/standalone.html").write_text(SKELETON + out + "</body></html>\n", encoding="utf8")
print("dist/language-master.html", len(out.encode("utf8")), "bytes")
