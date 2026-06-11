import { Anthropic } from '@anthropic-ai/sdk';

export interface ConflictData {
  localVersion: string;
  remoteVersion: string;
  originalVersion: string;
  filePath: string;
  fileName: string;
}

export interface MergeResult {
  merged: string;
  confidence: number;
  explanation: string;
  strategy: 'auto-merge' | 'manual-review' | 'both-preserved';
}

export class AIConflictResolver {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }

  async resolvConflict(conflict: ConflictData): Promise<MergeResult> {
    const prompt = `You are an expert code merge assistant. Analyze this merge conflict and suggest the best resolution.

File: ${conflict.fileName}
Path: ${conflict.filePath}

Original version:
\`\`\`
${conflict.originalVersion}
\`\`\`

Local (User 1) change:
\`\`\`
${conflict.localVersion}
\`\`\`

Remote (User 2) change:
\`\`\`
${conflict.remoteVersion}
\`\`\`

Respond with:
1. A merged version that combines both intents
2. Your confidence (0-100) that this merge is correct
3. Brief explanation of the merge strategy

Return ONLY valid JSON: {"merged": "...", "confidence": 85, "explanation": "...", "strategy": "auto-merge"}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        return {
          merged: result.merged,
          confidence: result.confidence,
          explanation: result.explanation,
          strategy: result.strategy,
        };
      }
    } catch (error) {
      console.error('AI conflict resolution failed:', error);
    }

    return {
      merged: conflict.remoteVersion,
      confidence: 0,
      explanation: 'Defaulting to remote version due to AI error',
      strategy: 'manual-review',
    };
  }
}
