// KinoVibe Modular Application Bridge & Shared Utilities
import { AuthService, supabase } from './services/auth.service.js';
import { MovieService } from './services/movie.service.js';
import { ProfileService } from './services/profile.service.js';
import { calcScores, getScoreLevel, formatScore, TIERS } from './utils/scoring.js';
import { escapeHtml, Toast, showConfirmModal, Skeleton } from './utils/ui.js';
import { SOCIAL_PLATFORMS, normalizeSocialUrl, copyProfileShareLink } from './utils/socials.js';

// Expose on window for backwards-compatibility
if (typeof window !== 'undefined') {
  window._db = supabase;
  window.Auth = AuthService;
  window.MovieStore = MovieService;
  window.ProfileService = ProfileService;
  window.calcScores = calcScores;
  window.getScoreLevel = getScoreLevel;
  window.formatScore = formatScore;
  window.escapeHtml = escapeHtml;
  window.Toast = Toast;
  window.showConfirmModal = showConfirmModal;
  window.Skeleton = Skeleton;
  window.TIERS = TIERS;
  window.SOCIAL_PLATFORMS = SOCIAL_PLATFORMS;
  window.copyProfileShareLink = copyProfileShareLink;
}

export {
  supabase,
  AuthService,
  AuthService as Auth,
  MovieService,
  MovieService as MovieStore,
  ProfileService,
  calcScores,
  getScoreLevel,
  formatScore,
  escapeHtml,
  Toast,
  showConfirmModal,
  Skeleton,
  TIERS,
  SOCIAL_PLATFORMS,
  normalizeSocialUrl,
  copyProfileShareLink
};
