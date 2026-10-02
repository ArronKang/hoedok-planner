"""미리 보기 올리기 — 사용자가 수정본을 먼저 써 볼 수 있게.

지금 작업 브랜치(커밋된 것)의 앱을 main 브랜치의 preview/ 폴더로 복사해 올린다.
실제 앱(main 맨 위의 파일)은 한 글자도 건드리지 않는다 → 폰에 '새 버전' 알림이 뜨지 않는다.

    python tools/preview.py "무엇을 바꿨나"          # 복사하고 main에 커밋까지
    python tools/preview.py "무엇을 바꿨나" --push   # GitHub에 올리기까지
    python tools/preview.py "시험" --local           # 올리지 않고 PC에서만: ./preview/ 에 만든다
                                                     # (http://localhost:5173/preview/, git에는 안 들어감)

주소: https://arronkang.github.io/hoedok-planner/preview/
미리 보기는 저장 이름이 따로라(src/env.js) 실제 기록과 섞이지 않고, 동기화도 하지 않는다.
홈 화면에 '미리 보기'(주황 아이콘)로 따로 설치할 수 있다 (manifest-preview.webmanifest, preview-sw.js).
"""
import datetime
import html
import io
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

APP = ['index.html', 'preview-sw.js', 'manifest-preview.webmanifest', 'styles', 'src', 'icons']
URL = 'https://arronkang.github.io/hoedok-planner/preview/'


def git(*args, cwd=None, env=None):
    r = subprocess.run(['git', *args], cwd=cwd, env=env, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'git {" ".join(args)} 실패:\n{r.stderr.strip()}')
    return r.stdout.strip()


def fix_index(dst, tag):
    """index.html: 미리 보기 표시(만든 때·내용), 제목, 미리 보기용 설치 정보·아이콘(주황), 첫 화면 색 저장 이름"""
    p = os.path.join(dst, 'index.html')
    with open(p, encoding='utf-8', newline='') as f:
        h = f.read()
    swaps = [
        ('<html lang="ko">', f'<html lang="ko" data-preview="{html.escape(tag, quote=True)}">'),
        ('<title>회독 플래너</title>', '<title>미리 보기 · 회독 플래너</title>'),
        ('href="manifest.webmanifest"', 'href="manifest-preview.webmanifest"'),
        ('href="icons/apple-touch-icon.png"', 'href="icons/preview-apple-touch-icon.png"'),
        ('href="icons/icon-192.png"', 'href="icons/preview-192.png"'),
        ('content="회독 플래너" />', 'content="미리 보기" />'),  # apple-mobile-web-app-title
        ("localStorage.getItem('hoedok.bg')", "localStorage.getItem('preview.hoedok.bg')"),
    ]
    for a, b in swaps:
        if a not in h:
            sys.exit(f'index.html에서 "{a}"를 찾지 못했어요. tools/preview.py를 index.html에 맞게 고치세요.')
        h = h.replace(a, b, 1)
    h = '\n'.join(l for l in h.split('\n') if 'href="icons/icon.svg"' not in l)  # 초록 SVG 아이콘은 빼고 주황 PNG만
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(h)


def stamp(label):
    now = datetime.datetime.now()
    s = f'{now.month}/{now.day} {now:%H:%M}'
    return f'{s} · {label}' if label else s


def local(root, label):
    """PC에서만 시험: 작업 폴더 그대로(커밋 안 한 것 포함) ./preview/ 에 만든다. git에는 안 들어가게 한다."""
    dst = os.path.join(root, 'preview')
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    for x in APP:
        s = os.path.join(root, x)
        (shutil.copytree if os.path.isdir(s) else shutil.copy2)(s, os.path.join(dst, x))
    fix_index(dst, stamp(label or 'PC 시험'))
    exclude = os.path.join(root, '.git', 'info', 'exclude')
    with open(exclude, encoding='utf-8') as f:
        has = '/preview/' in f.read().split('\n')
    if not has:
        with open(exclude, 'a', encoding='utf-8') as f:
            f.write('\n/preview/\n')
    print('만듦:', dst, '→ http://localhost:5173/preview/ (다 보면 지워도 됨)')


def main():
    # 윈도우 콘솔(cp949)에서 — 같은 글자가 있으면 print가 멈추지 않게
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    label = args[0] if args else ''
    push = '--push' in sys.argv
    root = git('rev-parse', '--show-toplevel')
    if '--local' in sys.argv:
        return local(root, label)
    if git('status', '--porcelain', cwd=root):
        sys.exit('커밋하지 않은 변경이 있어요. 먼저 커밋한 뒤에 미리 보기를 만드세요.')
    branch = git('rev-parse', '--abbrev-ref', 'HEAD', cwd=root)
    sha = git('rev-parse', '--short', 'HEAD', cwd=root)
    if branch == 'main':
        sys.exit('main이 아닌 작업 브랜치에서 실행하세요.')

    data = subprocess.run(['git', 'archive', '--format=zip', 'HEAD', *APP], cwd=root, capture_output=True, check=True).stdout
    tag = stamp(label)
    wt = os.path.join(tempfile.gettempdir(), f'hoedok-preview-{os.getpid()}')
    git('worktree', 'add', wt, 'main', cwd=root)
    try:
        dst = os.path.join(wt, 'preview')
        shutil.rmtree(dst, ignore_errors=True)
        os.makedirs(dst)
        zipfile.ZipFile(io.BytesIO(data)).extractall(dst)
        fix_index(dst, tag)
        # -f: --local 이 .git/info/exclude 에 /preview/ 를 넣어 두므로(모든 작업 폴더에 적용) 억지로 넣는다
        git('add', '-A', '-f', 'preview', cwd=wt)
        if not git('status', '--porcelain', cwd=wt):
            print('바뀐 것이 없어요 (이미 같은 미리 보기).')
        else:
            git('commit', '-q', '-m', f'미리 보기: {tag} ({branch} {sha})', cwd=wt)
            print(f'main에 커밋: 미리 보기 {tag} ({branch} {sha})')
        if push:
            env = dict(os.environ, GIT_TERMINAL_PROMPT='1', GCM_INTERACTIVE='always')
            git('push', 'origin', 'main', cwd=wt, env=env)
            print('올림:', URL)
    finally:
        git('worktree', 'remove', '--force', wt, cwd=root)


if __name__ == '__main__':
    main()
