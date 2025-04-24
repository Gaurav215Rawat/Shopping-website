// config/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Address API',
      version: '1.0.0',
      description: 'API documentation for managing Website',
    },
    servers: [
      {
        url: 'http://localhost:3001/',
      },
    ],
  },
  // Update the 'apis' property to include all necessary route files
  apis: ['./routes/user/login.js', './routes/user/address.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;