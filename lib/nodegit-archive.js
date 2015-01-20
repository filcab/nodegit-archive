var path = require("path");
var archiver = require("archiver");
var RepoOpen = require("nodegit").Repository.open;

module.exports = function(repoPath, commit, archiveFormat, prefix) {
  // TODO: Error checking on all the things!
  // TODO: Output debug info only if requested
  // TODO: Make debug output destination configurable

  // Know when we actually finished our work, so we can finalize the
  // archive.
  var walkerFinished = false;
  var filesInQueue = 0;

  var archive = archiver('tar', {
    gzip: true,
    gzipOptions: { level: 1, statConcurrency: 8 }
  });

  archive.on('entry', function (entry) {
    if (--filesInQueue === 0) {
      // If the walker already finished, we're done. Otherwise, we have to
      // wait for more files or for the walker's end event.
      if (walkerFinished) {
        archive.finalize();
        console.log('archiver.entry: Written ' + archive.pointer() + ' content bytes to the archive');
      }
    }
  });


  // TODO: Do we need path.resolve()?
  RepoOpen(path.resolve(repoPath))
  .then(function(repo) {
      console.log("Using git repo at " + repo.path());
      return repo.getMasterCommit();
    })
  .then(function(commit) {
    console.log('Archiving tree from commit ' + commit);
    return commit.getTree();
  })
  .then(function (tree) {
    var walker = tree.walk(/*blobsOnly*/false);

    walker.on("error", function(e) {
      console.log("walker: error: " + e);
      process.exit(1);
    });
    walker.on("entry", function(entry) {
      if (entry.isTree())
        // Skip trees, for now
        undefined;
      else if (entry.isFile()) {
        ++filesInQueue;

        var props = { name: prefix + entry.path() };
        entry.getBlob()
          .then(function (blob) {
            // FILCAB: This doesn't work…
            //props.mode = blob.filemode() & 0777;
            //props.size = blob.rawsize();
            archive = archive.append(blob.content(), props);
          }).done();
      } else {
        console.log('WTF, entry is neither tree nor file!');
        process.exit(1);
      }

    })

    walker.on('end', function () {
      walkerFinished = true;
      if (filesInQueue === 0) {
        archive.finalize();
        console.log('walker: Written ' + archive.pointer() + ' content bytes to the archive'
          + ' (this information might be wrong for certain archive types)');
      }
    });

    walker.start();
  })
  .done()

  return archive
};
