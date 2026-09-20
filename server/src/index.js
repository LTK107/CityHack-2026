import express from 'express';
import compression from 'compression';
import { config } from './config.js';
import { siteCount } from './map.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { sitesRouter } from './routes/sites.js';
import { chatRouter } from './routes/chat.js';
import { apiLimiter, chatLimiter, corsPolicy, securityHeaders } from './security.js';

const app = express();

// Only trust forwarding headers when explicitly told how many proxies sit in
// front; otherwise a client could spoof its IP and escape the rate limiter.
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
app.disable('etag');

app.use(securityHeaders());
app.use(corsPolicy());
app.use(compression());
// A generous ceiling for chat history, far below anything that could exhaust memory.
app.use(express.json({ limit: '32kb' }));

// The catalogue is validated at boot, so if the process is up it is serveable.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sites: siteCount,
    guide: config.gemini.enabled ? 'configured' : 'disabled',
  });
});

app.use('/api', apiLimiter);
app.use('/api/sites', sitesRouter);
app.use('/api/chat', chatLimiter, chatRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port} (${config.env})`);
  console.log(`[api] catalogue: ${siteCount} sites from ${config.sitesFile}`);
  console.log(`[api] cors origins: ${config.corsOrigins.join(', ')}`);
  if (!config.gemini.enabled) {
    console.warn('[api] GEMINI_API_KEY not set -- /api/chat will return 503.');
  }
});

// Drain in-flight requests before exiting so a deploy does not cut off a response.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
