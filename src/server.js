const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
// Middleware to parse URL-encoded bodies (Fonnte sering memakai ini)
app.use(express.urlencoded({ extended: true }));

// Import routes
const rfidRoutes = require('./routes/rfid');
const whatsappRoutes = require('./routes/whatsapp');
const telegramRoutes = require('./routes/telegram');

// Setup routes
app.use('/api/rfid', rfidRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/telegram', telegramRoutes);

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
