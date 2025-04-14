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
        conditions.push(`p.price >= $${values.length}`);
      }
  
      if (max_price) {
        values.push(max_price);
        conditions.push(`p.price <= $${values.length}`);
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
  router.post('/',authenticateToken , authorizeRoles('admin'), async (req, res) => {
    const client = await pool.connect();
    try {
      const { name, description, price, stock, category_id } = req.body;
  
      const check = await client.query(
        'SELECT * FROM products WHERE name = $1 AND category_id = $2',
        [name, category_id]
      );
  
      if (check.rows.length > 0) {
        return res.status(400).json({ message: 'Product already exists in this category' });
      }
  
      const result = await client.query(
        `INSERT INTO products (name, description, price, stock, category_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, description, price, stock, category_id]
      );
  
      res.status(201).json({ message: 'Product created', product: result.rows[0] });
    } catch (err) {
      console.error('Error creating product:', err);
      res.status(500).json({ error: 'Internal server error',message:err.detail });
    } finally {
      client.release();
    }
  });
  


  // Get Product by ID

  router.get('/products/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
  
      const result = await client.query(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1`,
        [id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error fetching product:', err);
      res.status(500).json({ error: 'Internal server error',message:err.detail });
    } finally {
      client.release();
    }
  });

  

  // Update Product
  router.put('/products/:id',authenticateToken , authorizeRoles('admin'), async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { name, description, price, stock, category_id } = req.body;
  
      const check = await client.query(
        'SELECT * FROM products WHERE name = $1 AND category_id = $2 AND id != $3',
        [name, category_id, id]
      );
  
      if (check.rows.length > 0) {
        return res.status(400).json({ message: 'Product with same name exists in this category' });
      }
  
      const result = await client.query(
        `UPDATE products
         SET name = $1, description = $2, price = $3, stock = $4, category_id = $5
         WHERE id = $6 RETURNING *`,
        [name, description, price, stock, category_id, id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      res.json({ message: 'Product updated', product: result.rows[0] });
    } catch (err) {
      console.error('Error updating product:', err);
      res.status(500).json({ error: 'Internal server error',message:err.detail });
    } finally {
      client.release();
    }
  });
  


  // Delete Product

  router.delete('/products/:id',authenticateToken , authorizeRoles('admin'), async (req, res) => {
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