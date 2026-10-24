import { createTemplates } from './templates.mjs';
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

const { homePage, postPage, archivePage, aboutPage, notFoundPage, eventsPage, subscribePage } = createTemplates({ root, url, absoluteUrl, escapeHtml, slugify, formatDate, formatMonth, markdownToHtml, siteTitle, siteDescription });

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
  await writeOutput('categories/index.html', archivePage({ title: '브리프 아카이브', description: '월별로 쌓인 AI 뉴스와 인사이트를 한곳에서 살펴보세요.', posts, kind: 'category' }));
  for (const group of categoryGroups) await writeOutput(`categories/${slugify(group.name)}/index.html`, archivePage({ title: group.name, eyebrow: 'Coverage brief', description: `${group.name}에 관한 최신 AI 뉴스 브리프입니다.`, posts: group.posts, kind: 'category' }));
  await writeOutput('tags/index.html', archivePage({ title: '주제 탐색', eyebrow: 'Topics', description: '기업, 모델, 연구와 산업 적용의 교차점을 탐색합니다.', posts, kind: 'tag' }));
  for (const group of tagGroups) await writeOutput(`tags/${slugify(group.name)}/index.html`, archivePage({ title: `#${group.name}`, eyebrow: 'Topic brief', description: `${group.name} 관련 최신 AI 뉴스 브리프입니다.`, posts: group.posts, kind: 'tag' }));
  await writeOutput('about/index.html', aboutPage());
  await writeOutput('subscribe/index.html', subscribePage(posts));
  await writeOutput('404.html', notFoundPage());
  await writeOutput('events/index.html', await eventsPage());
  await writeOutput('search.json', JSON.stringify(posts.map((post) => ({ title: post.title, description: post.description, date: post.date, category: post.category, tags: post.tags, url: url(post.permalink) }))));
  const rssItems = posts.map((post) => {
    const link = escapeHtml(absoluteUrl(post.permalink));
    // Readers display the body outside the site, so resolve article links and media.
    const content = markdownToHtml(post.body).replace(/\b(href|src|poster)=(['"])(.*?)\2/gi, (match, attribute, quote, target) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) return match;
      const resolved = target.startsWith('/') ? `${siteUrl}${url(target)}` : new URL(target, absoluteUrl(post.permalink)).href;
      return `${attribute}=${quote}${resolved}${quote}`;
    });
    return `<item><title>${escapeHtml(post.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><description>${escapeHtml(post.description)}</description><content:encoded>${escapeHtml(content)}</content:encoded><pubDate>${new Date(post.date).toUTCString()}</pubDate></item>`;
  }).join('');
  await writeOutput('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${siteTitle}</title><link>${absoluteUrl('/')}</link><atom:link href="${absoluteUrl('/feed.xml')}" rel="self" type="application/rss+xml"/><description>${siteDescription}</description><language>ko</language>${rssItems}</channel></rss>`);
  const urls = ['/', ...posts.map((post) => post.permalink), '/about/', '/subscribe/', '/events/', '/categories/', ...categoryGroups.map((group) => `/categories/${slugify(group.name)}/`), '/tags/', ...tagGroups.map((group) => `/tags/${slugify(group.name)}/`)];
  await writeOutput('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((entry) => `<url><loc>${absoluteUrl(entry)}</loc></url>`).join('')}</urlset>`);
  console.log(`Built ${posts.length} Markdown posts to ${path.relative(root, output)}${basePath ? ` (base path: ${basePath})` : ''}.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
