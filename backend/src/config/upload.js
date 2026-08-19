const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('./env');

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

function pickExt(file) {
  const orig = path.extname(file.originalname || '').toLowerCase();
  if (IMAGE_EXT.includes(orig)) return orig;
  return MIME_TO_EXT[file.mimetype] || '.jpg';
}

// Accept anything image-like. Phones sometimes send "application/octet-stream".
function fileFilter(req, file, cb) {
  const byMime = /^image\//.test(file.mimetype);
  const byExt = IMAGE_EXT.includes(path.extname(file.originalname || '').toLowerCase());
  const generic = file.mimetype === 'application/octet-stream' || !file.mimetype;
  if (byMime || byExt || generic) cb(null, true);
  else cb(new Error('Only image files are allowed'));
}

let storage;

// Durable storage: if CLOUDINARY_URL is set, photos go to Cloudinary (survive redeploys).
// Otherwise fall back to local disk (fine for dev; ephemeral on Render free tier).
if (process.env.CLOUDINARY_URL) {
  const cloudinary = require('cloudinary').v2; // auto-configures from CLOUDINARY_URL
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'prosales/visits', resource_type: 'image' },
  });
  console.log('📷 Photo storage: Cloudinary');
} else {
  const uploadDir = path.resolve(process.cwd(), env.uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${pickExt(file)}`),
  });
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
