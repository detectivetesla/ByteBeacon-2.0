import { startServer } from './server.js';
import { createApp } from './app.js';

export { createApp, startServer };

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('========================================');
    console.error('FATAL BYTEBEACON 2.0 STARTUP ERROR:');
    console.error(err);
    console.error('========================================');
    process.exit(1);
  });
}
