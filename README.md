# fiu

A WebComponent framework consisting of only a fiu files. NPM be damned.


* We want state management. But it's an opt in, not a default behavior.
* We may want an observable with a pipe.
    * observable's subscribe and unsubscribe __MUST__ be resistant to memory leaks (read: if you don't close it, the framework must at some point, so maybe don't even expose unsubscribe).