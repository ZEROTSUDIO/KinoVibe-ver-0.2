// KinoVibe Movie Detail Page Controller
import { AuthService } from '../services/auth.service.js';
import { MovieService } from '../services/movie.service.js';
import { ProfileService } from '../services/profile.service.js';
import { calcScores, getScoreLevel, formatScore, getTierForScore } from '../utils/scoring.js';
import { escapeHtml, Toast } from '../utils/ui.js';

// Qualitative Benchmark Label Helper (Scale 1.0 – 10.0)
function getBenchmark(val) {
  const n = Number(val) || 0;
  if (n >= 9.0) return 'Masterpiece';
  if (n >= 8.0) return 'Exceptional';
  if (n >= 7.0) return 'Strong';
  if (n >= 6.0) return 'Decent';
  if (n >= 5.0) return 'Mediocre';
  return 'Flawed';
}

// Matrix Quadrant Calculator
function getMatrixQuadrant(craft, fun) {
  if (craft >= 5 && fun >= 5) {
    return { title: 'Peak Cinema', icon: '🌟', class: 'q-peak', desc: 'High Quality · High Entertainment' };
  }
  if (craft < 5 && fun >= 5) {
    return { title: 'Guilty Pleasure', icon: '🍿', class: 'q-guilty', desc: 'Popcorn Fun · Lower Craft' };
  }
  if (craft >= 5 && fun < 5) {
    return { title: 'Slow Burn', icon: '🧐', class: 'q-slow', desc: 'High Craft · Low Energy' };
  }
  return { title: 'Dud', icon: '💀', class: 'q-duds', desc: 'Low Craft · Low Entertainment' };
}

