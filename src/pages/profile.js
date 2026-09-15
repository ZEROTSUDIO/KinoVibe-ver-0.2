// KinoVibe User Profile Page Controller
import { AuthService } from '../services/auth.service.js';
import { ProfileService } from '../services/profile.service.js';
import { MovieService } from '../services/movie.service.js';
import { calcScores, getScoreLevel, formatScore } from '../utils/scoring.js';
import { escapeHtml, Toast } from '../utils/ui.js';
import { renderSocialBadge, copyProfileShareLink } from '../utils/socials.js';

document.addEventListener('DOMContentLoaded', async () => {
  await AuthService.initNav();

  const loadingEl = document.getElementById('profile-loading');
  const notFoundEl = document.getElementById('profile-not-found');
  const contentEl = document.getElementById('profile-content');

  const avatarEl = document.getElementById('profile-avatar');
  const nameEl = document.getElementById('profile-display-name');
  const usernameEl = document.getElementById('profile-username');
  const adminBadgeEl = document.getElementById('profile-admin-badge');
  const joinedDateEl = document.getElementById('profile-joined-date');
  const bioEl = document.getElementById('profile-bio');

  const tasteRowEl = document.getElementById('profile-taste-row');
  const chipFavMovieEl = document.getElementById('chip-fav-movie');
  const valFavMovieEl = document.getElementById('profile-fav-movie');
  const chipFavGenreEl = document.getElementById('chip-fav-genre');
  const valFavGenreEl = document.getElementById('profile-fav-genre');

  const socialsRowEl = document.getElementById('profile-socials-row');
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const btnShareProfile = document.getElementById('btn-share-profile');

  // Stats elements
  const statTotalReviews = document.getElementById('stat-total-reviews');
  const statAvgScore = document.getElementById('stat-avg-score');
  const statSTierCount = document.getElementById('stat-s-tier-count');
  const statTopGenre = document.getElementById('stat-top-genre');

  // Reviews grid elements
  const moviesGrid = document.getElementById('profile-movies-grid');
  const emptyReviewsEl = document.getElementById('profile-empty-reviews');
  const reviewsCountBadge = document.getElementById('reviews-count-badge');
  const tabTopReviews = document.getElementById('tab-reviews-top');
  const tabAllReviews = document.getElementById('tab-reviews-all');

  // Edit Modal Elements
  const modalEdit = document.getElementById('modal-edit-profile');
  const formEdit = document.getElementById('form-edit-profile');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnSaveProfile = document.getElementById('btn-save-profile');

  const inputDisplayName = document.getElementById('edit-display-name');
  const inputUsername = document.getElementById('edit-username');
  const inputBio = document.getElementById('edit-bio');
  const bioCountEl = document.getElementById('edit-bio-count');
  const inputAvatarUrl = document.getElementById('edit-avatar-url');
  const avatarPreviewEl = document.getElementById('edit-avatar-preview');
  const inputFavMovie = document.getElementById('edit-fav-movie');
  const inputFavGenre = document.getElementById('edit-fav-genre');
  const inputSocialLetterboxd = document.getElementById('edit-social-letterboxd');
  const inputSocialTwitter = document.getElementById('edit-social-twitter');
  const inputSocialInstagram = document.getElementById('edit-social-instagram');
  const inputSocialYoutube = document.getElementById('edit-social-youtube');
  const inputSocialWebsite = document.getElementById('edit-social-website');

  let activeProfile = null;
  let currentUser = null;
  let isOwner = false;
  let userMovies = [];
  let currentReviewTab = 'top'; // 'top' | 'all'

  // 1. Resolve Target User Profile
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('id');
  const paramUsername = urlParams.get('u');

  try {
    currentUser = await AuthService.getUser();

    if (paramUsername) {
      activeProfile = await ProfileService.getProfileByUsername(paramUsername);
    } else if (paramId) {
      activeProfile = await ProfileService.getProfileById(paramId);
    } else if (currentUser) {
      activeProfile = await ProfileService.getProfileById(currentUser.id, true);
    } else {
      // Not logged in and no profile specified
      window.location.href = 'login.html';
      return;
    }

    if (!activeProfile) {
      loadingEl.classList.add('hidden');
      notFoundEl.classList.remove('hidden');
      return;
    }

    isOwner = Boolean(currentUser && currentUser.id === activeProfile.id);
    document.title = `${activeProfile.displayName} (@${activeProfile.username}) — KinoVibe Profile`;

    renderProfileHeader();
    await loadReviewsAndStats();

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to initialize profile page:', err);
    loadingEl.classList.add('hidden');
    notFoundEl.classList.remove('hidden');
  }

  // ─── Render Profile Header ───────────────────────────
  function renderProfileHeader() {
    nameEl.textContent = activeProfile.displayName || 'Cinephile';
    usernameEl.textContent = `@${activeProfile.username || 'user'}`;

    // Admin role
    if (activeProfile.isAdmin) {
      adminBadgeEl.classList.remove('hidden');
    } else {
      adminBadgeEl.classList.add('hidden');
    }

    // Joined date
    if (activeProfile.createdAt) {
      const date = new Date(activeProfile.createdAt);
      joinedDateEl.textContent = `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
    }

    // Avatar
    renderAvatar(activeProfile.avatarUrl, activeProfile.displayName);

    // Bio
    if (activeProfile.bio && activeProfile.bio.trim()) {
      bioEl.textContent = activeProfile.bio.trim();
      bioEl.classList.remove('hidden');
    } else if (isOwner) {
      bioEl.textContent = 'Add your cinephile bio and favorite movie quotes in Edit Profile.';
      bioEl.classList.remove('hidden');
      bioEl.style.color = 'var(--text-muted)';
      bioEl.style.fontStyle = 'italic';
    } else {
      bioEl.classList.add('hidden');
    }

    // Cinephile Taste Pills
    let hasTaste = false;
    if (activeProfile.favoriteMovie) {
      valFavMovieEl.textContent = activeProfile.favoriteMovie;
      chipFavMovieEl.classList.remove('hidden');
      hasTaste = true;
    } else {
      chipFavMovieEl.classList.add('hidden');
    }

    if (activeProfile.favoriteGenre) {
      valFavGenreEl.textContent = activeProfile.favoriteGenre;
      chipFavGenreEl.classList.remove('hidden');
      hasTaste = true;
    } else {
      chipFavGenreEl.classList.add('hidden');
    }

    tasteRowEl.classList.toggle('hidden', !hasTaste);

    // Social Badges Row
    renderSocials();

    // Owner action buttons
    if (isOwner) {
      btnEditProfile.classList.remove('hidden');
    } else {
      btnEditProfile.classList.add('hidden');
    }
  }

  function renderAvatar(avatarVal, displayName) {
    avatarEl.innerHTML = '';
    const initial = (displayName || 'U')[0].toUpperCase();

    if (avatarVal) {
      if (avatarVal.startsWith('http://') || avatarVal.startsWith('https://') || avatarVal.startsWith('/')) {
        const img = document.createElement('img');
        img.src = avatarVal;
        img.alt = displayName || 'User Avatar';
        img.className = 'profile-avatar-img';
        img.onerror = () => {
          avatarEl.innerHTML = `<span class="profile-avatar-char">${escapeHtml(initial)}</span>`;
        };
        avatarEl.appendChild(img);
        return;
      }
      // Emoji or short string
      avatarEl.innerHTML = `<span class="profile-avatar-emoji">${escapeHtml(avatarVal)}</span>`;
      return;
    }

    avatarEl.innerHTML = `<span class="profile-avatar-char">${escapeHtml(initial)}</span>`;
  }

  function renderSocials() {
    socialsRowEl.innerHTML = '';
    const platforms = ['letterboxd', 'twitter', 'instagram', 'youtube', 'website'];
    let count = 0;

    platforms.forEach(p => {
      const val = activeProfile[p];
      if (val && val.trim()) {
        const badgeHtml = renderSocialBadge(p, val);
        if (badgeHtml) {
          socialsRowEl.insertAdjacentHTML('beforeend', badgeHtml);
          count++;
        }
      }
    });

    if (count === 0 && isOwner) {
      socialsRowEl.innerHTML = `
        <button type="button" class="btn-ghost-sm" id="btn-add-socials-prompt">
          <span>🔗</span> Connect your Letterboxd, X & Socials →
        </button>
      `;
      document.getElementById('btn-add-socials-prompt')?.addEventListener('click', openEditModal);
    }
  }

  // ─── Reviews & Stats ─────────────────────────────────
  async function loadReviewsAndStats() {
    try {
      const [stats, movies] = await Promise.all([
        MovieService.getUserStats(activeProfile.id),
        MovieService.getByUserId(activeProfile.id, { publicOnly: !isOwner, sortBy: 'highest' })
      ]);

      // Populate stats
      statTotalReviews.textContent = stats.totalReviews || 0;
      statAvgScore.textContent = stats.totalReviews > 0 ? formatScore(stats.avgScore) : '—';
      statSTierCount.textContent = stats.sTierCount || 0;
      statTopGenre.textContent = stats.topGenre || '—';

      userMovies = movies || [];
      reviewsCountBadge.textContent = `${userMovies.length} review${userMovies.length !== 1 ? 's' : ''}`;

      renderMoviesGrid();
    } catch (err) {
      console.warn('Error loading user reviews and stats:', err);
    }
  }

  function renderMoviesGrid() {
    moviesGrid.innerHTML = '';

    let displayed = userMovies;
    if (currentReviewTab === 'top') {
      displayed = userMovies.filter(m => (m.finalScore || 0) >= 8.0);
    }

    if (displayed.length === 0) {
      emptyReviewsEl.classList.remove('hidden');
      moviesGrid.classList.add('hidden');
      return;
    }

    emptyReviewsEl.classList.add('hidden');
    moviesGrid.classList.remove('hidden');

    displayed.forEach((movie, i) => {
      const scores = calcScores(movie.storyScore, movie.visualScore, movie.actionScore, movie.funScore, movie.biases || []);
      const level = getScoreLevel(scores.final);
      const glowRing = level === 'high' 
        ? 'shadow-glow-high ring-1 ring-emerald-500/40' 
        : (level === 'mid' ? 'shadow-glow-mid ring-1 ring-amber-500/40' : 'shadow-glow-low ring-1 ring-rose-500/40');

      const posterContent = movie.posterUrl
        ? `<img src="${escapeHtml(movie.posterUrl)}" alt="${escapeHtml(movie.title)}" loading="lazy" class="w-full h-full object-cover transition duration-300 group-hover:scale-105" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="poster-fallback" style="display:none">${escapeHtml((movie.title || '?')[0])}</div>`
        : `<div class="poster-fallback">${escapeHtml((movie.title || '?')[0])}</div>`;

      const privacyBadge = isOwner && !movie.isPublic 
        ? `<span class="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">Private</span>` 
        : '';

      const card = document.createElement('div');
      card.className = 'w-full flex flex-col group';
      card.innerHTML = `
        <a href="view.html?id=${movie.id}" class="movie-card fade-in block h-full transition duration-300 hover:-translate-y-1.5 hover:shadow-glow-accent hover:border-kino-border-accent" style="--delay:${i * 0.03}s">
          <div class="movie-poster relative overflow-hidden">${posterContent}</div>
          <div class="ticket-cut movie-info">
            <div class="min-w-0 pr-1">
              <div class="movie-title truncate" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</div>
              <div class="flex items-center gap-1.5 movie-year">
                <span>${escapeHtml(movie.year) || '—'}</span>
                ${privacyBadge}
              </div>
            </div>
            <div class="score-badge ${level} ${glowRing} flex-shrink-0">${formatScore(scores.final)}</div>
          </div>
        </a>
      `;
      moviesGrid.appendChild(card);
    });
  }

  // ─── Tabs Switching ──────────────────────────────────
  tabTopReviews?.addEventListener('click', () => {
    currentReviewTab = 'top';
    tabTopReviews.className = 'px-3 py-1 rounded-full font-medium transition active text-white bg-kino-accent';
    tabAllReviews.className = 'px-3 py-1 rounded-full font-medium transition text-kino-secondary hover:text-white';
    renderMoviesGrid();
  });

  tabAllReviews?.addEventListener('click', () => {
    currentReviewTab = 'all';
    tabAllReviews.className = 'px-3 py-1 rounded-full font-medium transition active text-white bg-kino-accent';
    tabTopReviews.className = 'px-3 py-1 rounded-full font-medium transition text-kino-secondary hover:text-white';
    renderMoviesGrid();
  });

  // ─── Share Profile ───────────────────────────────────
  btnShareProfile?.addEventListener('click', () => {
    copyProfileShareLink(activeProfile.username || activeProfile.id);
  });

  // ─── Edit Profile Modal ──────────────────────────────
  btnEditProfile?.addEventListener('click', openEditModal);
  btnCloseModal?.addEventListener('click', closeEditModal);
  btnCancelEdit?.addEventListener('click', closeEditModal);

  modalEdit?.addEventListener('click', (e) => {
    if (e.target === modalEdit) closeEditModal();
  });

  function openEditModal() {
    if (!isOwner) return;

    inputDisplayName.value = activeProfile.displayName || '';
    inputUsername.value = activeProfile.username || '';
    inputBio.value = activeProfile.bio || '';
    updateBioCount();

    inputAvatarUrl.value = activeProfile.avatarUrl || '';
    updateAvatarPreview(activeProfile.avatarUrl);

    inputFavMovie.value = activeProfile.favoriteMovie || '';
    inputFavGenre.value = activeProfile.favoriteGenre || '';

    inputSocialLetterboxd.value = activeProfile.letterboxd || '';
    inputSocialTwitter.value = activeProfile.twitter || '';
    inputSocialInstagram.value = activeProfile.instagram || '';
    inputSocialYoutube.value = activeProfile.youtube || '';
    inputSocialWebsite.value = activeProfile.website || '';

    modalEdit.classList.add('active');
  }

  function closeEditModal() {
    modalEdit.classList.remove('active');
  }

  function updateBioCount() {
    const len = inputBio.value.length;
    bioCountEl.textContent = `${len} / 280`;
    bioCountEl.style.color = len > 260 ? 'var(--score-mid)' : 'var(--text-muted)';
  }

  inputBio?.addEventListener('input', updateBioCount);

  function updateAvatarPreview(val) {
    avatarPreviewEl.innerHTML = '';
    const v = (val || '').trim();
    if (!v) {
      avatarPreviewEl.textContent = '🍿';
      return;
    }
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) {
      const img = document.createElement('img');
      img.src = v;
      img.className = 'w-full h-full object-cover';
      img.onerror = () => { avatarPreviewEl.textContent = '?'; };
      avatarPreviewEl.appendChild(img);
      return;
    }
    avatarPreviewEl.textContent = v;
  }

  inputAvatarUrl?.addEventListener('input', (e) => {
    updateAvatarPreview(e.target.value);
  });

  // Preset Emoji buttons
  document.querySelectorAll('.avatar-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      inputAvatarUrl.value = emoji;
      updateAvatarPreview(emoji);
    });
  });

  // Save Profile Form Submit
  formEdit?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isOwner) return;

    const originalText = btnSaveProfile.textContent;
    btnSaveProfile.disabled = true;
    btnSaveProfile.textContent = 'Saving...';

    const updates = {
      displayName: inputDisplayName.value.trim(),
      username: inputUsername.value.trim().replace(/^@+/, ''),
      bio: inputBio.value.trim(),
      avatarUrl: inputAvatarUrl.value.trim(),
      favoriteMovie: inputFavMovie.value.trim(),
      favoriteGenre: inputFavGenre.value.trim(),
      letterboxd: inputSocialLetterboxd.value.trim(),
      twitter: inputSocialTwitter.value.trim(),
      instagram: inputSocialInstagram.value.trim(),
      youtube: inputSocialYoutube.value.trim(),
      website: inputSocialWebsite.value.trim()
    };

    try {
      const updated = await ProfileService.updateProfile(currentUser.id, updates);
      activeProfile = updated;
      renderProfileHeader();
      await AuthService.initNav();
      closeEditModal();
      Toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Save profile error:', err);
      Toast.error(err.message || 'Failed to save profile.');
    } finally {
      btnSaveProfile.disabled = false;
      btnSaveProfile.textContent = originalText;
    }
  });
});
