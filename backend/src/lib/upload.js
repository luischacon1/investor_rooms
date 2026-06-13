const multer = require('multer');
const path = require('path');
const fs = require('fs');

function createUploader(subdir) {
  const storagePath = path.resolve(process.env.STORAGE_PATH || './uploads', subdir);
  fs.mkdirSync(storagePath, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, storagePath),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

  return multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
}

module.exports = { createUploader };
