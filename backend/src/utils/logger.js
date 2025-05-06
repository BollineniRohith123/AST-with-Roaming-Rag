/**
 * Logger utility for structured logging
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json(),
);

// Create production format for console
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'ast-analysis-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' 
        ? productionFormat 
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
  // Exit on error only in production
  exitOnError: process.env.NODE_ENV === 'production',
});

// Add request logging format
logger.requestFormat = winston.format.printf(info => {
  const { timestamp, message, req, res, responseTime } = info;
  return `${timestamp} [HTTP] ${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)`;
});

// Add request logger middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log when the response is finished
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logger.info('HTTP Request', {
      req: {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-length': req.headers['content-length'],
        },
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      },
      res: {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        contentLength: res.get('content-length'),
      },
      responseTime,
    });
  });
  
  next();
};

// Create a child logger with additional metadata
logger.child = (metadata) => {
  return logger.child(metadata);
};

// Export logger
module.exports = logger;