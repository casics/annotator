var mongoose     = require('mongoose');
var log          = require('./log');
var util         = require('./util');
var stringer     = require('./stringer');
var mongoose     = require('mongoose');
require('mongoose-double')(mongoose);


// MongoDB schema.
// ......................................................................

var SchemaTypes = mongoose.Schema.Types;

var GitHubRepoSchema = mongoose.Schema({
    _id            : Number,
    owner          : String,
    name           : String,
    description    : String,
    readme         : String,
    languages      : [{name: String}],
    licenses       : [{name: String}],
    topics         :  {lcsh: [String]}, // Later add keys for other ontologies
    functions      : [String],
    is_visible     : Boolean,
    is_deleted     : Boolean,
    default_branch : String,
    homepage       : String,
    fork           : {parent: String, root: String},
    time           : {repo_created   : SchemaTypes.Double,
                      repo_pushed    : SchemaTypes.Double,
                      repo_updated   : SchemaTypes.Double,
                      data_refreshed : SchemaTypes.Double},
});


// MongoDB connection.
// ......................................................................

var githubdb_opts = {server: {socketOptions: {keepAlive: 1}}};

exports.connect = function(connection_url) {
    log.info('Connecting to ' + connection_url + '...');
    log.info('Connection options: ' + JSON.stringify(githubdb_opts));

    // Do not use mongoose.connect here; it does not work for multiple
    // database connections.  Must use createConnection(...).
    var db = mongoose.createConnection(connection_url, githubdb_opts);

    db.on('error', function(err) {
        log.error('GitHub db connection error: ' + err);
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
            log.warn('Connection to GitHub db closed through SIGINT');
        });
    });

    // 3rd arg is the collection.
    return db.model('REPOS', GitHubRepoSchema, 'repos');
}
