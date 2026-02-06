import { existsSync } from 'fs';
import { spawn } from 'bun-pty';

const TEST_TOKEN = 'hello_from_bun_pty';
const TIMEOUT_MS = 4000;

interface ProbeResult {
  label: string;
  args: string[];
  exitCode: number;
  signal?: number | string;
  durationMs: number;
  output: string;
}

function resolveShell(): string {
  const candidates = ['/bin/bash', '/bin/sh', process.env.SHELL];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return '/bin/sh';
}

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';

  return env;
}

async function runProbe(shell: string, label: string, args: string[]): Promise<ProbeResult> {
  return new Promise<ProbeResult>((resolve, reject) => {
    const outputChunks: string[] = [];
    const startedAt = Date.now();

    const proc = spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: buildPtyEnv(),
    });

    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        // ignore
      }
      reject(new Error(`[${label}] timeout after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.onData((chunk) => {
      outputChunks.push(chunk);
    });

    proc.onExit(({ exitCode, signal }) => {
      clearTimeout(timer);
      resolve({
        label,
        args,
        exitCode,
        signal,
        durationMs: Date.now() - startedAt,
        output: outputChunks.join(''),
      });
    });
  });
}

function printProbe(result: ProbeResult): void {
  console.log(`\n[probe] ${result.label}`);
  console.log(`args: ${result.args.join(' ')}`);
  console.log(`exitCode=${result.exitCode}, signal=${String(result.signal)}, durationMs=${result.durationMs}`);
  if (result.output.length > 0) {
    console.log(`output: ${JSON.stringify(result.output)}`);
  } else {
    console.log('output: (empty)');
  }
}

async function runCheck(): Promise<void> {
  const runtime = typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
  const shell = resolveShell();

  console.log(`runtime=${runtime}`);
  console.log(`shell=${shell}`);

  const sleepProbe = await runProbe(shell, 'sleep command', ['-lc', 'sleep 1']);
  const echoProbe = await runProbe(shell, 'echo command', ['-lc', `echo ${TEST_TOKEN}; sleep 1`]);

  printProbe(sleepProbe);
  printProbe(echoProbe);

  const sleepOk = sleepProbe.exitCode === 0 && sleepProbe.durationMs >= 800;
  const echoHasOutput = echoProbe.output.includes(TEST_TOKEN);

  if (sleepOk && !echoHasOutput) {
    throw new Error(
      '定位结果：PTY 进程可启动且可运行（sleep 正常退出），但输出数据没有回到 JS（echo 没有任何 onData）。问题在 bun-pty 输出读取链路。'
    );
  }

  if (!echoHasOutput) {
    throw new Error('没有收到 echo 输出，bun-pty 不可用。');
  }

  console.log('\n[PASS] bun-pty 基础 echo 测试通过');
}

runCheck().catch((error) => {
  console.error('\n[RESULT] check-bun-pty failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
