const winston = require('winston');

// 自定义日志等级
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    success: 3,  // 自定义的 success 等级
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'cyan',
    success: 'green',
    debug: 'blue',
  },
};

winston.addColors(customLevels.colors);

const logConfiguration = {
  levels: customLevels.levels,
  level: 'debug',
  transports: [ new winston.transports.Console() ],
  format: winston.format.combine(
      winston.format.colorize({all:true}),
      winston.format.timestamp({
         format: 'YYYY-MM-DD HH:mm:ss'
     }),
      winston.format.printf(info => `${[info.timestamp]} | ${info.level} | ${info.message}`),
  )
};

const my_logger = winston.createLogger(logConfiguration);

module.exports = my_logger;
// logger.success('This is a success message!');
// logger.info('This is an info message');
// logger.error('This is an error message');
// logger.debug('fdaf')
