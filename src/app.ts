import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import logger from './logger';
import router from './routes';

const app = express();

// Trust the first proxy (nginx) so req.ip reflects the real client IP
// from the X-Forwarded-For header instead of 127.0.0.1
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "'unsafe-inline'",  "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: null, // Disable upgrade-insecure-requests to allow mixed content if necessary (keeping HTTP)
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Add Permissions-Policy header
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logging přes Winston
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.url} – ip: ${req.ip}`);
  next();
});

// Routes
app.use('/', router);

export default app;
