var winston = require( 'winston' ),
    fs = require( 'fs' ),
    logDir = 'log', // Or read from a configuration
    env = process.env.NODE_ENV || 'development',
    logger;

winston.setLevels( winston.config.npm.levels );
winston.addColors( winston.config.npm.colors );

if ( !fs.existsSync( logDir ) ) {
    // Create the directory if it does not exist
    fs.mkdirSync( logDir );
}
if (env == 'development') {
    logger = new ( winston.Logger )({
    transports: [
        new winston.transports.Console( {
            level: 'info',
            colorize: true
        }),
        new winston.transports.File({
            level: 'debug',
            filename: logDir + '/logs.log',
            maxsize: 1024 * 1024 * 10 // 10MB
        })
    ],
        exceptionHandlers: [
            new winston.transports.File({
                filename: 'log/exceptions.log'
            })
        ]
    });
}
else if (env == 'test') {
    logger = new ( winston.Logger )({
    transports: [
        new winston.transports.Console( {
            level: 'info',
            colorize: true
        }),
        new winston.transports.File({
            level: 'debug',
            filename: logDir + '/test.log',
            maxsize: 1024 * 1024 * 10 // 10MB
        })
    ],
        exceptionHandlers: [
            new winston.transports.File({
                filename: 'log/test-exceptions.log'
            })
        ]
    });
}
else {
    logger = new ( winston.Logger )({
        transports: [
            new winston.transports.Console({
            level: 'warn', // Only write logs of warn level or higher
            colorize: true
        } ),
        new winston.transports.File( {
            level: 'info',
            filename: logDir + '/logs.log',
            maxsize: 1024 * 1024 * 10 // 10MB
        } ),
    ],
    exceptionHandlers: [
        new winston.transports.File( {
            filename: 'log/exceptions.log'
        } )
    ]
} );
}
module.exports = logger;
