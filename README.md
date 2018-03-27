CASICS Annotator
================

<img width="100px" align="right" src=".graphics/casics-logo-small.svg">

The CASICS Annotator is a browser-based annotation interface for CASICS (the Comprehensive and Automated Software Inventory Creation System).  It is used by CASICS annotators to add ontology terms to repository records in the database.

*Authors*:      [Michael Hucka](http://github.com/mhucka) and [Matthew J. Graham](https://github.com/doccosmos)<br>
*Repository*:   [https://github.com/casics/annotator](https://github.com/casics/annotator)<br>
*License*:      Unless otherwise noted, this content is licensed under the [GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html) license.


☀ Introduction
-----------------------------

CASICS (the Comprehensive and Automated Software Inventory Creation System) is a project to create a proof of concept that uses machine learning techniques to analyze source code in software repositories and classify the repositories.  To do this, we need to generate a labeled training set consisting of repositories labeled with ontology terms by human evaluators.  The CASICS Annotator is the interface we use to do the labeling.

The CASICS Annotator is written in a combination of Python and JavaScript.  The lower-level command line interface is written in Python, while the browser-based interface is written in JavaScript.  The command-line interface program (called simply `annotator`) is used to start the JavaScript portion using [node.js](https://nodejs.org/en/). 


☛ Installation and configuration
--------------------------------

The CASICS Annotator relies on two network services to do its work: [LoCTerms](https://github.com/casics/locterms), a database of terms from the Library of Congress Subject Headings, and the [CASICS database server](https://github.com/casics/server).  Before using the annotation system, both of those servers need to be running.


⁇ Getting help and support
--------------------------

If you find an issue, please submit it in [the GitHub issue tracker](https://github.com/casics/annotator/issues) for this repository.


♬ Contributing &mdash; info for developers
------------------------------------------

A lot remains to be done on CASICS in many areas.  We would be happy to receive your help and participation if you are interested.  Please feel free to contact the developers either via GitHub or the mailing list [casics-team@googlegroups.com](casics-team@googlegroups.com).

Everyone is asked to read and respect the [code of conduct](CONDUCT.md) when participating in this project.


❤️ Acknowledgments
------------------

This material is based upon work supported by the [National Science Foundation](https://nsf.gov) under Grant Number 1533792 (Principal Investigator: Michael Hucka).  Any opinions, findings, and conclusions or recommendations expressed in this material are those of the author(s) and do not necessarily reflect the views of the National Science Foundation.
    
<br>
<div align="center">
  <a href="https://www.nsf.gov">
    <img width="105" height="105" src=".graphics/NSF.svg">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.caltech.edu">
    <img width="100" height="100" src=".graphics/caltech-round.svg">
  </a>
</div>
