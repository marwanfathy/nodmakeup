// Entry — cluster master forks one worker per core; workers build + listen.
import cluster from 'node:cluster';
import os from 'node:os';
import { buildApp } from './app.js';
import { port } from './config/index.js';
import { purgeStaging, clearLegacyStaging } from './services/cleanup.js';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`🚀 Master process ${process.pid} is running`);
  console.log(`🔥 Forking ${numCPUs} workers for maximum speed...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // One-shot migration: drop the pre-restructure audio staging dir.
  clearLegacyStaging();

  // Hourly staging purge (raw uploads that failed to process).
  purgeStaging();
  setInterval(purgeStaging, 60 * 60 * 1000);

  cluster.on('exit', (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const app = buildApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Worker ${process.pid} started on port ${port}`);
  });
}