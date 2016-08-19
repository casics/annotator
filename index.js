// Configuration variables

var app_host       = (process.env.HOST         || 'localhost');
var app_port       = (process.env.PORT         || 3000);
var app_protocol   = 'http';

var result_limit   = (process.env.RESULT_LIMIT || 5000);

var lcsh_host      = (process.env.LCSH_HOST    || 'localhost');
var lcsh_port      = (process.env.LCSH_PORT    || 27017);

var mongo_host     = (process.env.MONGO_HOST   || 'synonym.caltech.edu');
var mongo_port     = (process.env.MONGO_PORT   || 9988);
var mongo_user     = (process.env.MONGO_USER);
var mongo_password = (process.env.MONGO_PASSWORD);


// Package requirements.
// .............................................................................

var express    = require('express');
var handlebars = require('express-handlebars');
var session    = require('express-session');
var mongoose   = require('mongoose');
var morgan     = require('morgan');
var escRegexp  = require('escape-string-regexp');
var bodyParser = require('body-parser');
var fileStore  = require('session-file-store');
var url        = require('url');


// Local requirements
// .............................................................................

var lcshdb     = require('./lib/lcshdb');
var githubdb   = require('./lib/githubdb');
var github     = require('./lib/github');
var util       = require('./lib/util');
var log        = require('./lib/log');
var stringer   = require('./lib/stringer');
var error      = require('./lib/error');


// App initialization.
// .............................................................................

var app = express();

app.use(morgan('dev', {stream: log.writer}));

app.set('port', app_port);
app.set('host', app_host);

hbs = handlebars.create({defaultLayout: 'default-layout',
                         extname: '.hbs',
                         helpers: {
                             json: function(x) {
                                 if (x) return JSON.stringify(x);
                                 else return JSON.stringify('');
                             },
                             equal: function(lvalue, rvalue, options) {
                                 if (arguments.length < 3)
                                     throw new Error("#equal needs 2 parameters");
                                 if (lvalue != rvalue)
                                     return options.inverse(this);
                                 else
                                     return options.fn(this);
                             },
                             forkinfo: function(x) {
                                 log.info(x.parent);
                             },
                         } });

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.use(bodyParser.urlencoded({ extended: true }));

// Session handling, needed to carry results of searching for repo to searching
// for LCSH terms.

app.use(session({
    store: new fileStore(session).FileStore,
    secret: 'casics',
    resave: true,
    saveUninitialized: true,
}));


// Mongoose initialization.
// .............................................................................

var REPOS = githubdb.connect('mongodb://' + mongo_user + ':' + mongo_password
                            + '@' + mongo_host + ':' + mongo_port
                            + '/github?authSource=admin');

var LCSH  = lcshdb.connect('mongodb://' + lcsh_host + ':' + lcsh_port + '/lcsh-db');


// User-level routes.
// .............................................................................
//
// Basic scheme of things:
//
//   /     => top-level page shows a form where you start by searching for repo
//   /O/N  => look up repository "owner/name" directly, then go to form.
//
// Static files like stylesheets are in /public.

app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
    log.info('Displaying main form.');
    if (req.session && req.session.repo)
        res.render('full-form', {repo: req.session.repo});
    else
        res.render('full-form');
});


app.get('/:owner/:name', function(req, res) {
    var owner   = req.params.owner;
    var name    = req.params.name;
    var query   = {owner: owner, name: name};
    var session = req.session;
    log.info('Looking up repository ' + owner + '/' + name);
    REPOS.findOne(query, function(err, results) {
        if (err)
            return errorDatabaseAccess(REPOS, query, null, res, err);
        if (! session)
            log.warn('No session -- unable to save repo info');
        renderFormWithRepoDescription(res, 'full-form', results, session);
    });
});


