#!/usr/bin/env python3.4
#
# @file    cataloguer.py
# @brief   Creates a database of all projects in repository hosts
# @author  Michael Hucka

import sys
import operator
import os
import plac
from datetime import datetime
from time import sleep
from timeit import default_timer as timer

sys.path.append('../database')
sys.path.append('../comment')

from casicsdb import *
from utils import *

# Main body.
# .............................................................................

repos_collection = None
lcsh_collection = None

def main(start=False, find=None,
         list_repos=False, list_terms=False, stats=False,
         acct=None, pswd=None, *repos):

    if start:
        if not acct or not pswd:
            text = '*** Need supply account and password to start interface'
            raise SystemExit(text)
        env = 'env MONGO_USER={} MONGO_PASSWORD={}'.format(acct, pswd)
        cmd = 'nodemon --debug -e js,hbs'
        # Save the return value so we can exit with that value.
        retval = os.system(env + ' ' + cmd)
        msg('***')
        msg("Don't forget to manually kill off any remaining node processes")
        msg('***')
        sys.exit(retval)

    if list_repos or list_terms or stats:
        repos = get_repos(acct, pswd)
        msg('Gathering list of annotated repositories ...')
        annotated = {}
#        for entry in repos.find({'_id': {'$in': [38116321, 973792]}, 'topics.lcsh': {'$ne': []}},
        for entry in repos.find({'topics.lcsh': {'$ne': []}},
                                {'_id': 1, 'owner': 1, 'name': 1, 'topics': 1}):
            annotated[entry['_id']] = {'owner': entry['owner'],
                                       'name' : entry['name'],
                                       '_id'  : entry['_id'],
                                       'terms': entry['topics']['lcsh']}
        msg('Done.')
        print_totals(annotated)
        if stats:
            print_stats(annotated)
        if list_repos:
            print_annotated(annotated)
        if list_terms:
            print_terms(annotated)

    if find:
        repos = get_repos(acct, pswd)
        msg('Searching for repos annotated with {} ...'.format(find))
        results = repos.find({'topics.lcsh': {'$in': [find]},
#                              '_id': {'$in': [38116321, 973792]}
                             },
                             {'_id': 1, 'owner': 1, 'name': 1, 'topics': 1})
        msg('Found {} repos:'.format(results.count()))
        for entry in results:
            print_repo(entry, prefix='   ')

    sys.exit(0)


def print_totals(annotated):
    msg('Total annotated repositories found: {}'.format(len(annotated)))


def print_repo(entry, prefix=''):
    msg('{}{}: {} terms'.format(prefix, e_summary(entry), len(entry['topics']['lcsh'])))
    lcsh = get_lcsh()
    msg(terms_explained(lcsh, entry['topics']['lcsh'], prefix + '   '))


def print_annotated(annotated):
    lcsh = get_lcsh()
    for id, entry in annotated.items():
        msg('-'*70)
        msg('{}: {} terms'.format(e_summary(entry), len(entry['terms'])))
        msg(terms_explained(lcsh, entry['terms'], prefix='    '))


def print_stats(annotated):
    lcsh = get_lcsh()
    (num, repos) = max_annotations(annotated)
    msg('Most number of terms on any repo: {}'.format(num))
    msg('└─ Repo(s) in question (total: {}): {}'.format(
        len(repos), ', '.join([e_summary(repo) for repo in repos])))
    # (terms, count) = most_used_terms(annotated)
    # msg('Most number of times any term is used: {}'.format(count))
    # msg('└─ Term(s) used that number of times: {}'.format(', '.join(terms)))
    msg('Term usage statistics:')
    counts = term_stats(annotated)
    for term, count in sorted(counts.items(), key=operator.itemgetter(1),
                             reverse=True):
        lcsh_entry = lcsh.find_one({'_id': term}, {'label': 1})
        msg('  {0:>3}: {1} = {2}'.format(count, term, lcsh_entry['label']))


def terms_explained(lcsh, terms, prefix=''):
    return prefix + ('\n' + prefix).join(
        term + ': ' + term_label(lcsh, term) for term in terms)


def term_label(lcsh, term):
    lcsh_entry = lcsh.find_one({'_id': term}, {'label': 1})
    return lcsh_entry['label']


def max_annotations(annotated):
    total = 0
    repos = []
    for id, entry in annotated.items():
        this_len = len(entry['terms'])
        if this_len > total:
            total = this_len
            repos = [entry]
        elif this_len == total:
            repos.append(entry)
    return (total, repos)


def most_used_terms(annotated):
    counts = term_stats(annotated)
    terms = []
    values = list(counts.values())
    keys   = list(counts.keys())
    max_value = max(values)
    for pos, value in enumerate(values):
        if value == max_value:
            terms.append(keys[pos])
    return (terms, max_value)


def term_stats(annotated):
    counts = {}
    for id, entry in annotated.items():
        for term in entry['terms']:
            if term in counts:
                counts[term] += 1
            else:
                counts[term] = 1
    return counts


def get_repos(acct, pswd):
    global repos_collection
    if repos_collection:
        return repos_collection
    if acct or pswd:
        casicsdb = CasicsDB(login=acct, password=pswd)
    else:
        casicsdb = CasicsDB()
    github_db = casicsdb.open('github')
    repos_collection = github_db.repos
    return repos_collection


def get_lcsh():
    global lcsh_collection
    if lcsh_collection:
        return lcsh_collection
    db = MongoClient(tz_aware=True, connect=True)
    lcsh_db = db['lcsh-db']
    lcsh_collection = lcsh_db.terms
    return lcsh_collection


# Plac annotations for main function arguments
# .............................................................................
# Argument annotations are: (help, kind, abbrev, type, choices, metavar)
# Plac automatically adds a -h argument for help, so no need to do it here.

main.__annotations__ = dict(
    start       = ('start the annotator web interface',        'flag',   'a'),
    find        = ('find repos annotated with the given term', 'option', 'f'),
    list_repos  = ('list annotated repos',                     'flag',   'l'),
    list_terms  = ('list LCSH terms used',                     'flag',   't'),
    stats       = ('print some annotation statistics',         'flag',   's'),
    acct        = ('CASICS MongoDB database user login',       'option', 'u'),
    pswd        = ('CASICS MongoDB database password',         'option', 'p'),
    repos       = 'one or more repository identifiers or names',
)

# Entry point
# .............................................................................

def cli_main():
    plac.call(main)

cli_main()
