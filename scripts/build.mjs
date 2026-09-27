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

// Material 3 recommends Roboto for Latin; Noto Sans KR covers Hangul.
const fontLinks = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap">';
const searchIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.25" stroke="currentColor" stroke-width="1.8"/><path d="M16 16.5 20 20.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

// Article covers use M3 container roles (background tone + matching on-color).
function coverFill(post) {
  const palette = [
    { bg: '#EADDFF', on: '#21005D' }, // primary-container
    { bg: '#E8DEF8', on: '#1D192B' }, // secondary-container
    { bg: '#FFD8E4', on: '#31111D' }, // tertiary-container
    { bg: '#F6EDFF', on: '#21005D' }, // primary · tone 95
    { bg: '#FFECF1', on: '#31111D' }, // tertiary · tone 95
    { bg: '#ECE6F0', on: '#1D1B20' }, // surface-container-high
  ];
  const month = Number(String(post.date).slice(5, 7)) || 1;
  return palette[month % palette.length];
}

function monthParts(date) {
  const value = new Date(date);
  return { year: String(value.getFullYear()), month: String(value.getMonth() + 1).padStart(2, '0') };
}

function newsCard(post, featured = false, anchor = false) {
  const parts = monthParts(post.date);
  const cover = coverFill(post);
  const id = anchor ? ` id="month-${parts.year}-${parts.month}"` : '';
  return `<article class="news-card${featured ? ' news-card--featured' : ''}"${id}><a href="${url(post.permalink)}"><div class="news-card-cover" style="--cover:${cover.bg};--on-cover:${cover.on}" aria-hidden="true"><span>${escapeHtml(post.category)}</span><strong>${parts.month}</strong><em>${parts.year}</em></div><div class="news-card-body"><p class="news-card-meta"><b>${escapeHtml(post.category)}</b><span>${formatDate(post.date)}</span></p><h3>${escapeHtml(post.title)}</h3><p class="news-card-desc">${escapeHtml(post.description)}</p><div class="news-card-foot"><span>${post.reading_time ?? 4}분 읽기</span><span class="news-card-cta">읽어보기</span></div></div></a></article>`;
}

function layout({ title, description, body: rawBody, type = 'website', robots = '' }) {
  const body = rawBody;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#FEF7FF"><meta name="site-base" content="${basePath}"><meta name="description" content="${escapeHtml(description ?? siteDescription)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description ?? siteDescription)}"><meta property="og:type" content="${type}">${robots ? `<meta name="robots" content="${robots}">` : ''}<title>${escapeHtml(title)} — ${siteTitle}</title><link rel="icon" href="${url('/assets/favicon.svg')}" type="image/svg+xml">${fontLinks}<link rel="stylesheet" href="${url('/assets/css/m3/tokens.css')}"><link rel="stylesheet" href="${url('/assets/css/styles.css')}"><script src="${url('/assets/js/main.js')}" defer></script></head><body><a class="skip-link" href="#main-content">본문으로 건너뛰기</a><header class="gnb"><div class="shell gnb-inner"><a class="brand" href="${url('/')}" aria-label="${siteTitle} 홈"><span class="brand-mark" aria-hidden="true">AI</span><span class="brand-name"><strong>SCM2 AI News</strong><small>월간 브리프</small></span></a><div class="gnb-tools" id="site-nav" data-site-nav><nav class="site-nav" aria-label="주요 메뉴"><a data-nav="news" href="${url('/')}">뉴스</a><a data-nav="events" href="${url('/events/')}">이벤트</a></nav><div class="gnb-search"><label class="sr-only" for="search-input">뉴스 검색</label>${searchIcon}<input id="search-input" data-search-input type="search" placeholder="뉴스, 주제 검색" autocomplete="off" aria-controls="search-results"><div id="search-results" class="gnb-search-results" data-search-results aria-live="polite"></div></div></div><button class="menu-button" data-menu-button type="button" aria-expanded="false" aria-controls="site-nav"><span class="menu-icon" aria-hidden="true"></span><span class="sr-only">메뉴</span></button></div></header>${body}<footer class="app-footer"><div class="shell app-footer-inner"><div class="app-footer-brand"><strong>${siteTitle}</strong><p>모델·연구·정책·산업의 변화를 한 달 단위로 모아, 맥락과 출처가 있는 브리프로 전합니다.</p></div><nav class="app-footer-nav" aria-label="푸터 바로가기"><a href="${url('/')}">뉴스</a><a href="${url('/categories/')}">아카이브</a><a href="${url('/events/')}">이벤트</a><a href="${url('/about/')}">소개</a><a href="${url('/feed.xml')}">RSS</a></nav></div><div class="shell app-footer-meta"><p>© <span data-current-year>2026</span> ${siteTitle}</p><p>UI 구성은 <a href="https://m3.material.io/">Material Design 3</a> 디자인 가이드를 참고했습니다.</p></div></footer></body></html>`;
}

