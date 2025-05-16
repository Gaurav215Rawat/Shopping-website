const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/dbconfig');

// Storage configuration for category images
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const { category_id } = req.params;

      // Fetch category name using category_id
      const client = await pool.connect();
      const query = `SELECT name FROM categories WHERE id = $1`;
      const result = await client.query(query, [category_id]);
      client.release();

      if (result.rows.length === 0) {
        return cb(new Error('Category not found'), null);
      }

      // Correctly access the name field
      const categoryName = result.rows[0].name.replace(/\s+/g, '_');
      const uploadPath = path.join(__dirname, '..', 'uploads', 'categories', categoryName, category_id);

      // Ensure the folder exists
      fs.mkdirSync(uploadPath, { recursive: true });

      cb(null, uploadPath);
    } catch (err) {
      console.error('Storage error (categories):', err);
      cb(err, null);
    }
  },

  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'));
  }
};

// Final upload middleware for category images
const uploadcatgImage = multer({
  storage,
  limits: { files: 6 },
  fileFilter
});

module.exports = uploadcatgImage;
