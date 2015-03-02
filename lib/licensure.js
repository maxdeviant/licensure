'use strict';

var fs = require('fs');
var path = require('path');
var dir = require('node-dir');
var q = require('q');
var cli = require('commander');

var getLicenseType = function (info) {
    if (info.licenses) {
        if (typeof info.licenses[0] === 'object') {
            return info.licenses[0].type;
        }

        return info.licenses[0];
    }

    if (info.license) {
        if (typeof info.license === 'object') {
            return info.license.type;
        }

        return info.license;
    }

    return '';
};

var inferFromLicense = function (licenseText) {
    var lines = licenseText.split('\n');

    if (/MIT/g.test(lines[0])) {
        return 'MIT';
    }

    if (/Apache/gi.test(lines[0])) {
        return 'Apache, v2';
    }

    if (/BSD/g.test(lines[0])) {
        return 'BSD';
    }

    if (/Permission is hereby granted, free of charge,/g.test(licenseText)) {
        return 'MIT';
    }

    if (/Redistribution and use in source and binary forms,/g.test(licenseText)) {
        return 'BSD';
    }

    return 'UNKNOWN';
};

var findLicenses = function (uniqueOnly, includeLicenseText) {
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

                if (uniqueOnly) {
                    var isUnique = licenses.filter(function (license) {
                        return license.module === currModule && license.version === moduleInfo.version;
                    }).length === 0;

                    if (!isUnique) {
                        return;
                    }
                }

                licenses.push({
                    'module': currModule,
                    'version': moduleInfo.version,
                    'license': getLicenseType(moduleInfo) || inferFromLicense(licenseText),
                    'license_file': file,
                    'content': includeLicenseText ? licenseText : ''
                });
            }
        });

        deferred.resolve(licenses);
    });

    return deferred.promise;
};

var createReadable = function (licenses) {
    var text = '';

    text += 'Total Licenses: ' + licenses.length + '\n';
    text += '=========================' + '\n\n';

    licenses.forEach(function (license) {
        text += 'Module: ' + license.module + '\n';
        text += 'Version: ' + license.version + '\n';
        text += 'License: ' + license.license + '\n';

        if (license.content !== '') {
            text += 'License Text:\n' + license.content + '\n';
        }

        text += '\n';
    });

    return text;
};

cli
    .version('0.0.1', '-v, --version')
    .option('-t, --text', 'Output readable text')
    .option('-l, --license-text', 'Include license file contents')
    .option('-u, --unique', 'Only include unique dependencies')
    .parse(process.argv);

if (cli.text) {
    findLicenses(cli.unique, cli.licenseText).then(function (data) {
        fs.writeFile(path.join(process.cwd(), 'licensure.txt'), createReadable(data), function (err) {
            if (err) {
                throw err;
            }

            console.log('Finished processing ' + data.length + ' licenses.');
            console.log('License information store in licensure.txt.');
        });
    });
} else {
    findLicenses(cli.unique, cli.licenseText).then(function (data) {
        fs.writeFile(path.join(process.cwd(), 'licensure.json'), JSON.stringify(data, null, 4), function (err) {
            if (err) {
                throw err;
            }

            console.log('Finished processing ' + data.length + ' licenses.');
            console.log('License information stored in licensure.json.');
        });
    });
}
