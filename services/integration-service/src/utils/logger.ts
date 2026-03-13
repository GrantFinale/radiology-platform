import winston from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp, service, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'integration-service' },
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
  ),
  transports: [],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(json()),
    }),
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), devFormat),
    }),
  );
}

export default logger;