function postPage(post, posts) {
  const position = posts.findIndex((item) => item.permalink === post.permalink);
  const newer = posts[position - 1];
  const older = posts[position + 1];
  const tags = (post.tags ?? []).map((tag) => `<a href="${url(`/tags/${slugify(tag)}/`)}">#${escapeHtml(tag)}</a>`).join('');
  const sameCategory = posts.filter((item) => item.category === post.category && item.permalink !== post.permalink).slice(0, 4);
  const relatedPool = sameCategory.length ? sameCategory : posts.filter((item) => item.permalink !== post.permalink).slice(0, 4);
  const related = relatedPool.map((item) => {
    const parts = monthParts(item.date);
    return `<a class="related-item" href="${url(item.permalink)}"><b>${parts.month}</b><span><strong>${escapeHtml(item.title)}</strong><small>${formatDate(item.date)}</small></span></a>`;
  }).join('');
  const toc = post.headings.map((heading) => `<li><a href="#${heading.id}">${escapeHtml(heading.label)}</a></li>`).join('');
  const body = `<main id="main-content" class="canvas"><div class="shell detail"><article class="sheet"><nav class="breadcrumb" aria-label="현재 위치"><a href="${url('/')}">뉴스</a><span aria-hidden="true">/</span><span>${escapeHtml(post.category)}</span></nav><p class="article-kicker">${escapeHtml(post.category)}</p><h1 class="article-title">${escapeHtml(post.title)}</h1><p class="article-lead">${escapeHtml(post.description)}</p><div class="article-meta"><span>${formatDate(post.date)}</span>${post.updated ? `<span>수정 ${formatDate(post.updated)}</span>` : ''}${post.reading_time ? `<span>${post.reading_time}분 읽기</span>` : ''}</div>${tags ? `<div class="tag-list">${tags}</div>` : ''}<div class="prose">${markdownToHtml(post.body)}</div><div class="article-actions"><button class="btn btn-ghost" data-copy-link type="button">링크 복사</button><a class="btn btn-ghost" href="${url('/feed.xml')}">RSS</a></div><nav class="pager" aria-label="글 탐색">${[newer ? `<a href="${url(newer.permalink)}"><small>이전 브리프</small><strong>${escapeHtml(newer.title)}</strong></a>` : '', older ? `<a class="next" href="${url(older.permalink)}"><small>다음 브리프</small><strong>${escapeHtml(older.title)}</strong></a>` : ''].join('')}</nav></article><aside class="aside" aria-label="글 보조 정보"><section class="side-card"><h2>목차</h2>${toc ? `<ol class="toc">${toc}</ol>` : '<p class="page-lead">이 글에는 번호 목차가 없습니다.</p>'}</section><section class="side-card"><h2>다른 브리프</h2>${related}<a class="side-more" href="${url('/categories/')}">아카이브 전체</a></section></aside></div></main><button class="back-to-top" data-back-to-top type="button" aria-label="맨 위로">↑</button>`;
  return layout({ title: post.title, description: post.description, body, type: 'article' });
}

