require('dotenv').config();

const app = require("./src/app");
const { dahuaSyncService } = require("./src/services/dahuaSyncService");
const db = require("./src/config/db");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
   dahuaSyncService.start();
});

let shuttingDown = false;
async function shutdown() {
   if (shuttingDown) return;
   shuttingDown = true;
   try {
       await dahuaSyncService.stop();
   } catch (error) {
       console.error(`[server] Dahua synchronizer shutdown failed: ${error.code || 'SYNC_ERROR'}`);
   } finally {
       server.close(async () => {
           try {
               await db.end();
           } catch (error) {
               console.error(`[server] Database shutdown failed: ${error.code || 'DB_ERROR'}`);
           }
           process.exitCode = 0;
       });
   }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);