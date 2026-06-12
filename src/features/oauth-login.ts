import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { buildApiUrl } from '../utils/api-config';
import { logger } from '../utils/logger';

interface OAuthProfile {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  provider: 'github' | 'gitlab';
  refreshToken?: string;
}

export class OAuthManager {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private profile: OAuthProfile | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private store: StateStore
  ) {
    this.loadStoredToken();
  }

  private generateStateToken(): string {
    // Generate a random 32-character state token for CSRF protection
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let state = '';
    for (let i = 0; i < 32; i++) {
      state += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return state;
  }

  private async loadStoredToken(): Promise<void> {
    try {
      const token = await this.context.secrets.get('pair-auth-token');
      const refreshToken = await this.context.secrets.get('pair-refresh-token');

      if (token) {
        this.token = token;
        this.refreshToken = refreshToken || null;
        const verified = await this.verifyToken();

        if (verified) {
          logger.info('Loaded existing OAuth token');
          this.scheduleTokenRefresh();
        } else {
          logger.warn('Stored token is invalid, clearing');
          await this.clearStoredTokens();
        }
      }
    } catch (error) {
      logger.error('Failed to load stored token', { error });
    }
  }

  private async clearStoredTokens(): Promise<void> {
    this.token = null;
    this.refreshToken = null;
    this.profile = null;
    await this.context.secrets.delete('pair-auth-token');
    await this.context.secrets.delete('pair-refresh-token');
  }

  private scheduleTokenRefresh(): void {
    // Refresh token 30 minutes from now (before typical 1-hour expiry)
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    this.tokenRefreshTimer = setTimeout(async () => {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      }
    }, 30 * 60 * 1000);
  }

  async initiateGitHubLogin(): Promise<boolean> {
    try {
      // Generate CSRF state token
      const state = this.generateStateToken();
      await this.context.secrets.store(`oauth-state-github`, state);

      const response = await fetch(buildApiUrl('/api/auth/github'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Failed to initiate GitHub login', { status: response.status, error });
        vscode.window.showErrorMessage('Failed to initiate GitHub login. Check your connection.');
        return false;
      }

      const { authUrl } = await response.json() as { authUrl: string };

      // Open browser for OAuth
      vscode.env.openExternal(vscode.Uri.parse(authUrl));
      vscode.window.showInformationMessage('🔐 GitHub login opened in browser. Waiting for authorization...');

      // Start polling for token
      this.startTokenPolling('github', state);
      return true;
    } catch (error) {
      logger.error('GitHub login error', { error });
      vscode.window.showErrorMessage(`GitHub login failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async initiateGitLabLogin(): Promise<boolean> {
    try {
      // Generate CSRF state token
      const state = this.generateStateToken();
      await this.context.secrets.store(`oauth-state-gitlab`, state);

      const response = await fetch(buildApiUrl('/api/auth/gitlab'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Failed to initiate GitLab login', { status: response.status, error });
        vscode.window.showErrorMessage('Failed to initiate GitLab login. Check your connection.');
        return false;
      }

      const { authUrl } = await response.json() as { authUrl: string };

      // Open browser for OAuth
      vscode.env.openExternal(vscode.Uri.parse(authUrl));
      vscode.window.showInformationMessage('🔐 GitLab login opened in browser. Waiting for authorization...');

      // Start polling for token
      this.startTokenPolling('gitlab', state);
      return true;
    } catch (error) {
      logger.error('GitLab login error', { error });
      vscode.window.showErrorMessage(`GitLab login failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private startTokenPolling(provider: string, expectedState: string): void {
    // Stop any existing polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Poll every 2 seconds for up to 5 minutes
    let pollCount = 0;
    const maxPolls = 150;

    logger.info(`Starting OAuth polling for ${provider}`, { maxPolls });

    this.pollInterval = setInterval(async () => {
      pollCount++;

      try {
        const response = await fetch(buildApiUrl(`/api/auth/callback/status?provider=${provider}`), {
          method: 'GET'
        });

        if (response.ok) {
          const data = await response.json() as { token?: string; refreshToken?: string; state?: string; user?: any };

          // Validate state token (CSRF protection)
          if (data.state && data.state !== expectedState) {
            logger.error('OAuth state token mismatch - possible CSRF attack');
            clearInterval(this.pollInterval!);
            this.pollInterval = null;
            vscode.window.showErrorMessage('Security validation failed. Please try logging in again.');
            return;
          }

          if (data.token) {
            logger.info(`OAuth callback received for ${provider}`);
            clearInterval(this.pollInterval!);
            this.pollInterval = null;
            await this.handleAuthCallback(data.token, data.refreshToken || null, provider);
          }
        }
      } catch (error) {
        logger.debug(`OAuth polling attempt ${pollCount}/${maxPolls}`, { error });
      }

      // Stop polling after max attempts
      if (pollCount >= maxPolls) {
        clearInterval(this.pollInterval!);
        this.pollInterval = null;
        logger.warn('OAuth login timeout');
        vscode.window.showWarningMessage('OAuth login timed out. Please try again.');
      }
    }, 2000);
  }

  async handleAuthCallback(token: string, refreshToken: string | null, provider: string): Promise<boolean> {
    try {
      // Store tokens securely
      await this.context.secrets.store('pair-auth-token', token);
      if (refreshToken) {
        await this.context.secrets.store('pair-refresh-token', refreshToken);
      }

      this.token = token;
      this.refreshToken = refreshToken;

      // Verify token and fetch user profile
      const verified = await this.verifyToken();

      if (verified) {
        logger.info(`OAuth login successful`, { provider });
        vscode.window.showInformationMessage(`✅ Successfully logged in with ${provider}`);

        // Clear state token
        await this.context.secrets.delete(`oauth-state-${provider}`);

        // Schedule token refresh if we have a refresh token
        if (this.refreshToken) {
          this.scheduleTokenRefresh();
        }

        this.store.emit('auth-success', { provider, profile: this.profile });
        return true;
      }

      logger.error('Token verification failed after OAuth callback');
      await this.clearStoredTokens();
      return false;
    } catch (error) {
      logger.error('OAuth callback handling failed', { error });
      vscode.window.showErrorMessage(`Failed to complete login: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      logger.warn('No refresh token available');
      return false;
    }

    try {
      logger.info('Refreshing access token');
      const response = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) {
        logger.warn('Token refresh failed', { status: response.status });
        await this.clearStoredTokens();
        vscode.window.showWarningMessage('Session expired. Please log in again.');
        return false;
      }

      const { token, refreshToken } = await response.json() as { token: string; refreshToken?: string };
      this.token = token;

      // Update refresh token if provided
      if (refreshToken) {
        this.refreshToken = refreshToken;
        await this.context.secrets.store('pair-refresh-token', refreshToken);
      }

      // Store new access token
      await this.context.secrets.store('pair-auth-token', token);

      logger.info('Access token refreshed successfully');
      this.scheduleTokenRefresh();
      return true;
    } catch (error) {
      logger.error('Token refresh error', { error });
      return false;
    }
  }

  async verifyToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch(buildApiUrl('/api/auth/token/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        logger.warn('Token verification failed', { status: response.status });
        this.token = null;
        await this.context.secrets.delete('pair-auth-token');
        return false;
      }

      const data = await response.json() as { user: any; tokenExpiry?: number };
      const user = data.user;

      this.profile = {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        provider: user.oauthProvider as 'github' | 'gitlab'
      };

      // Update store with user info
      this.store.updatePreferences({
        userName: user.username
      });

      logger.info('Token verified successfully', { username: user.username, provider: user.oauthProvider });
      return true;
    } catch (error) {
      logger.error('Token verification error', { error });
      return false;
    }
  }

  async logout(): Promise<boolean> {
    try {
      // Stop polling and refresh timers
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }

      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = null;
      }

      // Notify server of logout
      if (this.token) {
        try {
          await fetch(buildApiUrl('/api/auth/logout'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.token}`
            }
          });
        } catch (error) {
          logger.warn('Server logout notification failed', { error });
        }
      }

      // Clear local state
      await this.clearStoredTokens();
      logger.info('Logout successful');
      vscode.window.showInformationMessage('Logged out successfully');
      this.store.emit('auth-logout', {});

      return true;
    } catch (error) {
      logger.error('Logout error', { error });
      // Still clear local tokens even if server call fails
      await this.clearStoredTokens();
      return false;
    }
  }

  dispose(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
  }

  getProfile(): OAuthProfile | null {
    return this.profile;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.profile !== null;
  }
}

export const createOAuthManager = (context: vscode.ExtensionContext, store: StateStore) => {
  return new OAuthManager(context, store);
};
