const express = require('express');
const router = express.Router();
const upload = require('../../middleware/upload');
const { pool } = require('../../config/dbconfig'); // Adjust this to your actual DB pool
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');
const fs = require('fs');
const path = require('path');


// Upload single or multiple images for a product
router.post('/upload/:product_id', upload.array('images', 6),authenticateToken, authorizeRoles('Admin'),
     async (req, res) => {
    const client = await pool.connect();
    try {
      const { product_id } = req.params;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No images uploaded' });
      }

      // Clean and convert paths
      const imagePaths = req.files.map(file =>
        file.path.replace(/.*[\/\\]uploads/, '/uploads').replace(/\\/g, '/')
      );

      // Create parameterized VALUES string like: ($1, $2), ($1, $3), ...
      const valuesPlaceholders = imagePaths
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');

      // Query with parameterized placeholders
      const insertQuery = `
        INSERT INTO product_images (product_id, image_url)
        VALUES ${valuesPlaceholders}
        RETURNING *;
      `;

      const result = await client.query(insertQuery, [product_id, ...imagePaths]);

      res.status(201).json({
        message: 'Images uploaded successfully',
        images: result.rows,
      });
    } catch (err) {
      console.error('Error uploading images:', err);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);




// Get all images for a product
router.get('/:product_id', async (req, res) => {
    const client = await pool.connect();
    try {
      const { product_id } = req.params;
      const result = await client.query(
        'SELECT * FROM product_images WHERE product_id = $1',
        [product_id]
      );
  
      res.json({ images: result.rows });
    } catch (err) {
      console.error('Error fetching product images:', err);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  });




// Delete a specific image by ID
router.delete(
  '/:image_id',
  authenticateToken,
  authorizeRoles('Admin'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { image_id } = req.params;

      // Fetch image path from DB
      const { rows } = await client.query(
        'SELECT image_url FROM product_images WHERE id = $1',
        [image_id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Image not found' });
      }

      // Get the relative image path stored in DB (i.e., /uploads/name/id/...filename)
      let relPath = rows[0].image_url;

      // Ensure that the path is relative (remove leading slash if present)
      if (relPath.startsWith('/')) {
        relPath = relPath.slice(1);
      }

      // Resolve the absolute path of the image (move out of the 'routes' folder to the 'uploads' folder)
      const imagePath = path.resolve(__dirname, '..', '..', relPath);

      // Delete from DB
      await client.query('DELETE FROM product_images WHERE id = $1', [image_id]);

      // Delete the file from disk
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.warn('Warning: could not delete file:', err.message);
        }
      });

      res.json({ message: 'Image deleted successfully' });
    } catch (err) {
      console.error('Error deleting image:', err);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);


// Delete all images of a product and the associated folder
router.delete('/all/:product_id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id } = req.params;

    // Fetch all image URLs for the given product
    const { rows } = await client.query(
      'SELECT image_url FROM product_images WHERE product_id = $1',
      [product_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No images found for this product' });
    }

    // Delete all images from DB
    await client.query('DELETE FROM product_images WHERE product_id = $1', [product_id]);

    // Track the directory of the images
    let folderPath = null;

    // Delete each image file
    await Promise.all(rows.map(async (row) => {
      let relPath = row.image_url;

      // Ensure the path is relative (remove the leading slash if it exists)
      if (relPath.startsWith('/')) {
        relPath = relPath.slice(1);
      }

      // Resolve the absolute path to the file (moving out of the 'routes' folder)
      const imagePath = path.resolve(__dirname, '..', '..', relPath);

      // Track the folder path for later use
      const imageFolderPath = path.dirname(imagePath);
      if (!folderPath) folderPath = imageFolderPath; // Only need to track it once

      // Delete file from disk
      await fs.promises.unlink(imagePath).catch((err) => {
        console.warn('Error deleting image file:', err.message);
      });
    }));

    // Check if folder is empty and delete it
    if (folderPath) {
      fs.readdir(folderPath, (err, files) => {
        if (err) {
          console.warn('Error reading folder:', err.message);
        } else if (files.length === 0) {
          // Try to delete the folder after ensuring it is empty
          fs.rm(folderPath, { recursive: true }, (err) => {
            if (err) {
              console.warn('Error deleting folder:', err.message);
            } else {
              console.log('Folder deleted successfully:', folderPath);
            }
          });
        } else {
          console.log('Folder is not empty, cannot delete:', folderPath);
        }
      });
    }

    res.json({ message: 'All images and their folder deleted successfully' });
  } catch (err) {
    console.error('Error deleting images:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});
      

module.exports = router;
