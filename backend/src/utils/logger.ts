import pino from 'pino';
import { config } from './environment';

const isDev = config.nodeEnv === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  timestamp: !isDev ? pino.stdTimeFunctions.isoTime : undefined
});
