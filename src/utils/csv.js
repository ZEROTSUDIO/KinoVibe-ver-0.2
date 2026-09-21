// KinoVibe RFC 4180 Compliant CSV Parser and Serializer
// Handles quoted strings, escaped quotes (""), commas, and multiline values.

export class CSVUtil {
  /**
   * Parse a CSV string into an array of objects based on header row
   * @param {string} csvText 
   * @returns {Array<Object>}
   */
  static parse(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];

    const rows = this.parseRows(csvText);
    if (rows.length < 2) return [];

    // Clean and normalize headers
    const headers = rows[0].map(h => h.trim());
    const records = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Skip empty trailing rows
      if (row.length === 1 && row[0].trim() === '') continue;

      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] !== undefined ? row[index].trim() : '';
      });
      records.push(record);
    }

    return records;
  }

  /**
   * Parse raw CSV into an array of string arrays (rows and cells)
   * @param {string} text 
   * @returns {Array<Array<string>>}
   */
  static parseRows(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    // Normalize Windows CRLF to LF
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const nextChar = normalized[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i++; // Skip the second quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of cell
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        // End of row
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    // Push the final cell and row if not empty
    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Stringify an array of objects into a CSV string
   * @param {Array<Object>} data 
   * @param {Array<string>} [columns] Optional specific column order
   * @returns {string}
   */
  static stringify(data, columns = null) {
    if (!Array.isArray(data) || data.length === 0) return '';

    const headers = columns || Object.keys(data[0]);
    const lines = [];

    // Header line
    lines.push(headers.map(h => this.escapeCell(h)).join(','));

    // Data rows
    for (const item of data) {
      const row = headers.map(header => {
        const val = item[header];
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return this.escapeCell(val.join('; '));
        return this.escapeCell(String(val));
      });
      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  }

  /**
   * Escape cell values with quotes if they contain commas, quotes, or newlines
   * @param {string} val 
   * @returns {string}
   */
  static escapeCell(val) {
    if (typeof val !== 'string') val = String(val ?? '');
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}
