import { Express } from 'express';
import { Pool } from 'pg';
import authRoutes from './auth';
import messageRoutes from './messages';
import sessionRoutes from './sessions';
import analyticsRoutes from './analytics';
import { createCodeReviewRoutes } from './code-review';
import recordingsRoutes from './recordings';
import debugRoutes from './debug';
import encryptionRoutes from './encryption';
import createEnterpriseRoutes from './enterprise';
import { logger } from '../utils/logger';

export const setupRoutes = (app: Express, pool: Pool) => {
  logger.info('Setting up routes');

  app.use('/api/auth', authRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/code-review', createCodeReviewRoutes(pool));
  app.use('/api/recordings', recordingsRoutes);
  app.use('/api/debug', debugRoutes);
  app.use('/api/keys', encryptionRoutes);

  // Enterprise features
  app.use('/api/enterprise', createEnterpriseRoutes(pool));
  app.use('/api/rbac', createEnterpriseRoutes(pool));
  app.use('/api/audit', createEnterpriseRoutes(pool));

  logger.info('Routes configured successfully');
};

