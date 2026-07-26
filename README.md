# Paper Trail

Node.js만으로 빌드하는 GitHub Pages 정적 블로그입니다. Ruby, Jekyll, 외부 npm 패키지가 필요하지 않습니다.

## 요구사항

- Node.js 20 이상 (권장: Node.js 22 LTS)

## 명령어

```powershell
# Markdown을 HTML·RSS·sitemap으로 생성
npm run build

# 빌드 후 로컬 미리보기 서버 실행
npm run dev
```

`npm run dev`는 `http://127.0.0.1:4173`에서 `dist/` 결과물을 제공합니다. 내용 변경 후에는 `npm run build`를 다시 실행합니다.

## 글 작성

글은 `content/posts/`에 `YYYY-MM-DD-slug.md` 이름으로 추가합니다. 각 파일은 다음 front matter를 가집니다.

```md
---
title: 새 글 제목
description: 목록과 검색 결과에 보일 짧은 설명
date: 2026-07-25 09:00:00 +09:00
category: development
tags: [GitHub Pages, CSS]
reading_time: 5
permalink: /posts/new-post/
---

여기부터 Markdown 본문입니다.
```

제목은 페이지 템플릿이 H1으로 출력하므로 본문에서는 `##`부터 사용합니다. 제목에 `{#section-id}`를 붙이면 글 우측 목차에 해당 섹션이 나타납니다.

## 배포

`.github/workflows/deploy-pages.yml`은 `main` 브랜치 push 시 `dist/`를 GitHub Pages에 배포합니다. 저장소의 **Settings → Pages → Source**를 **GitHub Actions**로 한 번만 설정하세요.

워크플로가 사용자/조직 사이트와 프로젝트 사이트의 base path를 자동으로 구분합니다. 커스텀 도메인을 사용한다면 workflow의 `SITE_URL` 값을 실제 도메인으로 바꾸세요.
