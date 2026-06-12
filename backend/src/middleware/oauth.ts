import { Request, Response, NextFunction } from 'express';
import type { IncomingHttpHeaders } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest<P = Record<string, any>, ResBody = any, ReqBody = any, ReqQuery = Record<string, any>> extends Request<P, ResBody, ReqBody, ReqQuery> {
  headers: IncomingHttpHeaders;
  params: P;
  body: ReqBody;
  query: ReqQuery;
  user?: {
    id: string;
    email: string;
    username: string;
    oauthProvider?: string;
    oauthId?: string;
  };
  token?: string;
}

// Middleware to verify JWT token
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to generate JWT token
export const generateToken = (user: {
  id: string;
  email: string;
  username: string;
  oauthProvider?: string;
  oauthId?: string;
}): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      oauthProvider: user.oauthProvider,
      oauthId: user.oauthId
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Optional: Middleware for routes that require authentication
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Parse GitHub OAuth code and exchange for token
export const exchangeGitHubCode = async (code: string): Promise<{
  accessToken: string;
  profile: {
    id: string;
    login: string;
    email: string;
    avatar_url: string;
  };
}> => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials not configured');
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenData = await tokenResponse.json() as any;

    if (tokenData.error) {
      throw new Error(tokenData.error_description);
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const profile = await profileResponse.json() as any;

    return {
      accessToken,
      profile: {
        id: profile.id.toString(),
        login: profile.login,
        email: profile.email || '',
        avatar_url: profile.avatar_url
      }
    };
  } catch (error) {
    logger.error('GitHub OAuth exchange failed:', error);
    throw error;
  }
};

// Parse GitLab OAuth code
export const exchangeGitLabCode = async (code: string): Promise<{
  accessToken: string;
  profile: {
    id: string;
    username: string;
    email: string;
    avatar_url: string;
  };
}> => {
  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  const redirectUri = process.env.GITLAB_REDIRECT_URI || 'http://localhost:3000/api/auth/gitlab/callback';

  if (!clientId || !clientSecret) {
    throw new Error('GitLab OAuth credentials not configured');
  }

  try {
    const tokenResponse = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json() as any;

    if (tokenData.error) {
      throw new Error(tokenData.error_description);
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile
    const profileResponse = await fetch('https://gitlab.com/api/v4/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const profile = await profileResponse.json() as any;

    return {
      accessToken,
      profile: {
        id: profile.id.toString(),
        username: profile.username,
        email: profile.email,
        avatar_url: profile.avatar_url
      }
    };
  } catch (error) {
    logger.error('GitLab OAuth exchange failed:', error);
    throw error;
  }
};