app.post('/post-github-lookup', function(req, res) {
    var input   = req.body.github_search_string.trim();
    var session = req.session;
    var query;

    if (input.indexOf('/') > -1) {
        // Input is assumed to be a string of the form owner/name.
        var query_parts = input.split('/');
        var owner = query_parts[0];
        var name  = query_parts[1];
        log.info('Searching for repository ' + owner + '/' + name);
        query = {owner: owner, name: name};
    } else if (util.isPositiveInteger(input)) {
        // Input is assumed to be a repository id.
        log.info('Searching for repository ' + input);
        query = {_id: input};
    } else
        return errorBadUserInput(input, 'GitHub repository identifier', res);
    REPOS.findOne(query, function(err, results) {
        if (err)
            return errorDatabaseAccess(REPOS, query, null, res, err);
        if (! session)
            log.warn('No session -- unable to save repo info');
        if (! results) {
            var notfound = github.blankRepoDescription();
            notfound.id = input + ' (not found in database)';
            res.render('full-form', {repo: notfound});
        } else {
            renderFormWithRepoDescription(res, 'full-form', results, session);
        }
    });
});


app.post('/post-selection', function(req, res) {
    if (! req.session || ! req.session.repo)
        return errorLostSession(res);

    var terms = req.body.terms;
    var owner = req.session.repo.owner;
    var name  = req.session.repo.name;
    var query = {owner: owner, name: name};
    var ops   = {$push: {'topics.lcsh': {$each: terms}}};
    log.info('Adding topic terms to ' + owner + '/' + name);
    log.info('└─ Terms: ' + terms);
    REPOS.findOneAndUpdate(
        query,
        ops,
        {upsert: false, new: true},
        function(err, results) {
            if (err) 
                return errorDatabaseAccess(REPOS, query, ops, res, err);
            renderFormWithRepoDescription(res, 'full-form', results, req.session);
        });
});


app.post('/post-lcsh-search', function(req, res) {
    var search_alt_labels = (req.body.search_alt_labels !== 'false');
    var search_substrings = (req.body.search_substrings !== 'false');
    var use_regexp = (req.body.use_regexp !== 'false');
    var use_topmost = (req.body.topmost !== 'false');
    var repo;

    if (! req.session)
        log.warn('No session -- unable to get repo info');
    else
        repo = req.session.repo;

    var pattern = req.body.lcsh_search_string;
    try {
        // Seems that you can't get substring matches in any other way but to
        // use a regexp, but if you don't want special characters to be
        // interpreted as regexp characters, then you have to do this:
        if (! use_regexp)
            pattern = stringer.escapeRegexp(pattern);
        if (! search_substrings)
            pattern = '^' + pattern + '$';
        pattern = new RegExp(pattern, 'i');
    } catch (err) {
        log.error(err);
        if (err instanceof SyntaxError) {
            var msg = "Invalid regexp syntax: " + pattern;
            res.render('error', {message: msg});
            return;
        } else {
            res.render('error', {message: "Exception", body: err});
            return;
        }
    }

    var rmsg = use_regexp ? ' (regexp)' : ' (not regexp)';
    log.info('post-lcsh-search: searching for "' + pattern + '"' + rmsg);
    var query = {$or: [ {_id: pattern}, {label: pattern} ]};
    if (search_alt_labels) {
        query['$or'].push({alt_labels: pattern});
        log.info('└─ searching alt_labels too)');
    }
    LCSH.find(query)
        .limit(result_limit)
        .exec(function(err, results) {
            if (err)
                return errorDatabaseAccess(LCSH, query, null, res, err);
            var truncated = (results.length >= result_limit);
            if (truncated)
                log.warn('Result limit reached; results were truncated.');
            util.makeTermNodes(LCSH, results, use_topmost, function(terms_array) {
                var total_topmost;
                if (use_topmost) {
                    total_topmost = terms_array.length;
                    log.info('post-lcsh-search: ' + total_topmost +
                             ' topmost terms found');
                } else {
                    total_topmost = 0;
                    log.info('post-lcsh-search: ' + total_topmost +
                             ' terms found');
                }
                var context = {repo: repo,
                               search: req.body.lcsh_search_string,
                               search_alt_labels: search_alt_labels,
                               search_substrings: search_substrings,
                               use_regexp: use_regexp,
                               terms: terms_array, 
                               use_topmost: use_topmost,
                               total_terms: results.length,
                               total_topmost: total_topmost,
                               truncated: truncated,
                               result_limit: result_limit};
                res.render('full-form', context);
            });
        });
});


