import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env variables (including TMDB_API_KEY from .env or .env.local)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: './',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          library: resolve(__dirname, 'library.html'),
          add: resolve(__dirname, 'add.html'),
          edit: resolve(__dirname, 'edit.html'),
          view: resolve(__dirname, 'view.html'),
          tiers: resolve(__dirname, 'tiers.html'),
          matrix: resolve(__dirname, 'matrix.html'),
          'matrix-story': resolve(__dirname, 'matrix-story.html'),
          'matrix-rare': resolve(__dirname, 'matrix-rare.html'),
          login: resolve(__dirname, 'login.html'),
          profile: resolve(__dirname, 'profile.html'),
          admin: resolve(__dirname, 'admin.html'),
        }
      }
    },
    // In dev mode, handle /api/tmdb requests so developers don't need a separate server
    plugins: [
      {
        name: 'tmdb-dev-api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url, `http://${req.headers.host}`);
            
            if (url.pathname === '/api/tmdb/search') {
              const query = url.searchParams.get('query');
              const page = url.searchParams.get('page') || 1;
              const apiKey = env.TMDB_API_KEY || process.env.TMDB_API_KEY;

              if (!query || query.trim().length < 2) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ results: [] }));
                return;
              }

              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'TMDB_API_KEY not configured in .env' }));
                return;
              }

              try {
                const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query.trim())}&include_adult=false&language=en-US&page=${page}`;
                const tmdbRes = await fetch(tmdbUrl);
                const data = await tmdbRes.json();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
              return;
            }

            if (url.pathname === '/api/tmdb/details') {
              const id = url.searchParams.get('id');
              const apiKey = env.TMDB_API_KEY || process.env.TMDB_API_KEY;

              if (!id) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Movie ID required' }));
                return;
              }

              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'TMDB_API_KEY not configured in .env' }));
                return;
              }

              try {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}?api_key=${apiKey}&language=en-US`;
                const tmdbRes = await fetch(tmdbUrl);
                const data = await tmdbRes.json();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
              return;
            }

            if (url.pathname === '/api/health') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'ok', dev: true, version: '0.3.0' }));
              return;
            }

            next();
          });
        }
      }
    ]
  };
});
