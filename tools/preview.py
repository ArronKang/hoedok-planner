"""미리 보기 올리기 — 사용자가 수정본을 먼저 써 볼 수 있게.

지금 작업 브랜치(커밋된 것)의 앱을 main 브랜치의 preview/ 폴더로 복사해 올린다.
실제 앱(main 맨 위의 파일)은 한 글자도 건드리지 않는다 → 폰에 '새 버전' 알림이 뜨지 않는다.

    python tools/preview.py "무엇을 바꿨나"          # 복사하고 main에 커밋까지
    python tools/preview.py "무엇을 바꿨나" --push   # GitHub에 올리기까지

주소: https://arronkang.github.io/hoedok-planner/preview/
미리 보기는 저장 이름이 따로라(src/env.js) 실제 기록과 섞이지 않고, 동기화도 하지 않는다.
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

APP = ['index.html', 'preview-sw.js', 'styles', 'src', 'icons']
URL = 'https://arronkang.github.io/hoedok-planner/preview/'


def git(*args, cwd=None, env=None):
    r = subprocess.run(['git', *args], cwd=cwd, env=env, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'git {" ".join(args)} 실패:\n{r.stderr.strip()}')
    return r.stdout.strip()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    label = args[0] if args else ''
    push = '--push' in sys.argv
    root = git('rev-parse', '--show-toplevel')
    if git('status', '--porcelain', cwd=root):
        sys.exit('커밋하지 않은 변경이 있어요. 먼저 커밋한 뒤에 미리 보기를 만드세요.')
    branch = git('rev-parse', '--abbrev-ref', 'HEAD', cwd=root)
    sha = git('rev-parse', '--short', 'HEAD', cwd=root)
    if branch == 'main':
        sys.exit('main이 아닌 작업 브랜치에서 실행하세요.')

    data = subprocess.run(['git', 'archive', '--format=zip', 'HEAD', *APP], cwd=root, capture_output=True, check=True).stdout
    now = datetime.datetime.now()
    stamp = f'{now.month}/{now.day} {now:%H:%M}'
    tag = f'{stamp} · {label}' if label else stamp

    wt = os.path.join(tempfile.gettempdir(), f'hoedok-preview-{os.getpid()}')
    git('worktree', 'add', wt, 'main', cwd=root)
    try:
        dst = os.path.join(wt, 'preview')
        shutil.rmtree(dst, ignore_errors=True)
        os.makedirs(dst)
        zipfile.ZipFile(io.BytesIO(data)).extractall(dst)

        # index.html: 미리 보기 표시(만든 때·내용), 제목, 설치 안내 빼기, 첫 화면 색 저장 이름
        p = os.path.join(dst, 'index.html')
        with open(p, encoding='utf-8', newline='') as f:
            h = f.read()
        h = h.replace('<html lang="ko">', f'<html lang="ko" data-preview="{html.escape(tag, quote=True)}">', 1)
        h = h.replace('<title>회독 플래너</title>', '<title>미리 보기 · 회독 플래너</title>', 1)
        h = '\n'.join(l for l in h.split('\n') if 'rel="manifest"' not in l)
        h = h.replace("localStorage.getItem('hoedok.bg')", "localStorage.getItem('preview.hoedok.bg')")
        if 'data-preview=' not in h:
            sys.exit('index.html에 미리 보기 표시를 넣지 못했어요 (<html lang="ko"> 를 찾지 못함).')
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(h)

        git('add', '-A', 'preview', cwd=wt)
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
