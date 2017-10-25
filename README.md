Annotation interface
====================

This is the interface to annotate repository entries with ontology terms.

Prerequisites
-------------

This interface is built using [node](http://nodejs.org).  After installing `node` in some way (e.g., perhaps using MacPorts or Homebrew), execute the following in a terminal shell (in this directory) in order to install the necessary dependencies:

```csh
sudo npm install
sudo npm install -g nodemon
```

The annotation system requires the MongoDB-based LCSH database to be also installed.  See [../lcsh](../lcsh) for more information.

Starting the interface
----------------------

The following commands executed in a terminal shell should start the system and open a browser window on the annotation form:

```csh
cd ../lcsh
./start-local-mongo.sh
cd ../annotator
./start.sh
open http://localhost:3000
```
