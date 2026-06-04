import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

export class PythonBridge extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private stdoutBuffer: string = '';
  private pythonPath: string;
  private scriptPath: string;

  constructor(pythonPath: string = 'python3', scriptPath?: string) {
    super();
    this.pythonPath = pythonPath;
    // By default, assume script is in src-python relative to project root.
    // When compiled to dist/main/pythonBridge.js, '../../src-python/main.py' goes up to root.
    this.scriptPath = scriptPath || path.resolve(__dirname, '../../src-python/main.py');
  }

  /**
   * Spawns the child Python process and sets up stdio event listeners.
   */
  public start() {
    if (this.childProcess) {
      console.warn('[Bridge] Python process is already running.');
      return;
    }

    console.log(`[Bridge] Spawning Python process: ${this.pythonPath} "${this.scriptPath}"`);
    
    // Spawn Python with unbuffered output (-u) so we receive messages instantly
    this.childProcess = spawn(this.pythonPath, ['-u', this.scriptPath]);

    // Handle standard output (structured telemetry events)
    this.childProcess.stdout?.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString('utf8');
      this.processBuffer();
    });

    // Handle standard error (application logs / printouts)
    this.childProcess.stderr?.on('data', (chunk: Buffer) => {
      // Convert chunk buffer to string. We call trim() before split('\n')
      // to avoid a trailing empty string element since stderr outputs
      // typically end with a trailing newline (\n or \r\n).
      const logLines = chunk.toString('utf8').trim().split('\n');
      for (const line of logLines) {
        if (line.trim()) {
          console.error(`[Python stderr] ${line.trim()}`);
        }
      }
    });

    // Handle process exits
    this.childProcess.on('close', (code) => {
      console.log(`[Bridge] Python process exited with code ${code}`);
      this.childProcess = null;
      this.emit('close', code);
    });

    // Handle failure to start/spawn process
    this.childProcess.on('error', (err) => {
      console.error('[Bridge] Failed to spawn Python process:', err);
      this.childProcess = null;
      this.emit('error', err);
    });
  }

  /**
   * Processes the buffered stdout data, splitting on newlines and parsing JSON.
   * 
   * Stream Fragmentation Protocol:
   * Because data from the Python process streams in chunks of arbitrary size,
   * a single chunk may contain incomplete JSON or multiple messages merged together.
   * To handle this, we assume a contract where each message ends with a newline (\n).
   * 
   * We accumulate incoming chunks in stdoutBuffer, search for line boundaries (\n),
   * extract and parse completed lines, and keep any remaining incomplete lines in the buffer.
   */
  private processBuffer() {
    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      // Extract the full message up to the newline delimiter
      const line = this.stdoutBuffer.substring(0, newlineIndex).trim();
      // Retain the remaining part of the stream in the buffer
      this.stdoutBuffer = this.stdoutBuffer.substring(newlineIndex + 1);

      if (line) {
        try {
          const payload = JSON.parse(line);
          this.emit('message', payload);
        } catch (e) {
          console.error(`[Bridge] JSON parsing error on line: "${line}"`, e);
        }
      }
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }
  }

  /**
   * Sends a structured JSON command to the Python child process's stdin.
   */
  public sendCommand(action: string, data: Record<string, any> = {}) {
    if (!this.childProcess || !this.childProcess.stdin) {
      console.error('[Bridge] Cannot send command: process is not active.');
      return;
    }

    const payload = JSON.stringify({ action, ...data }) + '\n';
    this.childProcess.stdin.write(payload);
  }

  /**
   * Stops the child Python process. Tries exit command first, then force-kills.
   */
  public stop() {
    if (!this.childProcess) {
      return;
    }

    console.log('[Bridge] Terminating Python child process...');
    this.sendCommand('exit');

    const pid = this.childProcess.pid;
    const forceKillTimeout = setTimeout(() => {
      if (this.childProcess) {
        console.warn(`[Bridge] Child process (${pid}) did not exit. Sending SIGKILL.`);
        this.childProcess.kill('SIGKILL');
      }
    }, 2000);

    this.childProcess.once('close', () => {
      clearTimeout(forceKillTimeout);
    });
  }
}
