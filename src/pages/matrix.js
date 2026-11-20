// KinoVibe 2D Vibe Matrix Page Controller
import { AuthService } from '../services/auth.service.js';
import { MovieService } from '../services/movie.service.js';
import { calcScores, formatScore, getScoreLevel } from '../utils/scoring.js';
import { escapeHtml, Toast } from '../utils/ui.js';
import { ExportImageUtil } from '../utils/export-image.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Require login — redirect if not authenticated
  const user = await AuthService.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  await AuthService.initNav();

  const loadingStateEl = document.getElementById('loading-state');
  const matrixWrapperEl = document.getElementById('matrix-wrapper');
  const emptyStateEl = document.getElementById('empty-state');
  const matrixCountEl = document.getElementById('matrix-count');
  const plotAreaEl = document.getElementById('matrix-plot-area');
  const matrixBoardEl = document.getElementById('matrix-board');
  const tooltipEl = document.getElementById('matrix-tooltip');
  const searchInputEl = document.getElementById('matrix-search');
  const filterBtns = document.querySelectorAll('.matrix-filter-btn');
  const btnPosters = document.getElementById('toggle-matrix-posters');
  const btnDots = document.getElementById('toggle-matrix-dots');
  const tagFilterBar = document.getElementById('tag-filter-bar');

  // Lens Switcher & Axis Elements (v0.4)
  const lensBtns = document.querySelectorAll('#matrix-lens-toggle .tier-view-btn');
  const axisTopTitle = document.getElementById('axis-label-top-title');
  const axisTopFormula = document.getElementById('axis-label-top-formula');
  const axisLeftTitle = document.getElementById('axis-label-left-title');
  const axisRightTitle = document.getElementById('axis-label-right-title');
  const axisRightFormula = document.getElementById('axis-label-right-formula');
  const axisBottomTitle = document.getElementById('axis-label-bottom-title');
  const tickCenter = document.getElementById('tick-center');
  const tickXMin = document.getElementById('tick-x-min');
  const tickYMin = document.getElementById('tick-y-min');
  const quadTitleTl = document.getElementById('quad-title-tl');
  const quadDescTl = document.getElementById('quad-desc-tl');
  const quadTitleTr = document.getElementById('quad-title-tr');
  const quadDescTr = document.getElementById('quad-desc-tr');
  const quadTitleBl = document.getElementById('quad-title-bl');
  const quadDescBl = document.getElementById('quad-desc-bl');
  const quadTitleBr = document.getElementById('quad-title-br');
  const quadDescBr = document.getElementById('quad-desc-br');

  const LENSES = {
    classic: {
      id: 'classic',
      label: 'Classic (0–10)',
      axisTopTitle: 'High Entertainment',
      axisTopFormula: 'avg(Action + Fun)',
      axisBottomTitle: 'Low Entertainment',
      axisLeftTitle: 'Low Quality',
      axisRightTitle: 'High Quality',
      axisRightFormula: 'avg(Story + Visuals)',
      tickCenter: '5.0',
      tickXMin: '0',
      tickYMin: '0',
      quadTlTitle: 'Guilty Pleasures',
      quadTlDesc: 'Low Craft · High Fun',
      quadTrTitle: 'Peak Cinema',
      quadTrDesc: 'High Craft · High Fun',
      quadBlTitle: 'Duds & Skips',
      quadBlDesc: 'Low Craft · Low Fun',
      quadBrTitle: 'Slow Burns & Prestige',
      quadBrDesc: 'High Craft · Low Fun',
      computeCoords: (m) => {
        const x = Math.round(((m.story + m.visuals) / 2) * 10) / 10;
        const y = Math.round(((m.action + m.fun) / 2) * 10) / 10;
        const normX = x / 10;
        const normY = y / 10;
        let quad = 'duds';
        let quadLabel = 'Duds & Skips';
        if (x >= 5 && y >= 5) { quad = 'peak'; quadLabel = 'Peak Cinema'; }
        else if (x < 5 && y >= 5) { quad = 'guilty'; quadLabel = 'Guilty Pleasures'; }
        else if (x >= 5 && y < 5) { quad = 'slow'; quadLabel = 'Slow Burns & Prestige'; }
        return { coordX: x, coordY: y, normX, normY, quad, quadLabel };
      }
    },
    story: {
      id: 'story',
      label: 'Story × Fun',
      axisTopTitle: 'Pure Fun & Entertainment',
      axisTopFormula: 'Fun score (0–10)',
      axisBottomTitle: 'Serious / Heavy',
      axisLeftTitle: 'Light Narrative',
      axisRightTitle: 'Deep Story & Writing',
      axisRightFormula: 'Story score (0–10)',
      tickCenter: '5.0',
      tickXMin: '0',
      tickYMin: '0',
      quadTlTitle: 'Popcorn & Escapism',
      quadTlDesc: 'Light Story · Pure Fun',
      quadTrTitle: 'Rich Masterpiece',
      quadTrDesc: 'Deep Story · High Fun',
      quadBlTitle: 'Bleak & Shallow',
      quadBlDesc: 'Low Story · Low Fun',
      quadBrTitle: 'Serious Narrative',
      quadBrDesc: 'Deep Story · Low Fun',
      computeCoords: (m) => {
        const x = m.story;
        const y = m.fun;
        const normX = x / 10;
        const normY = y / 10;
        let quad = 'duds';
        let quadLabel = 'Bleak & Shallow';
        if (x >= 5 && y >= 5) { quad = 'peak'; quadLabel = 'Rich Masterpiece'; }
        else if (x < 5 && y >= 5) { quad = 'guilty'; quadLabel = 'Popcorn & Escapism'; }
        else if (x >= 5 && y < 5) { quad = 'slow'; quadLabel = 'Serious Narrative'; }
        return { coordX: x, coordY: y, normX, normY, quad, quadLabel };
      }
    },
    rare: {
      id: 'rare',
      label: 'Focused (3–10)',
      axisTopTitle: 'High Entertainment',
      axisTopFormula: 'avg(Action + Fun)',
      axisBottomTitle: 'Low Entertainment',
      axisLeftTitle: 'Low Quality',
      axisRightTitle: 'High Quality',
      axisRightFormula: 'avg(Story + Visuals)',
      tickCenter: '6.5',
      tickXMin: '3',
      tickYMin: '3',
      quadTlTitle: 'Guilty Pleasures',
      quadTlDesc: 'Craft < 6.5 · Fun ≥ 6.5',
      quadTrTitle: 'Peak Cinema',
      quadTrDesc: 'Craft ≥ 6.5 · Fun ≥ 6.5',
      quadBlTitle: 'Duds & Skips',
      quadBlDesc: 'Craft < 6.5 · Fun < 6.5',
      quadBrTitle: 'Slow Burns',
      quadBrDesc: 'Craft ≥ 6.5 · Fun < 6.5',
      computeCoords: (m) => {
        const x = Math.round(((m.story + m.visuals) / 2) * 10) / 10;
        const y = Math.round(((m.action + m.fun) / 2) * 10) / 10;
        const normX = Math.max(0, Math.min(1, (x - 3) / 7));
        const normY = Math.max(0, Math.min(1, (y - 3) / 7));
        let quad = 'duds';
        let quadLabel = 'Duds & Skips';
        if (x >= 6.5 && y >= 6.5) { quad = 'peak'; quadLabel = 'Peak Cinema'; }
        else if (x < 6.5 && y >= 6.5) { quad = 'guilty'; quadLabel = 'Guilty Pleasures'; }
        else if (x >= 6.5 && y < 6.5) { quad = 'slow'; quadLabel = 'Slow Burns'; }
        return { coordX: x, coordY: y, normX, normY, quad, quadLabel };
      }
    }
  };

  let currentView = localStorage.getItem('kinovibe_matrix_view') || 'posters';
  let activeQuadrant = 'all';
  let searchTerm = '';
  let activeTags = new Set();

  // Read URL param (e.g. matrix.html?tag=sci-fi&lens=story)
  const urlParams = new URLSearchParams(window.location.search);
  const urlTag = urlParams.get('tag');
  if (urlTag) activeTags.add(urlTag.trim().toLowerCase());

  let currentLens = urlParams.get('lens') || urlParams.get('mode') || 'classic';
  if (!LENSES[currentLens]) currentLens = 'classic';

  function applyLensUI(lensKey) {
    const config = LENSES[lensKey] || LENSES.classic;
    lensBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.lens === lensKey));

    if (axisTopTitle) axisTopTitle.textContent = config.axisTopTitle;
    if (axisTopFormula) axisTopFormula.textContent = config.axisTopFormula;
    if (axisBottomTitle) axisBottomTitle.textContent = config.axisBottomTitle;
    if (axisLeftTitle) axisLeftTitle.textContent = config.axisLeftTitle;
    if (axisRightTitle) axisRightTitle.textContent = config.axisRightTitle;
    if (axisRightFormula) axisRightFormula.textContent = config.axisRightFormula;

    if (tickCenter) tickCenter.textContent = config.tickCenter;
    if (tickXMin) tickXMin.textContent = config.tickXMin;
    if (tickYMin) tickYMin.textContent = config.tickYMin;

    if (quadTitleTl) quadTitleTl.textContent = config.quadTlTitle;
    if (quadDescTl) quadDescTl.textContent = config.quadTlDesc;
    if (quadTitleTr) quadTitleTr.textContent = config.quadTrTitle;
    if (quadDescTr) quadDescTr.textContent = config.quadTrDesc;
    if (quadTitleBl) quadTitleBl.textContent = config.quadBlTitle;
    if (quadDescBl) quadDescBl.textContent = config.quadBlDesc;
    if (quadTitleBr) quadTitleBr.textContent = config.quadBrTitle;
    if (quadDescBr) quadDescBr.textContent = config.quadBrDesc;
  }

  lensBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const l = btn.dataset.lens;
      if (l && LENSES[l] && l !== currentLens) {
        currentLens = l;
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('lens', l);
        history.replaceState(null, '', newUrl.toString());
        applyLensUI(currentLens);
        rebuildAndRender();
      }
    });
  });

  applyLensUI(currentLens);

  // Show spinner
  if (loadingStateEl) {
    loadingStateEl.classList.remove('hidden');
    loadingStateEl.style.display = 'flex';
  }
  matrixWrapperEl.classList.add('hidden');
  emptyStateEl.classList.add('hidden');

  let rawMovies = [];
  try {
    rawMovies = await MovieService.getAll();
  } catch (err) {
    console.error('Failed to load movies for matrix:', err);
    rawMovies = [];
  } finally {
    if (loadingStateEl) {
      loadingStateEl.classList.add('hidden');
      loadingStateEl.style.display = 'none';
    }
  }

  if (rawMovies.length === 0) {
    emptyStateEl.classList.remove('hidden');
    matrixWrapperEl.classList.add('hidden');
    matrixCountEl.textContent = '0 movies plotted';
    return;
  }

  emptyStateEl.classList.add('hidden');
  matrixWrapperEl.classList.remove('hidden');

  // ─── Tag Filter Bar ──────────────────────────────────
  function renderTagFilterBar() {
    const allTags = MovieService.getAllTags(rawMovies);
    if (allTags.length === 0) {
      tagFilterBar.classList.add('hidden');
      return;
    }
    tagFilterBar.classList.remove('hidden');

    tagFilterBar.innerHTML = `
      <button class="tag-pill ${activeTags.size === 0 ? 'active' : ''}" data-tag="__all__">
        All <span class="tag-pill-count">${rawMovies.length}</span>
      </button>
      ${allTags.map(tag => {
        const isActive = activeTags.has(tag);
        const cnt = rawMovies.filter(m => Array.isArray(m.tags) && m.tags.includes(tag)).length;
        return `<button class="tag-pill ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
          ${escapeHtml(tag)} <span class="tag-pill-count">${cnt}</span>
        </button>`;
      }).join('')}
    `;

    tagFilterBar.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (tag === '__all__') {
          activeTags.clear();
        } else {
          activeTags.has(tag) ? activeTags.delete(tag) : activeTags.add(tag);
        }
        if (activeTags.size === 1) {
          const [t] = activeTags;
          history.replaceState(null, '', `?tag=${encodeURIComponent(t)}`);
        } else {
          history.replaceState(null, '', window.location.pathname);
        }
        renderTagFilterBar();
        rebuildAndRender();
      });
    });
  }

  function getTagFilteredMovies() {
    if (activeTags.size === 0) return rawMovies;
    return rawMovies.filter(m => {
      const movieTags = Array.isArray(m.tags) ? m.tags : [];
      for (const t of activeTags) {
        if (movieTags.includes(t)) return true;
      }
      return false;
    });
  }
  // ────────────────────────────────────────────────────

  // Process movie coordinates & quadrants
  const coordMap = new Map();

  function processMovies(source) {
    coordMap.clear();
    const activeConfig = LENSES[currentLens] || LENSES.classic;

    return source.map(movie => {
      const story = Number(movie.storyScore) || 0;
      const visuals = Number(movie.visualScore) || 0;
      const action = Number(movie.actionScore) || 0;
      const fun = Number(movie.funScore) || 0;

      const scores = calcScores(story, visuals, action, fun, movie.biases || []);
      const finalScore = Number(scores.final);

      const calculated = activeConfig.computeCoords({ story, visuals, action, fun });
      const { coordX, coordY, normX, normY, quad: quadrant, quadLabel: quadrantLabel } = calculated;

      const key = `${coordX.toFixed(1)}_${coordY.toFixed(1)}`;
      const coordIndex = coordMap.get(key) || 0;
      coordMap.set(key, coordIndex + 1);

      return {
        ...movie,
        quality: coordX,
        entertainment: coordY,
        normX,
        normY,
        story, visuals, action, fun,
        finalScore, quadrant, quadrantLabel, coordIndex
      };
    });
  }

  let movies = processMovies(rawMovies);

  function rebuildAndRender() {
    const filtered = getTagFilteredMovies();
    movies = processMovies(filtered);

    const displayCount = activeTags.size > 0
      ? `${filtered.length} / ${rawMovies.length} movies plotted`
      : `${rawMovies.length} movie${rawMovies.length !== 1 ? 's' : ''} plotted`;
    matrixCountEl.textContent = displayCount;

    renderPins();
  }

  // Calculate percentage positions
  const INSET = 6; // % margin inside board
  const USABLE = 100 - (INSET * 2);

  function renderPins() {
    plotAreaEl.className = `matrix-plot-area mode-${currentView}`;
    plotAreaEl.innerHTML = '';

    movies.forEach(movie => {
      // Deterministic slight offset for identical coordinates
      let offsetX = 0;
      let offsetY = 0;
      if (movie.coordIndex > 0) {
        const angle = (movie.coordIndex * 137.5) * (Math.PI / 180);
        const radius = Math.min(2.5, movie.coordIndex * 0.9);
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }

      let posX = INSET + movie.normX * USABLE + offsetX;
      let posY = INSET + movie.normY * USABLE + offsetY;

      posX = Math.max(3, Math.min(97, posX));
      posY = Math.max(3, Math.min(97, posY));

      const pin = document.createElement('a');
      pin.href = `view.html?id=${movie.id}`;
      pin.className = `matrix-pin q-${movie.quadrant}`;
      pin.dataset.id = movie.id;
      pin.dataset.quadrant = movie.quadrant;
      pin.dataset.title = (movie.title || '').toLowerCase();
      pin.style.left = `${posX.toFixed(2)}%`;
      pin.style.bottom = `${posY.toFixed(2)}%`;

      const level = getScoreLevel(movie.finalScore);
      const formattedScore = formatScore(movie.finalScore);

      if (currentView === 'posters') {
        const posterContent = movie.posterUrl
          ? `<img src="${escapeHtml(movie.posterUrl)}" alt="${escapeHtml(movie.title)}" class="matrix-pin-poster-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="matrix-pin-fallback" style="display:none">${escapeHtml((movie.title || '?')[0])}</div>`
          : `<div class="matrix-pin-fallback">${escapeHtml((movie.title || '?')[0])}</div>`;

        pin.innerHTML = `
          <div class="matrix-pin-poster">
            ${posterContent}
            <div class="matrix-pin-score ${level}">${formattedScore}</div>
          </div>
        `;
      } else {
        pin.innerHTML = `
          <div class="matrix-pin-dot">
            <span class="matrix-dot-inner"></span>
            <span class="matrix-dot-badge">${formattedScore}</span>
          </div>
        `;
      }

      // Hover / Tooltip logic
      pin.addEventListener('mouseenter', () => showTooltip(movie, pin));
      pin.addEventListener('mouseleave', hideTooltip);
      pin.addEventListener('focus', () => showTooltip(movie, pin));
      pin.addEventListener('blur', hideTooltip);

      plotAreaEl.appendChild(pin);
    });

    applyFilters();
  }

  function showTooltip(movie, pinEl) {
    if (!tooltipEl || !matrixBoardEl) return;

    const formattedScore = formatScore(movie.finalScore);
    const level = getScoreLevel(movie.finalScore);

    const posterThumb = movie.posterUrl
      ? `<img src="${escapeHtml(movie.posterUrl)}" alt="${escapeHtml(movie.title)}" class="tooltip-poster" onerror="this.style.display='none'">`
      : '';

    // Tags in tooltip
    const movieTags = Array.isArray(movie.tags) ? movie.tags : [];
    const tagsHtml = movieTags.length > 0
      ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${movieTags.slice(0, 4).map(t => `<span class="tag-link" style="pointer-events:none;font-size:10px;padding:1px 7px">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    tooltipEl.innerHTML = `
      <div class="tooltip-content">
        ${posterThumb}
        <div class="tooltip-details">
          <div class="tooltip-header">
            <div class="tooltip-title">${escapeHtml(movie.title)}</div>
            <div class="tooltip-year">${escapeHtml(movie.year) || '—'}</div>
          </div>
          <div class="tooltip-badge q-${movie.quadrant}">${escapeHtml(movie.quadrantLabel)}</div>
          ${tagsHtml}
          <div class="tooltip-stats">
            <div class="stat-row">
              <span class="stat-lbl">Quality (Story + Visuals):</span>
              <strong class="stat-val">${movie.quality.toFixed(1)}</strong>
            </div>
            <div class="stat-breakdown">Story ${movie.story} · Visuals ${movie.visuals}</div>
            <div class="stat-row">
              <span class="stat-lbl">Entertainment (Action + Fun):</span>
              <strong class="stat-val">${movie.entertainment.toFixed(1)}</strong>
            </div>
            <div class="stat-breakdown">Action ${movie.action} · Fun ${movie.fun}</div>
            <div class="stat-row final-row">
              <span class="stat-lbl">Overall Score:</span>
              <strong class="stat-val ${level}">${formattedScore}</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    tooltipEl.classList.remove('hidden');

    // Position tooltip near the pin
    const boardRect = matrixBoardEl.getBoundingClientRect();
    const pinRect = pinEl.getBoundingClientRect();

    let left = pinRect.left - boardRect.left + (pinRect.width / 2);
    let top = pinRect.top - boardRect.top;

    const tooltipWidth = 260;
    if (left + (tooltipWidth / 2) > boardRect.width - 15) {
      left = boardRect.width - tooltipWidth - 15;
    } else if (left - (tooltipWidth / 2) < 15) {
      left = 15;
    } else {
      left = left - (tooltipWidth / 2);
    }

    if (top < 160) {
      top = top + pinRect.height + 10;
    } else {
      top = top - 180;
    }

    tooltipEl.style.left = `${Math.max(10, left)}px`;
    tooltipEl.style.top = `${Math.max(10, top)}px`;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.add('hidden');
  }

  function applyFilters() {
    const pins = plotAreaEl.querySelectorAll('.matrix-pin');
    pins.forEach(pin => {
      const matchQuadrant = activeQuadrant === 'all' || pin.dataset.quadrant === activeQuadrant;
      const matchSearch = !searchTerm || pin.dataset.title.includes(searchTerm);

      if (!matchQuadrant) {
        pin.classList.add('dimmed');
        pin.classList.remove('highlighted');
      } else if (matchSearch) {
        pin.classList.remove('dimmed');
        if (searchTerm) pin.classList.add('highlighted');
        else pin.classList.remove('highlighted');
      } else {
        pin.classList.add('dimmed');
        pin.classList.remove('highlighted');
      }
    });
  }

  // Quadrant filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeQuadrant = btn.dataset.quadrant;
      applyFilters();
    });
  });

  if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  function setView(mode) {
    currentView = mode;
    localStorage.setItem('kinovibe_matrix_view', mode);

    if (btnPosters) btnPosters.classList.toggle('active', mode === 'posters');
    if (btnDots) btnDots.classList.toggle('active', mode === 'dots');

    renderPins();
  }

  if (btnPosters) btnPosters.addEventListener('click', () => setView('posters'));
  if (btnDots) btnDots.addEventListener('click', () => setView('dots'));

  renderTagFilterBar();
  matrixCountEl.textContent = `${rawMovies.length} movie${rawMovies.length !== 1 ? 's' : ''} plotted`;
  setView(currentView);

  // ─── Export Image Card ─────────────────────────────────
  const btnExport = document.getElementById('btn-export-matrix-image');
  const modalExport = document.getElementById('modal-export-image');
  const btnCloseExport = document.getElementById('btn-close-export-modal');
  const exportPreviewImg = document.getElementById('export-preview-img');
  const exportSpinner = document.getElementById('export-loading-spinner');
  const btnCopyCard = document.getElementById('btn-copy-card');
  const btnDownloadCard = document.getElementById('btn-download-card');
  const formatButtons = document.querySelectorAll('#export-format-selector .aspect-pill');

  let currentExportFormat = 'square';
  let activeCanvas = null;

  async function updateExportPreview() {
    if (!modalExport || !modalExport.classList.contains('active')) return;

    if (exportSpinner) exportSpinner.classList.remove('hidden');
    if (exportPreviewImg) exportPreviewImg.classList.add('hidden');

    try {
      const filtered = getFilteredMovies();
      const profile = await AuthService.getProfile();
      const userName = profile?.username || profile?.displayName || user.email?.split('@')[0] || 'Cinephile';

      activeCanvas = await ExportImageUtil.renderMatrixCanvas({
        movies: filtered,
        userName,
        title: '2D Vibe Matrix',
        labels: {
          top: 'HIGH DEPTH / STORY',
          bottom: 'ACTION / SPECTACLE',
          left: 'POPCORN FUN',
          right: 'CINEPHILE GOLD'
        },
        format: currentExportFormat
      });

      if (exportPreviewImg && activeCanvas) {
        exportPreviewImg.src = activeCanvas.toDataURL('image/png');
        exportPreviewImg.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Failed to render matrix card export:', err);
      Toast.error('Could not generate card preview.');
    } finally {
      if (exportSpinner) exportSpinner.classList.add('hidden');
    }
  }

  btnExport?.addEventListener('click', () => {
    modalExport?.classList.add('active');
    updateExportPreview();
  });

  btnCloseExport?.addEventListener('click', () => {
    modalExport?.classList.remove('active');
  });

  modalExport?.addEventListener('click', (e) => {
    if (e.target === modalExport) modalExport.classList.remove('active');
  });

  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => {
        b.className = 'aspect-pill px-3 py-1 text-xs rounded-full border border-white/10 text-kino-secondary hover:text-white font-medium';
      });
      btn.className = 'aspect-pill px-3 py-1 text-xs rounded-full border border-white/10 bg-kino-accent text-white font-medium';
      currentExportFormat = btn.dataset.format || 'square';
      updateExportPreview();
    });
  });

  btnDownloadCard?.addEventListener('click', () => {
    if (!activeCanvas) return;
    ExportImageUtil.downloadCanvas(activeCanvas, `kinovibe-vibe-matrix-${currentExportFormat}.png`);
    Toast.success('Matrix card image downloaded!');
  });

  btnCopyCard?.addEventListener('click', async () => {
    if (!activeCanvas) return;
    try {
      await ExportImageUtil.copyCanvasToClipboard(activeCanvas);
      Toast.success('Image copied to clipboard! Paste it directly in Twitter or Discord.');
    } catch (err) {
      console.warn('Copy to clipboard error:', err);
      Toast.error('Clipboard image copy not supported in this browser. Use Download instead.');
    }
  });
});
