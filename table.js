// === File: Table.js ===
const { pool } = require('./config/dbconfig'); 


//DROP TABLE IF EXISTS entries CASCADE;


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
          full_name VARCHAR(150),
          phone_no VARCHAR(20),
          address_line TEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100),
          postal_code VARCHAR(20),
          is_default BOOLEAN DEFAULT false,
          UNIQUE(user_id, full_name, phone_no, address_line, city, state, country, postal_code)
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
          short_description TEXT,
          main_description TEXT,
          price NUMERIC(10,2) CHECK (price >= 0),
          discount_price NUMERIC(10,2) CHECK (discount_price >= 0),
          stock INTEGER,
          specifications JSONB,
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
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          product_id INT REFERENCES products(id)
        );
        
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES   users(id) ON DELETE CASCADE,
            address_id INT REFERENCES addresses(id) ON DELETE SET NULL,
            status VARCHAR(20) CHECK (status IN ('initiated','pending', 'paid', 'failed', 'cancelled', 'processing', 'completed', 'refunded')) DEFAULT 'pending',
            total NUMERIC(10,2) NOT NULL,
            payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('phonepe', 'cod')),
            phonepe_order_id VARCHAR(255) UNIQUE,  -- PhonePe's order_id
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INT REFERENCES orders(id) ON DELETE CASCADE,
            product_id INT REFERENCES products(id) ON DELETE SET NULL,
            quantity INT NOT NULL,
            price NUMERIC(10,2) NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id) ON DELETE CASCADE,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          payment_method VARCHAR(50) CHECK (payment_method IN ('phonepe', 'credit_card', 'paypal', 'wallet', 'debit_card')) DEFAULT 'phonepe',
          phonepe_payment_id VARCHAR(100),      -- PhonePe payment_id
          phonepe_signature TEXT,               -- For verification
          payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'success', 'failed', 'initiated', 'refunded')) DEFAULT 'pending',
          payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          transaction_id VARCHAR(100),          -- Unique transaction ID from PhonePe
          refund_status VARCHAR(20) DEFAULT 'not_refunded',  -- Handle refunds
          payment_details JSONB,                -- Storing additional payment details returned from PhonePe
          payment_mode VARCHAR(50) CHECK (payment_mode IN ('upi', 'debit_card', 'credit_card', 'wallet', 'net_banking')) DEFAULT 'upi',  -- Track payment method
          payment_response JSONB                -- Store detailed payment response (JSON format)
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
          experience VARCHAR(50),
          UNIQUE(title, location,job_type,skills,experience)
        );
        
        CREATE TABLE IF NOT EXISTS blogs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        url_reference VARCHAR(255) UNIQUE,
        summary TEXT,
        content TEXT NOT NULL,
        category VARCHAR(100),
        tags TEXT[],  -- array of tags
        author VARCHAR(100),
        thumbnail_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estimated_read_time VARCHAR(20),
        likes INTEGER DEFAULT 0
      );

      -- Table: blog_comments
      CREATE TABLE IF NOT EXISTS blog_comments (
        id SERIAL PRIMARY KEY,
        blog_id INTEGER REFERENCES blogs(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        comment TEXT NOT NULL,
        likes INTEGER CHECK (rating BETWEEN 1 AND 5) DEFAULT 0 ,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('blog', 'comment')),
        target_id INTEGER NOT NULL,
        liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, target_type, target_id)
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
