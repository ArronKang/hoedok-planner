"""sw.js의 VERSION을 앱 파일 내용으로 계산해 넣는다.

    python tools/bump_sw.py          # 바꿔서 저장
    python tools/bump_sw.py --check  # 맞는지만 확인 (틀리면 종료 코드 1)

파일을 하나라도 고치면 값이 바뀌므로, 설치된 앱이 새 버전을 받는다.
"""
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, "sw.js")


def files_in(sw_text):
    block = re.search(r"const FILES = \[(.*?)\];", sw_text, re.S).group(1)
    return re.findall(r"'([^']+)'", block)


def version(sw_text):
    h = hashlib.sha256()
    for f in files_in(sw_text):
        if f == "./":
            continue
        with open(os.path.join(ROOT, f), "rb") as fp:
            h.update(f.encode() + b"\0" + fp.read())
    # sw.js 자신의 내용(VERSION 줄 제외)도 넣는다
    h.update(re.sub(r"const VERSION = '[^']*';", "", sw_text).encode())
    return h.hexdigest()[:12]


if __name__ == "__main__":
    text = open(SW, encoding="utf-8").read()
    v = version(text)
    cur = re.search(r"const VERSION = '([^']*)';", text).group(1)
    if "--check" in sys.argv:
        print("ok" if cur == v else f"sw.js VERSION이 낡았어요: {cur} → {v} (python tools/bump_sw.py)")
        sys.exit(0 if cur == v else 1)
    if cur != v:
        text = text.replace(f"const VERSION = '{cur}';", f"const VERSION = '{v}';")
        open(SW, "w", encoding="utf-8", newline="\n").write(text)
    print("VERSION", v)