app.post('/post-lcsh-frequent-terms', function(req, res) {
    if (! req.session || ! req.session.repo)
        return errorLostSession(res);

    var selected = req.body.terms['selected'];
    if (typeof selected === 'string')
        selected = [selected];
    if (selected) {
        var owner = req.session.repo.owner;
        var name  = req.session.repo.name;
        log.info('post-lcsh-frequent-terms: adding topics to ' + owner + '/' + name);
        log.info('└─ Terms: ' + selected);

        var query = {owner: owner, name: name};
        var ops   = {$push: {'topics.lcsh': {$each: selected}}};
        REPOS.findOneAndUpdate(
            query,
            ops,
            {upsert: false, new: true},
            function(err, results) {
                if (err) 
                    return errorDatabaseAccess(REPOS, query, ops, res, err);
                renderFormWithRepoDescription(res, 'full-form', results, req.session);
            });
    } else {
        log.info('post-lcsh-frequent-terms: nothing selected');
        res.render('full-form', {repo: repo});
    }
});


app.post('/post-remove-topic', function(req, res) {
    if (! req.session || ! req.session.repo)
        return errorLostSession(res);

    var term  = req.body.term;
    var owner = req.session.repo.owner;
    var name  = req.session.repo.name;
    log.info('Removing topic term ' + term + ' from ' + owner + '/' + name);
    var query = {owner: owner, name: name};
    var ops   = {$pull: {'topics.lcsh': term}};
    REPOS.findOneAndUpdate(
        query,
        ops,
        {upsert: false, new: true},
        function(err, results) {
            if (err) 
                return errorDatabaseAccess(REPOS, query, ops, res, err);
            renderFormWithRepoDescription(res, 'full-form', results, req.session);
        });
});


app.post('/post-clear-session', function(req, res) {
    if (req.session)
        req.session.destroy();
    res.render('full-form');    
});


// The server also accepts requests in the form of URLs, and returns
// human-readable info in the form of web pages containing the answers.

app.get('/lcsh/:id', function(req, res) {
    log.info('Looking up term ' + req.params.id);
    var query = {'_id': req.params.id};
    LCSH.findOne(query, function(err, results) {
        if (err) 
            return errorDatabaseAccess(LCSH, query, null, res, err);
        var context = {id         : results._id,
                       label      : results.label,
                       alt_labels : stringer.arrayToString(results.alt_labels),
                       broader    : util.linkifyTerms(results.broader),
                       narrower   : util.linkifyTerms(results.narrower)};
        res.render('lcsh-term', context);
    });
});


app.get('/repo/:id', function(req, res) {
    log.info('Looking up repository #' + req.params.id);
    var query = {'_id': req.params.id};
    REPOS.findOne(query, function(err, results) {
        if (err)
            return errorDatabaseAccess(REPOS, query, null, res, err);
        if (results) {
            var context = {id : results._id};
            res.render('github-repo', context);
        }
    });
});


// AJAX-level routes
// .............................................................................

// API summary:
//
// * All data is always returned in JSON format.
//
// * The query parameters can be combined, e.g., field=narrower&format=fancy.
//
// * The API interfaces are as follows:
//
//     /ajax?lcsh=X
//       Return the MongoDB record entry for LCSH term X.
//       Example: /ajax?lcsh=sh90001980
//     
//     /ajax?lcsh=X?field=Y
//       Return subfield Y of the LCSH MongoDB entry for term X.
//       The fields "narrower", "broader" and "alt_labels" are lists.
//       E.g., for narrower, it will be ["sh2007100517", "2h85000610"].
//       Example: /ajax?lcsh=sh90001980?field=narrower
//     
//     /ajax?lcsh=X?format=fancy
//       Return the data in a form suitable for use with FancyTree.
//       Example: /ajax?narrower=sh90001980?format=fancy
// 
//     /ajax?repo=X
//       Return the MongoDB record entry for GitHub repository with id X.
// 
//     /ajax?repo=owner/name
//       Return the MongoDB record entry for GitHub repo with owner & name.

