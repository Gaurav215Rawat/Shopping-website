const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');

// with Filters & Search
router.get('/products', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name, category_id, min_price, max_price,
      min_stock, max_stock, page = 1, limit = 10
    } = req.query;
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // First, get total products count
    const countResult = await client.query(
      `SELECT COUNT(*) AS total FROM products p ${whereClause}`,
      values
    );
    const totalProducts = parseInt(countResult.rows[0].total, 10);

    // Now, fetch paginated product data
    values.push(limit, offset);
    const productResult = await client.query(
      `SELECT p.id, p.name, c.name AS category_name, 
              p.price, p.discount_price, p.stock,
              COALESCE(AVG(r.rating), 0) AS average_rating
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN reviews r ON p.id = r.product_id
       ${whereClause}
       GROUP BY p.id, c.name
       ORDER BY p.id DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const products = productResult.rows;

    // ✅ Get all images with id & image_url for fetched products
    const productIds = products.map(p => p.id);
    let imagesMap = {};

    if (productIds.length > 0) {
      const imageResult = await client.query(
        `SELECT id, product_id, image_url 
         FROM product_images 
         WHERE product_id = ANY($1::int[])`,
        [productIds]
      );

      imagesMap = imageResult.rows.reduce((acc, row) => {
        if (!acc[row.product_id]) {
          acc[row.product_id] = [];
        }
        acc[row.product_id].push({
          id: row.id,
          image_url: row.image_url
        });
        return acc;
      }, {});
    }

    // ✅ Attach images array to each product
    const productsWithImages = products.map(product => ({
      ...product,
      images: imagesMap[product.id] || []
    }));

    res.json({ 
      totalProducts,
      productsLeft: totalProducts - page * limit > 0 ? totalProducts - page * limit : 0,
      products: productsWithImages
    });
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
// Get a product with its images and average rating
router.get('/products/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Get the product with its category and average rating
    const productResult = await client.query(
      `SELECT p.*, 
              c.name AS category_name,
              COALESCE(AVG(r.rating), 0) AS average_rating
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN reviews r ON p.id = r.product_id
       WHERE p.id = $1
       GROUP BY p.id, c.name`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get all images for the product
    const imageResult = await client.query(
      'SELECT id, image_url FROM product_images WHERE product_id = $1',
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


// Update main_description of Product
router.put('/products/main/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { main_description } = req.body;

    // Validate main_description as JSONB type
    if (typeof main_description !== 'object' || main_description === null || Array.isArray(main_description)) {
      return res.status(400).json({ message: 'main_description must be a valid JSON object' });
    }

    // Check if the product exists
    const checkProduct = await client.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (checkProduct.rows.length <= 0) {
      return res.status(400).json({ message: 'Product Does Not Exist' });
    }

    // Update main_description only
    const result = await client.query(
      `UPDATE products
       SET main_description = $1
       WHERE id = $2 RETURNING *`,
      [main_description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'main_description updated', product: result.rows[0] });
  } catch (err) {
    console.error('Error updating main_description:', err);
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
  

  router.delete('/products/v2/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
    const client = await pool.connect();
    try {
      const { id: product_id } = req.params;
  
      // Start a transaction
      await client.query('BEGIN');
  
      // Fetch all image URLs for the given product
      const { rows: imageRows } = await client.query(
        'SELECT image_url FROM product_images WHERE product_id = $1',
        [product_id]
      );
  
      // Delete all product images from DB
      await client.query('DELETE FROM product_images WHERE product_id = $1', [product_id]);
  
      // Delete the product itself
      const result = await client.query(
        'DELETE FROM products WHERE id = $1 RETURNING *',
        [product_id]
      );
  
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Product not found' });
      }
  
      // Commit DB transaction
      await client.query('COMMIT');
  
      // Track the directory of the images
      let folderPath = null;
  
      // Delete image files from disk
      await Promise.all(imageRows.map(async (row) => {
        let relPath = row.image_url;
  
        if (relPath.startsWith('/')) {
          relPath = relPath.slice(1);
        }
  
        const imagePath = path.resolve(__dirname, '..', '..', relPath);
  
        const imageFolderPath = path.dirname(imagePath);
        if (!folderPath) folderPath = imageFolderPath;
  
        await fs.promises.unlink(imagePath).catch((err) => {
          console.warn('Error deleting image file:', err.message);
        });
      }));
  
      // Delete folder if it's empty
      if (folderPath) {
        fs.readdir(folderPath, (err, files) => {
          if (err) {
            console.warn('Error reading folder:', err.message);
          } else if (files.length === 0) {
            fs.rm(folderPath, { recursive: true }, (err) => {
              if (err) {
                console.warn('Error deleting folder:', err.message);
              } else {
                console.log('Folder deleted successfully:', folderPath);
              }
            });
          } else {
            console.log('Folder not empty, skipping delete:', folderPath);
          }
        });
      }
  
      res.json({ message: 'Product and all associated images deleted successfully', deleted: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deleting product and images:', err);
      res.status(500).json({ error: 'Internal server error', message: err.detail });
    } finally {
      client.release();
    }
  });

  module.exports = router;