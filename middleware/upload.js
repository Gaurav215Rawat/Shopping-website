const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/dbconfig'); 

// Storage configuration
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const { product_id } = req.params;

      // Fetch category name using product_id
      const client = await pool.connect();
      const query = `
        SELECT c.name AS category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = $1
      `;
      const result = await client.query(query, [product_id]);
      client.release();

      if (result.rows.length === 0) {
        return cb(new Error('Product or category not found'), null);
      }

      const categoryName = result.rows[0].category_name.replace(/\s+/g, '_');
      const uploadPath = path.join(__dirname, '..', 'uploads', categoryName, product_id);

      // Ensure the folder exists
      fs.mkdirSync(uploadPath, { recursive: true });

      cb(null, uploadPath);
    } catch (err) {
      console.error('Storage error:', err);
      cb(err, null);
    }
  },

  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

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

const upload = multer({
  storage,
  limits: { files: 6 },
  fileFilter
});

module.exports = upload;
