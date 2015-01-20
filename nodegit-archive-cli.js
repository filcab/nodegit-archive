#!/usr/bin/env node
var fs = require('fs');
var gitArchive = require('./lib/nodegit-archive');

var bailed = false;
var startTime = process.hrtime();
process.on('exit', function(code) {
    var timeDiff = process.hrtime(startTime);
    if (code === 0 && !bailed)
        console.log('Archive created in around ' + timeDiff[0] + ' seconds');
});

var argv = process.argv;

function usage(code) {
    console.log('Archives the master brach of the repo pointed to\n');
    console.log('Call with arguments: repository-path archive-path');
    console.log('Command line arguments:');
    console.log('  -h|-help|--help:   Print this message');
    process.exit(code); // undefined should be converted to 0
}

// TODO: Improve usage message!
if (argv.lastIndexOf('-h') !== -1 || argv.lastIndexOf('-help') !== -1 ||
    argv.lastIndexOf('--help') !== -1) {
    bailed = true;
    usage();
}

// TODO: Properly parse arguments
var repo = argv[2];
var outputPath = argv[3];
if (typeof repo === "undefined" || typeof outputPath === "undefined") {
    console.log('Error: Must pass two arguments: repository path and archive path\n');
    usage(1);
}

// TODO: Check error paths (non-existance of repo or outputPath directory)
console.log('Archiving from repo ' + repo);
console.log('Archiving into file ' + outputPath);

// TODO: Allow users to pass options to createWriteStream
// (mostly the mode to create the file)
var output = fs.createWriteStream(outputPath);
gitArchive(repo, 'master', 'tar', '').pipe(output);
