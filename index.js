const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const https = require('https');
const http = require('http');


const pool = require('./config/dbconfig');
const createTables = require('./table');
const authenticateToken = require('./middleware/jwt');
const sendMail = require('./config/mailconfig'); // Your mail config

const app = express();






app.use(cors());
app.use(express.json());



// Initialize DB tables
createTables();




const httpPort = process.env.HTTP_PORT || 3000; // HTTP port


// Create HTTP server
const httpServer = http.createServer(app);

// Start HTTP server
httpServer.listen(httpPort, () => {
  console.log(`HTTP Server is running on port ${httpPort}`);
});






// Route to verify the token
app.post('/verify-token', (req, res) => {
    const { token } = req.body;
  
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
  
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
  
      res.json({
        message: 'Token is valid',
        userId: decoded.id,
        email: decoded.email
      });
    });
  });












//Signin login
const login = require('./routes/user/login');
app.use('/login', login);
  
//Address
const address = require('./routes/user/addresses');
app.use('/address', address);


//category
const categoryRoutes = require('./routes/products/categories');
app.use('/categories', categoryRoutes);

// product
const productRoutes = require('./routes/products/product');
app.use('/product', productRoutes);

//uploaded images
const productImageRoutes = require('./routes/products/productImages');
app.use('/product-images', productImageRoutes);

// Also serve uploaded images
app.use('/uploads', express.static('uploads'));