#!/usr/bin/env python3
"""Рендер раскадровки клипа в один HTML-файл (без внешних зависимостей).

Пример:
    python render_storyboard.py analysis.json script.json -o storyboard.html
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from typing import Any

MAX_SCENE = 8.0  # максимальная длина клипа у Veo/Kling, секунд

SECTION_COLORS: dict[str, str] = {
    "intro": "var(--c-intro)", "verse": "var(--c-verse)", "chorus": "var(--c-chorus)",
    "bridge": "var(--c-bridge)", "outro": "var(--c-outro)",
}


def esc(v: Any) -> str:
    return html.escape(str(v if v is not None else ""))


def fmt_t(sec: float) -> str:
    m, s = divmod(float(sec), 60)
    return f"{int(m)}:{s:05.2f}"


def validate(script: dict[str, Any], duration: float) -> list[str]:
    """Проверяет сценарий: пропуски/наложения сцен и выход за длину трека."""
    issues: list[str] = []
    scenes = sorted(script.get("scenes", []), key=lambda s: float(s.get("start", 0)))
    if not scenes:
        return ["В сценарии нет сцен"]
    if float(scenes[0]["start"]) > 0.05:
        issues.append(f"Первая сцена начинается с {scenes[0]['start']}s, а не с 0")
    for a, b in zip(scenes, scenes[1:]):
        gap = float(b["start"]) - float(a["end"])
        if abs(gap) > 0.05:
            issues.append(f"Сцены {a.get('id')}→{b.get('id')}: {'пропуск' if gap > 0 else 'наложение'} {abs(gap):.2f}s")
    for s in scenes:
        if float(s["end"]) - float(s["start"]) > MAX_SCENE:
            issues.append(f"Сцена {s.get('id')} длиннее {MAX_SCENE:.0f}s — генератор не вытянет одним клипом, раздели")
    if abs(float(scenes[-1]["end"]) - duration) > 0.5:
        issues.append(f"Последняя сцена заканчивается на {scenes[-1]['end']}s, трек — {duration}s")
    return issues


def energy_svg(analysis: dict[str, Any], scenes: list[dict[str, Any]]) -> str:
    """SVG: полосы частей трека, кривая энергии, границы сцен."""
    dur = float(analysis["duration"])
    w, h = 1000, 140
    x = lambda t: float(t) / dur * w  # noqa: E731
    parts: list[str] = []
    for s in analysis["sections"]:
        col = SECTION_COLORS.get(s["label"], "var(--c-verse)")
        parts.append(f'<rect x="{x(s["start"]):.1f}" y="0" width="{x(s["end"]) - x(s["start"]):.1f}" '
                     f'height="{h}" fill="{col}" opacity="0.35"><title>{esc(s["label"])} '
                     f'{fmt_t(s["start"])}–{fmt_t(s["end"])}</title></rect>')
        parts.append(f'<text x="{x(s["start"]) + 4:.1f}" y="14" class="lbl">{esc(s["label"])}</text>')
    en = analysis["energy_per_second"]
    pts = " ".join(f"{x(i + 0.5):.1f},{h - 8 - v * (h - 30):.1f}" for i, v in enumerate(en))
    parts.append(f'<polyline points="{pts}" fill="none" stroke="var(--fg)" stroke-width="1.6"/>')
    for t in analysis.get("peaks", []):
        parts.append(f'<circle cx="{x(t):.1f}" cy="{h - 6}" r="3" fill="var(--accent)"><title>пик {fmt_t(t)}</title></circle>')
    for sc in scenes:
        parts.append(f'<line x1="{x(sc["start"]):.1f}" x2="{x(sc["start"]):.1f}" y1="20" y2="{h}" '
                     f'stroke="var(--muted)" stroke-dasharray="2 3"/>')
    return f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" role="img" aria-label="Энергия трека">{"".join(parts)}</svg>'


def scene_card(sc: dict[str, Any]) -> str:
    rows = [
        ("Кадр", sc.get("shot")), ("Камера", sc.get("camera")), ("Что в кадре", sc.get("visual")),
        ("Текст песни", sc.get("lyrics")), ("Переход", sc.get("transition")),
    ]
    body = "".join(f"<dt>{k}</dt><dd>{esc(v)}</dd>" for k, v in rows if v)
    prompt = sc.get("prompt")
    prompt_html = (f'<details open><summary>Промпт для видео-генератора</summary>'
                   f'<pre>{esc(prompt)}</pre><button type="button" class="copy">Копировать</button></details>'
                   if prompt else "")
    col = SECTION_COLORS.get(str(sc.get("section", "")), "var(--c-verse)")
    dur = float(sc["end"]) - float(sc["start"])
    return (f'<article class="scene" style="--sec:{col}"><header><span class="num">#{esc(sc.get("id"))}</span>'
            f'<span class="time">{fmt_t(sc["start"])} – {fmt_t(sc["end"])} · {dur:.1f}s</span>'
            f'<span class="tag">{esc(sc.get("section", ""))}</span></header>'
            f'<dl>{body}</dl>{prompt_html}</article>')


CSS = """
:root{--bg:#fafaf8;--fg:#1d1d1b;--muted:#77756f;--card:#fff;--line:#e3e1db;--accent:#d2462f;
--c-intro:#7aa6c2;--c-verse:#8fb98a;--c-chorus:#e0a43a;--c-bridge:#b48ac9;--c-outro:#9a9a9a;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#151514;--fg:#ecebe6;--muted:#9a978f;
--card:#1f1f1d;--line:#33322f;--accent:#ff7a5c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#151514;--fg:#ecebe6;--muted:#9a978f;--card:#1f1f1d;--line:#33322f;--accent:#ff7a5c;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{margin:0 0 4px;font-size:28px}
.meta{color:var(--muted);margin:0 0 16px}.concept{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:16px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;padding:0;list-style:none}.chips li{border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px}
svg{width:100%;height:140px;display:block;background:var(--card);border:1px solid var(--line);border-radius:10px}
.lbl{font-size:11px;fill:var(--fg)}.issues{border-left:3px solid var(--accent);padding:6px 12px;margin:12px 0;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-top:20px}
.scene{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--sec);border-radius:10px;padding:12px 14px;min-width:0}
.scene header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}.num{font-weight:700}
.time{color:var(--muted);font-variant-numeric:tabular-nums;font-size:13px}.tag{margin-left:auto;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
dl{margin:0;display:grid;grid-template-columns:96px 1fr;gap:4px 10px;font-size:14px}dt{color:var(--muted)}dd{margin:0}
details{margin-top:10px}summary{cursor:pointer;font-size:13px;color:var(--muted)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;font-size:12.5px;margin:6px 0}
.copy{font:inherit;font-size:12px;padding:3px 10px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer}
h2{font-size:18px;margin:24px 0 8px}
"""

JS = """
document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{
 const t=b.previousElementSibling.textContent;try{await navigator.clipboard.writeText(t);b.textContent='Скопировано';}
 catch(e){b.textContent='Не удалось';}setTimeout(()=>b.textContent='Копировать',1500);}));
