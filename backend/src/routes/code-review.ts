import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { CodeReviewService } from '../services/code-review';
import { logger } from '../utils/logger';

export function createCodeReviewRoutes(pool: Pool): Router {
  const router = Router();
  const codeReviewService = new CodeReviewService(pool);

// POST /api/code-review/comments - Create new code review comment
router.post('/comments', async (req, res) => {
  try {
    const { sessionId, filePath, lineNumber, userId, userName, content, type, severity } = req.body;

    if (!sessionId || !filePath || lineNumber === undefined || !userId || !content || !type || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const comment = await codeReviewService.createComment({
      sessionId,
      filePath,
      lineNumber,
      userId,
      userName: userName || 'Anonymous',
      content,
      type,
      severity,
      status: 'open',
      replies: []
    });

    res.status(201).json(comment);
  } catch (error) {
    logger.error('Error creating code review comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// POST /api/code-review/comments/:commentId/replies - Add reply to comment
router.post('/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, userName, content } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const reply = await codeReviewService.addReply({
      commentId,
      userId,
      userName: userName || 'Anonymous',
      content
    });

    res.status(201).json(reply);
  } catch (error) {
    logger.error('Error adding code review reply:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// GET /api/code-review/sessions/:sessionId/comments - Get all session comments
router.get('/sessions/:sessionId/comments', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const comments = await codeReviewService.getSessionComments(sessionId);

    res.status(200).json({
      sessionId,
      comments,
      totalCount: comments.length
    });
  } catch (error) {
    logger.error('Error fetching session comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// GET /api/code-review/sessions/:sessionId/files/:filePath/comments - Get file-specific comments
router.get('/sessions/:sessionId/files/:filePath/comments', async (req, res) => {
  try {
    const { sessionId, filePath } = req.params;
    const comments = await codeReviewService.getFileComments(sessionId, decodeURIComponent(filePath));

    res.status(200).json({
      sessionId,
      filePath,
      comments,
      totalCount: comments.length
    });
  } catch (error) {
    logger.error('Error fetching file comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// PATCH /api/code-review/comments/:commentId/status - Update comment status
router.patch('/comments/:commentId/status', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body;

    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await codeReviewService.updateCommentStatus(commentId, status);

    res.status(200).json({ success: true, status });
  } catch (error) {
    logger.error('Error updating comment status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/code-review/comments/:commentId - Delete comment
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    await codeReviewService.deleteComment(commentId);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// GET /api/code-review/sessions/:sessionId/report - Generate review report
router.get('/sessions/:sessionId/report', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const report = await codeReviewService.generateReviewReport(sessionId);

    res.status(200).json({
      sessionId,
      ...report
    });
  } catch (error) {
    logger.error('Error generating review report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

  return router;
}
