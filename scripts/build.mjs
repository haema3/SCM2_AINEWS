import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const siteTitle = 'SCM2팀 AI News 공유';
const siteDescription = '모델·연구·정책·산업의 변화를 맥락과 함께 읽는 AI 뉴스 브리프';
const basePath = normaliseBasePath(process.env.BASE_PATH ?? '');
const siteUrl = (process.env.SITE_URL ?? 'https://example.github.io').replace(/\/$/, '');

function normaliseBasePath(value) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}
function url(target = '/') { return `${basePath}${target.startsWith('/') ? target : `/${target}`}`; }
function absoluteUrl(target) { return `${siteUrl}${url(target)}`; }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, ''); }
function formatDate(value) { return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)).replace(/\. /g, '.').replace(/\.$/, ''); }
function formatMonth(value) { const date = new Date(value); return `${date.getFullYear()}년 ${date.getMonth() + 1}월`; }

function parseFrontMatter(source, file) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== '---') return parseFilenameMetadata(source, file);
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new Error(`${file}: front matter 종료 구분자가 없습니다.`);
  const data = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([\w-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (raw.startsWith('[') && raw.endsWith(']')) data[key] = raw.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean);
    else if (/^\d+$/.test(raw)) data[key] = Number(raw);
    else data[key] = raw.replace(/^"|"$/g, '');
  }
  for (const key of ['title', 'description', 'date', 'category', 'permalink']) if (!data[key]) throw new Error(`${file}: ${key} 값이 필요합니다.`);
  return { ...data, body: lines.slice(end + 1).join('\n').trim() };
}

