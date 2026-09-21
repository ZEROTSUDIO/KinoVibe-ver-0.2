// KinoVibe Library Page Controller — Suggestion A (Cinephile Showcase & 6-Col Grid)
import { AuthService } from '../services/auth.service.js';
import { MovieService } from '../services/movie.service.js';
import { ImportService } from '../services/import.service.js';
import { calcScores, getScoreLevel, formatScore } from '../utils/scoring.js';
import { escapeHtml, Toast } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Require login — redirect to login page if not authenticated
  const user = await AuthService.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  await AuthService.initNav();

  // Elements
  const grid = document.getElementById('movie-grid');
  const countEl = document.getElementById('movie-count');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const sortSelect = document.getElementById('sort-select');
  const tagFilterBar = document.getElementById('tag-filter-bar');
  const searchInput = document.getElementById('library-search');
  const searchClear = document.getElementById('library-search-clear');

  // Suggestion A Elements
  const statsBar = document.getElementById('library-stats-bar');
  const statTotal = document.getElementById('stat-total-logged');
  const statAvg = document.getElementById('stat-avg-rating');
  const statSTier = document.getElementById('stat-s-tier-count');
  const statTopCraft = document.getElementById('stat-top-craft');

  const showcaseContainer = document.getElementById('showcase-container');
  const shelfHof = document.getElementById('shelf-hall-of-fame');
  const hofGrid = document.getElementById('hof-grid');
  const hofCount = document.getElementById('hof-count');
  const shelfBias = document.getElementById('shelf-bias-outliers');
  const biasGrid = document.getElementById('bias-grid');

  const collectionHeading = document.getElementById('collection-heading');
  const collectionSubtitle = document.getElementById('collection-subtitle');

  let allMovies = [];
  let activeTags = new Set();
  let searchQuery = '';

  // Read URL param on load (e.g. library.html?tag=rewatchable)
  const urlParams = new URLSearchParams(window.location.search);
  const urlTag = urlParams.get('tag');
  if (urlTag) activeTags.add(urlTag.trim().toLowerCase());

  async function loadAndRender() {
    emptyState.classList.add('hidden');
    tagFilterBar.classList.add('hidden');
    grid.classList.add('hidden');
    if (showcaseContainer) showcaseContainer.classList.add('hidden');
    if (statsBar) statsBar.classList.add('hidden');

    if (loadingState) {
      loadingState.classList.remove('hidden');
    }

    try {
      allMovies = await MovieService.getAll({ sortBy: sortSelect.value });
    } catch (err) {
      console.error('Failed to load movies:', err);
      Toast.error('Failed to load movies. ' + err.message);
      allMovies = [];
    } finally {
      if (loadingState) {
        loadingState.classList.add('hidden');
      }
    }

    renderTagFilterBar();
    renderStatsAndShowcase();
    renderList();
  }

  // ─── 1. Stats & Showcase Shelves (Suggestion A) ───────
  function renderStatsAndShowcase() {
    if (allMovies.length === 0) {
      if (statsBar) statsBar.classList.add('hidden');
      if (showcaseContainer) showcaseContainer.classList.add('hidden');
      return;
    }

    // Calculate aggregated statistics
    let totalScoreSum = 0;
    let sTierCount = 0;
    let storySum = 0, visualsSum = 0, actionSum = 0, funSum = 0;

    const enriched = allMovies.map(m => {
      const scores = calcScores(m.storyScore, m.visualScore, m.actionScore, m.funScore, m.biases || []);
      totalScoreSum += scores.final;
      if (scores.final >= 9.0) sTierCount++;

      storySum += Number(m.storyScore) || 0;
      visualsSum += Number(m.visualScore) || 0;
      actionSum += Number(m.actionScore) || 0;
      funSum += Number(m.funScore) || 0;

      return { ...m, computedScores: scores };
    });

    const avgFinal = (totalScoreSum / allMovies.length).toFixed(1);

    // Determine highest rated criterion
    const criteriaAvgs = [
      { label: 'Story', val: storySum / allMovies.length },
      { label: 'Visuals', val: visualsSum / allMovies.length },
      { label: 'Action', val: actionSum / allMovies.length },
      { label: 'Fun', val: funSum / allMovies.length },
    ].sort((a, b) => b.val - a.val);

    const topCriterion = criteriaAvgs[0];

    // Populate Top Stats Strip
    if (statsBar) {
      statsBar.classList.remove('hidden');
      if (statTotal) statTotal.textContent = allMovies.length;
      if (statAvg) statAvg.textContent = `★ ${avgFinal}`;
      if (statSTier) statSTier.textContent = sTierCount;
      if (statTopCraft) statTopCraft.textContent = `${topCriterion.label} (${topCriterion.val.toFixed(1)})`;
    }

    // Populate Showcase Shelf 1: Hall of Fame (S Tier / 9.0+)
    const hofMovies = enriched.filter(m => m.computedScores.final >= 9.0);
    if (shelfHof && hofGrid) {
      if (hofMovies.length > 0) {
        shelfHof.classList.remove('hidden');
        if (hofCount) hofCount.textContent = hofMovies.length;
        hofGrid.innerHTML = hofMovies.slice(0, 6).map((m, i) => createCardHtml(m, m.computedScores, i, 'hof')).join('');
      } else {
        shelfHof.classList.add('hidden');
      }
    }

    // Populate Showcase Shelf 2: Bias Outliers (Largest absolute bias)
    const biasMovies = enriched
      .filter(m => Math.abs(m.computedScores.totalBias) >= 0.5)
      .sort((a, b) => Math.abs(b.computedScores.totalBias) - Math.abs(a.computedScores.totalBias));

    if (shelfBias && biasGrid) {
      if (biasMovies.length > 0) {
        shelfBias.classList.remove('hidden');
        biasGrid.innerHTML = biasMovies.slice(0, 6).map((m, i) => createCardHtml(m, m.computedScores, i, 'bias')).join('');
      } else {
        shelfBias.classList.add('hidden');
      }
    }

    // Show showcase container only if at least one shelf is visible
    const hasShowcase = (hofMovies.length > 0) || (biasMovies.length > 0);
    if (showcaseContainer) {
      if (hasShowcase && !searchQuery.trim() && activeTags.size === 0) {
        showcaseContainer.classList.remove('hidden');
      } else {
        showcaseContainer.classList.add('hidden');
      }
    }
  }

  // ─── 2. Compact Movie Card Template (6-Col Friendly) ──
  function createCardHtml(movie, scores, index, variant = 'default') {
    const level = getScoreLevel(scores.final);
    const glowRing = level === 'high' 
      ? 'shadow-glow-high ring-1 ring-emerald-500/40' 
      : (level === 'mid' ? 'shadow-glow-mid ring-1 ring-amber-500/40' : 'shadow-glow-low ring-1 ring-rose-500/40');

    let extraCardClass = '';
    if (variant === 'hof') extraCardClass = 'hof-card';
    if (variant === 'bias') extraCardClass = 'bias-card';

    // Poster content: image or fallback letter
    const posterContent = movie.posterUrl
      ? `<img src="${movie.posterUrl}" alt="${escapeHtml(movie.title)}" loading="lazy" class="w-full h-full object-cover transition duration-300 group-hover:scale-105" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="poster-fallback" style="display:none">${escapeHtml((movie.title || '?')[0])}</div>`
      : `<div class="poster-fallback">${escapeHtml((movie.title || '?')[0])}</div>`;

    // Tags row (only show 1-2 tags to keep card compact)
    const movieTags = Array.isArray(movie.tags) ? movie.tags : [];
    let badgeHtml = '';

    if (variant === 'bias') {
      const topBias = (Array.isArray(movie.biases) && movie.biases.length > 0) ? movie.biases[0] : null;
      const isPos = scores.totalBias > 0;
      const biasLabel = topBias ? escapeHtml(topBias.reason || '') : (isPos ? 'Positive bias' : 'Negative bias');
      const sign = isPos ? '+' : '';
      badgeHtml = `<div class="bias-tag-pill ${isPos ? 'positive' : 'negative'}" title="${sign}${scores.totalBias} ${biasLabel}">${sign}${scores.totalBias} ${biasLabel.slice(0, 12)}</div>`;
    } else if (movieTags.length > 0) {
      badgeHtml = `<div class="movie-card-tags" style="margin-top:2px">${movieTags.slice(0, 1).map(t => `<span class="tag-link" style="pointer-events:none;font-size:9px;padding:1px 5px">${escapeHtml(t)}</span>`).join('')}${movieTags.length > 1 ? `<span style="font-size:9px;color:var(--text-muted)">+${movieTags.length - 1}</span>` : ''}</div>`;
    }

    return `
      <div class="w-full flex flex-col group">
        <a href="view.html?id=${movie.id}" class="movie-card ${extraCardClass} fade-in block h-full transition duration-300 hover:-translate-y-1.5" style="--delay:${index * 0.03}s">
          <div class="movie-poster relative overflow-hidden">${posterContent}</div>
          <div class="ticket-cut movie-info">
            <div class="min-w-0 pr-1 flex-1">
              <div class="movie-title truncate" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</div>
              <div class="movie-year">${escapeHtml(movie.year) || '—'}</div>
              ${badgeHtml}
            </div>
            <div class="score-badge ${level} ${glowRing} flex-shrink-0">${formatScore(scores.final)}</div>
          </div>
        </a>
      </div>
    `;
  }

  // ─── 3. Tag Filter Bar ────────────────────────────────
  function renderTagFilterBar() {
    const allTags = MovieService.getAllTags(allMovies);

    if (allTags.length === 0) {
      tagFilterBar.classList.add('hidden');
      return;
    }

    tagFilterBar.classList.remove('hidden');

    const filtered = getFilteredMovies();
    const countLabel = activeTags.size > 0
      ? `${filtered.length} / ${allMovies.length}`
      : allMovies.length;

    tagFilterBar.innerHTML = `
      <button class="tag-pill ${activeTags.size === 0 ? 'active' : ''}" data-tag="__all__">
        All <span class="tag-pill-count">${countLabel}</span>
      </button>
      ${allTags.map(tag => {
        const isActive = activeTags.has(tag);
        const movieCount = allMovies.filter(m => Array.isArray(m.tags) && m.tags.includes(tag)).length;
        return `<button class="tag-pill ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
          ${escapeHtml(tag)} <span class="tag-pill-count">${movieCount}</span>
        </button>`;
      }).join('')}
    `;

    tagFilterBar.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (tag === '__all__') {
          activeTags.clear();
        } else {
          if (activeTags.has(tag)) {
            activeTags.delete(tag);
          } else {
            activeTags.add(tag);
          }
        }
        if (activeTags.size === 1) {
          const [t] = activeTags;
          history.replaceState(null, '', `?tag=${encodeURIComponent(t)}`);
        } else {
          history.replaceState(null, '', window.location.pathname);
        }
        renderTagFilterBar();
        renderList();
      });
    });
  }

  function getFilteredMovies() {
    let result = allMovies;

    if (activeTags.size > 0) {
      result = result.filter(m => {
        const movieTags = Array.isArray(m.tags) ? m.tags : [];
        for (const t of activeTags) {
          if (movieTags.includes(t)) return true;
        }
        return false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(m => {
        const title = (m.title || '').toLowerCase();
        const year = String(m.year || '');
        return title.includes(q) || year.includes(q);
      });
    }

    return result;
  }

  // ─── 4. Main Collection List ──────────────────────────
  function renderList() {
    const sort = sortSelect.value;
    const filtered = getFilteredMovies();
    const movies = sortMovies(filtered, sort);

    const isFiltered = activeTags.size > 0 || Boolean(searchQuery.trim());

    // Toggle showcase visibility based on filter state
    if (showcaseContainer) {
      const hasShowcaseItems = (shelfHof && !shelfHof.classList.contains('hidden')) || (shelfBias && !shelfBias.classList.contains('hidden'));
      if (isFiltered || !hasShowcaseItems || allMovies.length === 0) {
        showcaseContainer.classList.add('hidden');
      } else {
        showcaseContainer.classList.remove('hidden');
      }
    }

    // Update section headers
    if (isFiltered) {
      if (collectionHeading) collectionHeading.textContent = 'Filtered Results';
      if (collectionSubtitle) collectionSubtitle.textContent = `Showing ${movies.length} of ${allMovies.length} movies`;
      countEl.textContent = `${movies.length} of ${allMovies.length} movie${allMovies.length !== 1 ? 's' : ''} matched`;
    } else {
      if (collectionHeading) collectionHeading.textContent = 'All Reviews';
      if (collectionSubtitle) collectionSubtitle.textContent = 'Search, filter, and sort your entire catalog';
      countEl.textContent = `${movies.length} movie${movies.length !== 1 ? 's' : ''} logged`;
    }

    // Empty state
    if (movies.length === 0) {
      grid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      const emptyTitle = emptyState.querySelector('.empty-title');
      const emptySubtitle = emptyState.querySelector('.empty-subtitle');
      if (searchQuery.trim() && emptyTitle) {
        emptyTitle.textContent = `No movies found for "${searchQuery}"`;
        if (emptySubtitle) emptySubtitle.textContent = 'Try adjusting your search query or clear tag filters';
      } else if (activeTags.size > 0 && emptyTitle) {
        emptyTitle.textContent = 'No movies matching these tags';
        if (emptySubtitle) emptySubtitle.textContent = 'Try removing tags or tagging more movies';
      } else if (emptyTitle) {
        emptyTitle.textContent = 'No movies yet';
        if (emptySubtitle) emptySubtitle.textContent = 'Start building your personal review library';
      }
      return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Render cards into compact 6-column grid
    grid.innerHTML = movies.map((movie, i) => {
      const scores = calcScores(movie.storyScore, movie.visualScore, movie.actionScore, movie.funScore, movie.biases || []);
      return createCardHtml(movie, scores, i, 'default');
    }).join('');
  }

  function sortMovies(movies, sort) {
    switch (sort) {
      case 'newest':
        return [...movies].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'highest':
        return [...movies].sort((a, b) => {
          const sa = calcScores(a.storyScore, a.visualScore, a.actionScore, a.funScore, a.biases || []);
          const sb = calcScores(b.storyScore, b.visualScore, b.actionScore, b.funScore, b.biases || []);
          return sb.final - sa.final;
        });
      case 'lowest':
        return [...movies].sort((a, b) => {
          const sa = calcScores(a.storyScore, a.visualScore, a.actionScore, a.funScore, a.biases || []);
          const sb = calcScores(b.storyScore, b.visualScore, b.actionScore, b.funScore, b.biases || []);
          return sa.final - sb.final;
        });
      case 'title':
        return [...movies].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      default:
        return movies;
    }
  }

  // Real-time search input listener
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchClear) {
        searchClear.classList.toggle('hidden', !searchQuery);
      }
      renderList();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.add('hidden');
      searchInput.focus();
      renderList();
    });
  }

  sortSelect.addEventListener('change', renderList);
  await loadAndRender();

  // ─── CSV Import & Export Modal ─────────────────────────
  const btnOpenCsv = document.getElementById('btn-open-csv-modal');
  const modalCsv = document.getElementById('modal-csv-io');
  const btnCloseCsv = document.getElementById('btn-close-csv-modal');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const tabCsvImport = document.getElementById('tab-csv-import');
  const tabCsvExport = document.getElementById('tab-csv-export');
  const panelCsvImport = document.getElementById('panel-csv-import');
  const panelCsvExport = document.getElementById('panel-csv-export');

  const csvDropzone = document.getElementById('csv-dropzone');
  const csvFileInput = document.getElementById('csv-file-input');
  const csvDropLabel = document.getElementById('csv-drop-label');
  const chkEnrichTmdb = document.getElementById('chk-enrich-tmdb');
  const chkSkipDuplicates = document.getElementById('chk-skip-duplicates');
  const csvPreviewBox = document.getElementById('csv-preview-box');
  const csvPreviewCount = document.getElementById('csv-preview-count');
  const csvPreviewFormat = document.getElementById('csv-preview-format');
  const csvPreviewList = document.getElementById('csv-preview-list');
  const csvProgressBox = document.getElementById('csv-progress-box');
  const csvProgressText = document.getElementById('csv-progress-text');
  const csvProgressPercent = document.getElementById('csv-progress-percent');
  const csvProgressBar = document.getElementById('csv-progress-bar');
  const btnStartImport = document.getElementById('btn-start-import');

  const exportLibraryCount = document.getElementById('export-library-count');
  const btnRunExport = document.getElementById('btn-run-export');

  let parsedImportMovies = [];

  function openCsvModal() {
    if (exportLibraryCount) exportLibraryCount.textContent = allMovies.length;
    modalCsv?.classList.add('active');
  }

  function closeCsvModal() {
    modalCsv?.classList.remove('active');
    // Reset import form
    parsedImportMovies = [];
    if (csvFileInput) csvFileInput.value = '';
    if (csvDropLabel) csvDropLabel.textContent = 'Choose or drag & drop Letterboxd CSV file';
    csvPreviewBox?.classList.add('hidden');
    csvProgressBox?.classList.add('hidden');
    if (btnStartImport) {
      btnStartImport.disabled = true;
      btnStartImport.textContent = 'Start Import';
    }
  }

  btnOpenCsv?.addEventListener('click', openCsvModal);
  btnCloseCsv?.addEventListener('click', closeCsvModal);
  btnCancelImport?.addEventListener('click', closeCsvModal);

  modalCsv?.addEventListener('click', (e) => {
    if (e.target === modalCsv) closeCsvModal();
  });

  // Tab switching
  tabCsvImport?.addEventListener('click', () => {
    tabCsvImport.className = 'pb-2 px-3 text-xs font-semibold border-b-2 border-kino-accent text-white';
    tabCsvExport.className = 'pb-2 px-3 text-xs font-semibold text-kino-secondary hover:text-white';
    panelCsvImport?.classList.remove('hidden');
    panelCsvExport?.classList.add('hidden');
  });

  tabCsvExport?.addEventListener('click', () => {
    tabCsvExport.className = 'pb-2 px-3 text-xs font-semibold border-b-2 border-kino-accent text-white';
    tabCsvImport.className = 'pb-2 px-3 text-xs font-semibold text-kino-secondary hover:text-white';
    panelCsvExport?.classList.remove('hidden');
    panelCsvImport?.classList.add('hidden');
    if (exportLibraryCount) exportLibraryCount.textContent = allMovies.length;
  });

  // Dropzone click & drag events
  csvDropzone?.addEventListener('click', () => csvFileInput?.click());

  csvDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvDropzone.classList.add('border-kino-accent', 'bg-white/[0.05]');
  });

  csvDropzone?.addEventListener('dragleave', () => {
    csvDropzone.classList.remove('border-kino-accent', 'bg-white/[0.05]');
  });

  csvDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    csvDropzone.classList.remove('border-kino-accent', 'bg-white/[0.05]');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  });

  csvFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleCsvFile(e.target.files[0]);
    }
  });

  function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      Toast.error('Please select a valid .csv file.');
      return;
    }

    if (csvDropLabel) csvDropLabel.textContent = `Selected: ${file.name}`;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const result = ImportService.parseLetterboxdCSV(text);

        if (!result.movies || result.movies.length === 0) {
          Toast.warning('No valid movie records found in this file.');
          btnStartImport.disabled = true;
          return;
        }

        parsedImportMovies = result.movies;
        csvPreviewCount.textContent = `${parsedImportMovies.length} movies detected`;
        csvPreviewFormat.textContent = result.format === 'letterboxd-ratings' ? 'Letterboxd Ratings' : (result.format === 'letterboxd-reviews' ? 'Letterboxd Reviews' : 'Letterboxd Watched');

        // Render preview of first 5 items
        csvPreviewList.innerHTML = parsedImportMovies.slice(0, 5).map(m => `
          <div class="flex items-center justify-between py-0.5 border-b border-white/[0.04]">
            <span class="truncate font-medium text-white max-w-[240px]">${escapeHtml(m.title)} (${m.year || '—'})</span>
            <span class="text-kino-accent-light font-bold">${m.rawRating ? `${m.rawRating}★ → ${m.finalScore}` : `${m.finalScore}`}</span>
          </div>
        `).join('');

        if (parsedImportMovies.length > 5) {
          csvPreviewList.innerHTML += `<div class="text-kino-muted pt-1 text-center">...and ${parsedImportMovies.length - 5} more</div>`;
        }

        csvPreviewBox?.classList.remove('hidden');
        btnStartImport.disabled = false;
        Toast.info(`Parsed ${parsedImportMovies.length} movies. Ready to import.`);
      } catch (err) {
        console.error('Error parsing CSV:', err);
        Toast.error('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  btnStartImport?.addEventListener('click', async () => {
    if (parsedImportMovies.length === 0) return;

    btnStartImport.disabled = true;
    btnStartImport.textContent = 'Importing...';
    csvProgressBox?.classList.remove('hidden');

    let toImport = [...parsedImportMovies];

    // Deduplicate against existing library if checked
    if (chkSkipDuplicates?.checked) {
      const existingKeys = new Set(allMovies.map(m => `${(m.title || '').trim().toLowerCase()}_${m.year || ''}`));
      toImport = toImport.filter(m => !existingKeys.has(`${(m.title || '').trim().toLowerCase()}_${m.year || ''}`));
    }

    if (toImport.length === 0) {
      Toast.warning('All movies in this CSV already exist in your library.');
      btnStartImport.disabled = false;
      btnStartImport.textContent = 'Start Import';
      return;
    }

    try {
      // Step 1: TMDB enrichment
      if (chkEnrichTmdb?.checked) {
        csvProgressText.textContent = `Enriching posters & info from TMDB (0 of ${toImport.length})...`;
        toImport = await ImportService.enrichWithTMDB(toImport, (cur, total, item) => {
          const pct = Math.round((cur / total) * 60); // 0 to 60%
          csvProgressBar.style.width = `${pct}%`;
          csvProgressPercent.textContent = `${pct}%`;
          csvProgressText.textContent = `Enriching TMDB: ${escapeHtml(item.title)} (${cur}/${total})`;
        });
      }

      // Step 2: Batch Insert
      csvProgressText.textContent = `Saving ${toImport.length} movies to your library...`;
      await MovieService.batchInsert(toImport, (cur, total) => {
        const pct = 60 + Math.round((cur / total) * 40); // 60 to 100%
        csvProgressBar.style.width = `${pct}%`;
        csvProgressPercent.textContent = `${pct}%`;
        csvProgressText.textContent = `Saved ${cur} of ${total} reviews...`;
      });

      Toast.success(`Successfully imported ${toImport.length} movies into your library!`);
      closeCsvModal();
      await loadAndRender();
    } catch (err) {
      console.error('Import error:', err);
      Toast.error('Import failed: ' + err.message);
      btnStartImport.disabled = false;
      btnStartImport.textContent = 'Retry Import';
    }
  });

  btnRunExport?.addEventListener('click', () => {
    try {
      if (allMovies.length === 0) {
        Toast.warning('No movies in your library to export.');
        return;
      }
      ImportService.exportToLetterboxdCSV(allMovies);
      Toast.success(`Exported ${allMovies.length} movies to Letterboxd CSV!`);
    } catch (err) {
      console.error('Export error:', err);
      Toast.error('Export failed: ' + err.message);
    }
  });
});
