import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import logger from './logger';
import router from './routes';

const app = express();

// Trust the first proxy (nginx) so req.ip reflects the real client IP
// from the X-Forwarded-For header instead of 127.0.0.1
app.set('trust proxy', 1);

// Generate a per-request nonce and attach it to res.locals before helmet runs
app.use((_req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Security headers – CSP uses per-request nonce so no unsafe-inline is needed
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", `'nonce-${res.locals.nonce as string}'`, "https://cdn.jsdelivr.net"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
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
  })(req, res, next);
});

// Add Permissions-Policy header
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// HTTP request logging přes Winston
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.url} – ip: ${req.ip}`);
  next();
});

// Routes
app.use('/', router);

export default app;
