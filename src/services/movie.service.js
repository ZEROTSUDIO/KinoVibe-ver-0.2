// KinoVibe Movie Repository & Data Service
import { supabase, AuthService } from './auth.service.js';
import { calcScores } from '../utils/scoring.js';
import { Toast } from '../utils/ui.js';

export class MovieService {
  static _getLocalKey(userId) {
    return `kinovibe_movies_${userId || 'guest'}`;
  }

  static _loadLocal(userId) {
    try {
      return JSON.parse(localStorage.getItem(this._getLocalKey(userId))) || [];
    } catch {
      return [];
    }
  }

  static _saveLocal(userId, movies) {
    try {
      localStorage.setItem(this._getLocalKey(userId), JSON.stringify(movies));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  static _mapFromDB(row) {
    if (!row) return null;
    
    // Ensure scores and biases are calculated
    const s = Number(row.story_score);
    const v = Number(row.visual_score);
    const a = Number(row.action_score);
    const f = Number(row.fun_score);
    const biases = Array.isArray(row.biases) ? row.biases : [];
    
    // Fallback to client calculation if trigger hasn't populated base/final yet
    const clientCalc = calcScores(s, v, a, f, biases);
    const baseScore = (row.base_score !== null && row.base_score !== undefined) ? Number(row.base_score) : clientCalc.base;
    const finalScore = (row.final_score !== null && row.final_score !== undefined) ? Number(row.final_score) : clientCalc.final;

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title || '',
      year: row.year || null,
      posterUrl: row.poster_url || '',
      backdropUrl: row.backdrop_url || '',
      overview: row.overview || '',
      genres: Array.isArray(row.genres) ? row.genres : [],
      runtime: row.runtime || null,
      tmdbId: row.tmdb_id || null,
      reviewText: row.review_text || '',
      storyScore: s,
      visualScore: v,
      actionScore: a,
      funScore: f,
      biases,
      tags: Array.isArray(row.tags) ? row.tags : [],
      baseScore,
      finalScore,
      isPublic: row.is_public !== false,
      status: row.status || 'completed',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Fetch all movies for the current user (with local cache fallback)
   */
  static async getAll({ sortBy = 'newest' } = {}) {
    const user = await AuthService.getUser();
    const userId = user ? user.id : 'guest';

    if (user) {
      try {
        let query = supabase
          .from('movies')
          .select('*')
          .eq('user_id', user.id);

        if (sortBy === 'highest') {
          query = query.order('final_score', { ascending: false });
        } else if (sortBy === 'lowest') {
          query = query.order('final_score', { ascending: true });
        } else if (sortBy === 'title') {
          query = query.order('title', { ascending: true });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
          console.error('Supabase getAll error:', error.message);
          Toast.warning('Could not sync with Supabase cloud. Loaded offline cache.');
          return this._loadLocal(userId);
        }

        if (data) {
          const mapped = data.map(r => this._mapFromDB(r));
          this._saveLocal(userId, mapped);
          return mapped;
        }
      } catch (err) {
        console.error('Supabase getAll exception:', err);
        Toast.warning('Offline mode: displaying locally cached reviews.');
      }
    }

    return this._loadLocal(userId);
  }

  /**
   * Fetch single movie by ID
   */
  static async getById(id) {
    if (!id) return null;
    const user = await AuthService.getUser();
    const userId = user ? user.id : 'guest';

    if (user) {
      try {
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Supabase getById error:', error.message);
        } else if (data) {
          return this._mapFromDB(data);
        }
      } catch (err) {
        console.error('Supabase getById exception:', err);
      }
    }

    return this._loadLocal(userId).find(m => String(m.id) === String(id)) || null;
  }

  /**
   * Save movie (Insert or Update)
   */
  static async save(data) {
    const user = await AuthService.getUser();
    const userId = user ? user.id : 'guest';

    // Calculate local scores for immediate cache availability
    const calc = calcScores(data.storyScore, data.visualScore, data.actionScore, data.funScore, data.biases);

    const payload = {
      title: data.title.trim(),
      year: data.year || null,
      poster_url: data.posterUrl || '',
      backdrop_url: data.backdropUrl || '',
      overview: data.overview || '',
      genres: data.genres || [],
      runtime: data.runtime || null,
      tmdb_id: data.tmdbId || null,
      review_text: data.reviewText || '',
      story_score: Number(data.storyScore),
      visual_score: Number(data.visualScore),
      action_score: Number(data.actionScore),
      fun_score: Number(data.funScore),
      biases: data.biases || [],
      tags: (data.tags || []).map(t => t.trim().toLowerCase()),
      base_score: calc.base,
      final_score: calc.final,
      is_public: data.isPublic !== false,
      status: data.status || 'completed',
      user_id: user ? user.id : undefined,
      updated_at: new Date().toISOString()
    };

    if (user) {
      try {
        if (data.id) {
          const { data: updated, error } = await supabase
            .from('movies')
            .update(payload)
            .eq('id', data.id)
            .select()
            .single();

          if (error) throw error;
          if (updated) {
            const result = this._mapFromDB(updated);
            this._updateLocalItem(userId, result);
            return result;
          }
        } else {
          const { data: inserted, error } = await supabase
            .from('movies')
            .insert([payload])
            .select()
            .single();

          if (error) throw error;
          if (inserted) {
            const result = this._mapFromDB(inserted);
            this._updateLocalItem(userId, result);
            return result;
          }
        }
      } catch (err) {
        console.error('Supabase save error:', err);
        Toast.warning('Could not save to cloud. Saved to local storage.');
      }
    }

    // Local fallback
    const localMovie = {
      id: data.id || ('local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
      ...data,
      baseScore: calc.base,
      finalScore: calc.final,
      updatedAt: new Date().toISOString(),
      createdAt: data.createdAt || new Date().toISOString()
    };
    this._updateLocalItem(userId, localMovie);
    return localMovie;
  }

  static _updateLocalItem(userId, movie) {
    const list = this._loadLocal(userId);
    const idx = list.findIndex(m => String(m.id) === String(movie.id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...movie };
    } else {
      list.unshift(movie);
    }
    this._saveLocal(userId, list);
  }

  /**
   * Delete movie by ID
   */
  static async remove(id) {
    if (!id) return;
    const user = await AuthService.getUser();
    const userId = user ? user.id : 'guest';

    if (user) {
      try {
        const { error } = await supabase
          .from('movies')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase remove error:', err);
        Toast.warning('Cloud deletion failed; removed from local cache.');
      }
    }

    const filtered = this._loadLocal(userId).filter(m => String(m.id) !== String(id));
    this._saveLocal(userId, filtered);
  }

  /**
   * Aggregate all unique tags across movies
   */
  static getAllTags(movies) {
    const set = new Set();
    (movies || []).forEach(m => {
      (Array.isArray(m.tags) ? m.tags : []).forEach(t => {
        if (t && t.trim()) set.add(t.trim().toLowerCase());
      });
    });
    return Array.from(set).sort();
  }

  /**
   * Fetch movies for a specific user (public or all if owner)
   */
  static async getByUserId(userId, { publicOnly = true, sortBy = 'highest' } = {}) {
    if (!userId) return [];
    const currentUser = await AuthService.getUser();
    const isOwner = currentUser && currentUser.id === userId;

    try {
      let query = supabase
        .from('movies')
        .select('*')
        .eq('user_id', userId);

      if (publicOnly && !isOwner) {
        query = query.eq('is_public', true);
      }

      if (sortBy === 'highest') {
        query = query.order('final_score', { ascending: false });
      } else if (sortBy === 'lowest') {
        query = query.order('final_score', { ascending: true });
      } else if (sortBy === 'title') {
        query = query.order('title', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.warn('getByUserId error:', error.message);
        if (isOwner) return this._loadLocal(userId);
        return [];
      }

      if (data) {
        return data.map(r => this._mapFromDB(r));
      }
    } catch (err) {
      console.warn('getByUserId exception:', err);
      if (isOwner) return this._loadLocal(userId);
    }
    return [];
  }

  /**
   * Calculate stats for a given user
   */
  static async getUserStats(userId) {
    const movies = await this.getByUserId(userId, { publicOnly: false });
    const totalReviews = movies.length;

    let avgScore = 0;
    let sTierCount = 0;
    const genreCounts = {};
    const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

    if (totalReviews > 0) {
      const sum = movies.reduce((acc, m) => acc + (Number(m.finalScore) || 0), 0);
      avgScore = Math.round((sum / totalReviews) * 10) / 10;

      movies.forEach(m => {
        const s = Number(m.finalScore) || 0;
        if (s >= 9.0) { tierCounts.S++; sTierCount++; }
        else if (s >= 8.0) tierCounts.A++;
        else if (s >= 7.0) tierCounts.B++;
        else if (s >= 6.0) tierCounts.C++;
        else if (s >= 5.0) tierCounts.D++;
        else if (s >= 4.0) tierCounts.E++;
        else tierCounts.F++;

        (m.genres || []).forEach(g => {
          if (typeof g === 'string') {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          }
        });
      });
    }

    let topGenre = '—';
    let maxGenreCount = 0;
    Object.entries(genreCounts).forEach(([genre, count]) => {
      if (count > maxGenreCount) {
        maxGenreCount = count;
        topGenre = genre;
      }
    });

    return {
      totalReviews,
      avgScore,
      sTierCount,
      topGenre,
      tierCounts
    };
  }
}
