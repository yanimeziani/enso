import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLynxApp } from '@enso/lynx';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnsoMobileApp } from '../src/App';

const scaffoldDir = resolve(process.cwd(), 'enso-lynx');
const rspeedyBin = resolve(scaffoldDir, 'node_modules/.bin/rspeedy');
const rspeedyBinWin = `${rspeedyBin}.cmd`;

const runCommand = (command: string, args: string[]) =>
  spawn(command, args, {
    cwd: scaffoldDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

const hasRspeedyBinary = () => existsSync(rspeedyBin) || existsSync(rspeedyBinWin);

const ensureDependencies = async () => {
  if (hasRspeedyBinary()) {
    return;
  }

  console.log('[Lynx] Installing dependencies in apps/mobile/enso-lynx...');

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const installProcess = runCommand('pnpm', ['install']);
    installProcess.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`pnpm install exited with code ${code}`));
      }
    });
    installProcess.on('error', (error) => {
      rejectPromise(error);
    });
  });

  if (!hasRspeedyBinary()) {
    throw new Error('rspeedy binary not found after pnpm install.');
  }
};

const startRspeedyDev = async () => {
  await ensureDependencies();

  const devProcess = runCommand('pnpm', ['exec', 'rspeedy', 'dev']);

  devProcess.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  devProcess.on('error', (error) => {
    console.error('Failed to launch Lynx dev server via Rspeedy:', error);
    process.exit(1);
  });
};

if (existsSync(resolve(scaffoldDir, 'package.json'))) {
  startRspeedyDev().catch((error) => {
    console.error('[Lynx] Unable to start Rspeedy dev server:', error);
    process.exit(1);
  });
} else {
  const app = createLynxApp({
    name: 'EnsoMobile',
    component: EnsoMobileApp
  });

  app.start({
    render(element) {
      const markup = renderToStaticMarkup(element);
      console.log('\n[Lynx] Rendered bootstrap preview:');
      console.log(markup);
    }
  });

  console.log('\nLynx dev bootstrap executed.');
  console.log('Scaffold the native host with pnpm create rspeedy -- --dir enso-lynx to enable the full bundler experience.');
}