function parseFilenameMetadata(source, file) {
  const match = file.match(/^\[(\d{8})\]_\[(.*?)\]_\[(.*?)\]_\[(.*?)\]_\[(.*?)\]_\[(.*?)\]\.md$/);
  if (!match) throw new Error(`${file}: front matter 또는 [날짜]_[제목]_[카테고리]_[썸네일]_[요약]_[태그].md 형식이 필요합니다.`);
  const [, dateKey, title, category, thumbnail, description, filenameTags] = match;
  const bodyWithoutTagFooter = source.replace(/\n-{5,}\s*\n🏷️\s*태그:\s*[^\n]+\s*$/s, '').trim();
  const footerTags = [...source.matchAll(/🏷️\s*태그:\s*([^\n]+)/g)].flatMap((tagLine) => [...tagLine[1].matchAll(/#([^\s#]+)/g)].map((tag) => tag[1]));
  const tags = [...new Set([...(filenameTags ? filenameTags.split(',').map((tag) => tag.trim()).filter(Boolean) : []), ...footerTags])];
  const date = `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)} 09:00:00 +09:00`;
  return {
    title,
    description,
    date,
    category,
    thumbnail,
    tags,
    reading_time: Math.max(3, Math.ceil(bodyWithoutTagFooter.replace(/\s+/g, ' ').trim().length / 700)),
    permalink: `/posts/${dateKey}-${slugify(category) || 'ai-news'}/`,
    body: bodyWithoutTagFooter,
  };
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[((?:[^\[\]]|\[[^\[\]]*\])+)]\(([^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  const flushParagraph = () => { if (paragraph.length) { output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`); paragraph = []; } };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) { flushParagraph(); continue; }
    if (line.startsWith('~~~')) {
      flushParagraph(); const language = line.slice(3).trim(); const code = []; index += 1;
      while (index < lines.length && !lines[index].startsWith('~~~')) { code.push(lines[index]); index += 1; }
      output.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+?)(?:\s+\{#([\w-]+)\})?$/);
    if (heading) { flushParagraph(); const level = heading[1].length; const headingId = heading[3] ?? slugify(heading[2]); output.push(`<h${level}${headingId ? ` id="${headingId}"` : ''}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    if (/^-{3,}$/.test(line)) { flushParagraph(); output.push('<hr>'); continue; }
    if (line.startsWith('> ')) { flushParagraph(); const quote = []; while (index < lines.length && lines[index].startsWith('> ')) { quote.push(lines[index].slice(2)); index += 1; } index -= 1; output.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`); continue; }
    if (/^\s*-\s+/.test(line)) {
      flushParagraph(); const items = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) { items.push(lines[index].replace(/^\s*-\s+/, '')); index += 1; }
      index -= 1; output.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`); continue;
    }
    const trimmedLine = line.trim();
    const htmlBlock = trimmedLine.match(/^<(div|section|article|aside|figure|figcaption|table|details|summary|iframe|video|audio)\b/i);
    if (htmlBlock) {
      flushParagraph();
      const tagName = htmlBlock[1];
      const closingTag = new RegExp(`</${tagName}\\s*>`, 'i');
      const block = [line];
      while (!closingTag.test(block.join('\n')) && index + 1 < lines.length) { index += 1; block.push(lines[index]); }
      output.push(block.join('\n'));
      continue;
    }
    if (trimmedLine.startsWith('<')) { flushParagraph(); output.push(line); continue; }
    if (line.startsWith('|') && lines[index + 1]?.match(/^\|\s*[-:]+/)) {
      flushParagraph(); const headers = line.split('|').slice(1, -1).map((cell) => cell.trim()); index += 2; const rows = [];
      while (index < lines.length && lines[index].startsWith('|')) { rows.push(lines[index].split('|').slice(1, -1).map((cell) => cell.trim())); index += 1; } index -= 1;
      output.push(`<table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); return output.join('\n');
}

function layout({ title, description, body: rawBody, type = 'website' }) {
  const body = rawBody.replace(/<li><a href="mailto:news@example\.com">제보<\/a><\/li>/g, '').replace(/<p><a href="mailto:news@example\.com">news@example\.com<\/a><\/p>/g, '');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="site-base" content="${basePath}"><meta name="description" content="${escapeHtml(description ?? siteDescription)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description ?? siteDescription)}"><meta property="og:type" content="${type}"><title>${escapeHtml(title)} — ${siteTitle}</title><link rel="icon" href="${url('/assets/favicon.svg')}" type="image/svg+xml"><link rel="stylesheet" href="${url('/assets/css/styles.css')}"><script src="${url('/assets/js/main.js')}" defer></script></head><body><a class="skip-link" href="#main-content">본문으로 건너뛰기</a><header class="site-header"><div class="header-inner"><a class="brand" href="${url('/')}" aria-label="${siteTitle} 홈"><span class="brand-copy"><small>Independent AI newsroom</small><strong>${siteTitle}</strong></span></a><button class="menu-button" data-menu-button type="button" aria-expanded="false" aria-controls="site-nav">메뉴</button><nav id="site-nav" class="site-nav" data-site-nav aria-label="주요 메뉴"><a href="${url('/')}">뉴스</a><a href="${url('/events/')}">이벤트</a></nav><div class="header-search"><label class="sr-only" for="search-input">뉴스 검색</label><input id="" data-search-input type="search" placeholder="뉴스 검색" autocomplete="off" aria-controls="search-results"><div id="search-results" class="header-search-results" data-search-results aria-live="polite"></div></div></div></header>${body}<footer class="site-footer"><div class="footer-inner"><p><span class="footer-label">${siteTitle}</span> © <span data-current-year>2026</span></p><div class="footer-links"><a href="${url('/feed.xml')}">RSS</a><a href="${url('/about/')}">편집 원칙</a></div></div></footer></body></html>`;
}

function postPage(post, posts) {
  const position = posts.findIndex((item) => item.permalink === post.permalink);
  const newer = posts[position - 1];
  const older = posts[position + 1];
  const tags = (post.tags ?? []).map((tag) => `<a class="tag" href="${url(`/tags/${slugify(tag)}/`)}">${escapeHtml(tag)}</a>`).join('');
  const sameCategory = posts.filter((item) => item.category === post.category && item.permalink !== post.permalink).slice(0, 3);
  const related = sameCategory.map((item) => `<li><a href="${url(item.permalink)}">${escapeHtml(item.title)}</a></li>`).join('');
  const toc = post.headings.map((heading) => `<li><a href="#${heading.id}">${escapeHtml(heading.label)}</a></li>`).join('');
  const body = `<main id="main-content" class="page-shell"><div class="layout"><article class="main-column"><header class="article-header"><p class="eyebrow">${escapeHtml(post.category)} / ${escapeHtml(post.index ?? '01')}</p><h1>${escapeHtml(post.title)}</h1><p class="lead">${escapeHtml(post.description)}</p><div class="article-meta"><span>발행 ${formatDate(post.date)}</span>${post.updated ? `<span>수정 ${formatDate(post.updated)}</span>` : ''}${post.reading_time ? `<span>${post.reading_time}분 읽기</span>` : ''}</div><div class="tag-list">${tags}</div></header><div class="article-content">${markdownToHtml(post.body)}</div><footer class="article-footer"><div><p class="eyebrow">Share</p><button class="button-link" data-copy-link type="button">글 링크 복사</button></div><nav class="pager" aria-label="글 탐색">${newer ? `<a href="${url(newer.permalink)}"><small>← 이전 글</small><strong>${escapeHtml(newer.title)}</strong></a>` : ''}${older ? `<a href="${url(older.permalink)}"><small>다음 글 →</small><strong>${escapeHtml(older.title)}</strong></a>` : ''}</nav></footer></article><aside class="sidebar is-sticky" aria-label="글 보조 정보"><section class="side-card"><p class="eyebrow">On this page</p><h2>목차</h2><ul class="toc">${toc}</ul></section><section class="side-card"><p class="eyebrow">More notes</p><h2>같은 주제의 글</h2><ul class="simple-list">${related}<li><a href="${url(`/categories/${slugify(post.category)}/`)}">${escapeHtml(post.category)} 글 전체 보기</a></li></ul></section></aside></div></main><button class="back-to-top" data-back-to-top type="button" aria-label="맨 위로 이동"><span aria-hidden="true">↑</span><span>맨 위로</span></button>`;
  return layout({ title: post.title, description: post.description, body, type: 'article' });
}

function legacyHomePage(posts) {
  const newsStream = posts.map((post) => `<article class="news-stream-item"><p class="eyebrow">${escapeHtml(post.category)}</p><h3><a href="${url(post.permalink)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.description)}</p><div class="post-meta"><span>${formatDate(post.date)}</span><span>${post.reading_time ?? 4}분 읽기</span><span>#${escapeHtml(post.tags?.[0] ?? post.category)}</span></div></article>`).join('');
  const currentMonth = posts[0] ? formatMonth(posts[0].date) : '이번 달';
  const body = `<main id="main-content" class="page-shell"><div class="layout"><div class="main-column"><section class="monthly-section" aria-labelledby="monthly-news"><div class="section-heading"><div><p class="section-index">Monthly AI news</p><h1 id="monthly-news">월간 AI 뉴스</h1></div><span class="month-count">${posts.length}개 브리프</span></div><div class="news-stream">${newsStream || '<div class="empty-state"><p>아직 발행된 브리프가 없습니다.</p></div>'}</div></section></div><aside class="sidebar" aria-label="뉴스 보조 정보"><section class="side-card featured profile-card"><div class="profile"><div class="avatar" aria-hidden="true">AI</div><div><h2>${currentMonth} 발행</h2><p>한 달 동안의 AI 뉴스를 핵심 변화와 원문 링크 중심으로 정리합니다.</p></div></div><ul class="side-links"><li><a href="${url('/events/')}">이벤트 보기</a></li><li><a href="${url('/feed.xml')}">RSS 구독</a></li><li><a href="mailto:news@example.com">제보</a></li></ul></section><section class="side-card"><p class="eyebrow">Monthly format</p><h2>월간 뉴스 기준</h2><p>매월 제품·연구·산업 적용에서 확인된 핵심 신호를 모아 발행합니다.</p></section><section class="side-card"><p class="eyebrow">Source first</p><h2>읽는 기준</h2><p>공식 발표와 원문 링크를 우선 제공하며, 공개된 사실과 해석을 구분합니다.</p></section></aside></div></main>`;
  const polishedBody = body.replace('Monthly format', 'AI NEWS / SHARE').replace('월간 뉴스 기준', '매달 AI 뉴스를 공유해요').replace('매월 제품·연구·산업 적용에서 확인된 핵심 신호를 모아 발행합니다.', '매달 제품·연구·산업의 변화를 골라, 읽기 쉬운 뉴스로 함께 공유합니다.').replace('Source first', 'NEWS SIGNAL').replace('읽는 기준', '근거와 함께 공유하기').replace('공식 발표와 원문 링크를 우선 제공하며, 공개된 사실과 해석을 구분합니다.', '공식 발표와 원문 링크를 바탕으로, 확인된 AI 뉴스를 투명하게 공유합니다.').replace(/<section class="side-card"><p class="eyebrow">NEWS SIGNAL<\/p>[\s\S]*?<\/section>/, '').replace('<div class="avatar" aria-hidden="true">AI</div>', '');
  return layout({ title: '월간 AI 뉴스', description: siteDescription, body: polishedBody });
}

function homePage(posts) {
  const newsStream = posts.map((post) => `<article class="news-stream-item"><p class="eyebrow">${escapeHtml(post.category)}</p><h3><a href="${url(post.permalink)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.description)}</p><div class="post-meta"><span>${formatDate(post.date)}</span><span>${post.reading_time ?? 4}분 읽기</span><span>#${escapeHtml(post.tags?.[0] ?? post.category)}</span></div></article>`).join('');
  const currentMonth = posts[0] ? formatMonth(posts[0].date) : '이번 달';
  const heroVisual = `<figure class="home-hero-visual" aria-hidden="true"><div class="home-hero-bubbles"><span></span><span></span><span></span><span></span><span></span><span></span></div><img class="home-hero-seahorse" src="${url('/assets/haema.png')}" alt=""></figure>`;
  const body = `<main id="main-content" class="page-shell home-page"><section class="home-hero" aria-labelledby="home-hero-title"><div class="home-hero-hearts" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="home-hero-inner"><div class="home-hero-copy"><p class="eyebrow">AI SIGNAL / MONTHLY BRIEF</p><h1 id="home-hero-title">AI News</h1><p class="home-hero-statement">한 달간의 <strong>AI 트렌드의 맥락</strong>을 짚어드립니다.<br></p><p class="home-hero-lead">최신 AI 트렌드와 연구 소식, 실무 인사이트를 한눈에 파악할 수 있도록 수집해 전달하는 AI 뉴스 큐레이션 서비스입니다.</p><div class="home-hero-meta"><span>${currentMonth} issue</span><span>${posts.length} briefs</span><span>Source-led</span></div></div></div></section><div class="layout"><div class="main-column"><section class="news-list-section" aria-labelledby="latest-news"><div class="section-heading"><div><p class="section-index">Latest briefs</p><h2 id="latest-news">포스트 목록</h2></div><span class="month-count">${posts.length}개 브리프</span></div><div class="news-stream">${newsStream || '<div class="empty-state"><p>아직 발행된 브리프가 없습니다.</p></div>'}</div></section></div><aside class="sidebar" aria-label="뉴스 보조 정보"><section class="side-card featured profile-card"><div class="profile"><div><p class="eyebrow">Latest issue</p><h2>${currentMonth} 발행</h2><p>한 달 동안의 AI 뉴스를 핵심 변화와 원문 링크 중심으로 정리합니다.</p></div></div><ul class="side-links"><li style='text-decoration-line: underline;'><a href="${url('/events/')}">이벤트 보기</a></li><li style='text-decoration-line: underline;'><a href="${url('/feed.xml')}">RSS 구독</a></li></ul></section><section class="side-card"><p class="eyebrow">AI NEWS / SHARE</p><h2>매달 AI 뉴스를 공유해요</h2><p>제품·연구·산업의 변화를 골라, 읽기 쉬운 뉴스로 함께 공유합니다.</p></section></aside></div></main>`;
  return layout({ title: '월간 AI 뉴스', description: siteDescription, body: body.replace('</div></div></section><div class="layout">', `</div>${heroVisual}</div></section><div class="layout">`) });
}

function archivePage({ title, eyebrow, description, posts, kind }) {
  const cards = posts.map((post) => `<a class="post-card" href="${url(post.permalink)}"><div><p class="eyebrow">${escapeHtml(post.category)} · ${formatDate(post.date)}</p><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description)}</p><div class="post-meta"><span>${post.reading_time ?? 4}분 읽기</span><span>#${escapeHtml(post.tags?.[0] ?? post.category)}</span></div></div><span class="arrow" aria-hidden="true">↗</span></a>`).join('');
  const body = `<main id="main-content" class="page-shell"><div class="layout"><section class="main-column"><header class="article-header"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="lead">${escapeHtml(description)}</p></header><div class="post-list">${cards || '<div class="empty-state"><p>아직 발행된 브리프가 없습니다.</p></div>'}</div></section><aside class="sidebar"><section class="side-card"><p class="eyebrow">Browse</p><h2>${kind === 'tag' ? '주제' : '브리프'}</h2><p>AI SIGNAL은 모델, 연구, 산업 적용의 변화를 원문과 함께 다룹니다.</p><div class="tag-list"><a class="tag" href="${url('/categories/')}">ALL BRIEFS</a><a class="tag" href="${url('/tags/')}">ALL TOPICS</a></div></section></aside></div></main>`;
  return layout({ title, description, body });
}

function aboutPage() {
  const body = `<main id="main-content" class="page-shell"><div class="layout"><article class="main-column"><header class="article-header"><p class="eyebrow">About AI SIGNAL</p><h1>빠른 뉴스, 더 느린 해석.</h1><p class="lead">AI SIGNAL은 모델·연구·정책·현장 적용에서 실제로 바뀐 사실을 선별해 전하는 독립 AI 뉴스 브리프입니다.</p></header><div class="article-content"><h2>무엇을 다루나요</h2><p>새 모델과 제품, 연구 결과, 산업 적용, AI 거버넌스의 변화를 다룹니다. 발표를 그대로 옮기기보다 누가 영향을 받고 무엇을 더 확인해야 하는지 정리합니다.</p><h2>편집 원칙</h2><p>공식 발표와 원문을 우선 확인하고, 사실과 해석을 구분합니다. 성능 수치와 도입 사례는 제공사의 조건을 함께 표시하며, 확인할 수 없는 주장은 단정하지 않습니다.</p><h2>제보와 수정</h2><p>정정이나 제보는 <a href="mailto:news@example.com">news@example.com</a>으로 보내 주세요. 중요한 수정에는 글의 수정일과 변경 내용을 남깁니다.</p></div></article><aside class="sidebar"><section class="side-card featured"><p class="eyebrow">Source policy</p><h2>원문으로 돌아갈 수 있게</h2><p>각 브리프의 핵심 사실은 출처 링크와 함께 제공합니다. 링크는 독자가 직접 판단할 수 있는 가장 짧은 경로입니다.</p></section></aside></div></main>`;
  return layout({ title: '소개와 편집 원칙', description: siteDescription, body });
}

async function eventsPage() {
  const source = await readFile(path.join(root, 'content/events/event.md'), 'utf8');
  const eventHtml = markdownToHtml(source);
  const body = `<main id="main-content" class="page-shell"><div class="layout"><article class="main-column"><div class="article-content event-content">${eventHtml}</div></article><aside class="sidebar"><section class="side-card featured"><p class="eyebrow">AI SIGNAL / Events</p><h2>AI 이벤트</h2><p>AI·데이터·개발 커뮤니티의 공개 행사를 월별로 정리합니다.</p><p><a class="button-link" href="${url('/')}">뉴스 홈으로</a></p></section><section class="side-card"><p class="eyebrow">Submit</p><h2>이벤트 제보</h2><p>공개 접근 가능한 AI 행사 정보를 보내 주세요.</p><p><a href="mailto:news@example.com">news@example.com</a></p></section></aside></div></main>`;
  return layout({ title: 'AI 이벤트', description: 'AI·데이터·개발 커뮤니티의 주요 행사 정보를 월별로 안내합니다.', body });
}

async function writeOutput(relativePath, content) {
  const footerExtra = `<div class="footer-extra"><div><p class="eyebrow">AI SIGNAL / COMMUNITY</p><h2>AI 뉴스를 함께 공유하는 곳</h2><p>최신 AI 트렌드와 연구 소식, 실무 인사이트를 한눈에 파악할 수 있도록 수집해 전달하는 AI 뉴스 큐레이션 서비스입니다.</p></div><nav class="footer-extra-nav" aria-label="푸터 바로가기"><a href="${url('/')}">최신 뉴스</a><a href="${url('/events/')}">AI 이벤트</a><a href="${url('/feed.xml')}">RSS 구독</a></nav></div>`;
  const cleanedContent = content.replace(/<a href="[^\"]*\/about\/">편집 원칙<\/a>/g, '');
  const withoutFooterRss = cleanedContent.replace(/<div class="footer-links"><a href="[^\"]*\/feed\.xml">RSS<\/a>/g, '<div class="footer-links">');
  const enhancedContent = withoutFooterRss.replace('<div class="footer-inner">', `${footerExtra}<div class="footer-inner">`);
  const file = path.join(output, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, enhancedContent, 'utf8');
}
async function main() {
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
  await cp(path.join(root, '404.html'), path.join(output, '404.html')); await cp(path.join(root, 'robots.txt'), path.join(output, 'robots.txt'));
  const entries = await readdir(path.join(root, 'content/posts')); const posts = [];
  for (const entry of entries.filter((name) => name.endsWith('.md'))) { const file = path.join(root, 'content/posts', entry); const post = parseFrontMatter(await readFile(file, 'utf8'), entry); post.tags ??= []; post.headings = [...post.body.matchAll(/^#{2,4}\s+(.+?)(?:\s+\{#([\w-]+)\})?$/gm)].map((match) => ({ label: match[1].replace(/\s+\{#[\w-]+\}$/, ''), id: match[2] ?? slugify(match[1]) })).filter((heading) => /^(?:[^\p{L}\p{N}])*\d+(?:\.\d+)*\.\s+/u.test(heading.label)); posts.push(post); }
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  await writeOutput('index.html', homePage(posts));
  for (const post of posts) await writeOutput(path.posix.join(post.permalink, 'index.html'), postPage(post, posts));
  const categoryGroups = [...new Set(posts.map((post) => post.category))].map((category) => ({ name: category, posts: posts.filter((post) => post.category === category) }));
  const tagGroups = [...new Set(posts.flatMap((post) => post.tags))].map((tag) => ({ name: tag, posts: posts.filter((post) => post.tags.includes(tag)) }));
  await writeOutput('categories/index.html', archivePage({ title: '브리프 아카이브', eyebrow: 'Coverage desk', description: '모델, AI 경제, 현장 적용을 주제별로 모았습니다.', posts, kind: 'category' }));
  for (const group of categoryGroups) await writeOutput(`categories/${slugify(group.name)}/index.html`, archivePage({ title: group.name, eyebrow: 'Coverage brief', description: `${group.name}에 관한 최신 AI 뉴스 브리프입니다.`, posts: group.posts, kind: 'category' }));
  await writeOutput('tags/index.html', archivePage({ title: '주제 탐색', eyebrow: 'Topics', description: '기업, 모델, 연구와 산업 적용의 교차점을 탐색합니다.', posts, kind: 'tag' }));
  for (const group of tagGroups) await writeOutput(`tags/${slugify(group.name)}/index.html`, archivePage({ title: `#${group.name}`, eyebrow: 'Topic brief', description: `${group.name} 관련 최신 AI 뉴스 브리프입니다.`, posts: group.posts, kind: 'tag' }));
  await writeOutput('about/index.html', aboutPage());
  await writeOutput('events/index.html', await eventsPage());
  await writeOutput('search.json', JSON.stringify(posts.map((post) => ({ title: post.title, description: post.description, date: post.date, category: post.category, tags: post.tags, url: url(post.permalink) }))));
  const rssItems = posts.map((post) => `<item><title>${escapeHtml(post.title)}</title><link>${absoluteUrl(post.permalink)}</link><description>${escapeHtml(post.description)}</description><pubDate>${new Date(post.date).toUTCString()}</pubDate></item>`).join('');
  await writeOutput('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${siteTitle}</title><link>${absoluteUrl('/')}</link><description>${siteDescription}</description><language>ko</language>${rssItems}</channel></rss>`);
  const urls = ['/', ...posts.map((post) => post.permalink), '/about/', '/events/', '/categories/', ...categoryGroups.map((group) => `/categories/${slugify(group.name)}/`), '/tags/', ...tagGroups.map((group) => `/tags/${slugify(group.name)}/`)];
  await writeOutput('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((entry) => `<url><loc>${absoluteUrl(entry)}</loc></url>`).join('')}</urlset>`);
  console.log(`Built ${posts.length} Markdown posts to ${path.relative(root, output)}${basePath ? ` (base path: ${basePath})` : ''}.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
