export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  execute(params: any): Promise<ToolResult>;
}

export class WeatherTool implements Tool {
  name = "get_weather";
  description = "Get the current weather for a location";

  async execute(params: { location: string }): Promise<ToolResult> {
    try {
      // Mock weather data for MVP
      const weatherData = {
        location: params.location,
        temperature: 99,
        condition: 'Raining',
        humidity: 100
      };

      return {
        success: true,
        data: weatherData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

export class GitHubRepoTool implements Tool {
  name = "read_github_repo";
  description = "Read and tokenize a GitHub repository";

  async execute(params: { repoUrl: string; branch?: string }): Promise<ToolResult> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    const { encode } = require('gpt-tokenizer');
    
    const execAsync = promisify(exec);
    
    try {
      // Create temporary directory
      const tempDir = path.join(os.tmpdir(), `github-repo-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      // Clone the repository
      const branch = params.branch || 'main';
      const cloneCommand = `git clone --depth 1 --branch ${branch} ${params.repoUrl} ${tempDir}`;
      await execAsync(cloneCommand);
      
      // Find all code files
      const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.cs'];
      const files: { path: string; content: string; tokens: number }[] = [];
      
      async function scanDirectory(dir: string): Promise<void> {
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
                tokens
              });
            }
          }
        }
      }
      
      await scanDirectory(tempDir);
      
      // Calculate total tokens
      const totalTokens = files.reduce((sum, file) => sum + file.tokens, 0);
      
      // Prepare debug output
      const debugData = {
        repository: params.repoUrl,
        branch,
        timestamp: new Date().toISOString(),
        totalFiles: files.length,
        totalTokens,
        files: files.map(f => ({
          path: f.path,
          tokens: f.tokens,
          preview: f.content.substring(0, 200) + (f.content.length > 200 ? '...' : '')
        })),
        fullFiles: files
      };
      
      // Write debug output
      const debugPath = path.join(process.cwd(), 'github-repo-debug.json');
      await fs.writeFile(debugPath, JSON.stringify(debugData, null, 2));
      
      // Clean up temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
      
      // Create a compressed summary for the agent
      const summary = {
        repository: params.repoUrl,
        branch,
        totalFiles: files.length,
        totalTokens,
        avgTokensPerFile: Math.round(totalTokens / files.length),
        filesByExtension: files.reduce((acc, file) => {
          const ext = path.extname(file.path) || 'no-extension';
          acc[ext] = (acc[ext] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        largestFiles: files
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 10)
          .map(f => ({
            path: f.path,
            tokens: f.tokens,
            snippet: f.content.substring(0, 100).replace(/\n/g, ' ') + '...'
          })),
        structure: files.map(f => `${f.path} (${f.tokens})`).join('\n')
      };
      
      return {
        success: true,
        data: summary
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}