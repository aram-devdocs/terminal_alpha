import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { encode } from 'gpt-tokenizer';
import { BaseTool } from '../base';
import { ToolResult, ToolInputSchema } from '../../types';

const execAsync = promisify(exec);

interface GitHubRepoParams {
  repoUrl: string;
  branch?: string;
}

interface FileInfo {
  path: string;
  content: string;
  tokens: number;
}

export class GitHubRepoTool extends BaseTool {
  readonly name = 'read_github_repo';
  readonly description = 'Read and tokenize a GitHub repository';
  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      repoUrl: {
        type: 'string',
        description: 'The GitHub repository URL',
      },
      branch: {
        type: 'string',
        description: 'The branch to read (optional, defaults to main)',
      },
    },
    required: ['repoUrl'],
  };

  async execute(params: unknown): Promise<ToolResult> {
    try {
      this.validateInput(params);
      const { repoUrl, branch = 'main' } = params as GitHubRepoParams;

      // Create temporary directory
      const tempDir = path.join(os.tmpdir(), `github-repo-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      // Clone the repository
      const cloneCommand = `git clone --depth 1 --branch ${branch} ${repoUrl} ${tempDir}`;
      await execAsync(cloneCommand);

      // Find all code files
      const codeExtensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.h',
        '.go',
        '.rs',
        '.cs',
      ];
      const files: FileInfo[] = [];

      const scanDirectory = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (codeExtensions.includes(ext)) {
              const content = await fs.readFile(fullPath, 'utf-8');
              const relativePath = path.relative(tempDir, fullPath);

              // Use GPT tokenizer for accurate token counting
              const tokens = encode(content).length;
              files.push({
                path: relativePath,
                content,
                tokens,
              });
            }
          }
        }
      };

      await scanDirectory(tempDir);

      // Calculate total tokens
      const totalTokens = files.reduce((sum, file) => sum + file.tokens, 0);

      // Prepare debug output
      const debugData = {
        repository: repoUrl,
        branch,
        timestamp: new Date().toISOString(),
        totalFiles: files.length,
        totalTokens,
        files: files.map((f) => ({
          path: f.path,
          tokens: f.tokens,
          preview: f.content.substring(0, 200) + (f.content.length > 200 ? '...' : ''),
        })),
        fullFiles: files,
      };

      // Write debug output
      const debugPath = path.join(process.cwd(), 'github-repo-debug.json');
      await fs.writeFile(debugPath, JSON.stringify(debugData, null, 2));

      // Clean up temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });

      // Create a compressed summary for the agent
      const filesByExtension = files.reduce(
        (acc, file) => {
          const ext = path.extname(file.path) || 'no-extension';
          acc[ext] = (acc[ext] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const summary = {
        repository: repoUrl,
        branch,
        totalFiles: files.length,
        totalTokens,
        avgTokensPerFile: Math.round(totalTokens / files.length),
        filesByExtension,
        largestFiles: files
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 10)
          .map((f) => ({
            path: f.path,
            tokens: f.tokens,
            snippet: f.content.substring(0, 100).replace(/\n/g, ' ') + '...',
          })),
        structure: files.map((f) => `${f.path} (${f.tokens})`).join('\n'),
      };

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
