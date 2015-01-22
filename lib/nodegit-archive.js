var path = require("path");
var async = require('async');
var archiver = require("archiver");
var RepoOpen = require("nodegit").Repository.open;

var debug = false;
var log = debug ? console.log : function () {};

module.exports = function(repoPath, commit, archiveFormat, prefix) {
  // TODO: Error checking on all the things!
  // TODO: Output debug info only if requested
  // TODO: Make debug output destination configurable

  // Know when we actually finished our work, so we can finalize the
  // archive.
  var filesInQueue = 0;

  var archive = archiver('tar', {
    gzip: true,
    gzipOptions: { level: 1, statConcurrency: 8 }
  });

  var canFinishArchive = false;
  archive.on('entry', function (entry) {
    if (--filesInQueue === 0 && canFinishArchive) {
      archive.finalize();
      log('archiver.entry: Written ' + archive.pointer() + ' content bytes to the archive');
    }
  });

  // Vars for storing info between callbacks
  var repo;
  var tree;
  var index;
  // TODO: Do we need path.resolve()?
  RepoOpen(path.resolve(repoPath))
  .then(function(repository) {
    repo = repository;
    log("Using git repo at " + repo.path());
    return repo.getMasterCommit();
  }).then(function(commit) {
    log('Archiving tree from commit ' + commit);
    return commit.getTree();
  }).then(function (treeish) {
    tree = treeish;
    return repo.openIndex();
  }).then(function (idx) {
    index = idx;
    index.readTree(tree);
  }).then(function (error) {
    // TODO: Report errors on readTree()?
    return repo.odb();
  }).then(function (odb) {
    // TODO: check error
    var n = index.entryCount();
    var i = 0;

    async.whilst(function () { return i < n; },
      function (keepLooping) {
        var entry = index.getByIndex(i++);
        odb.read(entry.id()).then(function (blob) {
          var props = { name: prefix + entry.path() };
          props.mode = entry.mode();
          props.size = entry.fileSize();
          ++filesInQueue;
          archive = archive.append(blob.data().toBuffer(blob.size()), props);
          keepLooping();
        }).done();
      },
      function () {
        canFinishArchive = true;
      });
  }).done();
  return archive
};
