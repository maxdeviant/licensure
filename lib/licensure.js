'use strict';

var fs = require('fs');
var path = require('path');
var dir = require('node-dir');
var mkdirp = require('mkdirp');
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

var createCSV = function (licenses, outputDir) {
    var deferred = q.defer();

    if (outputDir !== 'undefined') {
        var destinationDir = outputDir;

        if (!path.isAbsolute(destinationDir)) {
            destinationDir = path.join(process.cwd(), destinationDir);
        }

        fs.exists(destinationDir, function (exists) {
            if (!exists) {
                mkdirp(destinationDir, function (err, made) {
                    if (err) {
                        throw err;
                    }

                    deferred.resolve(doCreate(licenses, destinationDir));
                });
            } else {
                deferred.resolve(doCreate(licenses, destinationDir));
            }
        });
    } else {
        deferred.resolve(doCreate(licenses));
    }

    return deferred.promise;
};

function doCreate(licenses, destinationDir) {
    var csv = [];

    csv[0] = 'Module,Version,License';

    licenses.forEach(function (license) {
        if (destinationDir) {
            var destination = path.join(destinationDir, license.module + '_' + path.basename(license.license_file));

            fs.createReadStream(license.license_file).pipe(fs.createWriteStream(destination));
        }

        csv.push(license.module + ',' + license.version + ',"' + license.license + '"');
    });

    return csv.join('\n');
}

var write = function (file, data, total) {
    fs.writeFile(file, data, function (err) {
        if (err) {
            throw err;
        }

        console.log('Finished processing ' + total + ' licenses.');
        console.log('License information stored in ' + path.basename(file) + '.');
    });
};

cli
    .version('0.0.1', '-v, --version')
    .option('-t, --text', 'Output readable text')
    .option('-c, --csv', 'Output as CSV')
    .option('-l, --license-text', 'Include license file contents')
    .option('-u, --unique', 'Only include unique dependencies')
    .option('-o, --output [dir]', 'Specify output directory')
    .parse(process.argv);

findLicenses(cli.unique, cli.licenseText).then(function (data) {
    var outputFile, outputData;

    var total = data.length;

    if (cli.text) {
        outputFile = path.join(process.cwd(), 'licensure.txt');
        outputData = createReadable(data);

        write(outputFile, outputData, total);
    } else if (cli.csv) {
        outputFile = path.join(process.cwd(), 'licensure.csv');

        createCSV(data, path.normalize(cli.output)).then(function (data) {
            write(outputFile, data, total);
        });
    } else {
        outputFile = path.join(process.cwd(), 'licensure.json');
        outputData = JSON.stringify(data, null, 4);

        write(outputFile, outputData, total);
    }
});
