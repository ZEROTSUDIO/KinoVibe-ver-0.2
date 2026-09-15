// KinoVibe Auth & User Profile Service
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config.js';
import { escapeHtml, Toast } from '../utils/ui.js';

// Initialize Supabase Client
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

let _cachedProfile = null;
let _cachedUser = null;

export const AuthService = {
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (err) {
      console.warn('getSession error:', err.message);
      return null;
    }
  },

  async getUser() {
    if (_cachedUser) return _cachedUser;
    const session = await this.getSession();
    _cachedUser = session ? session.user : null;
    return _cachedUser;
  },

  async getProfile(forceRefresh = false) {
    if (_cachedProfile && !forceRefresh) return _cachedProfile;
    const user = await this.getUser();
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch error:', error.message);
      } else if (data) {
        _cachedProfile = data;
        return data;
      }
    } catch (err) {
      console.warn('Profile fetch exception:', err);
    }

    // Fallback profile if profiles table not yet populated
    _cachedProfile = {
      id: user.id,
      email: user.email,
      display_name: user.email?.split('@')[0] || 'User',
      is_admin: false
    };
    return _cachedProfile;
  },

  async isAdmin() {
    const profile = await this.getProfile();
    return Boolean(profile && profile.is_admin === true);
  },

  async signUp(email, password, displayName = '') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0]
        }
      }
    });
    if (error) throw error;
    _cachedUser = null;
    _cachedProfile = null;
    return { data, error: null };
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    _cachedUser = data.user;
    _cachedProfile = null;
    return { data, error: null };
  },

  async signOut() {
    try {
      const user = await this.getUser();
      if (user) {
        // Clear scoped user cache from localStorage
        try {
          localStorage.removeItem(`kinovibe_movies_${user.id}`);
        } catch {}
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      _cachedUser = null;
      _cachedProfile = null;
      window.location.href = 'index.html';
    }
  },

  /**
   * Route Guard: Requires authentication, redirects to login.html if not signed in
   */
  async requireAuth() {
    const user = await this.getUser();
    if (!user) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login.html?return=${returnUrl}`;
      return null;
    }
    return user;
  },

  /**
   * Route Guard: Requires admin role, redirects to library.html if not admin
   */
  async requireAdmin() {
    const user = await this.requireAuth();
    if (!user) return false;

    const isAdminUser = await this.isAdmin();
    if (!isAdminUser) {
      Toast.error('Access denied: Administrator privileges required.');
      setTimeout(() => {
        window.location.href = 'library.html';
      }, 1200);
      return false;
    }
    return true;
  },

  /**
   * Universal Navbar Initializer
   */
  async initNav() {
    const user = await this.getUser();
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Clean up existing dynamic user elements
    document.querySelectorAll('.nav-user, .nav-login-link, .nav-admin-link, .nav-profile-link').forEach(el => el.remove());

    if (user) {
      const profile = await this.getProfile();
      const isAdminUser = profile && profile.is_admin === true;

      // Profile navigation link
      const profileLink = document.createElement('a');
      profileLink.href = 'profile.html';
      profileLink.className = `nav-link nav-profile-link ${window.location.pathname.includes('profile.html') ? 'active' : ''}`;
      profileLink.innerHTML = '👤 Profile';
      navLinks.appendChild(profileLink);

      // If admin, inject Admin link before the user badge
      if (isAdminUser) {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = `nav-link nav-admin-link ${window.location.pathname.includes('admin.html') ? 'active' : ''}`;
        adminLink.innerHTML = '🛡️ Admin';
        navLinks.appendChild(adminLink);
      }

      const avatarContent = profile?.avatar_url
        ? (profile.avatar_url.startsWith('http') || profile.avatar_url.startsWith('/')
            ? `<img src="${escapeHtml(profile.avatar_url)}" class="nav-avatar-img" alt="${escapeHtml(profile?.display_name || 'User')}">`
            : `<span class="nav-avatar-emoji">${escapeHtml(profile.avatar_url)}</span>`)
        : `<span class="nav-avatar-fallback">${escapeHtml((profile?.display_name || user.email || 'U')[0].toUpperCase())}</span>`;

      const userDiv = document.createElement('div');
      userDiv.className = 'nav-user';
      userDiv.innerHTML = `
        <a href="profile.html" class="nav-user-badge group" title="View your profile (${escapeHtml(user.email)})">
          <span class="nav-avatar-wrap">${avatarContent}</span>
          <span class="nav-user-name truncate">
            ${isAdminUser ? '<span class="admin-badge">ADMIN</span> ' : ''}${escapeHtml(profile?.display_name || user.email.split('@')[0])}
          </span>
        </a>
        <button class="nav-signout-btn" id="nav-signout-btn">Sign Out</button>
      `;
      navLinks.appendChild(userDiv);

      document.getElementById('nav-signout-btn')?.addEventListener('click', () => {
        AuthService.signOut();
      });
    } else {
      const loginLink = document.createElement('a');
      loginLink.href = 'login.html';
      loginLink.className = 'nav-link nav-login-link';
      loginLink.textContent = 'Sign In / Register';
      navLinks.appendChild(loginLink);
    }
  }
};
