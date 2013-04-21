# Getting started.

    npm install

Change the mongo url to your mongodb

    npm start

    http://localhost:8000/index.html

Import content defined in index.html into db:

    http://localhost:8000/importer/index.html

Dogfood viewing of index.html from db:

    http://localhost:8000/page/app/main.index.html


# Features:

* Realtime, thru sharejs.
* Run and develop at the same time.
* Importing, driven by comment markers.
* Serverside templating, driven by comment markers.


# Examples:

all functionality is found index.html


# Interface:

## sharejs:

        // [type:collection:name]
        var main_documentId = 'json:app:main'
        sharejs.open( main_documentId, 'json', function (error, mainDoc) {

        // [type:collection:nameDoc.id:attribute]
        var attribute_documentId = 'text:app:'+mainDoc._id + ':index';
            sharejs.open( attribute_documentId, 'text', function (error, attributeDoc) {

            // see https://github.com/josephg/ShareJS/wiki
            }
        }

## http.get:

Get an attribute and use apply the preview markers to its content.

    /page/[collection]/[main].[attribute].html


Get raw attribute content

    /content/[collection]/[name]/[attribute].(css|less|js|html)
    /data/[collection]/[parent._id]/[attribute].(css|less|js|html)

Get raw document content

    /content/[collection]/[name].json
    /data/[collection]/[name._id].json

Import content:

    /importer/[filename]


# Comment markers:

## Importer:

Content can be imported into the site using the /importer/[filename] interface.

Filename is taken from /public folder by default.

### Importing text into attributes:

     import__[collection]_[name]_[attribute]_
     _end_import__[collection]_[name]_[attribute]

### Importing json into documents:

     import__[collection]_[name]_json_
     _end_import__[collection]_[name]_json

moves content between marker into /collection/name/attribute


### Importing content of a file into an attribute:

    import_file__[filename]__into__[collection]_[name]_[attribute]


### Importing content of a file as data into a document:

    import_file__[filename]__into__[collection]_[name]_json

read filename into /collection/name/attribute and processes import marker inside it.


## Previewer:

when content is requested thru the /page/collection/name/attribute.html interface
the following markers are handled.

    <!-- marker -->

### replace:

    [type]__[collection]_[name]_[attribute]

Where type is:

script   ->

    <script src="/content/collection/name/attribute.js"/>

style    ->

    <link href="/content/collection/name/attribute.css" media="all" rel="stylesheet" type="text/css">



    markdown__[collection]_[nameX]_[attribute]

Parses /content/collection/name/attribute into HTML (assuming the attribute contains MD) and include.


    template__[collectionX]_[nameX]_[attributeX]__context__[collectionY]_[nameY]

Push /content/collectionX/nameX/attributeX thru Handlebars.. context=collectionY/nameY/attributeY and include


    remove_.*_end_remove

removes markers and everything in between.


#### not implemented yet:

    [type]__[collection]_[name]
    script   -> <script src="/content/collection/name.js"/>
    contains all type='script' attributes concatenated based on 'order'
    style    -> <link href="/content/collection/name.css" media="all" rel="stylesheet" type="text/css">
    contains all type='style' attributes concatenated based on 'order'
