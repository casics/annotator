var mongoose   = require('mongoose');
var log        = require('./log');
var util       = require('./util');
var stringer   = require('./stringer');


// MongoDB schema.
// ......................................................................

var LcshTermSchema = mongoose.Schema({
    _id                   : String,
    label                 : String,
    alt_labels            : [String],
    narrower              : [String],
    broader               : [String],
    topmost               : [String],
    'validation-record'   : { type: Boolean, default: false },
    'topical-subdivision' : { type: Boolean, default: false },
    'childrens-subjects'  : { type: Boolean, default: false },
    'genre-form'          : { type: Boolean, default: false }
});


// MongoDB connection.
// ......................................................................

var lcshdb_opts = {server: {socketOptions: {keepAlive: 1}}};

exports.connect = function(connection_url) {
    log.info('Connecting to ' + connection_url + '...');
    log.info('Connection options: ' + JSON.stringify(lcshdb_opts));

    // Do not use mongoose.connect here; it does not work for multiple
    // database connections.  Must use createConnection(...).
    var db = mongoose.createConnection(connection_url, lcshdb_opts);

    db.on('error', function(err) {
        log.error('LCSH db connection error: ' + err);
    });

    db.on('open', function() {
        log.info('Connected to ' + connection_url);
        var names = [];
        Object.keys(db.collections).forEach(function(col) {
            names.push(col);
        });
        log.info('└─ Collections: ' + stringer.arrayToString(names, ', ') + '.');
    });

    db.on('disconnected', function() {
        log.info('Disconnected from ' + connection_url);
    });

    // If the Node process ends, close the Mongoose connection 
    process.on('SIGINT', function() {
        db.close(function () {
            log.warn('Connection to LCSH db closed through SIGINT');
        });
    });

    // 3rd arg is the collection.
    return db.model('LCSH', LcshTermSchema, 'terms');
}
