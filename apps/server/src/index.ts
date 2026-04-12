import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { prepareTreeCutoutsBackground } from './services/cutout-cache.service.js';

async function main() {
  await connectDatabase();
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════╗
║   红艺花木 API Server               ║
║   Port: ${config.port}                        ║
║   Env:  ${config.nodeEnv.padEnd(27)}║
╚══════════════════════════════════════╝
    `);

    // Generate tree cutouts in background (non-blocking)
    prepareTreeCutoutsBackground().catch(err => {
      console.warn('[CutoutCache] Background preparation failed:', err.message);
    });
  });
}

main().catch(console.error);
