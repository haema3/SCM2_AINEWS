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

## 디자인 시스템

[이벤터스](https://event-us.kr/)의 검색 중심 헤더, 넓은 추천 배너, 카드형 콘텐츠 탐색, 보라색 포인트와 섹션 구성을 참고해 AI 뉴스 서비스에 맞게 새로 구성했습니다. 월호 아트워크와 브랜드 심볼은 프로젝트에서 직접 생성합니다.

- 기본 테마는 라이트이며 다크 테마도 지원합니다. 선택은 `localStorage['scm-theme']`에 저장합니다.
- `scripts/templates.mjs`: 홈, 기사, 아카이브, 주제, 행사, 소개, 404 화면.
- `assets/css/m3/tokens.css`: 색상과 서체 토큰. `assets/css/styles.css`: 컴포넌트와 반응형 배치.
- `assets/js/main.js`: 검색, 추천 배너, 월별 필터, 정렬, 브리프 저장, 행사 필터, 목차와 모바일 메뉴.
- Paperlogy 서체를 로컬에서 제공하며 외부 서체 요청이 필요하지 않습니다.
- 데스크톱 3열, 태블릿 2열, 모바일 1열로 콘텐츠를 배치합니다. 모바일에서도 검색창을 항상 표시합니다.

### 콘텐츠 탐색

홈과 아카이브의 월별 필터로 브리프를 좁히고 최신순·오래된순으로 정렬할 수 있습니다. 검색은 제목·요약·카테고리·태그를 대상으로 하며 방향키와 Escape 키를 지원합니다.

북마크 버튼으로 저장한 브리프는 `localStorage['scm-saved-briefs']`에 보관합니다. 저장 목록은 `?view=saved#briefs`로 바로 열 수 있으며 계정이나 서버 저장소를 사용하지 않습니다.

행사 화면은 `content/events/event.md`의 기존 월별 제목과 행사 정보를 카드로 변환합니다. 월과 온라인·오프라인 형식을 조합해 필터링할 수 있으며 주최 측 원문을 새 창에서 엽니다. 행사 원문의 접수·일시를 그대로 제공하고 모집 상태는 임의로 추정하지 않습니다.

기존 글 주소, 주제·카테고리 주소, RSS, 사이트맵과 GitHub Pages의 `BASE_PATH` 구성을 유지합니다.

RSS 구독 버튼은 `/subscribe/`의 구독 안내로 연결됩니다. 피드 주소를 복사해 RSS 리더에 등록하거나, 안내 페이지의 최신 브리프 링크로 상세 내용을 읽을 수 있습니다. 기존 `/feed.xml`은 유지하며 각 글의 요약과 HTML 본문 전체를 함께 제공합니다. 모든 페이지의 RSS 자동 탐색 링크로도 구독할 수 있습니다.
