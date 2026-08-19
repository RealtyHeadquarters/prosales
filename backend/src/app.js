const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Trust Render's proxy so rate-limiting sees real client IPs.
app.set('trust proxy', 1);

// Security headers (CSP off — this is a JSON API; allow cross-origin resource use for photos).
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
}));
app.use(express.json({ limit: '2mb' }));

// Basic abuse protection.
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));

// Serve uploaded visit photos.
app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)));

// Health check (no DB access).
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// API routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/location', require('./routes/location.routes'));
app.use('/api/clients', require('./routes/clients.routes'));
app.use('/api/visits', require('./routes/visits.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/territories', require('./routes/territories.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/settings', require('./routes/settings.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
