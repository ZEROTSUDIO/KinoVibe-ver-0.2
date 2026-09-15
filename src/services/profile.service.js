// KinoVibe Profile & Socials Service
import { supabase, AuthService } from './auth.service.js';
import { Toast } from '../utils/ui.js';

const _profileCache = new Map();

export const ProfileService = {
  /**
   * Helper to map and sanitize raw DB profile row
   */
  _mapProfile(row, fallbackEmail = '') {
    if (!row) return null;
    const email = row.email || fallbackEmail;
    const defaultName = email ? email.split('@')[0] : 'Cinephile';

    return {
      id: row.id,
      email: email,
      username: row.username || (email ? email.split('@')[0] : 'user'),
      displayName: row.display_name || defaultName,
      avatarUrl: row.avatar_url || '',
      bio: row.bio || '',
      letterboxd: row.letterboxd || '',
      twitter: row.twitter || '',
      instagram: row.instagram || '',
      youtube: row.youtube || '',
      website: row.website || '',
      favoriteMovie: row.favorite_movie || '',
      favoriteGenre: row.favorite_genre || '',
      socials: typeof row.socials === 'object' && row.socials !== null ? row.socials : {},
      isAdmin: Boolean(row.is_admin),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  },

  /**
   * Fetch profile by user ID
   */
  async getProfileById(userId, forceRefresh = false) {
    if (!userId) return null;
    if (!forceRefresh && _profileCache.has(userId)) {
      return _profileCache.get(userId);
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('ProfileService getProfileById error:', error.message);
      } else if (data) {
        const profile = this._mapProfile(data);
        _profileCache.set(userId, profile);
        return profile;
      }
    } catch (err) {
      console.warn('ProfileService getProfileById exception:', err);
    }

    // Offline / fallback profile
    const currentUser = await AuthService.getUser();
    if (currentUser && currentUser.id === userId) {
      const fallback = {
        id: userId,
        email: currentUser.email,
        username: currentUser.email?.split('@')[0] || 'user',
        displayName: currentUser.email?.split('@')[0] || 'Cinephile',
        avatarUrl: '',
        bio: '',
        letterboxd: '',
        twitter: '',
        instagram: '',
        youtube: '',
        website: '',
        favoriteMovie: '',
        favoriteGenre: '',
        socials: {},
        isAdmin: false
      };
      _profileCache.set(userId, fallback);
      return fallback;
    }

    return null;
  },

  /**
   * Fetch profile by @username handle
   */
  async getProfileByUsername(username) {
    if (!username) return null;
    const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (error) {
        console.warn('ProfileService getProfileByUsername error:', error.message);
      } else if (data) {
        const profile = this._mapProfile(data);
        _profileCache.set(profile.id, profile);
        return profile;
      }
    } catch (err) {
      console.warn('ProfileService getProfileByUsername exception:', err);
    }

    return null;
  },

  /**
   * Get authenticated user's profile
   */
  async getCurrentProfile(forceRefresh = false) {
    const user = await AuthService.getUser();
    if (!user) return null;
    return this.getProfileById(user.id, forceRefresh);
  },

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username, currentUserId = '') {
    if (!username) return false;
    const clean = username.trim().replace(/^@+/, '').toLowerCase();

    // Regex check: 3 to 24 chars, letters, numbers, underscores
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) {
      return false;
    }

    try {
      let query = supabase
        .from('profiles')
        .select('id')
        .ilike('username', clean);

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('isUsernameAvailable error:', error.message);
        return true;
      }
      return (!data || data.length === 0);
    } catch (err) {
      console.warn('isUsernameAvailable exception:', err);
      return true;
    }
  },

  /**
   * Update profile information
   */
  async updateProfile(userId, profileData) {
    if (!userId) throw new Error('User ID is required to update profile.');

    const cleanUsername = (profileData.username || '').trim().replace(/^@+/, '').toLowerCase();
    if (cleanUsername) {
      const available = await this.isUsernameAvailable(cleanUsername, userId);
      if (!available) {
        throw new Error(`Username "@${cleanUsername}" is already taken or invalid.`);
      }
    }

    const payload = {
      display_name: (profileData.displayName || '').trim(),
      username: cleanUsername || undefined,
      avatar_url: (profileData.avatarUrl || '').trim(),
      bio: (profileData.bio || '').trim().slice(0, 280),
      letterboxd: (profileData.letterboxd || '').trim(),
      twitter: (profileData.twitter || '').trim(),
      instagram: (profileData.instagram || '').trim(),
      youtube: (profileData.youtube || '').trim(),
      website: (profileData.website || '').trim(),
      favorite_movie: (profileData.favoriteMovie || '').trim(),
      favorite_genre: (profileData.favoriteGenre || '').trim(),
      socials: typeof profileData.socials === 'object' && profileData.socials !== null ? profileData.socials : {},
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      const updated = this._mapProfile(data);
      _profileCache.set(userId, updated);
      return updated;
    } catch (err) {
      console.error('ProfileService updateProfile error:', err);
      // If error occurred because new columns do not exist in DB yet, try fallback with only core columns
      if (err.message && (err.message.includes('column') || err.message.includes('schema'))) {
        try {
          const corePayload = {
            display_name: payload.display_name,
            avatar_url: payload.avatar_url,
            updated_at: payload.updated_at
          };
          const { data: coreData, error: coreErr } = await supabase
            .from('profiles')
            .update(corePayload)
            .eq('id', userId)
            .select()
            .single();

          if (coreErr) throw coreErr;
          const merged = { ...this._mapProfile(coreData), ...payload };
          _profileCache.set(userId, merged);
          Toast.warning('Profile updated (Note: Run migration 002 in Supabase SQL Editor to save all social fields to cloud).');
          return merged;
        } catch (subErr) {
          throw err;
        }
      }
      throw err;
    }
  }
};
