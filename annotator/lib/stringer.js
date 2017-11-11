// Exported utilities.
// ............................................................................

function Stringer() {};

/**
 * Escapes a string containing characters that would be interpreted as
 * regexp characters, so that the string can be passed to RegExp() and
 * not interpreted as a regular expression.
 */
Stringer.escapeRegexp = function(str) {
    // From http://stackoverflow.com/a/30851002/743730
    return str.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
};


Stringer.convertQuotes = function(obj) {
    if (typeof obj === 'string') {
        return obj.replace(/\'/g, '\\"');
    } else if (obj instanceof Array) {
        var newObj = new Array();
        for (var i = 0; i < obj.length; ++i) {
            newObj.push(convertQuotes(obj[i]))
        }
        return newObj;
    } else if (obj !== null && typeof obj === 'object') {
        var newObj = {};
        for (var key in obj) {
            if (typeof obj[key] === 'string')
                newObj[key] = convertQuotes(obj[key]);
            else
                newObj[key] = obj[key];
        }
        return newObj;
    } else {
        return obj;
    }
};

Stringer.arrayToString = function(obj, sep) {
    if (! (obj instanceof Array)) {
        return obj.toString();
    } else if (obj === null) {
        return '';
    } else {
        return obj.join(sep);
    }
};


Stringer.nameArrayToString = function(obj, sep) {
    if (! (obj instanceof Array)) {
        return obj;
    } else if (obj === null) {
        return '';
    } else {
        var names_array = obj.map(function(x) { return x.name; });
        return names_array.join(sep);
    }
};


/**
 * Removes duplicates from an array of strings.
 */
Stringer.uniq = function(arr) {
    // Based on http://stackoverflow.com/a/9229821/743730
    var seen = {};
    var out  = [];
    var len  = arr.length;
    var j    = 0;
    for (var i = 0; i < len; i++) {
        var item = arr[i];
        if (seen[item] !== 1) {
            seen[item] = 1;
            out[j++] = item;
        }
    }
    return out;
};

module.exports = Stringer;
