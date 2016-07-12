var stringer = require('./stringer');

var Util = {

    /**
     * Returns true if the string is a positive integer.
     */

    isPositiveInteger: function isPositiveInteger(str) {
        // Originally from http://stackoverflow.com/a/10834843/743730
        var n = ~~Number(str);
        return String(n) === str && n > 0;
    },


    /**
     * Returns the current date and time, in the current time zone.
     */
    now: function now() {
        // Hacked from http://stackoverflow.com/a/8563517/743730
        function pad(number) {
            var r = String(number);
            if (r.length === 1)
                r = '0' + r;
            return r;
        }
        var dateTime = new Date();
        return            dateTime.getFullYear()
             + '-' + pad( dateTime.getMonth() + 1 )
             + '-' + pad( dateTime.getDate() )
             + ' ' + pad( dateTime.getHours() )
             + ':' + pad( dateTime.getMinutes() )
             + ':' + pad( dateTime.getSeconds() );
    },


    linkifyTerms: function linkifyTerms(obj) {
        if (! (obj instanceof Array)) {
            return obj;
        } else if (obj === null) {
            return '';
        } else {
            var linkArray = obj.map(function(term) {
                return '<a href="/lcsh/' + term + '">' + term + '</a>';
            });
            return linkArray.join('<br>');
        }
    },


    ignorableTerm: function ignorableTerm(obj) {
        return (obj['validation-record']
              || (obj['topical-subdivision'] && !obj['narrower'])
              || obj['genre-form']
              || obj['childrens-subjects']);
    },


    termNodeTitle: function termNodeTitle(obj) {
        var broader  = (obj.broader.length > 0);
        var narrower = (obj.narrower.length > 0);
        var annotations = '';
        if (broader && narrower)
            annotations = ' △ ▽'
        else if (broader)
            annotations = ' △'
        else if (narrower)
            annotations = ' ▽'
        else
            annotations = ''
        return obj.label + ' [' + obj._id + ']' + annotations;
    },


    // The data has this format:
    // {'narrower': ['sh03151433'], 'label': 'Foo',
    //  '_id': 'sh2010005102', 'broader': ['sh0945555'],
    //  'alt_labels': ['foobar']}
    //
    // FancyTree needs this format:
    // [ {title: 'some title'},
    //   {title: 'some other', folder: true, children:
    //     [ {title: 'some title'},
    //       {title: 'some other title'},
    //       ...
    //     ]},
    //   ...
    // ]

    termNode: function termNode(obj) {
        var tooltip = '(No alt labels)';
        // Important: to get line breaks into tooltip text, you need the CSS
        // style to define "white-space: pre-line".  See term-layout.hbs.
        if (obj.alt_labels.length > 0)
            tooltip = 'Alt labels: \n - '
                    + stringer.arrayToString(obj.alt_labels, '\n - ')
        if (obj.note)
            tooltip += '\n\nNote (from LOC): ' + obj.note;
        var fancy_obj = {title: Util.termNodeTitle(obj),
                         tooltip: tooltip, key: obj._id};
        if (obj.narrower.length > 0) {
            fancy_obj.folder = true;
            fancy_obj.lazy = true;
        }
        return fancy_obj;
    },


    /**
     * 'Obj' is expected to be an array of term identifiers ('sh34059349').
     * Calls function 'callback' with one arg, the list of FancyTree nodes.
     */
    makeNodesFromTermIds: function makeNodesFromTermIds(lcsh, obj, callback) {
        lcsh.find({_id: { $in: obj}},
                  function(err, results) {
                      if (err) {
                          console.log(err);
                          res.render('error', {body: err});
                          return;
                      }
                      var output = []
                      for (var i = 0; i < results.length; i++) {
                          var node = Util.termNode(results[i]);
                          output.push(node);
                      }
                      callback(Util.sortByTitles(output));
                  });
    },


    /**
     * 'Olist' is expected to be an array of MongoDB documents.  If 'fromTop'
     * is true, the objects' broader-term lists are followed to get the
     * top-most terms in the LCSH subject term hierarchy, and those are the
     * terms used; if 'fromTop' is false, then the 'olist' array is used
     * as-is.  Callback is with an array of FancyTree nodes.
     */
    makeNodesFromTermDocs: function makeNodesFromTermDocs(lcsh, olist, fromTop, callback) {

        function make_node(term) {
            var node = Util.termNode(term);
            if (term.narrower && term.narrower.length > 0) {
                node.folder = true;
                node.lazy = true;
            }
            return node;
        }

        var output = [];

        // First put all the non-topmost term identifiers into a set.
        var seen = Object.create(null);
        for (var i = 0; i < olist.length; i++) {
            if (Util.ignorableTerm(olist[i]))
                continue;
            if (fromTop && olist[i].topmost !== null)
                continue;
            seen[olist[i]._id] = true;
            output.push(Util.termNode(olist[i]));
        }

        // Now a list of terms that we still need to look up in our database.
        var term_list = [];
        for (var i = 0; i < olist.length; i++) {
            if (Util.ignorableTerm(olist[i]))
                continue;
            if (fromTop && olist[i].topmost !== null) {
                var candidates = olist[i].topmost;
                for (var j = 0; j < candidates.length; j++)
                    if (! seen[candidates[j]]) {
                        seen[candidates[j]] = true;
                        term_list.push(candidates[j]);
                    }
            }
        }

        // If we have terms to look up, get them and call the callback function
        // from within the callback handed to the mongoose call.  Otherwise,
        // just call the callback directly.
        term_list = stringer.uniq(term_list);
        if (term_list) {
            lcsh.find({_id: { $in: term_list}},
                      function(err, results) {
                          if (err) {
                              console.log(err);
                              res.render('error', {body: err});
                              return;
                          }
                          for (var i = 0; i < results.length; i++) {
                              var term = results[i];
                              if (Util.ignorableTerm(term))
                                  continue;
                              output.push(Util.termNode(term));
                          }
                          callback(Util.sortByTitles(output));
                      });
        } else {
            callback(Util.sortByTitles(output));
        }
    },


    makeTermNodes: function makeTermNodes(lcsh, thing, fromTop, callback) {
        // Switches on 'thing'.  If it looks like mongodb objects, it diverts
        // to one case, else if it's a string or array of strings, it assumes
        // they're LCSH term identifiers and diverts to another case.

        if (thing === null)
            return;
        if (! (thing instanceof Array))
            thing = [thing];
        if (typeof(thing[0]) === 'string')
            Util.makeNodesFromTermIds(lcsh, thing, fromTop, callback);
        else
            Util.makeNodesFromTermDocs(lcsh, thing, fromTop, callback);
    },


    sortByTitles: function sortByTitles(arr) {
        // Sort array of {title: 'x', ...} objects.
        if (! (arr instanceof Array)) {
            return arr;
        } else {
            return arr.sort(function(left, right) {
                       var a = left['title'].toLowerCase();
                       var b = right['title'].toLowerCase();
                       if (a < b) return -1;
                       if (a > b) return 1;
                       return 0;
                       });
        }
    },

}

module.exports = Util;
