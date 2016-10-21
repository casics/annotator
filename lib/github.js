var util       = require('./util');

// Local utilities.
// ............................................................................

function valuesFromNameArray(arr) {
    if (arr === null) {
        return [];
    } else {
        return arr.map(function(x) { return x.name; });
    }
}



// Exported utilities.
// ............................................................................

function GitHubUtils() {};

// Create an object that contains all the fields from a MongoDB record for
// our repository data, in a format suitable for use in HTML/CSS/handlebars
// web pages.
//
GitHubUtils.repoDescription = function(obj) {
    return {id               : obj._id,
            name             : obj.name,
            owner            : obj.owner,
            description      : obj.description,
            readme           : obj.readme,
            languages        : obj.languages,
            licenses         : obj.licenses,
            files            : obj.files,
            is_visible       : obj.is_visible,
            is_deleted       : obj.is_deleted,
            num_commits      : obj.num_commits,
            num_branches     : obj.num_branches,
            num_releases     : obj.num_releases,
            num_contributors : obj.num_contributors,
            homepage         : obj.homepage,
            default_branch   : obj.default_branch,
            content_type     : obj.content_type,
            kind             : obj.kind,
            interfaces       : obj.interfaces,
            topics           : obj.topics,
            functions        : obj.functions,
            fork             : obj.fork,
            time             : obj.time};
};

// Create a blank repository object.
//
GitHubUtils.blankRepoDescription = function(obj) {
    return {id               : '',
            name             : '',
            owner            : '',
            description      : '',
            readme           : '',
            languages        : [],
            licenses         : [],
            files            : [],
            is_visible       : '',
            is_deleted       : '',
            num_commits      : '',
            num_branches     : '',
            num_releases     : '',
            num_contributors : '',
            homepage         : '',
            default_branch   : '',
            content_type     : [],
            kind             : [],
            interfaces       : [],
            topics           : [],
            functions        : [],
            fork             : null,
            time             : null};
};

GitHubUtils.makeTopicsArray = function(prefix, terms) {
    var makeItem = function(x) {
        var item = {};
        item[prefix] = x;
        return item;
    };

    return terms.map(makeItem);
};

module.exports = GitHubUtils;
