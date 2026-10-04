"""앱 아이콘 만들기: 진도 칸(단계마다 한 칸, 채워진 만큼 색) 모양.

    python tools/make_icons.py            # 실제 앱 아이콘
    python tools/make_icons.py --preview  # 미리 보기 아이콘 (주황 바탕 — 홈 화면에서 실제 앱과 구별)

icons/ 에 icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png, icon.svg 를 만든다.
미리 보기는 preview-192.png, preview-512.png, preview-maskable-512.png, preview-apple-touch-icon.png.
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

BG = (31, 92, 74)        # 종이 디자인의 초록 (--accent)
INK = (244, 241, 232)    # 종이 색
MARK = (232, 135, 90)    # 지금 단계 밑줄
CELLS = [(0.26, 1.0), (0.20, 1.0), (0.30, 0.5), (0.24, 0.0)]  # (너비 비율, 채운 비율)


def geometry(size, safe):
    """safe: 그림이 들어갈 가운데 영역 비율 (maskable은 작게)"""
    w = size * safe
    x0 = (size - w) / 2
    h = size * 0.115 * (safe / 0.72)
    y0 = size / 2 - h / 2 - size * 0.02
    gap = size * 0.028 * (safe / 0.72)
    total = w - gap * (len(CELLS) - 1)
    cells, x = [], x0
    for frac, fill in CELLS:
        cw = total * frac
        cells.append((x, y0, cw, h, fill))
        x += cw + gap
    return cells


def draw(size, rounded, safe):
    k = 4  # 크게 그려서 줄이면 가장자리가 매끈하다
    S = size * k
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    r = S * 0.018
    line = max(2, int(S * 0.012))
    for i, (x, y, w, h, fill) in enumerate(geometry(S, safe)):
        box = [x, y, x + w, y + h]
        if fill >= 1:
            d.rounded_rectangle(box, radius=r, fill=INK)
        else:
            d.rounded_rectangle(box, radius=r, outline=INK + (150,), width=line)
            if fill > 0:
                d.rounded_rectangle([x, y, x + w * fill, y + h], radius=r, fill=INK)
        if i == 2:  # 지금 하는 단계 밑줄
            d.rectangle([x, y + h + S * 0.035, x + w, y + h + S * 0.035 + line * 2.2], fill=MARK)
    return img.resize((size, size), Image.LANCZOS)


def svg(safe=0.72, size=512):
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">',
             f'<rect width="{size}" height="{size}" rx="{size*0.22:.1f}" fill="rgb{BG}"/>']
    r = size * 0.018
    for i, (x, y, w, h, fill) in enumerate(geometry(size, safe)):
        if fill >= 1:
            parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" fill="rgb{INK}"/>')
        else:
            parts.append(f'<rect x="{x+3:.1f}" y="{y+3:.1f}" width="{w-6:.1f}" height="{h-6:.1f}" rx="{r:.1f}" fill="none" stroke="rgb{INK}" stroke-opacity=".6" stroke-width="6"/>')
            if fill > 0:
                parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w*fill:.1f}" height="{h:.1f}" rx="{r:.1f}" fill="rgb{INK}"/>')
        if i == 2:
            parts.append(f'<rect x="{x:.1f}" y="{y+h+size*0.035:.1f}" width="{w:.1f}" height="{size*0.026:.1f}" fill="rgb{MARK}"/>')
    parts.append("</svg>")
    return "".join(parts)


# 아이폰 홈 화면 앱의 시작 이미지 (apple-touch-startup-image): 없으면 아이폰이 하얀 화면을 먼저 보여 준다.
# 시작 화면(index.html #splash)과 같은 종이색 한 장 → 이어서 시작 화면이 그려진다. (논리 크기 pt, 배율 3)
STARTUP = [(393, 852), (402, 874), (420, 912), (440, 956)]  # 15·16 / 16 Pro·17·17 Pro / Air / 16·17 Pro Max


def startup():
    tags = []
    for w, h in STARTUP:
        name = f"start-{w * 3}x{h * 3}.png"
        Image.new("RGB", (w * 3, h * 3), INK).save(os.path.join(OUT, name), optimize=True)
        tags.append(f'<link rel="apple-touch-startup-image" media="(device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="icons/{name}" />')
    return tags


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if "--startup" in sys.argv:
        print("\n".join(startup()))
        sys.exit(0)
    if "--preview" in sys.argv:
        # 미리 보기: 주황(종이 디자인의 --flag) 바탕, 지금 단계 밑줄은 실제 앱의 초록
        BG, MARK = (184, 85, 43), (31, 92, 74)
        draw(192, True, 0.74).save(os.path.join(OUT, "preview-192.png"))
        draw(512, True, 0.74).save(os.path.join(OUT, "preview-512.png"))
        draw(512, False, 0.62).save(os.path.join(OUT, "preview-maskable-512.png"))
        draw(180, False, 0.70).convert("RGB").save(os.path.join(OUT, "preview-apple-touch-icon.png"))
        print("preview icons ->", OUT)
        sys.exit(0)
    draw(192, True, 0.74).save(os.path.join(OUT, "icon-192.png"))
    draw(512, True, 0.74).save(os.path.join(OUT, "icon-512.png"))
    draw(512, False, 0.62).save(os.path.join(OUT, "maskable-512.png"))  # 안전 영역(가운데 80%) 안에 그림
    draw(180, False, 0.70).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))  # iOS는 모서리를 알아서 둥글게
    with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg())
    print("icons ->", OUT)
