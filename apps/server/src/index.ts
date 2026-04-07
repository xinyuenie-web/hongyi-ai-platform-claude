import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';

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
  });
}

main().catch(console.error);
