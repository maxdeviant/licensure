'use strict';

var fs = require('fs');
var path = require('path');
var dir = require('node-dir');
var q = require('q');

var findLicenses = function () {
    var deferred = q.defer();

    var modulesDir = path.join(process.cwd(), 'node_modules');

    dir.files(modulesDir, function (err, files) {
        var licenses = [];

        files.forEach(function (file) {
            if (/license/gi.test(file)) {
                var currPath = file.split(path.sep);
                var currModule = currPath[currPath.lastIndexOf('node_modules') + 1];

                licenses.push({
                    'module': currModule,
                    'license': file
                });
            }
        });

        deferred.resolve(licenses);
    });

    return deferred.promise;
};

findLicenses().then(function (data) {
    console.log(data);
});
