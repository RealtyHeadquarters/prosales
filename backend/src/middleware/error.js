function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Map common PostgreSQL error codes to friendly HTTP responses.
  if (err.code === '23505') return res.status(409).json({ error: 'This value already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'Related record not found' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Invalid value format' });
  if (err.code === '23514') return res.status(400).json({ error: 'Invalid value' });

  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
}

module.exports = { notFound, errorHandler };
