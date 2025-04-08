const express = require('express');
const router = express.Router();
const upload = require('../../middleware/upload');
const { pool } = require('../../config/dbconfig'); // Adjust this to your actual DB pool
const fs = require('fs');
const path = require('path');


// Upload single or multiple images for a product
router.post('/upload/:product_id', upload.array('images', 6), async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const imagePaths = req.files.map(file => `/uploads/${file.filename}`);

    const values = imagePaths.map(path => `(${product_id}, '${path}')`).join(',');

    const insertQuery = `
      INSERT INTO product_images (product_id, image_url)
      VALUES ${values}
      RETURNING *;
    `;

    const result = await client.query(insertQuery);

    res.status(201).json({
      message: 'Images uploaded successfully',
      images: result.rows
    });
  } catch (err) {
    console.error('Error uploading images:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});



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
  
router.delete('/:image_id', async (req, res) => {
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
  
      const imagePath = path.join(__dirname, '..', rows[0].image_url);
  
      // Delete from DB
      await client.query('DELETE FROM product_images WHERE id = $1', [image_id]);
  
      // Delete file from disk
      fs.unlink(imagePath, (err) => {
        if (err) console.warn('Error deleting image file:', err);
      });
  
      res.json({ message: 'Image deleted successfully' });
    } catch (err) {
      console.error('Error deleting image:', err);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  });



    //  Delete all images of a product

    router.delete('/all/:product_id', async (req, res) => {
        const client = await pool.connect();
        try {
          const { product_id } = req.params;
      
          const { rows } = await client.query(
            'SELECT image_url FROM product_images WHERE product_id = $1',
            [product_id]
          );
      
          if (rows.length === 0) {
            return res.status(404).json({ message: 'No images found' });
          }
      
          // Delete from DB
          await client.query('DELETE FROM product_images WHERE product_id = $1', [product_id]);
      
          // Delete each image file
          rows.forEach(row => {
            const imagePath = path.join(__dirname, '..', row.image_url);
            fs.unlink(imagePath, (err) => {
              if (err) console.warn('Error deleting image file:', err);
            });
          });
      
          res.json({ message: 'All images deleted successfully' });
        } catch (err) {
          console.error('Error deleting images:', err);
          res.status(500).json({ message: 'Internal server error' });
        } finally {
          client.release();
        }
      });
      

module.exports = router;
