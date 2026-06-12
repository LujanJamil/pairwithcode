import dotenv from 'dotenv';
dotenv.config();

// Define the configuration variables
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  port: process.env.PORT || 5000
};

// Satisfy default imports (import config from './environment')
export default config;
