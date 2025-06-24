import { Terminal } from './terminal';
import { ClaudeAgent } from './claude-agent';

async function main() {
  try {
    const agent = new ClaudeAgent();
    const terminal = new Terminal(agent);
    await terminal.start();
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

main();