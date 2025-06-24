import readline from "readline";
import { Writable } from "stream";

export interface TerminalIO {
  write(text: string): void;
  writeRaw(text: string): void;
  writeStream(text: string): void;
  startLoading(message?: string): () => void;
  clear(): void;
  exit(): void;
}

export interface Application {
  onStart(io: TerminalIO): Promise<void>;
  onInput(input: string, io: TerminalIO): Promise<void>;
}

export class Terminal {
  private rl: readline.Interface;
  private io: TerminalIO;
  private loadingInterval: NodeJS.Timeout | null = null;

  constructor(private app: Application) {
    // Create a muted output stream that only shows the prompt
    const mutableStdout = new Writable({
      write: (chunk, encoding, callback) => {
        if (!this.rl.line) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      prompt: '> '
    });
    
    this.io = {
      write: (text: string) => console.log(text),
      writeRaw: (text: string) => process.stdout.write(text),
      writeStream: (text: string) => {
        process.stdout.write(text);
      },
      startLoading: (message?: string) => {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        
        if (this.loadingInterval) {
          clearInterval(this.loadingInterval);
        }
        
        this.loadingInterval = setInterval(() => {
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(`${frames[i]} ${message || 'Loading...'}`);
          i = (i + 1) % frames.length;
        }, 80);
        
        return () => {
          if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
          }
        };
      },
      clear: () => console.clear(),
      exit: () => this.stop()
    };
  }

  async start(): Promise<void> {
    await this.app.onStart(this.io);
    
    this.rl.on('line', async (input: string) => {
      await this.app.onInput(input, this.io);
      this.rl.prompt();
    });
    
    this.rl.on('SIGINT', () => this.stop());
    
    this.rl.prompt();
  }
  
  private stop(): void {
    this.rl.close();
    process.exit(0);
  }
}
