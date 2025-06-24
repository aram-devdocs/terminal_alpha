import chalk from 'chalk';

// Simple markdown-like formatting without the marked library to avoid type issues
function simpleMarkdownFormat(text: string): string {
  // Bold text
  text = text.replace(/\*\*(.*?)\*\*/g, (_, p1) => chalk.bold(p1));
  
  // Italic text
  text = text.replace(/\*(.*?)\*/g, (_, p1) => chalk.italic(p1));
  
  // Code blocks
  text = text.replace(/```([\s\S]*?)```/g, (_, p1) => chalk.yellow(p1.trim()));
  
  // Inline code
  text = text.replace(/`([^`]+)`/g, (_, p1) => chalk.yellow(p1));
  
  // Headers
  text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
    return chalk.green.bold(content);
  });
  
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    return chalk.blue.underline(text);
  });
  
  return text;
}

export function formatMarkdown(text: string): string {
  return simpleMarkdownFormat(text);
}

export function formatUserMessage(message: string): string {
  return chalk.cyan('You: ') + message;
}

export function formatAssistantMessage(message: string): string {
  const formatted = formatMarkdown(message);
  return chalk.green('Claude: ') + formatted;
}

export function formatToolUse(toolName: string): string {
  return chalk.yellow(`🔧 Using tool: ${toolName}`);
}

export function formatError(error: string): string {
  return chalk.red(`❌ Error: ${error}`);
}

export function formatHeader(text: string): string {
  const border = '═'.repeat(42);
  return chalk.blue(`╔${border}╗\n║ ${text.padEnd(40)} ║\n╚${border}╝`);
}

export function formatDivider(): string {
  return chalk.gray('─'.repeat(42));
}