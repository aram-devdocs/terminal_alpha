import { Terminal } from './core/terminal';
import { ClaudeAgent } from './core/agent';

async function main(): Promise<void> {
  try {
    const agent = new ClaudeAgent();
    const terminal = new Terminal(agent);
    await terminal.start();
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

void main();
