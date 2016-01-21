#!/usr/bin/env node

var program = require('commander'),
    chalk = require('chalk'),
    package = require('./package.json'),
    s2l = require('./lib/swagger2locust');

program
  .description("swagger2locust is a CLI tool that creates locust.io config tasks file from swagger specification.\n\n  Website: https://github.com/lieldulev/swagger-to-locustfile\n\n  Copyright: (C) 2016 Liel Dulev")
  .version(package['version'])
  .usage('[options] <file>')
  .arguments('<file>')
  .option('-m, --min <n>', 'minimum time, in milliseconds, that a simulated user will wait between executing each task (default: 1000).', parseInt)
  .option('-x, --max <n>', 'maximum time, in milliseconds, that a simulated user will wait between executing each task (default: 3000).', parseInt)
  .option('-H, --host <host>', 'The host attribute is a URL prefix (i.e. “http://google.com”) to the host that is to be loaded.')
  .action(function(file, options) {
    cmdValue = file;
    if (!s2l.validFile(file)) {
      console.error(chalk.red("Error: File not found or not a valid swagger yaml/json file: "+file));
      console.log(chalk.yellow("Hint: Check that file exsits and extension is either .json or .yaml"));
    } 
    else {

      var actualOptions = s2l.defaultOptions;
      if (options.host) { actualOptions['host'] = options.host}
      if (options.min) { actualOptions['min_wait'] = options.min}
      if (options.max) { actualOptions['max_wait'] = options.max}

      console.log(s2l.convertFile(file, actualOptions));
    }
  })
  .parse(process.argv);

// Catch missing actions
if (typeof cmdValue === 'undefined') {
   console.log(chalk.yellow("\n  Error: Missing swagger specifications input file."));
   program.outputHelp();
   process.exit(1);
}
