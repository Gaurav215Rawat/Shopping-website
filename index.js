const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const https = require('https');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger'); // adjust path
const fs = require('fs');

const pool = require('./config/dbconfig');
const createTables = require('./table');
const authenticateToken = require('./middleware/jwt');
const sendMail = require('./config/mailconfig'); // Your mail config

const app = express();



app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use(cors());
app.use(express.json());



// Initialize DB tables
createTables();



// // SSL certificate paths
// const options = {
//   key: fs.readFileSync('/etc/letsencrypt/live/info.catchcraft.shop/privkey.pem'),
//   cert: fs.readFileSync('/etc/letsencrypt/live/info.catchcraft.shop/fullchain.pem')
// };


const httpPort = process.env.HTTP_PORT || 3000; // HTTP port
// const httpsPort = process.env.HTTPS_PORT || 3443;

// Create HTTP server
const httpServer = http.createServer(app);

// Start HTTP server
httpServer.listen(httpPort, () => {
  console.log(`HTTP Server is running on port ${httpPort}`);
});


// // Start HTTPS server
// https.createServer(options, app).listen(httpsPort, () => {
//   console.log('Backend running on HTTPS port 3002');
// });




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

//contact us
const contactus = require('./routes/Infosite/contact');
app.use('/contactus', contactus);

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

// carts & items
const cart = require('./routes/cart/carts');
app.use('/cart', cart);

//wishlist
const wishlistRouter = require('./routes/cart/wishlist');
app.use('/wishlist', wishlistRouter);

//order
const ordersRouter = require('./routes/orders/orders');
app.use('/orders', ordersRouter);

// Payment 
const paymentRoutes = require('./routes/orders/payment');
app.use('/api/payments', paymentRoutes);


// Main website
const listing = require('./routes/Infosite/joblisting');
app.use('/listing', listing);

const blogs = require('./routes/Infosite/blogs');
app.use('/blogs', blogs);

