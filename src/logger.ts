import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import config from './config';

const logsDir = path.resolve(__dirname, '../logs');

const fileRotateTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: '%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxFiles: '30d',
  auditFile: path.join(logsDir, '.audit.json'),
});

// Aktuální log – přepisuje se, uchovává jen dnešní záznamy (symlink-like)
const currentFileTransport = new winston.transports.File({
  dirname: logsDir,
  filename: 'current.log',
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level}] ${message}`;
        })
      ),
    }),
    fileRotateTransport,
    currentFileTransport,
  ],
});

export default logger;

