// KinoVibe Cinephile Community Feed Controller
import { AuthService } from '../services/auth.service.js';
import { MovieService } from '../services/movie.service.js';
import { ProfileService } from '../services/profile.service.js';
import { calcScores, formatScore, getScoreLevel } from '../utils/scoring.js';
import { escapeHtml } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  await AuthService.initNav();

  const loadingEl = document.getElementById('community-loading');
  const gridEl = document.getElementById('community-grid');
  const emptyEl = document.getElementById('community-empty');
  const countEl = document.getElementById('community-count');
  const searchInput = document.getElementById('community-search');
  const tabBtns = document.querySelectorAll('#community-tab-group button');
  const genreBtns = document.querySelectorAll('#genre-filter-bar .tag-pill');
  const loadMoreContainer = document.getElementById('community-load-more-container');
  const loadMoreBtn = document.getElementById('btn-load-more');
  const loadMoreBtnText = document.getElementById('load-more-btn-text');
  const endOfFeedEl = document.getElementById('community-end-of-feed');

  let currentFeed = 'recent'; // 'recent' | 'masterpieces' | 'top'
  let currentGenre = '__all__';
  let searchQuery = '';
  let allPublicReviews = [];
  let userProfilesMap = {};

  // Pagination State (v0.4)
  const PAGE_SIZE = 24;
  let currentPage = 0;
  let hasMore = true;
  let isLoading = false;

  async function fetchReviews(isLoadMore = false) {
    if (isLoading) return;
    isLoading = true;

    if (!isLoadMore) {
      currentPage = 0;
      hasMore = true;
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (gridEl) gridEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.add('hidden');
      if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
    } else {
      if (loadMoreBtnText) loadMoreBtnText.textContent = 'Loading more...';
      if (loadMoreBtn) loadMoreBtn.disabled = true;
    }

    try {
      let sortBy = 'newest';
      let minScore = null;

      if (currentFeed === 'masterpieces') {
        minScore = 9.0;
        sortBy = 'highest';
      } else if (currentFeed === 'top') {
        sortBy = 'highest';
      }

      const newReviews = await MovieService.getPublicFeed({
        sortBy,
        minScore,
        genre: currentGenre,
        limit: PAGE_SIZE,
        page: currentPage
      });

      if (newReviews.length < PAGE_SIZE) {
        hasMore = false;
      }

      if (isLoadMore) {
        allPublicReviews = [...allPublicReviews, ...newReviews];
      } else {
        allPublicReviews = newReviews;
      }

      // Batch query reviewer profiles for new user IDs
      const userIds = newReviews.map(m => m.userId).filter(Boolean);
      if (userIds.length > 0) {
        const newProfiles = await ProfileService.getProfilesByIds(userIds);
        userProfilesMap = { ...userProfilesMap, ...newProfiles };
      }

      renderFeed();
    } catch (err) {
      console.error('Failed to load community reviews:', err);
      if (!isLoadMore) allPublicReviews = [];
      renderFeed();
    } finally {
      isLoading = false;
      if (loadingEl) loadingEl.classList.add('hidden');
      if (loadMoreBtnText) loadMoreBtnText.textContent = 'Load More Reviews';
      if (loadMoreBtn) loadMoreBtn.disabled = false;
      updatePaginationUI();
    }
  }

  function updatePaginationUI() {
    if (!loadMoreContainer) return;
    const isSearching = Boolean(searchQuery.trim());

    if (allPublicReviews.length === 0 || isSearching) {
      loadMoreContainer.classList.add('hidden');
      return;
    }

    loadMoreContainer.classList.remove('hidden');
    if (hasMore) {
      loadMoreBtn?.classList.remove('hidden');
      endOfFeedEl?.classList.add('hidden');
    } else {
      loadMoreBtn?.classList.add('hidden');
      endOfFeedEl?.classList.remove('hidden');
    }
  }

  function getFilteredReviews() {
    if (!searchQuery) return allPublicReviews;

    // Search query matches title or reviewer name
    return allPublicReviews.filter(movie => {
      const titleMatch = (movie.title || '').toLowerCase().includes(searchQuery);
      const profile = userProfilesMap[movie.userId];
      const authorMatch = profile && (
        (profile.displayName || '').toLowerCase().includes(searchQuery) ||
        (profile.username || '').toLowerCase().includes(searchQuery)
      );
      return titleMatch || authorMatch;
    });
  }

  function renderFeed() {
    const displayed = getFilteredReviews();

    if (countEl) {
      countEl.textContent = `Showing ${displayed.length} public review${displayed.length !== 1 ? 's' : ''}`;
    }

    if (displayed.length === 0) {
      if (gridEl) gridEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      updatePaginationUI();
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (gridEl) {
      gridEl.classList.remove('hidden');
      gridEl.innerHTML = displayed.map((movie, idx) => renderReviewCard(movie, idx)).join('');
    }
    updatePaginationUI();
  }

  function renderReviewCard(movie, index) {
    const scores = calcScores(movie.storyScore, movie.visualScore, movie.actionScore, movie.funScore, movie.biases || []);
    const finalScore = movie.finalScore || scores.final;
    const level = getScoreLevel(finalScore);
    const scoreFormatted = formatScore(finalScore);

    const profile = userProfilesMap[movie.userId] || {
      displayName: 'Cinephile',
      username: 'user',
      avatarUrl: ''
    };

    // Reviewer avatar
    let avatarContent = `<span class="text-xs font-bold uppercase">${(profile.displayName || 'U')[0]}</span>`;
    if (profile.avatarUrl) {
      if (profile.avatarUrl.startsWith('http') || profile.avatarUrl.startsWith('/')) {
        avatarContent = `<img src="${escapeHtml(profile.avatarUrl)}" alt="${escapeHtml(profile.displayName)}" class="w-full h-full object-cover rounded-full">`;
      } else {
        avatarContent = `<span class="text-sm">${escapeHtml(profile.avatarUrl)}</span>`;
      }
    }

    // Poster
    const posterContent = movie.posterUrl
      ? `<img src="${escapeHtml(movie.posterUrl)}" alt="${escapeHtml(movie.title)}" loading="lazy" class="w-full h-full object-cover rounded-kino-sm transition duration-300 group-hover:scale-105" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="poster-fallback w-full h-full rounded-kino-sm" style="display:none">${escapeHtml((movie.title || '?')[0])}</div>`
      : `<div class="poster-fallback w-full h-full rounded-kino-sm">${escapeHtml((movie.title || '?')[0])}</div>`;

    const glowRing = level === 'high'
      ? 'shadow-glow-high ring-1 ring-emerald-500/40 text-emerald-400'
      : (level === 'mid' ? 'shadow-glow-mid ring-1 ring-amber-500/40 text-amber-400' : 'shadow-glow-low ring-1 ring-rose-500/40 text-rose-400');

    // Review snippet (v0.4 quote styling)
    const reviewSnippet = movie.reviewText
      ? `<div class="relative pl-3 border-l-2 border-kino-accent/60 mb-3 bg-white/[0.015] py-1.5 pr-2 rounded-r">
           <p class="text-xs text-kino-secondary italic line-clamp-3 leading-relaxed">"${escapeHtml(movie.reviewText)}"</p>
         </div>`
      : `<p class="text-xs text-kino-muted italic mb-3">Rated ${scoreFormatted} / 10 across 4 core criteria.</p>`;

    // Bias badge (v0.4)
    let biasBadge = '';
    if (Array.isArray(movie.biases) && movie.biases.length > 0) {
      const b = movie.biases[0];
      const sign = b.amount > 0 ? '+' : '';
      biasBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.amount >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
        <span>⚡</span><span>${sign}${b.amount} ${escapeHtml(b.reason || 'Bias')}</span>
      </span>`;
    }

    // 4 Criteria Telemetry Mini Strip (v0.4)
    const telemetryStrip = `
      <div class="grid grid-cols-4 gap-1 py-1.5 px-2 bg-black/40 rounded border border-white/[0.04] text-[10px] text-center my-2.5">
        <div><span class="text-kino-muted block text-[9px] uppercase tracking-wider">Story</span><span class="font-bold text-white">${movie.storyScore || 0}</span></div>
        <div><span class="text-kino-muted block text-[9px] uppercase tracking-wider">Visual</span><span class="font-bold text-white">${movie.visualScore || 0}</span></div>
        <div><span class="text-kino-muted block text-[9px] uppercase tracking-wider">Action</span><span class="font-bold text-white">${movie.actionScore || 0}</span></div>
        <div><span class="text-kino-muted block text-[9px] uppercase tracking-wider">Fun</span><span class="font-bold text-white">${movie.funScore || 0}</span></div>
      </div>
    `;

    const timeAgo = formatTimeAgo(movie.createdAt);

    return `
      <div class="group bg-kino-surface/70 hover:bg-kino-surface border border-white/[0.08] hover:border-kino-border-accent rounded-kino p-4 flex flex-col justify-between transition duration-300 hover:-translate-y-1 hover:shadow-glow-accent">
        <div>
          <!-- Card Header: Reviewer attribution -->
          <div class="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/[0.06]">
            <a href="profile.html?u=@${escapeHtml(profile.username)}" class="flex items-center gap-2.5 no-underline group/author min-w-0" title="View @${escapeHtml(profile.username)} profile">
              <div class="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.12] flex items-center justify-center flex-shrink-0 overflow-hidden">
                ${avatarContent}
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold text-white group-hover/author:text-kino-accent-light truncate">
                  ${escapeHtml(profile.displayName)}
                </div>
                <div class="text-[11px] text-kino-muted truncate">@${escapeHtml(profile.username)}</div>
              </div>
            </a>
            <span class="text-[10px] text-kino-muted flex-shrink-0">${timeAgo}</span>
          </div>

          <!-- Movie Content Row -->
          <div class="flex gap-3.5 mb-2">
            <a href="view.html?id=${movie.id}" class="w-16 h-24 flex-shrink-0 overflow-hidden rounded-kino-sm relative border border-white/[0.08] block">
              ${posterContent}
            </a>
            <div class="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <a href="view.html?id=${movie.id}" class="font-bold text-sm text-white hover:text-kino-accent-light no-underline line-clamp-2 leading-snug mb-1">
                  ${escapeHtml(movie.title)}
                </a>
                <div class="text-xs text-kino-muted mb-1.5">
                  ${movie.year || '—'}
                </div>
              </div>

              <!-- Score Badge & Bias -->
              <div class="flex items-center gap-2 flex-wrap">
                <div class="score-badge ${level} ${glowRing} text-xs font-bold px-2 py-0.5 rounded">
                  ${scoreFormatted}
                </div>
                ${biasBadge}
              </div>
            </div>
          </div>

          <!-- 4 Criteria Telemetry Mini Strip -->
          ${telemetryStrip}

          <!-- Review Snippet -->
          ${reviewSnippet}
        </div>

        <!-- Card Footer -->
        <div class="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px]">
          <a href="view.html?id=${movie.id}" class="text-kino-accent-light hover:underline font-medium flex items-center gap-1">
            <span>Read full review</span>
            <span>→</span>
          </a>
          <a href="profile.html?u=@${escapeHtml(profile.username)}" class="text-kino-muted hover:text-white transition">
            <span>More by @${escapeHtml(profile.username)}</span>
          </a>
        </div>
      </div>
    `;
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ─── Filter & Pagination Listeners ────────────────────
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold text-kino-secondary hover:text-white transition';
      });
      btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-kino-accent text-white transition';
      currentFeed = btn.dataset.feed || 'recent';
      fetchReviews(false);
    });
  });

  genreBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      genreBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGenre = btn.dataset.genre || '__all__';
      fetchReviews(false);
    });
  });

  loadMoreBtn?.addEventListener('click', () => {
    if (hasMore && !isLoading) {
      currentPage++;
      fetchReviews(true);
    }
  });

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderFeed();
  });

  // Initial Fetch
  await fetchReviews(false);
});
