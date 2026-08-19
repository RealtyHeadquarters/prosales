const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('./env');

const uploadDir = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'];
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp',
};

// Choose a sensible stored extension so browsers can render the photo later.
function pickExt(file) {
  const orig = path.extname(file.originalname || '').toLowerCase();
  if (IMAGE_EXT.includes(orig)) return orig;
  return MIME_TO_EXT[file.mimetype] || '.jpg';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${pickExt(file)}`;
    cb(null, unique);
  },
});

// Accept a file if it looks like an image by MIME OR by extension. Phones sometimes
// send images as "application/octet-stream" (missing/unknown content type), so we
// allow that too — this endpoint only ever receives visit photos from logged-in reps.
function fileFilter(req, file, cb) {
  const byMime = /^image\//.test(file.mimetype);
  const byExt = IMAGE_EXT.includes(path.extname(file.originalname || '').toLowerCase());
  const generic = file.mimetype === 'application/octet-stream' || !file.mimetype;
  if (byMime || byExt || generic) cb(null, true);
  else cb(new Error('Only image files are allowed'));
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per photo
});
