const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(cors({
  origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
}));
app.use(express.json({ limit: '2mb' }));

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
app.use('/api/settings', require('./routes/settings.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
