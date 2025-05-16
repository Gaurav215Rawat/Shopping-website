const express = require('express');
const {pool} = require('../../config/dbconfig'); // Assuming you have a db.js to handle the PostgreSQL connection
const router = express.Router();
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');

// POST /reviews - Add a new review
router.post('/',authenticateToken,authorizeRoles('customer','Admin'), async (req, res) => {
    const { user_id, order_id, product_id, rating, comment } = req.body;
  
    if (!user_id || !order_id || !product_id || rating === undefined) {
      return res.status(400).json({ error: 'User ID, Order ID, Product ID, and Rating are required' });
    }
  
    if (rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5' });
    }
  
    try {
      // Verify order belongs to user, is delivered, and includes the product
      const purchaseCheck = await pool.query(
        `
        SELECT oi.id
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.id = $1 AND o.user_id = $2 AND o.status = 'delivered' AND oi.product_id = $3
        LIMIT 1
        `,
        [order_id, user_id, product_id]
      );
  
      if (purchaseCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You can only review products you have purchased and received from this order' });
      }
  
      // Insert or update the review
      const result = await pool.query(
        `INSERT INTO reviews (user_id, product_id, rating, comment) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (user_id, product_id) 
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
         RETURNING id, user_id, product_id, rating, comment, created_at`,
        [user_id, product_id, rating, comment]
      );
  
      const review = result.rows[0];
      res.status(201).json({ success: true, review });
    } catch (err) {
      console.error('Error inserting review:', err);
      res.status(500).json({ error: 'Failed to add review' });
    }
  });
  
  

// GET /reviews - Get all reviews or filter by user_id or product_id
router.get('/', async (req, res) => {
  const { user_id, product_id } = req.query;

  let query = `
    SELECT 
      reviews.*,users.name
    FROM reviews
    JOIN users ON users.id = reviews.user_id
  `;
  
  let queryParams = [];
  let conditions = [];

  if (user_id) {
    conditions.push(`reviews.user_id = $${queryParams.length + 1}`);
    queryParams.push(user_id);
  }

  if (product_id) {
    conditions.push(`reviews.product_id = $${queryParams.length + 1}`);
    queryParams.push(product_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  try {
    const result = await pool.query(query, queryParams);
    res.json({ success: true, reviews: result.rows });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


module.exports = router;
