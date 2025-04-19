const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');

// with Filters & Search
router.get('/products', async (req, res) => {
    const client = await pool.connect();
    try {
      const { name, category_id, min_price, max_price, min_stock, max_stock, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
  
      let conditions = [];
      let values = [];
  
      if (name) {
        values.push(`%${name.toLowerCase()}%`);
        conditions.push(`LOWER(p.name) LIKE $${values.length}`);
      }
  
      if (category_id) {
        values.push(category_id);
        conditions.push(`p.category_id = $${values.length}`);
      }
  
      if (min_price) {
        values.push(min_price);
        conditions.push(`p.discount_price >= $${values.length}`);
      }
  
      if (max_price) {
        values.push(max_price);
        conditions.push(`p.discount_price <= $${values.length}`);
      }
  
      if (min_stock) {
        values.push(min_stock);
        conditions.push(`p.stock >= $${values.length}`);
      }
  
      if (max_stock) {
        values.push(max_stock);
        conditions.push(`p.stock <= $${values.length}`);
      }
  
      let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
      values.push(limit, offset);
      const result = await client.query(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause}
         ORDER BY p.id DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
  
      res.json({ products: result.rows });
    } catch (err) {
      console.error('Error filtering products:', err);
      res.status(500).json({ message: 'Internal server error' });
    } finally {
      client.release();
    }
  });
  


 // Add a Product
router.post('/', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      short_description,
      main_description,
      price,
      discount_price,
      stock,
      specifications,
      category_id
    } = req.body;

    const check = await client.query(
      'SELECT * FROM products WHERE name = $1 AND category_id = $2',
      [name, category_id]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ message: 'Product already exists in this category' });
    }
     
   // ✅ Validate specifications 
    if (typeof specifications !== 'object' || specifications === null || Array.isArray(specifications)) {
      return res.status(400).json({ message: 'Specifications must be a valid JSON object' });
    }

    const result = await client.query(
      `INSERT INTO products (
         name, short_description, main_description, price, discount_price, stock, specifications, category_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8
       ) RETURNING *`,
      [name, short_description, main_description, price, discount_price, stock, specifications, category_id]
    );

    res.status(201).json({ message: 'Product created', product: result.rows[0] });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  } finally {
    client.release();
  }
});

  


  // Get Product by ID

// Get a product with its images
router.get('/products/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Get the product with its category
    const productResult = await client.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get all images for the product
    const imageResult = await client.query(
      'SELECT * FROM product_images WHERE product_id = $1',
      [id]
    );

    // Add images array to the product object
    product.images = imageResult.rows;

    res.json(product);
  } catch (err) {
    console.error('Error fetching product with images:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  } finally {
    client.release();
  }
});


  

// Update Product
router.put('/products/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      name,
      short_description,
      main_description,
      price,
      discount_price,
      stock,
      specifications,
      category_id
    } = req.body;

    const checkproduct = await client.query(
      'SELECT * FROM products WHERE id= $1',
      [id]
    );

    if (checkproduct.rows.length <= 0) {
      return res.status(400).json({ message: 'Product Does Not Exist' });
    }

    const check = await client.query(
      'SELECT * FROM products WHERE name = $1 AND category_id = $2 AND id != $3',
      [name, category_id, id]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ message: 'Product with same name exists in this category' });
    }

    // ✅ Validate specifications
    if (typeof specifications !== 'object' || specifications === null || Array.isArray(specifications)) {
      return res.status(400).json({ message: 'Specifications must be a valid JSON object' });
    }

    const result = await client.query(
      `UPDATE products SET
         name = $1,
         short_description = $2,
         main_description = $3,
         price = $4,
         discount_price = $5,
         stock = $6,
         specifications = $7,
         category_id = $8
       WHERE id = $9 RETURNING *`,
      [name, short_description, main_description, price, discount_price, stock, specifications, category_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product updated', product: result.rows[0] });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  } finally {
    client.release();
  }
});



  // Delete Product

  router.delete('/products/:id',authenticateToken , authorizeRoles('Admin'), async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
  
      const result = await client.query(
        'DELETE FROM products WHERE id = $1 RETURNING *',
        [id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      res.json({ message: 'Product deleted', deleted: result.rows[0] });
    } catch (err) {
      console.error('Error deleting product:', err);
      res.status(500).json({ error: 'Internal server error',message:err.detail });
    } finally {
      client.release();
    }
  });
  

  module.exports = router;