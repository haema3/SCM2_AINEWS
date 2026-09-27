(() => {
  const menuButton = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-site-nav]');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      const label = menuButton.querySelector('.sr-only');
      if (label) label.textContent = isOpen ? '메뉴 닫기' : '메뉴';
    });
  }

  // Material 3 top app bar: elevate once the page starts scrolling.
  const appBar = document.querySelector('.gnb');
  if (appBar) {
    const syncAppBar = () => appBar.classList.toggle('is-scrolled', window.scrollY > 4);
    syncAppBar();
    window.addEventListener('scroll', syncAppBar, { passive: true });
  }

  const path = window.location.pathname;
  const section = path.includes('/categories') ? 'archive'
    : path.includes('/tags') ? 'topics'
      : path.includes('/events') ? 'events'
        : path.includes('/about') ? 'about'
          : 'news';
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === section) link.setAttribute('aria-current', 'page');
  });

  document.querySelectorAll('[data-copy-link]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        const original = button.textContent;
        button.textContent = '링크를 복사했어요';
        window.setTimeout(() => { button.textContent = original; }, 1800);
      } catch { window.prompt('이 링크를 복사하세요.', window.location.href); }
    });
  });

  const backToTopButton = document.querySelector('[data-back-to-top]');
  if (backToTopButton) {
    const updateBackToTopVisibility = () => {
      backToTopButton.classList.toggle('is-visible', window.scrollY > 420);
    };

    updateBackToTopVisibility();
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
    backToTopButton.addEventListener('click', () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  const searchInput = document.querySelector('[data-search-input]');
  const searchResults = document.querySelector('[data-search-results]');
  let searchIndex = null;

  const renderSearchResults = (query) => {
    if (!searchResults) return;
    const keyword = query.trim().toLocaleLowerCase('ko-KR');
    if (!keyword) {
      searchResults.replaceChildren();
      return;
    }
    const matches = (searchIndex ?? []).filter((post) => [post.title, post.description, post.category, ...(post.tags ?? [])].join(' ').toLocaleLowerCase('ko-KR').includes(keyword));
    searchResults.replaceChildren();
    if (!matches.length) {
      searchResults.innerHTML = '<p class="search-empty">일치하는 뉴스가 없습니다.</p>';
      return;
    }
    const list = document.createElement('ul');
    list.className = 'search-result-list';
    matches.forEach((post) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = post.url;
      link.innerHTML = `<span>${post.category}</span><strong>${post.title}</strong><small>${post.date.slice(0, 10)} · ${post.tags.join(' · ')}</small>`;
      item.append(link); list.append(item);
    });
    searchResults.append(list);
  };

  const loadSearchIndex = async () => {
    if (!searchInput || searchIndex) return;
    if (!searchIndex) {
      const basePath = document.querySelector('meta[name="site-base"]')?.content ?? '';
      try { searchIndex = await fetch(`${basePath}/search.json`).then((response) => response.ok ? response.json() : []); }
      catch { searchIndex = []; }
    }
  };

  searchInput?.addEventListener('focus', loadSearchIndex);
  searchInput?.addEventListener('input', async (event) => { await loadSearchIndex(); renderSearchResults(event.target.value); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.gnb-search')) searchResults?.replaceChildren();
  });

  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
})();
