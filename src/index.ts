import app from './app';
import config from './config';
import logger from './logger';

const server = app.listen(config.port, () => {
  logger.info(`Anketa server běží na http://localhost:${config.port}`);
  logger.info(`Verze Node.js: ${process.version}`);
});

process.on('SIGTERM', () => {
  logger.info('Přijat signál SIGTERM, ukončuji server...');
  server.close(() => {
    logger.info('Server zastaven.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Přijat signál SIGINT (Ctrl+C), ukončuji server...');
  server.close(() => {
    logger.info('Server zastaven.');
    process.exit(0);
  });
});

