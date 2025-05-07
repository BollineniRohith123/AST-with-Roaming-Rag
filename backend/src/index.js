/**
 * Main application entry point
 */
require('dotenv').config();
const api = require('./api');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Constants
const PORT = process.env.PORT || 3002; // Changed to 3002 to avoid conflicts
const NODE_ENV = process.env.NODE_ENV || 'development';

// Banner
const displayBanner = () => {
  const bannerText = `
 █████╗ ███████╗████████╗     █████╗ ███╗   ██╗ █████╗ ██╗  ██╗   ██╗███████╗██╗███████╗
██╔══██╗██╔════╝╚══██╔══╝    ██╔══██╗████╗  ██║██╔══██╗██║  ╚██╗ ██╔╝██╔════╝██║██╔════╝
███████║███████╗   ██║       ███████║██╔██╗ ██║███████║██║   ╚████╔╝ ███████╗██║███████╗
██╔══██║╚════██║   ██║       ██╔══██║██║╚██╗██║██╔══██║██║    ╚██╔╝  ╚════██║██║╚════██║
██║  ██║███████║   ██║       ██║  ██║██║ ╚████║██║  ██║███████╗██║   ███████║██║███████║
╚═╝  ╚═╝╚══════╝   ╚═╝       ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝╚═╝╚══════╝

=============== AST-based Analysis System with RAG Integration ===============
Mode: ${NODE_ENV}
Port: ${PORT}
Version: ${require('../package.json').version}
=========================================================================
`;
  console.log(bannerText);
};

// Create necessary directories
const createDirectories = () => {
  const libDir = path.join(__dirname, '../lib');
  const reposDir = path.join(__dirname, '../repos');
  const logsDir = path.join(__dirname, '../logs');

  // Ensure directories exist
  [libDir, reposDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Check for Java parser JAR
const checkJavaParser = () => {
  const libDir = path.join(__dirname, '../lib');

  // Check if any JAR file exists
  const files = fs.readdirSync(libDir);
  const jarFile = files.find(file => file.endsWith('.jar'));

  if (!jarFile) {
    logger.warn('No Java parser JAR found in the lib directory. Please build it before analyzing repositories.');
  } else {
    logger.info(`Found Java parser JAR: ${jarFile}`);
  }
};

// Initialize and start server
const startServer = async () => {
  try {
    // Display banner
    displayBanner();

    // Create necessary directories
    createDirectories();

    // Check for Java parser JAR
    checkJavaParser();

    // Initialize the database
    logger.info('Initializing database...');
    await db.initDatabase();
    logger.info('Database initialized successfully');

    // Start the API server
    api.listen(PORT, () => {
      logger.info(`API server listening on port ${PORT}`);

      // Print server information
      const nodeVersion = process.version;
      const memoryUsage = process.memoryUsage();
      logger.info(`Node.js version: ${nodeVersion}`);
      logger.info(`Memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
    });
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', err => {
  logger.error('UNHANDLED REJECTION! Shutting down...', err);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();