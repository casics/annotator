var winston  = require('winston');
var morgan   = require('morgan');
var fs       = require('fs');

var logLevel = (process.env.LOG_LEVEL || 'info');
var logFile  = (process.env.LOG_FILE || 'annotator.log');

// Log rotation.  I prefer to make the current log file start from the
// current session.

var logger = new winston.Logger({
    level: logLevel,
    exitOnError: false,
    transports: [
        new winston.transports.File({
            filename: logFile,
            prettyPrint: true,
            colorize: false,
            tailable: true,
            maxsize: 5242880,
            maxFiles: 2,
        }),
        new winston.transports.Console({
            colorize: true
        })
    ],
});

fs.rename(logFile, logFile + '.prev', function(err) {
    if (err) {
        logger.warn('Renaming log file to ' + logFile + '.prev: ' + err);
    }
});

logger.writer = {
    write: function(message, encoding) {
        logger.info(message.replace(/\n$/, ""));
    }
};

// The end.

module.exports = logger;
