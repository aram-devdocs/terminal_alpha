import readline from "readline";
import { Writable } from "stream";

export interface TerminalIO {
  write(text: string): void;
  writeRaw(text: string): void;
  exit(): void;
}

export interface Application {
  onStart(io: TerminalIO): Promise<void>;
  onInput(input: string, io: TerminalIO): Promise<void>;
}

export class Terminal {
  private rl: readline.Interface;
  private io: TerminalIO;

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
