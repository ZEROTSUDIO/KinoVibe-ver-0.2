// KinoVibe Letterboxd & CSV Import/Export Service
import { CSVUtil } from '../utils/csv.js';
import { TMDBService } from './tmdb.service.js';

export class ImportService {
  /**
   * Detect and parse Letterboxd CSV files (ratings.csv, reviews.csv, watched.csv)
   * @param {string} csvText 
   * @returns {{ format: string, movies: Array<Object>, errors: Array<string> }}
   */
  static parseLetterboxdCSV(csvText) {
    const rawRows = CSVUtil.parse(csvText);
    if (!rawRows || rawRows.length === 0) {
      return { format: 'unknown', movies: [], errors: ['No valid rows found in CSV file.'] };
    }

    const first = rawRows[0];
    let format = 'custom';
    if ('Letterboxd URI' in first && 'Rating' in first && 'Review' in first) {
      format = 'letterboxd-reviews';
    } else if ('Letterboxd URI' in first && 'Rating' in first) {
      format = 'letterboxd-ratings';
    } else if ('Letterboxd URI' in first) {
      format = 'letterboxd-watched';
    }

    const movies = [];
    const errors = [];

    rawRows.forEach((row, idx) => {
      const title = (row.Name || row.Title || '').trim();
      if (!title) {
        errors.push(`Row ${idx + 2}: Skipped due to missing movie title.`);
        return;
      }

      const yearRaw = row.Year || '';
      const year = parseInt(yearRaw, 10) || null;

      // Letterboxd rating is 0.5 - 5.0 (stars)
      let ratingNum = parseFloat(row.Rating);
      let finalScore = 7.0; // default fallback if unrated
      if (!isNaN(ratingNum) && ratingNum > 0) {
        finalScore = Math.min(10.0, Math.max(1.0, Math.round(ratingNum * 2 * 10) / 10));
      }

      const reviewText = (row.Review || row.review || '').trim();
      const tagsRaw = row.Tags || row.tags || '';
      const tags = tagsRaw
        ? tagsRaw.split(/[,;]/).map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];

      // Tag imported movies
      if (!tags.includes('imported')) {
        tags.push('imported');
      }

      movies.push({
        title,
        year,
        rawRating: !isNaN(ratingNum) ? ratingNum : null,
        finalScore,
        storyScore: finalScore,
        visualScore: finalScore,
        actionScore: finalScore,
        funScore: finalScore,
        biases: [],
        reviewText,
        tags,
        letterboxdUri: row['Letterboxd URI'] || '',
        watchedDate: row['Watched Date'] || row.Date || ''
      });
    });

    return { format, movies, errors };
  }

  /**
   * Enrich imported movies with TMDB posters and metadata (throttled)
   * @param {Array<Object>} movies 
   * @param {Function} [onProgress]
   * @returns {Promise<Array<Object>>}
   */
  static async enrichWithTMDB(movies, onProgress = null) {
    const enriched = [];
    const total = movies.length;

    for (let i = 0; i < total; i++) {
      const item = { ...movies[i] };
      try {
        const results = await TMDBService.searchMovies(item.title);
        if (results && results.length > 0) {
          // Find best match with matching year if possible
          let match = null;
          if (item.year) {
            match = results.find(r => r.release_date && r.release_date.startsWith(String(item.year)));
          }
          if (!match) match = results[0];

          if (match) {
            item.tmdbId = match.id;
            item.posterUrl = TMDBService.getPosterUrl(match.poster_path);
            item.backdropUrl = TMDBService.getBackdropUrl(match.backdrop_path);
            item.overview = match.overview || '';
            if (!item.year && match.release_date) {
              item.year = parseInt(match.release_date.split('-')[0], 10) || null;
            }
          }
        }
      } catch (err) {
        console.warn(`Could not enrich "${item.title}":`, err.message);
      }

      enriched.push(item);
      if (typeof onProgress === 'function') {
        onProgress(i + 1, total, item);
      }

      // Small throttle to ensure smoothness
      if (i < total - 1) {
        await new Promise(r => setTimeout(r, 60));
      }
    }

    return enriched;
  }

  /**
   * Export an array of KinoVibe movies to Letterboxd-compatible CSV
   * @param {Array<Object>} movies 
   * @param {string} [filename]
   */
  static exportToLetterboxdCSV(movies, filename = 'kinovibe-letterboxd-export.csv') {
    if (!Array.isArray(movies) || movies.length === 0) {
      throw new Error('No movies available to export.');
    }

    const exportRows = movies.map(m => {
      const starRating = m.finalScore ? (m.finalScore / 2).toFixed(1) : '';
      return {
        Title: m.title || '',
        Year: m.year || '',
        Rating: starRating,
        Rating10: m.finalScore ? m.finalScore.toFixed(1) : '',
        Review: m.reviewText || '',
        Tags: Array.isArray(m.tags) ? m.tags.join(', ') : '',
        'Watched Date': m.createdAt ? m.createdAt.split('T')[0] : ''
      };
    });

    const csvContent = CSVUtil.stringify(exportRows, [
      'Title',
      'Year',
      'Rating',
      'Rating10',
      'Review',
      'Tags',
      'Watched Date'
    ]);

    // Trigger browser file download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
