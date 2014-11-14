#!/usr/bin/env node
var mysql = require('mysql');

var pool = mysql.createPool({
  connectionLimit: 5,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'casadevalentina'
});

function processRow(row, field, callback) {
  var text = row[field];
  var newText = row[field];

  var matches = text.match(/<\s*img[^>]*>/g);

  console.log(row.id);

  if (!matches) {
    return callback();
  }

  var changed = false;

  for (var i = 0; i < matches.length; i++) {
    var currMatch = matches[i];

    var srcURL = /src="([^"]*)"/g.exec(currMatch);

    if (srcURL) {
      var newURL = srcURL[1];

      for (var j = 2; j < process.argv.length; j++) {
        newURL = newURL.replace(process.argv[1], process.argv[j]);
      }

      if (newURL != srcURL[1]) {
        console.log("");
        console.log(srcURL[1]);
        console.log(newURL);

        changed = true;
        newText = newText.replace(srcURL[1], newURL);
      }
    }
  }

  console.log("");

  if (!changed) {
    console.log("Unchanged. No URLs were changed.\n");

    return callback();
  }

  pool.getConnection(function (err, connection) {
    if (err) {
      console.error('Could not create connection to server.');
      console.error(err.stack);
      console.log('Unchanged. Error on connection.\n');

      return callback();
    }

    var query = connection.query('UPDATE blogs SET text = ? WHERE id = ?', [newText, row.id], function (err, result) {
      if (err) {
        console.error('Error trying to update text of blog post.');
        console.error(err.stack);
        console.log('Unchanged. Error on query.\n')

        connection.release();
        return callback();
      }

      console.log('Changed.\n');

      connection.release();
      return callback();
    });
  });
}

function updateURLs(table, field, callback) {
  console.log('Begin updating URLs of table ' + table + '.');

  pool.getConnection(function (err, connection) {
    if (err) {
      console.error('Could not create connection to server.');
      console.error(err.stack);
      return callback();
    }

    var query = connection.query('SELECT id, ' + field + ' FROM ' + table);

    query
      .on('error', function (err) {
        console.error('Error retrieving results from query.');
        console.error(err.stack);
      })
      .on('result', function (row) {
        connection.pause();

        processRow(row, field, function () {
          connection.resume();
        });
      })
      .on('end', function () {
        connection.release();

        return callback();
      });
  });
}

if process.argv.length < 3:
  console.log("usage: " + process.argv[0] + " new_domain_with_protocol current_domain_with_protocol [current_domain_with_protocol2, ...]");
else:
  updateURLs('blogs', 'text', function () {
    updateURLs('projects', 'content', function () {
      pool.end(function (err) {
        if (err) {
          console.error('Could not end connections from the pool.')
          console.error(err.stack);
        }
      });
    });
  });