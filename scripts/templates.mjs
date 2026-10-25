import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function createTemplates({ root, url, absoluteUrl, escapeHtml: e, slugify, formatDate, formatMonth, markdownToHtml, siteTitle, siteDescription }) {
  const icons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5M10 10h4v4h-4z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-14 4h3m4 0h3"/>',
    book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    rss: '<circle cx="5" cy="19" r="1"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',
    moon: '<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.spark}</svg>`;
  const nav = [['news', '/', 'AI 뉴스'], ['events', '/events/', 'AI 행사'], ['archive', '/categories/', '월별 아카이브'], ['topics', '/tags/', '주제 탐색'], ['about', '/about/', '소개']];
  const month = (post) => post.date.slice(5, 7);
  const year = (post) => post.date.slice(0, 4);
  const displayTitle = (post) => /^\d{2,4}년\s*\d{1,2}월\s*AI\s*News$/i.test(post.title)
    ? `${year(post)}년 ${Number(month(post))}월 AI 브리프`
    : post.title;
  const theme = (post) => ['peach', 'mint', 'blue', 'lemon', 'violet'][Number(month(post)) % 5];
  const brand = `<span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><span>SCM2<span class="brand-light"> AI NEWS</span></span>`;

  function layout({ title, description = siteDescription, body, type = 'website', robots = '' }) {
    return `<!doctype html><html lang="ko" data-theme="light"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><meta name="color-scheme" content="light dark"><meta name="site-base" content="${url('').replace(/\/$/, '')}"><meta name="description" content="${e(description)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="${type}">${robots ? `<meta name="robots" content="${robots}">` : ''}
<title>${e(title)} · ${siteTitle}</title><link rel="alternate" type="application/rss+xml" title="${e(siteTitle)}" href="${url('/feed.xml')}"><link rel="icon" href="${url('/assets/favicon.svg')}?v=thin-gradient-bars-1" type="image/svg+xml">
<script>try{document.documentElement.dataset.theme=localStorage.getItem('scm-theme')==='dark'?'dark':'light'}catch(e){}</script>
<link rel="preload" href="${url('/assets/font/PretendardVariable.woff2')}" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${url('/assets/css/m3/tokens.css')}"><link rel="stylesheet" href="${url('/assets/css/styles.css')}"><script src="${url('/assets/js/main.js')}" defer></script></head><body>
<a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
<header class="site-header" data-header><div class="shell header-main">
<a class="brand" href="${url('/')}" aria-label="SCM2 AI News 홈">${brand}</a>
<div class="search" data-search><label class="sr-only" for="site-search">브리프 검색</label>${icon('search')}<input id="site-search" type="search" data-search-input placeholder="궁금한 AI 소식, 검색해 보세요" autocomplete="off" aria-controls="search-results" aria-expanded="false"><div id="search-results" class="search-results" data-search-results hidden></div></div>
<div class="header-actions"><a class="saved-link" href="${url('/')}?view=saved#briefs">${icon('bookmark')}<span>저장한 브리프</span><b data-saved-count hidden>0</b></a><button class="icon-button theme-toggle" data-theme-toggle aria-label="어두운 테마로 전환" type="button">${icon('moon')}</button><button class="icon-button menu-button" data-menu-button aria-label="메뉴 열기" aria-controls="site-nav" aria-expanded="false" type="button">${icon('menu')}</button></div>
</div><div class="nav-border"><nav class="shell main-nav" id="site-nav" aria-label="주요 메뉴">${nav.map(([key, target, label]) => `<a href="${url(target)}" data-nav="${key}">${key === 'news' ? icon('grid') : ''}${label}${key === 'events' ? '<span class="nav-dot" aria-hidden="true"></span>' : ''}</a>`).join('')}<a class="nav-rss" href="${url('/subscribe/')}">${icon('rss')}RSS 구독</a></nav></div></header>
${body}
<footer class="site-footer"><div class="shell footer-main"><div class="footer-about"><a class="brand" href="${url('/')}">${brand}</a><p>빠르게 바뀌는 AI, 함께 읽고 깊이 이해합니다.<br>SCM2팀이 나누는 월간 AI 뉴스와 인사이트.</p></div><div><h2>둘러보기</h2><a href="${url('/categories/')}">월별 아카이브</a><a href="${url('/tags/')}">주제 탐색</a><a href="${url('/events/')}">AI 행사</a></div><div><h2>SCM2 AI News</h2><a href="${url('/about/')}">소개와 편집 원칙</a><a href="${url('/subscribe/')}">RSS 구독 안내</a></div><div class="footer-note">작은 발견이 모여,<br><strong>다음의 가능성이 됩니다.</strong>${icon('spark')}</div></div><div class="shell footer-bottom"><span>© ${new Date().getFullYear()} SCM2 AI News.</span><span>함께 읽는 AI, 함께 만드는 인사이트</span></div></footer>
<button class="back-to-top icon-button" data-back-to-top type="button" aria-label="맨 위로">↑</button><div class="toast" role="status" data-toast></div></body></html>`;
  }

  function cover(post, hero = false) {
    const facet = 'M60 10C68 41 79 52 110 60H77C67 60 60 53 60 43Z';
    const mark = `<svg class="cover-mark" viewBox="0 0 120 120" focusable="false"><ellipse class="cover-orbit-track" cx="60" cy="60" rx="54" ry="43" transform="rotate(-28 60 60)"/><g transform="translate(60 60) scale(.78) rotate(-12) translate(-60 -60)">${[0, 90, 180, 270].map((rotation, i) => `<path class="cover-facet cover-facet-${i}" d="${facet}" transform="rotate(${rotation} 60 60)"/>`).join('')}</g><g transform="rotate(-28 60 60)"><path class="cover-orbit-front" d="M114 60a54 43 0 0 1-108 0"/><g class="cover-satellite"><circle class="cover-satellite-halo" r="5.8"/><circle class="cover-satellite-core" r="3.6"/><circle class="cover-satellite-glint" cx="-1" cy="-1.1" r="1"/></g></g></svg>`;
    return `<div class="brief-cover ${theme(post)}${hero ? ' hero-cover' : ''}" aria-hidden="true"><span class="cover-top">SCM2 MONTHLY BRIEF <span>${year(post)}</span></span><div class="cover-middle"><span class="cover-word">AI<br>INSIGHT<span class="cover-period">.</span></span><span class="cover-orbit">${mark}</span></div><div class="cover-bottom"><span>새로운 변화, 더 넓은 시선</span><strong>${month(post)}<small>월호</small></strong></div></div>`;
  }
  function card(post, index = 0) {
    return `<article class="brief-card" data-brief-card data-month="${post.date.slice(0, 7)}" data-date="${post.date.slice(0, 10)}" data-post-id="${e(post.permalink)}"><div class="card-image"><a href="${url(post.permalink)}" tabindex="-1" aria-hidden="true">${cover(post)}</a><button class="save-button" data-save="${e(post.permalink)}" aria-label="${e(displayTitle(post))} 저장" aria-pressed="false" type="button">${icon('bookmark')}</button></div><div class="card-meta"><span>AI NEWS</span>${index === 0 ? '<span class="new-badge">LATEST</span>' : ''}<time datetime="${post.date.slice(0, 10)}">${formatDate(post.date)}</time></div><h3><a href="${url(post.permalink)}">${e(displayTitle(post))}</a></h3><p class="card-description">${e(post.description)}</p><div class="card-bottom"><span>${icon('clock')}${post.reading_time ?? 4}분 읽기</span><a href="${url(post.permalink)}" aria-label="${e(displayTitle(post))} 읽기">브리프 읽기 ${icon('arrow')}</a></div></article>`;
  }
  function shortcuts(posts) {
    const tags = [...new Set(posts.flatMap(p => p.tags))];
    const match = (query) => tags.find(t => query.test(t));
    const items = [['grid', '전체 브리프', '/categories/', 'lavender'], ['chip', '모델 & 기술', match(/모델|GPT|OpenAI|AI모델/i), 'sky'], ['spark', 'AI 인사이트', match(/에이전트|인사이트/i), 'butter'], ['globe', '산업 & 트렌드', match(/산업|오픈소스|자동화/i), 'rose'], ['calendar', 'AI 행사', '/events/', 'green'], ['book', '월별 아카이브', '/categories/', 'sand']];
    return `<nav class="topic-shortcuts" aria-label="관심 분야 바로가기">${items.map(([name, label, target, color]) => `<a href="${url(target?.startsWith('/') ? target : target ? `/tags/${slugify(target)}/` : '/tags/')}"><span class="shortcut-icon ${color}">${icon(name)}</span><span>${label}</span></a>`).join('')}</nav>`;
  }
  function hero(posts) {
    if (!posts.length) return '<section class="empty-state"><h1>첫 번째 AI 브리프를 준비하고 있어요.</h1></section>';
    const latest = posts[0];
    const slides = [
      { eyebrow: `${year(latest)}.${month(latest)} · MONTHLY AI BRIEF`, title: 'AI의 변화가,<br>우리의 인사이트가 되도록.', description: latest.description, href: latest.permalink, cta: '최신 브리프 읽기', art: cover(latest, true), color: 'hero-lavender' },
      { eyebrow: 'LEARN · CONNECT · GROW', title: '화면 속 인사이트를,<br>새로운 만남으로.', description: 'AI·데이터·개발 커뮤니티의 행사와 컨퍼런스. 관심 있는 주제를 현장에서 더 깊이 만나보세요.', href: '/events/', cta: 'AI 행사 둘러보기', art: `<div class="hero-event-art" aria-hidden="true">${icon('calendar')}<span>MEET<br>WHAT’S<br><em>NEXT.</em></span><b>↗</b></div>`, color: 'hero-peach' },
      { eyebrow: 'OUR GROWING ARCHIVE', title: '지나간 뉴스에도,<br>다음의 힌트가 있으니까.', description: '매달 쌓아 온 AI의 변화. 월별 브리프를 다시 읽고, 오늘의 흐름을 연결해 보세요.', href: '/categories/', cta: '아카이브 살펴보기', art: `<div class="hero-archive-art" aria-hidden="true"><span>IDEAS<br>WORTH<br>KEEPING.</span><b>${String(posts.length).padStart(2, '0')}<small>BRIEFS & COUNTING</small></b></div>`, color: 'hero-mint' },
    ];
    return `<section class="hero" aria-label="추천 콘텐츠" aria-roledescription="캐러셀" data-carousel>${slides.map((s, i) => `<div class="hero-slide ${s.color}" data-slide ${i ? 'hidden' : ''} role="group" aria-roledescription="슬라이드" aria-label="${i + 1} / ${slides.length}"><div class="hero-copy"><p class="eyebrow">${s.eyebrow}</p><h${i ? '2' : '1'}>${s.title}</h${i ? '2' : '1'}><p class="hero-description">${e(s.description)}</p><a class="button button-primary" href="${url(s.href)}">${s.cta}${icon('arrow')}</a></div><div class="hero-art">${s.art}</div></div>`).join('')}<div class="carousel-controls"><div class="carousel-dots" role="group" aria-label="추천 콘텐츠 선택">${slides.map((s, i) => `<button data-slide-to="${i}" aria-label="${i + 1}번 추천 콘텐츠" aria-pressed="${i === 0}" type="button"></button>`).join('')}</div><span class="carousel-count" data-slide-count aria-live="polite">01 <i>/ 03</i></span><button class="icon-button previous" data-slide-prev aria-label="이전 추천 콘텐츠" type="button">${icon('chevron')}</button><button class="icon-button" data-slide-next aria-label="다음 추천 콘텐츠" type="button">${icon('chevron')}</button></div></section>`;
  }
  function browse(posts, { title = '함께 읽으면 좋은 AI 브리프', description = '한 달의 변화를 모아, 다음 생각의 시작으로.', saved = true } = {}) {
    const months = [...new Set(posts.map(p => p.date.slice(0, 7)))];
    return `<section class="browse-section" id="briefs" data-browse><div class="section-heading"><div><p class="eyebrow">THE MONTHLY COLLECTION</p><h2>${e(title)} <span class="heading-spark">✳</span></h2><p>${e(description)}</p></div><a class="text-link" href="${url('/categories/')}">전체 아카이브 ${icon('chevron')}</a></div><div class="browse-toolbar"><div class="filter-chips" role="group" aria-label="브리프 필터"><button class="filter-chip is-active" data-filter="all" aria-pressed="true" type="button">전체 <b>${posts.length}</b></button>${months.map(m => `<button class="filter-chip" data-filter="${m}" aria-pressed="false" type="button">${Number(m.slice(5))}월</button>`).join('')}${saved ? `<button class="filter-chip saved-filter" data-filter="saved" aria-pressed="false" type="button">${icon('bookmark')}저장한 브리프</button>` : ''}</div><label class="sort-control"><span class="sr-only">브리프 정렬</span><select data-sort><option value="newest">최신순</option><option value="oldest">오래된순</option></select></label></div><p class="results-status sr-only" aria-live="polite" data-filter-status></p><div class="brief-grid" data-brief-grid>${posts.map(card).join('')}</div><div class="empty-state" data-filter-empty hidden>${icon('bookmark')}<h3>아직 저장한 브리프가 없어요.</h3><p>브리프의 북마크를 눌러, 다시 읽고 싶은 소식을 모아 보세요.</p><button class="button button-primary" data-reset-filter type="button">전체 브리프 보기</button></div></section>`;
  }
  function rssBand() {
    return `<section class="rss-band"><div class="shell rss-inner"><div class="rss-art" aria-hidden="true">${icon('rss')}<i>✳</i></div><div><p class="eyebrow">A LITTLE INSIGHT, EVERY MONTH</p><h2>다음 달의 AI 소식도<br>가장 편한 곳에서 만나세요.</h2><p>새 브리프를 RSS 리더에서 이어 읽을 수 있어요.</p></div><a class="button button-primary" href="${url('/subscribe/')}">RSS로 구독하기${icon('arrow')}</a></div></section>`;
  }
  function subscribePage(posts) {
    const latest = posts[0];
    const body = `<main id="main-content" class="shell page-main"><header class="page-heading"><p class="eyebrow">YOUR NEXT AI INSIGHT</p><h1>새 AI 브리프를 편한 곳에서 읽으세요.</h1><p>RSS 리더에 한 번 등록하면 새로 발행한 브리프의 전체 내용을 모아 읽을 수 있어요.</p></header>
<section class="subscribe-panel" aria-labelledby="subscribe-title"><div><span class="subscribe-icon" aria-hidden="true">${icon('rss')}</span><h2 id="subscribe-title">RSS로 구독하기</h2><p>아래 주소를 복사해 사용 중인 RSS 리더의 구독 추가 메뉴에 붙여 넣어 주세요.</p><ol class="subscribe-steps"><li>피드 주소를 복사하세요.</li><li>RSS 리더에서 구독 추가를 선택하세요.</li><li>주소를 붙여 넣으면 새 브리프를 받아볼 수 있어요.</li></ol></div><div class="subscribe-feed"><label for="rss-feed-url">RSS 피드 주소</label><input id="rss-feed-url" type="url" value="${e(absoluteUrl('/feed.xml'))}" data-feed-url="${url('/feed.xml')}" readonly spellcheck="false"><button class="button button-primary" data-copy-feed type="button">피드 주소 복사 ${icon('arrow')}</button><p class="subscribe-status" data-feed-status role="status" aria-live="polite"></p><a class="text-link" href="${url('/feed.xml')}">RSS 원본 보기 (XML) ${icon('arrow')}</a><p class="subscribe-note">이 페이지를 여는 것만으로 구독되지는 않아요. RSS 리더에 주소를 등록해 주세요.</p></div></section>
<section class="subscribe-reading" aria-labelledby="subscribe-reading-title"><div class="section-heading"><div><p class="eyebrow">READ THE FULL BRIEF</p><h2 id="subscribe-reading-title">지금 바로 브리프를 읽고 싶다면</h2><p>RSS 리더 없이도 각 브리프의 상세 내용을 읽을 수 있어요.</p></div></div>${latest ? `<a class="button button-primary" href="${url(latest.permalink)}">최신 브리프 읽기 ${icon('arrow')}</a><div class="brief-grid">${posts.slice(0, 3).map(card).join('')}</div>` : '<p>첫 번째 AI 브리프를 준비하고 있어요.</p>'}<a class="text-link" href="${url('/categories/')}">전체 브리프 둘러보기 ${icon('arrow')}</a></section></main>`;
    return layout({ title: 'RSS 구독 안내', description: 'RSS 구독 방법을 확인하고 최신 AI 브리프의 전체 내용을 읽어보세요.', body });
  }
  function homePage(posts) {
    const body = `<main id="main-content"><div class="shell home-main">${hero(posts)}${shortcuts(posts)}${browse(posts)}<section class="discovery-banner"><div><span class="eyebrow">BEYOND THE BRIEF</span><h2>읽는 것을 넘어, 직접 만나보세요.</h2><p>AI 컨퍼런스부터 커뮤니티 밋업까지, 새로운 연결을 찾아보세요.</p><a class="text-link" href="${url('/events/')}">AI 행사 둘러보기 ${icon('arrow')}</a></div><div class="discovery-art" aria-hidden="true">${icon('calendar')}<span>LET’S<br>CONNECT<b>↗</b></span></div></section><section class="principle-strip"><span>${icon('book')}함께 읽는 뉴스</span><p>원문과 맥락을 함께 살피는, SCM2팀의 AI 브리프.</p><a class="text-link" href="${url('/about/')}">우리를 소개합니다 ${icon('chevron')}</a></section></div>${rssBand()}</main>`;
    return layout({ title: '함께 읽는 AI, 넓어지는 인사이트', body });
  }
  function archivePage({ title, description, posts, kind }) {
    const tags = [...new Set(posts.flatMap(p => p.tags))];
    const isTagIndex = kind === 'tag' && title === '주제 탐색';
    const tagList = kind === 'tag' ? `<nav class="topic-cloud" aria-label="주제별 브리프">${tags.map(t => `<a href="${url(`/tags/${slugify(t)}/`)}"${title === `#${t}` ? ' aria-current="page"' : ''}>#${e(t)}</a>`).join('')}</nav>` : '';
    return layout({ title, description, body: `<main id="main-content" class="shell page-main"><header class="page-heading"><p class="eyebrow">${kind === 'tag' ? 'EXPLORE YOUR INTERESTS' : 'THE AI ARCHIVE'}</p><h1>${e(title)}</h1><p>${e(description)}</p></header>${tagList}${browse(posts, { title: isTagIndex ? '주제로 연결되는 AI 이야기' : '차곡차곡, AI의 기록', description: `${posts.length}개의 브리프에서 새로운 인사이트를 찾아보세요.` })}</main>` });
  }
  function postPage(post, posts) {
    const position = posts.findIndex(p => p.permalink === post.permalink);
    const toc = post.headings.map(h => `<li><a href="#${e(h.id)}">${e(h.label)}</a></li>`).join('');
    const tags = post.tags.map(t => `<a href="${url(`/tags/${slugify(t)}/`)}">#${e(t)}</a>`).join('');
    const others = posts.filter(p => p.permalink !== post.permalink).slice(0, 3);
    const body = `<main id="main-content" class="shell article-main"><nav class="breadcrumb" aria-label="현재 위치"><a href="${url('/')}">AI 뉴스</a>${icon('chevron')}<a href="${url('/categories/')}">월별 브리프</a>${icon('chevron')}<span>${formatMonth(post.date)}</span></nav><div class="article-layout"><article class="article"><header class="article-heading"><p class="eyebrow">MONTHLY AI BRIEF · ${year(post)}.${month(post)}</p><h1>${e(displayTitle(post))}</h1><p class="article-lead">${e(post.description)}</p><div class="article-meta"><span>SCM2팀</span><time datetime="${post.date.slice(0, 10)}">${formatDate(post.date)}</time><span>${icon('clock')}${post.reading_time ?? 4}분 읽기</span>${post.updated ? `<span>수정 ${e(post.updated)}</span>` : ''}</div><div class="article-tools"><button class="button button-small" data-save="${e(post.permalink)}" aria-pressed="false" type="button">${icon('bookmark')}<span data-save-label>브리프 저장</span></button><button class="button button-small" data-copy-link type="button">링크 복사 ${icon('arrow')}</button></div></header>${cover(post)}${toc ? `<details class="mobile-toc"><summary>이 브리프의 주요 내용</summary><ol>${toc}</ol></details>` : ''}<div class="prose">${markdownToHtml(post.body)}</div><div class="topic-cloud article-tags">${tags}</div><nav class="article-pager" aria-label="다른 브리프">${posts[position + 1] ? `<a href="${url(posts[position + 1].permalink)}"><small>← 이전 발행</small><strong>${e(displayTitle(posts[position + 1]))}</strong></a>` : ''}${posts[position - 1] ? `<a href="${url(posts[position - 1].permalink)}"><small>다음 발행 →</small><strong>${e(displayTitle(posts[position - 1]))}</strong></a>` : ''}</nav></article><aside class="article-aside"><div class="toc"><p class="eyebrow">IN THIS BRIEF</p><h2>이번 호의 이야기</h2>${toc ? `<ol>${toc}</ol>` : '<p>본문에서 전체 내용을 확인하세요.</p>'}<a class="text-link" href="${url('/categories/')}">전체 아카이브 ${icon('arrow')}</a></div><a class="aside-promo" href="${url('/events/')}">${icon('calendar')}<strong>인사이트 다음은,<br>새로운 만남.</strong><span>AI 행사 살펴보기 →</span></a></aside></div><section class="related-section"><div class="section-heading"><div><p class="eyebrow">KEEP EXPLORING</p><h2>이 브리프도 읽어보세요</h2></div></div><div class="brief-grid">${others.map(card).join('')}</div></section></main>`;
    return layout({ title: post.title, description: post.description, body, type: 'article' });
  }
  function aboutPage() {
    return layout({ title: 'SCM2 AI News 소개', body: `<main id="main-content" class="shell page-main"><header class="about-hero"><p class="eyebrow">SMALL DISCOVERIES, BIG POSSIBILITIES</p><h1>함께 읽는 AI,<br>넓어지는 우리의 시선<span>✳</span></h1><p>SCM2 AI News는 모델·연구·정책·산업의 변화를<br>맥락과 함께 읽는 월간 AI 뉴스 브리프입니다.</p></header><div class="about-principles">${[['01', '변화를 고릅니다', '새 모델과 제품, 연구 결과, 산업 적용과 AI 거버넌스. 한 달 동안 무엇이 달라졌는지 함께 살펴봅니다.'], ['02', '맥락을 연결합니다', '발표와 수치 너머, 누가 영향을 받고 무엇을 더 확인해야 하는지 정리합니다. 사실과 해석을 구분하고 원문을 함께 남깁니다.'], ['03', '인사이트를 나눕니다', '뉴스를 읽는 데서 끝나지 않도록. 팀의 다음 대화와 업무의 작은 실험으로 이어질 생각을 나눕니다.']].map(([n,t,d])=>`<section><span>${n}</span><h2>${t}</h2><p>${d}</p></section>`).join('')}</div><section class="about-editorial prose"><p class="eyebrow">OUR EDITORIAL PRINCIPLES</p><h2>빠른 뉴스보다, 확인된 변화.</h2><p>공식 발표와 원문을 우선 확인하고, 성능 수치와 도입 사례는 제공사의 조건을 함께 표시합니다. 확인되지 않은 주장은 단정하지 않고, 중요한 수정은 글에 변경 내용을 남깁니다.</p><a class="button button-primary" href="${url('/categories/')}">우리의 브리프 읽기 ${icon('arrow')}</a></section></main>${rssBand()}` });
  }
  function notFoundPage() {
    return layout({ title: '페이지를 찾을 수 없습니다', robots: 'noindex', body: `<main id="main-content" class="shell empty-page"><span class="error-number">404<span>✳</span></span><h1>잠깐, 다른 길로 오셨네요.</h1><p>주소가 변경되었거나 아직 발행되지 않은 페이지입니다.</p><a class="button button-primary" href="${url('/')}">AI 뉴스로 돌아가기 ${icon('arrow')}</a></main>` });
  }
  async function eventsPage() {
    const source = await readFile(path.join(root, 'content/events/event.md'), 'utf8');
    const events = []; let currentMonth = '';
    for (const line of source.split(/\r?\n/)) {
      const m = line.match(/^##\s+(\d+)년\s+(\d+)월/);
      if (m) currentMonth = `${m[1].length === 2 ? '20' : ''}${m[1]}-${m[2].padStart(2, '0')}`;
      const heading = line.match(/^####\s+\[(.+)\]\((https?:\/\/\S+)\)/);
      if (heading) events.push({ title: heading[1], href: heading[2], month: currentMonth, host: '', date: '', type: '' });
      const field = line.match(/^\s*-\s+\*\*(주최|접수|일시|분류)\*\*:\s*(.+)/);
      if (field && events.length) { const item = events.at(-1); if (field[1] === '주최') item.host = field[2]; else if (field[1] === '분류') item.type = field[2].replace(/`/g, ''); else { item.date = field[2]; item.dateLabel = field[1]; } }
    }
    const months = [...new Set(events.map(x => x.month))];
    const cards = events.map((item, index) => `<article class="event-card" data-event-card data-event-month="${item.month}" data-event-type="${item.type.startsWith('오프라인') ? 'offline' : item.type.startsWith('온라인') ? 'online' : 'other'}"><div class="event-card-top"><span class="event-number">${String(index + 1).padStart(2,'0')}</span><span class="event-type">${icon(item.type.startsWith('온라인') ? 'globe' : 'calendar')}${e(item.type)}</span></div><h2><a href="${e(item.href)}" target="_blank" rel="noopener noreferrer">${e(item.title)}</a></h2><p>${e(item.host)}</p><div class="event-date">${icon('calendar')}<div><small>${e(item.dateLabel ?? '일정')}</small><span>${e(item.date)}</span></div></div><a class="text-link" href="${e(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${e(item.title)} 주최 측 안내 새 창에서 보기">주최 측 안내 보기 ↗</a></article>`).join('');
    return layout({ title: 'AI 행사', description: 'AI·데이터·개발 커뮤니티의 행사와 컨퍼런스를 만나보세요.', body: `<main id="main-content" class="shell page-main"><header class="page-heading event-heading"><div><p class="eyebrow">LEARN · CONNECT · GROW</p><h1>다음 인사이트는,<br>새로운 만남에서.</h1><p>AI·데이터·개발 커뮤니티의 행사와 컨퍼런스를 모았습니다.</p></div><span class="event-heading-icon" aria-hidden="true">${icon('calendar')}</span></header><section class="events-section" data-events><div class="section-heading"><div><h2>관심 있는 행사를 찾아보세요</h2><p>일정과 모집 상태는 주최 측 안내에서 확인해 주세요.</p></div><span class="event-total" data-event-count>${events.length}개의 행사</span></div><div class="browse-toolbar"><div class="filter-chips" role="group" aria-label="행사 형식"><button class="filter-chip is-active" data-event-filter="all" aria-pressed="true" type="button">전체</button><button class="filter-chip" data-event-filter="offline" aria-pressed="false" type="button">오프라인</button><button class="filter-chip" data-event-filter="online" aria-pressed="false" type="button">온라인</button></div><label class="sort-control"><span class="sr-only">행사 월 선택</span><select data-event-month-select><option value="all">전체 월</option>${months.map(m => `<option value="${m}">${m.slice(0,4)}년 ${Number(m.slice(5))}월</option>`).join('')}</select></label></div><div class="event-grid">${cards}</div><div class="empty-state" data-event-empty hidden><h2>이 조건에 맞는 행사가 없어요.</h2><p>다른 월이나 행사 형식을 선택해 보세요.</p></div><p class="event-disclaimer">수록된 행사 정보는 콘텐츠 작성 시점을 기준으로 합니다. 지난 행사도 아카이브로 함께 제공합니다.</p></section></main>` });
  }
  return { homePage, archivePage, postPage, aboutPage, notFoundPage, eventsPage, subscribePage };
}
