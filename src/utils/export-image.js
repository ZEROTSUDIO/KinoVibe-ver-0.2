// KinoVibe Canvas Image Export Engine
// Renders Tier Lists and 2D Matrices to high-resolution shareable graphics (1:1, 9:16, Landscape)
import { TIERS } from './scoring.js';
import { Toast } from './ui.js';

export class ExportImageUtil {
  /**
   * Helper to load an image with CORS and timeout
   */
  static _loadImage(src, timeoutMs = 2500) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, timeoutMs);

      img.onload = () => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(img);
        }
      };

      img.onerror = () => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(null);
        }
      };

      img.src = src;
    });
  }

  /**
   * Render a Tier List to a Canvas
   * @param {Object} options
   * @param {Map<string, Array<Object>>} options.tierMap
   * @param {string} options.userName
   * @param {string} [options.filterTag]
   * @param {'square'|'story'|'landscape'} [options.format]
   * @returns {Promise<HTMLCanvasElement>}
   */
  static async renderTierListCanvas({ tierMap, userName = 'Cinephile', filterTag = '', format = 'square' }) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Dimensions
    let width = 1200;
    let height = 1200;
    if (format === 'story') {
      width = 1080;
      height = 1920;
    } else if (format === 'landscape') {
      width = 1600;
      height = 1000;
    }

    canvas.width = width;
    canvas.height = height;

    // 1. Dark Cinematic Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0d0d16');
    bgGrad.addColorStop(0.5, '#08080d');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle ambient glow at top
    const glowGrad = ctx.createRadialGradient(width / 2, 0, 10, width / 2, 0, width * 0.7);
    glowGrad.addColorStop(0, 'rgba(124, 58, 237, 0.18)');
    glowGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Header
    const headerTop = format === 'story' ? 100 : 50;
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('🎬 KINOVIBE', 60, headerTop);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, sans-serif';
    const tagSuffix = filterTag ? ` · #${filterTag}` : '';
    ctx.fillText(`Cinephile Tier List${tagSuffix}`, 60, headerTop + 45);

    ctx.fillStyle = '#8888a0';
    ctx.font = '500 20px Inter, sans-serif';
    ctx.fillText(`Ranked by @${userName}`, 60, headerTop + 80);

    // 3. Body: Tier Rows
    const activeTiers = TIERS.filter(t => (tierMap.get(t.label) || []).length > 0 || format !== 'story');
    const displayTiers = activeTiers.length > 0 ? activeTiers : TIERS.slice(0, 5);

    const bodyTop = headerTop + 110;
    const bodyBottom = height - (format === 'story' ? 140 : 80);
    const availableHeight = bodyBottom - bodyTop;
    const rowGap = 12;
    const rowHeight = Math.min(130, Math.floor((availableHeight - (displayTiers.length - 1) * rowGap) / displayTiers.length));

    // Preload top posters for performance
    const posterPromises = [];
    displayTiers.forEach(t => {
      const movies = (tierMap.get(t.label) || []).slice(0, format === 'story' ? 7 : 12);
      movies.forEach(m => {
        if (m.posterUrl) {
          posterPromises.push(
            this._loadImage(m.posterUrl).then(img => {
              m._loadedImg = img;
            })
          );
        }
      });
    });

    await Promise.all(posterPromises);

    displayTiers.forEach((tier, rowIdx) => {
      const rowY = bodyTop + rowIdx * (rowHeight + rowGap);
      const rowX = 60;
      const rowW = width - 120;

      // Row background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      this._roundRect(ctx, rowX, rowY, rowW, rowHeight, 10, true, true);

      // Tier Label Badge
      const badgeW = Math.max(90, Math.floor(rowHeight * 0.85));
      ctx.fillStyle = tier.color || '#fbbf24';
      this._roundRect(ctx, rowX, rowY, badgeW, rowHeight, { tl: 10, bl: 10, tr: 0, br: 0 }, true, false);

      ctx.fillStyle = '#08080d';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tier.label, rowX + badgeW / 2, rowY + rowHeight / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Movie items inside row
      const movies = (tierMap.get(tier.label) || []).slice(0, format === 'story' ? 7 : 12);
      const posterW = Math.floor(rowHeight * 0.65);
      const posterH = rowHeight - 16;
      const posterY = rowY + 8;
      let curX = rowX + badgeW + 16;

      movies.forEach(movie => {
        if (curX + posterW > rowX + rowW - 10) return;

        if (movie._loadedImg) {
          // Draw poster with rounded corners
          ctx.save();
          this._roundRect(ctx, curX, posterY, posterW, posterH, 6, false, false);
          ctx.clip();
          ctx.drawImage(movie._loadedImg, curX, posterY, posterW, posterH);
          ctx.restore();

          // Border on poster
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          this._roundRect(ctx, curX, posterY, posterW, posterH, 6, false, true);
        } else {
          // Fallback box with title
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          this._roundRect(ctx, curX, posterY, posterW, posterH, 6, true, true);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((movie.title || '?')[0].toUpperCase(), curX + posterW / 2, posterY + posterH / 2 - 4);

          ctx.fillStyle = '#8888a0';
          ctx.font = '500 10px Inter, sans-serif';
          const shortTitle = (movie.title || '').slice(0, 8);
          ctx.fillText(shortTitle, curX + posterW / 2, posterY + posterH / 2 + 16);
          ctx.textAlign = 'left';
        }

        // Mini score tag at bottom right of poster
        if (movie.finalScore) {
          const scoreStr = movie.finalScore.toFixed(1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          this._roundRect(ctx, curX + posterW - 28, posterY + posterH - 16, 26, 14, 3, true, false);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(scoreStr, curX + posterW - 15, posterY + posterH - 5);
          ctx.textAlign = 'left';
        }

        curX += posterW + 10;
      });
    });

    // 4. Footer
    ctx.fillStyle = '#55556a';
    ctx.font = '500 16px Inter, sans-serif';
    const footerY = height - (format === 'story' ? 60 : 35);
    ctx.fillText('Generated with KinoVibe · Movie Review & Tier Ranking Platform', 60, footerY);

    const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, width - 60, footerY);
    ctx.textAlign = 'left';

    return canvas;
  }

  /**
   * Render a 2x2 Matrix to a Canvas
   * @param {Object} options
   * @param {Array<Object>} options.movies
   * @param {string} options.userName
   * @param {string} [options.title]
   * @param {Object} [options.labels]
   * @param {'square'|'story'|'landscape'} [options.format]
   * @returns {Promise<HTMLCanvasElement>}
   */
  static async renderMatrixCanvas({ movies = [], userName = 'Cinephile', title = '2D Vibe Matrix', labels = {}, format = 'square' }) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let width = 1200;
    let height = 1200;
    if (format === 'story') {
      width = 1080;
      height = 1920;
    } else if (format === 'landscape') {
      width = 1600;
      height = 1000;
    }

    canvas.width = width;
    canvas.height = height;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0d0d16');
    bgGrad.addColorStop(0.5, '#08080d');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient radial glow
    const glowGrad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.6);
    glowGrad.addColorStop(0, 'rgba(124, 58, 237, 0.12)');
    glowGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    const headerTop = format === 'story' ? 100 : 50;
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('🎬 KINOVIBE', 60, headerTop);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillText(title, 60, headerTop + 45);

    ctx.fillStyle = '#8888a0';
    ctx.font = '500 20px Inter, sans-serif';
    ctx.fillText(`Plotted by @${userName}`, 60, headerTop + 80);

    // Matrix Board Area
    const boardTop = headerTop + 115;
    const boardBottom = height - (format === 'story' ? 120 : 70);
    const boardSize = Math.min(width - 120, boardBottom - boardTop);
    const boardX = Math.floor((width - boardSize) / 2);
    const boardY = boardTop + Math.floor((boardBottom - boardTop - boardSize) / 2);

    // Board container
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, boardX, boardY, boardSize, boardSize, 14, true, true);

    const midX = boardX + boardSize / 2;
    const midY = boardY + boardSize / 2;

    // Crosshair axes
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(boardX, midY);
    ctx.lineTo(boardX + boardSize, midY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX, boardY);
    ctx.lineTo(midX, boardY + boardSize);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Axis Labels
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 16px Inter, sans-serif';

    // Top & Bottom
    ctx.textAlign = 'center';
    ctx.fillText(labels.top || 'HIGH DEPTH / STORY', midX, boardY + 28);
    ctx.fillText(labels.bottom || 'ACTION / SPECTACLE', midX, boardY + boardSize - 16);

    // Left & Right
    ctx.textAlign = 'left';
    ctx.fillText(labels.left || 'POPCORN', boardX + 20, midY - 10);
    ctx.textAlign = 'right';
    ctx.fillText(labels.right || 'CINEPHILE GOLD', boardX + boardSize - 20, midY - 10);
    ctx.textAlign = 'left';

    // Quadrant watermark titles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIGH BROW', boardX + boardSize * 0.75, boardY + boardSize * 0.25);
    ctx.fillText('DEEP THINKER', boardX + boardSize * 0.25, boardY + boardSize * 0.25);
    ctx.fillText('GUILTY PLEASURE', boardX + boardSize * 0.25, boardY + boardSize * 0.75);
    ctx.fillText('BLOCKBUSTER', boardX + boardSize * 0.75, boardY + boardSize * 0.75);
    ctx.textAlign = 'left';

    // Plot movies
    const validMovies = movies.slice(0, 30);
    validMovies.forEach(m => {
      // Calculate normalized X (fun vs story) and Y (visual vs action)
      const xVal = (m.funScore !== undefined ? m.funScore : 5);
      const yVal = (m.storyScore !== undefined ? m.storyScore : 5);

      const normX = Math.max(0.05, Math.min(0.95, xVal / 10));
      const normY = Math.max(0.05, Math.min(0.95, 1 - (yVal / 10))); // Invert Y for standard coordinates

      const ptX = boardX + normX * boardSize;
      const ptY = boardY + normY * boardSize;

      // Outer glow circle
      const score = m.finalScore || 5;
      const dotColor = score >= 8.0 ? '#22c55e' : (score >= 6.0 ? '#f59e0b' : '#ef4444');

      ctx.beginPath();
      ctx.arc(ptX, ptY, 8, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Movie title label
      ctx.fillStyle = '#eeeef0';
      ctx.font = '600 12px Inter, sans-serif';
      const cleanTitle = (m.title || '').length > 14 ? m.title.slice(0, 13) + '…' : m.title;
      ctx.fillText(cleanTitle, ptX + 12, ptY + 4);
    });

    // Footer
    ctx.fillStyle = '#55556a';
    ctx.font = '500 16px Inter, sans-serif';
    const footerY = height - (format === 'story' ? 60 : 30);
    ctx.fillText('Generated with KinoVibe · 2D Coordinate Matrix', 60, footerY);

    const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, width - 60, footerY);
    ctx.textAlign = 'left';

    return canvas;
  }

  /**
   * Helper to draw rounded rectangles on canvas
   */
  static _roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      radius = Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, radius);
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  /**
   * Download canvas as PNG
   */
  static downloadCanvas(canvas, filename = 'kinovibe-export.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Copy canvas PNG blob directly to clipboard
   */
  static async copyCanvasToClipboard(canvas) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error('Clipboard image copy is not supported in this browser.');
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Could not generate image blob.'));
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    });
  }
}
