// === File: Table.js ===
const { pool } = require('./config/dbconfig'); 

const createTables = async () => {
    const client = await pool.connect();
    try {
        const createTablesQuery = ` 

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          gender VARCHAR(10) CHECK (gender IN ('Male', 'Female','Others')) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          phone VARCHAR(20) UNIQUE NOT NULL,
          role VARCHAR(20) DEFAULT 'customer',
          otp_code VARCHAR(6),
          otp_expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS addresses (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          address_line TEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100),
          postal_code VARCHAR(20),
          is_default BOOLEAN DEFAULT false,
          UNIQUE(user_id, address_line, city, state, country, postal_code)
        );
        
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          parent_id INT REFERENCES categories(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CHECK (id IS DISTINCT FROM parent_id)
        );
        
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          description TEXT,
          price NUMERIC(10,2),
          stock INTEGER,
          category_id INT REFERENCES categories(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (name, category_id)
        );
        
        CREATE TABLE IF NOT EXISTS product_images (
          id SERIAL PRIMARY KEY,
          product_id INT REFERENCES products(id),
          image_url TEXT
        );
        
        CREATE TABLE IF NOT EXISTS carts (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id) -- Ensures one cart per user
        );

        CREATE TABLE IF NOT EXISTS cart_items (
          id SERIAL PRIMARY KEY,
          cart_id INT REFERENCES carts(id) ON DELETE CASCADE,
          product_id INT REFERENCES products(id),
          quantity INT DEFAULT 1,
          UNIQUE(cart_id, product_id) -- Ensures one entry per product in a cart
        );
        
        CREATE TABLE IF NOT EXISTS wishlists (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          product_id INT REFERENCES products(id)
        );
        
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          address_id INT REFERENCES addresses(id),
          status VARCHAR(20) DEFAULT 'pending',
          total NUMERIC(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id),
          product_id INT REFERENCES products(id),
          quantity INT,
          price NUMERIC(10,2)
        );
        
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id),
          payment_method VARCHAR(50),
          payment_status VARCHAR(20),
          payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS reviews (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          product_id INT REFERENCES products(id),
          rating INT,
          comment TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_percent INT,
          valid_from DATE,
          valid_to DATE,
          is_active BOOLEAN DEFAULT true
        );
        
        CREATE TABLE IF NOT EXISTS shipping (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id),
          shipping_status VARCHAR(50),
          estimated_delivery DATE,
          tracking_number VARCHAR(100)
        );


        CREATE TABLE IF NOT EXISTS job_listings (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          location VARCHAR(255) NOT NULL,
          job_type VARCHAR(50),
          skills TEXT,
          experience VARCHAR(50)
        );
        
        `;

    await client.query(createTablesQuery);
    console.log("Tables created");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    client.release();
  }
};

module.exports = createTables;