function homePage(posts) {
  const featured = posts[0];
  const rest = posts.slice(1);
  const months = [];
  for (const post of posts) {
    const parts = monthParts(post.date);
    const id = `month-${parts.year}-${parts.month}`;
    if (!months.some((item) => item.id === id)) months.push({ id, label: formatMonth(post.date) });
  }
  const seenMonths = new Set();
  const card = (post, featured = false) => {
    const parts = monthParts(post.date);
    const key = `${parts.year}-${parts.month}`;
    const anchor = !seenMonths.has(key);
    seenMonths.add(key);
    return newsCard(post, featured, anchor);
  };
  const chips = [`<a class="chip is-current" href="${url('/')}">전체 ${posts.length}</a>`, ...months.map((item) => `<a class="chip" href="#${item.id}">${escapeHtml(item.label)}</a>`)].join('');
  const grid = rest.map((post) => card(post)).join('');
  const currentMonth = featured ? formatMonth(featured.date) : '이번 달';
  const body = `<main id="main-content" class="canvas"><div class="shell page-head"><div><p class="eyebrow">월간 브리프</p><h1 id="home-title">AI 뉴스, 매달 한 편으로 정리해 전해드립니다</h1><p>모델부터 정책까지, 한 달의 AI 소식을 모아 담았습니다.</p></div><div class="page-head-actions">${featured ? `<a class="btn" href="${url(featured.permalink)}">${escapeHtml(currentMonth)} 읽기</a>` : ''}<a class="btn btn-ghost" href="${url('/events/')}">이벤트</a></div></div><div class="shell"><div class="chip-row" aria-label="월별 바로가기">${chips}</div>${featured ? `<div class="section-label"><h2>${escapeHtml(currentMonth)}</h2><span>${posts.length}개</span></div>${card(featured, true)}` : '<div class="empty-state"><h1>아직 발행된 브리프가 없습니다.</h1><p>첫 브리프가 올라오면 이곳에 카드로 쌓입니다.</p></div>'}${rest.length ? `<div class="section-label"><h2>이전 브리프</h2><span>${rest.length}</span></div><div class="news-grid">${grid}</div>` : ''}<section class="info-band" aria-label="더 보기"><a class="info-tile" href="${url('/events/')}"><span>이벤트</span><strong>이번 달 AI 행사</strong><p>커뮤니티 밋업과 컨퍼런스 일정을 월별로 모아 두었습니다.</p><em>일정 보기</em></a><a class="info-tile" href="${url('/about/')}"><span>편집</span><strong>사실과 해석을 구분합니다</strong><p>원문과 수치 조건을 함께 남기고, 확인되지 않은 주장은 단정하지 않습니다.</p><em>원칙 보기</em></a></section></div></main>`;
  return layout({ title: '월간 AI 뉴스', description: siteDescription, body });
}

function archivePage({ title, eyebrow, description, posts, kind }) {
  const cards = posts.map((post) => newsCard(post)).join('');
  const chips = `<a class="chip${kind === 'category' ? ' is-current' : ''}" href="${url('/categories/')}">아카이브</a><a class="chip${kind === 'tag' ? ' is-current' : ''}" href="${url('/tags/')}">주제</a>`;
  const body = `<main id="main-content" class="canvas"><div class="shell page-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></div><div class="shell"><div class="chip-row">${chips}</div><div class="section-label"><h2>${kind === 'tag' ? '주제별 브리프' : '브리프'}</h2><span>${posts.length}</span></div>${cards ? `<div class="news-grid">${cards}</div>` : '<div class="empty-state"><h1>아직 발행된 브리프가 없습니다.</h1><p>글이 추가되면 이 목록에 카드로 나타납니다.</p></div>'}</div></main>`;
  return layout({ title, description, body });
}

