# -*- python-indent-offset: 4 -*-
'''
credentials: utilities for interacting with the user's keyring/keychain.

This is used by CasicsDB and other functions to retrieve user login & password
for the CASICS database, as well as host and port info for the database server.

'''

import getpass
import keyring


# Credentials/keyring functions
# .............................................................................
# Explanation about the weird way this is done: the Python keyring module
# only offers a single function for setting a value; ostensibly, this is
# intended to store a password associated with an identifier.  However, we
# need to store several pieces of information, including a user name.  Since
# we don't know the user name ahead of time, we can't use that as a key to
# look up the credentials.  So, the approach here is to subvert the
# set_password() functionality to store the user name under the fake user
# "username", the password under the fake user "password", the host under the
# fake user "host", etc.

def get_keyring_credentials(ring, user=None):
    '''Looks up user credentials for user 'user'.  If 'user' is None, gets
    the user name stored in the "username" field.'''
    if not user:
        user = keyring.get_password(ring, "username")
    password = keyring.get_password(ring, "password")
    host     = keyring.get_password(ring, "host")
    port     = keyring.get_password(ring, "port")
    return (user, password, host, port)


def save_keyring_credentials(ring, user, password, host, port):
    '''Saves the user, password, host and port info to the keyring.'''
    keyring.set_password(ring, "username", user)
    keyring.set_password(ring, "password", password)
    keyring.set_password(ring, "host", host)
    keyring.set_password(ring, "port", str(port))


def obtain_credentials(ring, db, user=None, pswd=None, host=None, port=None,
                       default_host=None, default_port=None):
    (s_user, s_pswd, s_host, s_port) = (None, None, None, None)
    if ring:
        (s_user, s_pswd, s_host, s_port) = get_keyring_credentials(ring)

    if not host:
        host = s_host or input("{} host (default: {}): ".format(db, default_host))
        host = host or default_host
    if not port:
        port = s_port or input("{} port (default: {}): ".format(db, default_port))
        port = port or default_port
    if not user:
        user = s_user or input("{} user name: ".format(db))
    if not pswd:
        pswd = s_pswd or getpass.getpass()

    return (user, pswd, host, port)
