/**
 * Health Controller
 * Provides health-check endpoints for the API
 */
const os = require('os');
const { Pool } = require('pg');
const logger = require('../../utils/logger');
const pkg = require('../../../package.json');

/**
 * Basic health check endpoint
 */
exports.getHealth = (req, res) => {
  res.json({
    status: 'ok',
    version: pkg.version,
    timestamp: new Date().toISOString()
  });
};

/**
 * Detailed health check with component statuses
 */
exports.getDetailedHealth = async (req, res) => {
  const components = {};
  
  // Check database connection
  try {
    const pool = new Pool();
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW()');
      components.database = {
        status: 'ok',
        timestamp: result.rows[0].now
      };
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    logger.error('Database health check failed:', error);
    components.database = {
      status: 'error',
      message: error.message
    };
  }
  
  // Check disk space
  try {
    const { exec } = require('child_process');
    exec('df -h / | grep -v Filesystem', (error, stdout) => {
      if (error) {
        components.disk = {
          status: 'unknown',
          message: error.message
        };
      } else {
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 5) {
          const usedPercentage = parts[4].replace('%', '');
          components.disk = {
            status: parseInt(usedPercentage) < 90 ? 'ok' : 'warning',
            usage: parts[4],
            available: parts[3]
          };
        }
      }
    });
  } catch (error) {
    logger.error('Disk health check failed:', error);
    components.disk = {
      status: 'unknown',
      message: error.message
    };
  }
  
  // Check memory usage
  try {
    const totalMem = os.totalmem() / (1024 * 1024 * 1024); // GB
    const freeMem = os.freemem() / (1024 * 1024 * 1024); // GB
    const usedPercentage = ((totalMem - freeMem) / totalMem) * 100;
    
    components.memory = {
      status: usedPercentage < 90 ? 'ok' : 'warning',
      usage: `${usedPercentage.toFixed(2)}%`,
      total: `${totalMem.toFixed(2)} GB`,
      free: `${freeMem.toFixed(2)} GB`
    };
  } catch (error) {
    logger.error('Memory health check failed:', error);
    components.memory = {
      status: 'unknown',
      message: error.message
    };
  }
  
  // Check CPU load
  try {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    components.cpu = {
      status: 'ok',
      cores: cpus.length,
      load1m: loadAvg[0],
      load5m: loadAvg[1],
      load15m: loadAvg[2]
    };
  } catch (error) {
    logger.error('CPU health check failed:', error);
    components.cpu = {
      status: 'unknown',
      message: error.message
    };
  }
  
  // Return overall health status
  const overallStatus = Object.values(components).some(c => c.status === 'error') ? 'error' :
                        Object.values(components).some(c => c.status === 'warning') ? 'warning' : 'ok';
  
  res.json({
    status: overallStatus,
    version: pkg.version,
    timestamp: new Date().toISOString(),
    components
  });
};