function aboutPage() {
  const body = `<main id="main-content" class="canvas"><div class="shell page-stack"><article class="sheet"><p class="eyebrow">소개</p><h1>빠른 뉴스보다, 확인된 변화.</h1><p class="page-lead">SCM2 AI News는 모델·연구·정책·현장 적용에서 실제로 바뀐 사실을 한 달 단위로 골라 전하는 브리프입니다.</p><div class="prose"><h2>무엇을 다루나요</h2><p>새 모델과 제품, 연구 결과, 산업 적용, AI 거버넌스의 변화를 다룹니다. 발표를 그대로 옮기기보다 누가 영향을 받고 무엇을 더 확인해야 하는지 정리합니다.</p><h2>편집 원칙</h2><p>공식 발표와 원문을 우선 확인하고, 사실과 해석을 구분합니다. 성능 수치와 도입 사례는 제공사의 조건을 함께 표시하며, 확인할 수 없는 주장은 단정하지 않습니다.</p><h2>제보와 수정</h2><p>정정이나 제보는 <a href="mailto:news@example.com">news@example.com</a>으로 보내 주세요. 중요한 수정에는 글의 수정일과 변경 내용을 남깁니다.</p></div></article><aside class="info-band"><a class="info-tile" href="${url('/categories/')}"><span>아카이브</span><strong>지난 브리프를 카드로</strong><p>월별로 쌓인 글을 같은 카드 그리드에서 다시 고릅니다.</p><em>아카이브 열기</em></a><a class="info-tile" href="${url('/feed.xml')}"><span>구독</span><strong>RSS로 이어서</strong><p>새 브리프가 올라오면 피드로 받을 수 있습니다.</p><em>피드 주소</em></a></aside></div></main>`;
  return layout({ title: '소개와 편집 원칙', description: siteDescription, body });
}

function notFoundPage() {
  const body = `<main id="main-content" class="canvas"><div class="shell page-stack"><section class="empty-state"><p class="eyebrow">404</p><h1>이 페이지는 없습니다.</h1><p>주소가 바뀌었거나 아직 발행되지 않은 브리프입니다.</p><a class="btn" href="${url('/')}">최신 뉴스 보기</a></section></div></main>`;
  return layout({ title: '페이지를 찾을 수 없습니다', description: '요청한 페이지를 찾을 수 없습니다.', robots: 'noindex', body });
}

async function eventsPage() {
  const source = await readFile(path.join(root, 'content/events/event.md'), 'utf8');
  const eventHtml = markdownToHtml(source);
  const body = `<main id="main-content" class="canvas"><div class="shell page-head"><div><p class="eyebrow">커뮤니티</p><h1>AI 이벤트</h1><p>공개된 AI·데이터·개발 행사를 월별로 모아 둡니다.</p></div><div class="page-head-actions"><a class="btn btn-ghost" href="${url('/')}">뉴스로</a></div></div><div class="shell page-stack"><article class="sheet"><div class="prose event-feed">${eventHtml}</div></article></div></main>`;
  return layout({ title: 'AI 이벤트', description: 'AI·데이터·개발 커뮤니티의 주요 행사 정보를 월별로 안내합니다.', body });
}

async function writeOutput(relativePath, content) {
  const file = path.join(output, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}
async function main() {
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
  await cp(path.join(root, 'robots.txt'), path.join(output, 'robots.txt'));
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
  await writeOutput('404.html', notFoundPage());
  await writeOutput('events/index.html', await eventsPage());
  await writeOutput('search.json', JSON.stringify(posts.map((post) => ({ title: post.title, description: post.description, date: post.date, category: post.category, tags: post.tags, url: url(post.permalink) }))));
  const rssItems = posts.map((post) => `<item><title>${escapeHtml(post.title)}</title><link>${absoluteUrl(post.permalink)}</link><description>${escapeHtml(post.description)}</description><pubDate>${new Date(post.date).toUTCString()}</pubDate></item>`).join('');
  await writeOutput('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${siteTitle}</title><link>${absoluteUrl('/')}</link><description>${siteDescription}</description><language>ko</language>${rssItems}</channel></rss>`);
  const urls = ['/', ...posts.map((post) => post.permalink), '/about/', '/events/', '/categories/', ...categoryGroups.map((group) => `/categories/${slugify(group.name)}/`), '/tags/', ...tagGroups.map((group) => `/tags/${slugify(group.name)}/`)];
  await writeOutput('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((entry) => `<url><loc>${absoluteUrl(entry)}</loc></url>`).join('')}</urlset>`);
  console.log(`Built ${posts.length} Markdown posts to ${path.relative(root, output)}${basePath ? ` (base path: ${basePath})` : ''}.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