"""


def render(analysis: dict[str, Any], script: dict[str, Any]) -> str:
    scenes = sorted(script.get("scenes", []), key=lambda s: float(s.get("start", 0)))
    issues = validate(script, float(analysis["duration"]))
    title = script.get("title") or analysis.get("file", "Клип")
    chips = [f"{analysis['bpm']} BPM", analysis["key"], f"{fmt_t(analysis['duration'])}",
             f"{len(scenes)} сцен"]
    style = script.get("style") or {}
    style_html = "".join(f"<li>{esc(k)}: {esc(v)}</li>" for k, v in style.items()) if isinstance(style, dict) else ""
    chars = script.get("characters") or []
    chars_html = "".join(f"<dt>{esc(c.get('name'))}</dt><dd>{esc(c.get('description'))}</dd>" for c in chars)
    issues_html = ("<div class='issues'><b>Проверка таймингов:</b><br>" + "<br>".join(esc(i) for i in issues) + "</div>"
                   if issues else "")
    return f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><style>{CSS}</style></head>
<body><main><h1>{esc(title)}</h1><p class="meta">{esc(script.get('artist', ''))} · {esc(analysis.get('mood_hint', ''))}</p>
<ul class="chips">{''.join(f'<li>{esc(c)}</li>' for c in chips)}</ul>
{f"<div class='concept'>{esc(script.get('concept'))}</div>" if script.get('concept') else ''}
{energy_svg(analysis, scenes)}{issues_html}
{f"<h2>Стиль</h2><ul class='chips'>{style_html}</ul>" if style_html else ''}
{f"<h2>Персонажи</h2><dl>{chars_html}</dl>" if chars_html else ''}
<h2>Сцены</h2><div class="grid">{''.join(scene_card(s) for s in scenes)}</div></main><script>{JS}</script></body></html>"""


def main() -> None:
    p = argparse.ArgumentParser(description="HTML-раскадровка клипа")
    p.add_argument("analysis", type=Path, help="JSON из analyze_audio.py")
    p.add_argument("script", type=Path, help="JSON сценария (формат — в SKILL.md)")
    p.add_argument("-o", "--output", type=Path, default=Path("storyboard.html"))
    args = p.parse_args()
    try:
        analysis = json.loads(args.analysis.read_text(encoding="utf-8"))
        script = json.loads(args.script.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"Не удалось прочитать JSON: {exc}")
    args.output.write_text(render(analysis, script), encoding="utf-8")
    issues = validate(script, float(analysis["duration"]))
    print(f"OK → {args.output}")
    for i in issues:
        print(f"! {i}")


if __name__ == "__main__":
    main()