document.addEventListener('DOMContentLoaded', async () => {
  // Require login — redirect if not authenticated
  const user = await AuthService.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  await AuthService.initNav();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    window.location.href = 'library.html';
    return;
  }

  const movie = await MovieService.getById(id);
  if (!movie) {
    window.location.href = 'library.html';
    return;
  }

  // Set page title
  document.title = `${movie.title} — KinoVibe`;

  // Calculate scores & tier
  const scores = calcScores(movie.storyScore, movie.visualScore, movie.actionScore, movie.funScore, movie.biases || []);
  const level = getScoreLevel(scores.final);
  const tier = getTierForScore(scores.final);

  // Poster with fallback
  const posterEl = document.getElementById('detail-poster');
  const fallbackEl = document.getElementById('poster-fallback');
  if (movie.posterUrl) {
    const img = document.createElement('img');
    img.src = movie.posterUrl;
    img.alt = movie.title;
    img.onerror = () => {
      img.style.display = 'none';
      if (fallbackEl) fallbackEl.style.display = 'flex';
    };
    posterEl.insertBefore(img, fallbackEl);
    if (fallbackEl) fallbackEl.style.display = 'none';
  } else if (fallbackEl) {
    fallbackEl.textContent = (movie.title || '?')[0];
  }

  // Backdrop Hero
  const backdropContainer = document.getElementById('backdrop-container');
  if (movie.backdropUrl && backdropContainer) {
    backdropContainer.innerHTML = `
      <div class="movie-backdrop-hero" style="background-image: url('${movie.backdropUrl}')">
        <div class="movie-backdrop-overlay"></div>
      </div>
    `;
  }

  // Tier Stamp Seal
  const tierSeal = document.getElementById('tier-seal');
  if (tierSeal) {
    tierSeal.className = `tier-stamp-seal tier-stamp-${tier.label.toLowerCase()}`;
    tierSeal.innerHTML = `<span>★</span> ${tier.label} TIER · ${tier.desc.toUpperCase()}`;
  }

  // Final score with glow
  const finalEl = document.getElementById('detail-final-score');
  if (finalEl) {
    finalEl.textContent = formatScore(scores.final);
    const glowStyle = level === 'high'
      ? 'text-score-high drop-shadow-[0_0_24px_rgba(34,197,94,0.45)]'
      : (level === 'mid'
        ? 'text-score-mid drop-shadow-[0_0_24px_rgba(245,158,11,0.45)]'
        : 'text-score-low drop-shadow-[0_0_24px_rgba(239,68,68,0.45)]');
    finalEl.className = `score-big score-${level} ${glowStyle}`;
  }

  // Craft & Entertainment matrix calculations
  const storyNum = Number(movie.storyScore) || 0;
  const visualNum = Number(movie.visualScore) || 0;
  const actionNum = Number(movie.actionScore) || 0;
  const funNum = Number(movie.funScore) || 0;

  const craft = (storyNum + visualNum) / 2;
  const fun = (actionNum + funNum) / 2;
  const quadrant = getMatrixQuadrant(craft, fun);

  // Matrix Quadrant Badge
  const matrixIcon = document.getElementById('matrix-badge-icon');
  const matrixTitle = document.getElementById('matrix-badge-title');
  const matrixCoords = document.getElementById('matrix-badge-coords');
  if (matrixIcon) matrixIcon.textContent = quadrant.icon;
  if (matrixTitle) matrixTitle.textContent = quadrant.title;
  if (matrixCoords) matrixCoords.textContent = `Quality ${craft.toFixed(1)} · Entertainment ${fun.toFixed(1)}`;

  // Reviewer Signature Card
  // Reviewer Signature Card & Link to Profile
  const reviewerProfile = movie.userId ? await ProfileService.getProfileById(movie.userId) : await AuthService.getProfile();
  const isOwner = !movie.userId || movie.userId === user.id;
  const reviewerDisplayName = reviewerProfile?.displayName || reviewerProfile?.display_name || (isOwner ? (user.email?.split('@')[0] || 'You') : 'Community Member');
  const reviewerHandle = reviewerProfile?.username ? `@${reviewerProfile.username}` : (reviewerDisplayName.startsWith('@') ? reviewerDisplayName : `@${reviewerDisplayName}`);

  const reviewerCard = document.getElementById('reviewer-card');
  const reviewerAvatar = document.getElementById('reviewer-avatar');
  const reviewerNameEl = document.getElementById('reviewer-name');
  const reviewDateEl = document.getElementById('review-date');

  if (reviewerCard && (movie.userId || reviewerProfile?.id)) {
    reviewerCard.href = `profile.html?id=${movie.userId || reviewerProfile?.id}`;
    reviewerCard.title = `View ${reviewerDisplayName}'s Profile`;
  }

  if (reviewerAvatar) {
    const avatarVal = reviewerProfile?.avatarUrl || reviewerProfile?.avatar_url;
    if (avatarVal) {
      if (avatarVal.startsWith('http://') || avatarVal.startsWith('https://') || avatarVal.startsWith('/')) {
        reviewerAvatar.innerHTML = `<img src="${escapeHtml(avatarVal)}" class="w-full h-full object-cover rounded-full">`;
      } else {
        reviewerAvatar.textContent = avatarVal;
      }
    } else {
      reviewerAvatar.textContent = (reviewerDisplayName.replace(/^@/, '').charAt(0) || 'U').toUpperCase();
    }
  }

  if (reviewerNameEl) reviewerNameEl.textContent = reviewerHandle;
  if (reviewDateEl) {
    if (movie.createdAt) {
      const dateObj = new Date(movie.createdAt);
      reviewDateEl.textContent = isNaN(dateObj.getTime())
        ? 'Recently'
        : dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else {
      reviewDateEl.textContent = 'Recently';
    }
  }

  // Owner check for Edit/Delete actions
  if (!isOwner) {
    const ownerActions = document.getElementById('owner-actions');
    if (ownerActions) ownerActions.classList.add('hidden');
  } else {
    const editBtn = document.getElementById('edit-btn');
    if (editBtn) editBtn.href = `edit.html?id=${movie.id}`;
  }

  // Title, year, runtime, genres
  document.getElementById('detail-title').textContent = movie.title;
  let yearStr = movie.year || '—';
  if (movie.runtime) {
    const hrs = Math.floor(movie.runtime / 60);
    const mins = movie.runtime % 60;
    const runtimeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    yearStr += ` · ${runtimeStr}`;
  }
  document.getElementById('detail-year').textContent = yearStr;

  const genresEl = document.getElementById('detail-genres');
  if (genresEl && Array.isArray(movie.genres) && movie.genres.length > 0) {
    genresEl.innerHTML = movie.genres.map(g =>
      `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-kino-secondary">${escapeHtml(g)}</span>`
    ).join('');
  }

  // Tags — clickable chips that deep-link to Library
  const tagsEl = document.getElementById('detail-tags');
  if (tagsEl && Array.isArray(movie.tags) && movie.tags.length > 0) {
    tagsEl.innerHTML = movie.tags.map(t =>
      `<a href="library.html?tag=${encodeURIComponent(t)}" class="tag-link">${escapeHtml(t)}</a>`
    ).join('');
  }

  // 4-Metric Command Center Cards & Benchmark Pills
  document.getElementById('stat-story').textContent = movie.storyScore;
  document.getElementById('stat-visuals').textContent = movie.visualScore;
  document.getElementById('stat-action').textContent = movie.actionScore;
  document.getElementById('stat-fun').textContent = movie.funScore;

  const benchStory = document.getElementById('benchmark-story');
  const benchVisuals = document.getElementById('benchmark-visuals');
  const benchAction = document.getElementById('benchmark-action');
  const benchFun = document.getElementById('benchmark-fun');

  if (benchStory) benchStory.textContent = getBenchmark(movie.storyScore);
  if (benchVisuals) benchVisuals.textContent = getBenchmark(movie.visualScore);
  if (benchAction) benchAction.textContent = getBenchmark(movie.actionScore);
  if (benchFun) benchFun.textContent = getBenchmark(movie.funScore);

  // Animated progress meters
  setTimeout(() => {
    const mStory = document.getElementById('meter-story');
    if (mStory) mStory.style.width = `${Math.min(100, Math.max(0, storyNum * 10))}%`;
    const mVisuals = document.getElementById('meter-visuals');
    if (mVisuals) mVisuals.style.width = `${Math.min(100, Math.max(0, visualNum * 10))}%`;
    const mAction = document.getElementById('meter-action');
    if (mAction) mAction.style.width = `${Math.min(100, Math.max(0, actionNum * 10))}%`;
    const mFun = document.getElementById('meter-fun');
    if (mFun) mFun.style.width = `${Math.min(100, Math.max(0, funNum * 10))}%`;
  }, 120);

  // Craft vs Entertainment Balance Meter
  const craftScoreVal = document.getElementById('craft-score-val');
  const funScoreVal = document.getElementById('fun-score-val');
  if (craftScoreVal) craftScoreVal.textContent = `${craft.toFixed(1)}/10`;
  if (funScoreVal) funScoreVal.textContent = `${fun.toFixed(1)}/10`;

  const totalBalance = craft + fun;
  let craftPct = 50;
  let funPct = 50;
  if (totalBalance > 0) {
    craftPct = Math.round((craft / totalBalance) * 100);
    funPct = 100 - craftPct;
  }

  const balanceCraftBar = document.getElementById('balance-craft-bar');
  const balanceFunBar = document.getElementById('balance-fun-bar');
  if (balanceCraftBar) balanceCraftBar.style.width = `${craftPct}%`;
  if (balanceFunBar) balanceFunBar.style.width = `${funPct}%`;

  const balanceCraftPct = document.getElementById('balance-craft-pct');
  const balanceFunPct = document.getElementById('balance-fun-pct');
  if (balanceCraftPct) balanceCraftPct.textContent = `Story + Visuals (${craftPct}%)`;
  if (balanceFunPct) balanceFunPct.textContent = `Action + Fun (${funPct}%)`;

  // The Scoring Equation Inspector
  const eqBase = document.getElementById('equation-base');
  const eqSign = document.getElementById('equation-sign');
  const eqBias = document.getElementById('equation-bias');
  const eqFinal = document.getElementById('equation-final');

  if (eqBase) eqBase.textContent = formatScore(scores.base);
  if (eqSign) eqSign.textContent = scores.totalBias >= 0 ? '+' : '−';
  if (eqBias) {
    const netBiasQuarter = Math.abs(scores.totalBias) / 4;
    eqBias.textContent = `${netBiasQuarter.toFixed(2)}`;
    if (scores.totalBias > 0) eqBias.style.color = 'var(--score-high)';
    else if (scores.totalBias < 0) eqBias.style.color = 'var(--score-low)';
  }
  if (eqFinal) eqFinal.textContent = formatScore(scores.final);

  // Bias pills
  const pillsContainer = document.getElementById('bias-pills');
  const biases = movie.biases || [];
  if (pillsContainer) {
    if (biases.length === 0) {
      pillsContainer.innerHTML = `<span class="text-xs text-kino-muted italic">No personal biases applied. Pure 4-metric score.</span>`;
    } else {
      pillsContainer.innerHTML = '';
      biases.forEach(b => {
        const pill = document.createElement('span');
        const rawVal = typeof b === 'object' && b !== null ? b.amount : b;
        let amt;
        if (typeof rawVal === 'number') {
          amt = isNaN(rawVal) ? 0 : rawVal;
        } else {
          const clean = String(rawVal || '').trim().replace(/\s+/g, '').replace(',', '.');
          amt = parseFloat(clean);
          if (isNaN(amt)) amt = 0;
        }
        const isPos = amt > 0;
        pill.className = `bias-pill ${isPos ? 'positive' : 'negative'}`;
        pill.innerHTML = `<span class="pill-amount">${isPos ? '+' : ''}${amt}</span> ${escapeHtml(b.reason)}`;
        pillsContainer.appendChild(pill);
      });
    }
  }

  // Written Review
  const reviewSection = document.getElementById('review-section');
  const reviewText = document.getElementById('review-text');
  if (movie.reviewText && reviewText) {
    reviewText.textContent = movie.reviewText;
  } else if (reviewSection) {
    reviewSection.classList.add('hidden');
  }

  // Overview / Synopsis
  const overviewSection = document.getElementById('overview-section');
  const overviewText = document.getElementById('overview-text');
  if (movie.overview && overviewSection && overviewText) {
    overviewText.textContent = movie.overview;
    overviewSection.classList.remove('hidden');
  }

  // ── Share Review Modal ──
  const shareModal = document.getElementById('share-modal');
  const shareBtn = document.getElementById('share-btn');
  const closeShareModal = document.getElementById('close-share-modal');
  const copyTextBtn = document.getElementById('copy-text-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const sharePreviewText = document.getElementById('share-preview-text');

  const shareText = [
    `🎬 ${movie.title}${movie.year ? ` (${movie.year})` : ''} — ${formatScore(scores.final)}/10`,
    `🏆 ${tier.label} Tier · ${tier.desc} | 🧭 ${quadrant.title}`,
    `📖 Story: ${movie.storyScore} | 🎨 Visuals: ${movie.visualScore}`,
    `⚡ Action: ${movie.actionScore} | 🎉 Fun: ${movie.funScore}`,
    scores.totalBias !== 0 ? `⚖️ Personal Bias: ${scores.totalBias > 0 ? '+' : ''}${scores.totalBias}` : null,
    `\nReviewed on KinoVibe 🍿`,
    window.location.href
  ].filter(Boolean).join('\n');

  if (sharePreviewText) {
    sharePreviewText.textContent = shareText;
  }

  if (shareBtn && shareModal) {
    shareBtn.addEventListener('click', () => {
      shareModal.classList.add('active');
    });
  }

  if (closeShareModal && shareModal) {
    closeShareModal.addEventListener('click', () => {
      shareModal.classList.remove('active');
    });
  }

  if (shareModal) {
    shareModal.addEventListener('click', (e) => {
      if (e.target === shareModal) shareModal.classList.remove('active');
    });
  }

  if (copyTextBtn) {
    copyTextBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareText);
        Toast.success('Review summary copied to clipboard!');
      } catch {
        // Fallback for non-https/permissions
        const ta = document.createElement('textarea');
        ta.value = shareText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        Toast.success('Review summary copied to clipboard!');
      }
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        Toast.success('Review link copied to clipboard!');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = window.location.href;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        Toast.success('Review link copied to clipboard!');
      }
    });
  }

  // ── Delete Confirmation Flow ──
  const deleteModal = document.getElementById('delete-modal');
  const deleteMovieTitle = document.getElementById('delete-movie-title');
  if (deleteMovieTitle) {
    deleteMovieTitle.textContent = `"${movie.title}" will be permanently removed.`;
  }

  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn && deleteModal) {
    deleteBtn.addEventListener('click', () => {
      deleteModal.classList.add('active');
    });
  }

  const cancelDelete = document.getElementById('cancel-delete');
  if (cancelDelete && deleteModal) {
    cancelDelete.addEventListener('click', () => {
      deleteModal.classList.remove('active');
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) deleteModal.classList.remove('active');
    });
  }

  const confirmDelete = document.getElementById('confirm-delete');
  if (confirmDelete) {
    confirmDelete.addEventListener('click', async () => {
      confirmDelete.disabled = true;
      confirmDelete.textContent = 'Deleting...';
      try {
        await MovieService.remove(movie.id);
        Toast.success('Review deleted successfully.');
        setTimeout(() => {
          window.location.href = 'library.html';
        }, 400);
      } catch (err) {
        Toast.error('Failed to delete review: ' + (err.message || err));
        confirmDelete.disabled = false;
        confirmDelete.textContent = 'Delete permanently';
      }
    });
  }
});
