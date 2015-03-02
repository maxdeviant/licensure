'use strict';

var fs = require('fs');
var path = require('path');
var dir = require('node-dir');
var q = require('q');

var getLicenseType = function (info) {
    if (info.licenses) {
        return info.licenses[0];
    }

    if (info.license) {
        return info.license;
    }

    return '';
};

var findLicenses = function () {
    var deferred = q.defer();

    var modulesDir = path.join(process.cwd(), 'node_modules');

    dir.files(modulesDir, function (err, files) {
        var licenses = [];

        files.forEach(function (file) {
            if (/license/gi.test(file)) {
                var currPath = file.split(path.sep);
                var currModule = currPath[currPath.lastIndexOf('node_modules') + 1];

                var moduleInfo = {};

                try {
                    moduleInfo = require(path.join(path.dirname(file), 'package.json'));
                } catch (e) {
                    console.log('No package.json found for ' + currModule + '.');
                }

                var licenseText = fs.readFileSync(file, 'utf8');

                licenses.push({
                    'module': currModule,
                    'license': getLicenseType(moduleInfo),
                    'license_file': file,
                    'content': licenseText
                });
            }
        });

        deferred.resolve(licenses);
    });

    return deferred.promise;
};

findLicenses().then(function (data) {
    fs.writeFile(path.join(process.cwd(), 'licensure.json'), JSON.stringify(data, null, 4), function (err) {
        if (err) {
            throw err;
        }

        console.log('License information stored in licensure.json.');
    });
});
