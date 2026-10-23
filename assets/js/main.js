(() => {
  const root = document.documentElement;
  const base = document.querySelector('meta[name="site-base"]')?.content ?? '';
  const toastNode = document.querySelector('[data-toast]');
  let toastTimeout;
  const toast = (message) => {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastNode.classList.remove('is-visible'), 2400);
  };

  // The new visual system defaults to light; only an explicit choice persists.
  const themeButton = document.querySelector('[data-theme-toggle]');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    themeButton?.setAttribute('aria-label', theme === 'dark' ? '밝은 테마로 전환' : '어두운 테마로 전환');
    themeButton?.setAttribute('aria-pressed', String(theme === 'dark'));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18161e' : '#ffffff');
  };
  applyTheme(root.dataset.theme);
  themeButton?.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('scm-theme', theme); } catch { /* optional preference */ }
  });

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const closeMenu = () => {
    header?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', '메뉴 열기');
  };
  menuButton?.addEventListener('click', () => {
    const open = header?.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  window.matchMedia('(min-width:561px)').addEventListener('change', closeMenu);
  const path = window.location.pathname.slice(base.length);
  const section = path.startsWith('/categories') ? 'archive' : path.startsWith('/tags') ? 'topics' : path.startsWith('/events') ? 'events' : path.startsWith('/about') ? 'about' : 'news';
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === section) link.setAttribute('aria-current', 'page');
  });
  const back = document.querySelector('[data-back-to-top]');
  const updateScroll = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 5);
    back?.classList.toggle('is-visible', window.scrollY > 500);
  };
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();
  back?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' }));

  document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const slides = [...carousel.querySelectorAll('[data-slide]')];
    const dots = [...carousel.querySelectorAll('[data-slide-to]')];
    const count = carousel.querySelector('[data-slide-count]');
    let current = 0;
    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== current; });
      dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === current)));
      if (count) count.replaceChildren(document.createTextNode(`${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`));
    };
    carousel.querySelector('[data-slide-prev]')?.addEventListener('click', () => show(current - 1));
    carousel.querySelector('[data-slide-next]')?.addEventListener('click', () => show(current + 1));
    dots.forEach(dot => dot.addEventListener('click', () => show(Number(dot.dataset.slideTo))));
  });

  // Stable content permalinks keep saved articles valid across rebuilds.
  let saved = new Set();
  const readSaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem('scm-saved-briefs') ?? '[]');
      return new Set(Array.isArray(value) ? value.filter(x => typeof x === 'string') : []);
    } catch { return new Set(); }
  };
  saved = readSaved();
  const browseUpdates = [];
  const syncSaved = () => {
    document.querySelectorAll('[data-save]').forEach(button => {
      const active = saved.has(button.dataset.save);
      button.setAttribute('aria-pressed', String(active));
      const label = button.querySelector('[data-save-label]');
      if (label) label.textContent = active ? '저장됨' : '브리프 저장';
      if (!button.dataset.originalLabel) button.dataset.originalLabel = button.getAttribute('aria-label') ?? '브리프 저장';
      button.setAttribute('aria-label', active ? button.dataset.originalLabel.replace(/저장$/, '저장 취소') : button.dataset.originalLabel);
    });
    document.querySelectorAll('[data-saved-count]').forEach(node => { node.textContent = saved.size; node.hidden = !saved.size; });
    browseUpdates.forEach(update => update());
  };
  document.querySelectorAll('[data-save]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.save;
      const active = !saved.has(id);
      if (active) saved.add(id); else saved.delete(id);
      let persisted = true;
      try { localStorage.setItem('scm-saved-briefs', JSON.stringify([...saved])); } catch { persisted = false; }
      syncSaved();
      toast(active ? (persisted ? '다시 읽을 브리프에 저장했어요.' : '현재 화면에서 저장했어요. 브라우저 저장 공간은 사용할 수 없어요.') : '저장한 브리프에서 해제했어요.');
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === 'scm-saved-briefs' || event.key === null) { saved = readSaved(); syncSaved(); }
  });

  document.querySelectorAll('[data-browse]').forEach(browse => {
    const grid = browse.querySelector('[data-brief-grid]');
    const cards = [...browse.querySelectorAll('[data-brief-card]')];
    const chips = [...browse.querySelectorAll('[data-filter]')];
    const empty = browse.querySelector('[data-filter-empty]');
    const status = browse.querySelector('[data-filter-status]');
    const sort = browse.querySelector('[data-sort]');
    const params = new URLSearchParams(location.search);
    let filter = params.get('view') === 'saved' ? 'saved' : 'all';
    const render = () => {
      cards.sort((a,b) => sort?.value === 'oldest' ? a.dataset.date.localeCompare(b.dataset.date) : b.dataset.date.localeCompare(a.dataset.date));
      let visible = 0;
      cards.forEach(card => {
        card.hidden = !(filter === 'all' || (filter === 'saved' ? saved.has(card.dataset.postId) : card.dataset.month === filter));
        if (!card.hidden) visible++;
        grid.append(card);
      });
      chips.forEach(chip => { const active = chip.dataset.filter === filter; chip.classList.toggle('is-active', active); chip.setAttribute('aria-pressed', String(active)); });
      if (empty) empty.hidden = visible !== 0;
      if (status) status.textContent = `${filter === 'saved' ? '저장한 ' : ''}브리프 ${visible}개`;
    };
    const select = (value) => {
      filter = value;
      const address = new URL(location.href);
      if (filter === 'saved') address.searchParams.set('view', 'saved'); else address.searchParams.delete('view');
      history.replaceState(null, '', address);
      render();
    };
    chips.forEach(chip => chip.addEventListener('click', () => select(chip.dataset.filter)));
    browse.querySelector('[data-reset-filter]')?.addEventListener('click', () => select('all'));
    sort?.addEventListener('change', render);
    browseUpdates.push(render);
    render();
  });
  syncSaved();

  const eventSection = document.querySelector('[data-events]');
  if (eventSection) {
    const cards = [...eventSection.querySelectorAll('[data-event-card]')];
    const buttons = [...eventSection.querySelectorAll('[data-event-filter]')];
    const monthSelect = eventSection.querySelector('[data-event-month-select]');
    let mode = 'all';
    const filter = () => {
      let count = 0;
      cards.forEach(card => {
        card.hidden = !((mode === 'all' || mode === card.dataset.eventType) && (monthSelect.value === 'all' || monthSelect.value === card.dataset.eventMonth));
        if (!card.hidden) count++;
      });
      buttons.forEach(button => { const active = mode === button.dataset.eventFilter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
      const label = eventSection.querySelector('[data-event-count]');
      label.setAttribute('aria-live', 'polite'); label.textContent = `${count}개의 행사`;
      eventSection.querySelector('[data-event-empty]').hidden = count > 0;
    };
    buttons.forEach(button => button.addEventListener('click', () => { mode = button.dataset.eventFilter; filter(); }));
    monthSelect.addEventListener('change', filter);
  }

  // Search creates DOM text nodes rather than interpreting article metadata as HTML.
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  let indexPromise;
  let searchVersion = 0;
  const closeSearch = () => { if (results) results.hidden = true; input?.setAttribute('aria-expanded', 'false'); };
  const showMessage = (message) => { const p = document.createElement('p'); p.className = 'search-message'; p.textContent = message; results.replaceChildren(p); };
  const getIndex = () => {
    if (!indexPromise) indexPromise = fetch(`${base}/search.json`).then(response => { if (!response.ok) throw new Error('Search unavailable'); return response.json(); }).catch(error => { indexPromise = null; throw error; });
    return indexPromise;
  };
  const search = async () => {
    const version = ++searchVersion;
    const query = input.value.trim().toLocaleLowerCase('ko-KR');
    if (!query) { closeSearch(); return; }
    results.hidden = false; input.setAttribute('aria-expanded', 'true'); showMessage('브리프를 찾고 있어요…');
    try {
      const index = await getIndex();
      if (version !== searchVersion || !input.value.trim()) return;
      const matches = index.filter(post => [post.title,post.description,post.category,...post.tags].join(' ').toLocaleLowerCase('ko-KR').includes(query));
      if (!matches.length) { showMessage('일치하는 브리프가 없어요. 다른 검색어를 입력해 보세요.'); return; }
      const list = document.createElement('ul');
      matches.forEach(post => {
        const li = document.createElement('li'); const link = document.createElement('a'); link.href = post.url;
        const category = document.createElement('span'); category.textContent = post.category;
        const title = document.createElement('strong'); title.textContent = post.title;
        const meta = document.createElement('small'); meta.textContent = post.date.slice(0,10);
        link.append(category,title,meta); li.append(link); list.append(li);
      });
      results.replaceChildren(list);
    } catch { if (version === searchVersion) showMessage('검색을 불러오지 못했어요. 다시 입력하면 재시도합니다.'); }
  };
  input?.addEventListener('input', search);
  input?.addEventListener('focus', () => { if (input.value.trim()) search(); });
  input?.addEventListener('keydown', event => {
    if ((event.key === 'ArrowDown' || event.key === 'Enter') && !results.hidden) {
      const first = results.querySelector('a');
      if (first) { event.preventDefault(); first.focus(); }
    }
  });
  results?.addEventListener('keydown', event => {
    const links = [...results.querySelectorAll('a')]; const i = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); links[(i+1)%links.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (i <= 0) input.focus(); else links[i-1]?.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('[data-search]')) { searchVersion++; closeSearch(); } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (results?.contains(document.activeElement)) input.focus();
      searchVersion++; closeSearch(); closeMenu();
    }
  });
  document.addEventListener('focusin', event => { if (!event.target.closest('[data-search]')) closeSearch(); });

  document.querySelectorAll('[data-copy-link]').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('브리프 링크를 복사했어요.'); }
    catch { window.prompt('이 주소를 복사해 주세요.', location.href); }
  }));
  const tocLinks = [...document.querySelectorAll('.toc ol a')];
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) tocLinks.forEach(link => link.classList.toggle('is-active', decodeURIComponent(link.hash.slice(1)) === entry.target.id));
      });
    }, { rootMargin: '-175px 0px -55% 0px' });
    tocLinks.forEach(link => { const heading = document.getElementById(decodeURIComponent(link.hash.slice(1))); if (heading) observer.observe(heading); });
  }
})();
