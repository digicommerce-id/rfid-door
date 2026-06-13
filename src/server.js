const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Import routes
const rfidRoutes = require('./routes/rfid');

// Setup routes
app.use('/api/rfid', rfidRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Smart Access Node API is running on Vercel!' });
});

// Start the server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running locally on port ${PORT}`);
  });
}

// Export for Vercel Serverless
module.exports = app;