app.get('/ajax', function(req, res) {
    var fancy = (req.query.format === 'fancy');
    var field = req.query.field;

    if (req.query.lcsh) {
        // Form: "ajax?lcsh=..."
        log.info('Ajax: get LCSH term ' + req.query.lcsh + ', field "' + field + '"');
        var query = {_id: req.query.lcsh};
        LCSH.findOne(query, function(err, term) {
            if (err) 
                return errorDatabaseAccess(LCSH, query, null, res, err);
            var output = term;
            if (field && field in output) {
                output = output[field];
            } else {
                log.warn('Subfield ' + field + ' unknown');
            }
            if (fancy) {                    
                util.makeTermNodes(LCSH, output, function(x) { res.json(x); });
            } else {
                res.json(output);
            }
        });
    } else if (req.query.repo) {
        // Form: "ajax?repo=..."
        var owner, name, id;
        if (req.query.repo.indexOf('/') > -1) {
            var query_parts = req.query.repo.split('/');
            owner = query_parts[0];
            name  = query_parts[1];
            log.info('Ajax: get repo ' + owner + '/' + name);
        }
    }
});


app.post('/select', function(req, res) {
    console.log(req.body);
});


// Error page handlers.
// .............................................................................
//
// Instead of app.get(), this uses app.use(). app.use() is the method by
// which Express adds middleware.

app.use(function(req, res, next) {
    res.status(404);
    res.render('404');                  // Render 404.hbs
});


app.use(function(err, req, res, next) {
    log.error(err.stack);
    if (req.session.errorMessage)
        log.error('└─ message: ' + errorMessage);
    res.status(500);
    res.render('500');                  // Render 500.hbs
});


// Miscellaneous local utilities.
// .............................................................................

function topicTermsToTitles(topics, callback) {
    // Format of topics is {lcsh: [array of strings]}.
    // Other keys besides 'lcsh' may be introduced later.

    if (topics === null || (! topics.hasOwnProperty('lcsh'))) {
        callback([]);
        return;
    }
    log.info('Looking up labels corresponding to list of terms');
    log.info('└─ Terms: ' + topics.lcsh);
    var query = {_id: {$in : topics.lcsh}};
    LCSH.find(query, function(err, results) {
        if (err) return errorDatabaseAccess(LCSH, query, null, res, err);
        log.info('Got ' + results.length + ' results back');
        var titles = results.map(function(node) {
            return {title: util.termNodeTitle(node), key: node._id};
        });
        callback(titles);
    });
};


function renderFormWithRepoDescription(res, form, results, session) {
    var data = github.repoDescription(results);
    topicTermsToTitles(data.topics, function(titles) {
        if (titles) {
            data.topics = titles;
            if (session)
                session.repo = data;
        }
        res.render('full-form', {repo: data});
        // res.redirect('/');  // This results in a 'get'.
    });
}



// function topicTermsToTitles(arr, callback) {
//     if (arr === null) {
//         callback('');
//         return;
//     }
//     if (! (arr instanceof Array)) {
//         callback(arr);
//         return;
//     }
//     var terms_list = arr.map(function(x) { return x.lcsh; });
//     var query = {_id: {$in : terms_list}};
//     log.info('Looking up labels corresponding to list of terms');
//     log.info('└─ Terms: ' + terms_list);
//     LCSH.find(query, function(err, results) {
//         if (err) {
//             errorDatabaseAccess(LCSH, query, null, res, err);
//             return;
//         }
//         log.info('Got ' + results.length + ' results back');
//         var titles = results.map(function(x) {
//             return {title: util.termNodeTitle(x)};
//         });
//         callback(titles);
//     });
// };


function errorLostSession(res) {
    var response = {errorCode: error.LostSession,
                    errorMessage: 'Lost session data or session expired.',
                    errorDestinationURL: url.format({protocol: app_protocol,
                                                     hostname: app_host,
                                                     port: app_port,
                                                     pathname: '/'})};
    log.error(response.errorMessage);
    res.status(440);
    res.end(JSON.stringify(response));
    return false;
};


function errorDatabaseAccess(db, query, operators, res, err) {
    var ops = operators ? operators : '';
    log.error('Query to ' + db.modelName + ' returned error');
    log.error('├─ Query object: ' + query);
    log.error('├─ Operators: ' + ops);
    log.error('└─ Error: ' + err);
    res.render('error', {database: db.modelName,
                         query: query,
                         operators: ops,
                         error: err});
    return false;
};

function errorBadUserInput(input, what, res) {
    var problem = 'Cannot interpret "' + input + '" as a ' + what;
    log.error(problem);
    res.render('error', {message: problem,
                         situation: 'form input',
                         input: input});
}



// Main
// .............................................................................

app.listen(app_port, function() {
    log.info('Started on ' + app_protocol + '://' + app_host + ':' + app_port);
});
