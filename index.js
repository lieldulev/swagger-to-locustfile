#!/usr/bin/env node

var program = require('commander'),
    chalk = require('chalk'),
    package = require('./package.json'),
    s2l = require('./lib/swagger2locust'),
    getArgs = require('cli-pipe');

program
  .description("swagger2locust is a CLI tool that creates locust.io config tasks file from swagger specification.\n\n  Website: https://github.com/lieldulev/swagger-to-locustfile\n\n  Copyright: (C) 2016 Liel Dulev")
  .version(package['version'])
  .usage('[options] <file>')
  .arguments('<file>')
  .option('-m, --min <n>', 'minimum time, in milliseconds, that a simulated user will wait between executing each task (default: 1000).', parseInt)
  .option('-x, --max <n>', 'maximum time, in milliseconds, that a simulated user will wait between executing each task (default: 3000).', parseInt)
  .option('-H, --host <host>', 'The host attribute is a URL prefix (i.e. “http://google.com”) to the host that is to be loaded.')
  .action(function(file, options) {

    cmdValue = 'convert';
    
    var actualOptions = s2l.defaultOptions;
    if (options.host) { actualOptions['host'] = options.host}
    if (options.min) { actualOptions['min_wait'] = options.min}
    if (options.max) { actualOptions['max_wait'] = options.max}

    if (file.indexOf('{') == 0) { // piped in JSON string
      console.log(s2l.convertJSON(file, actualOptions));
    } else if (file.indexOf('swagger:') == 0) { // piped in yaml string
      console.log(s2l.convertYAML(file, actualOptions));
    } else if (!s2l.validFile(file)) { // bad file
      console.error(chalk.red("Error: File not found or not a valid swagger yaml/json file: "+file));
      console.log(chalk.yellow("Hint: Check that file exsits and extension is either .json or .yaml"));
    } else { // good file
      console.log(s2l.convertFile(file, actualOptions));
    }
  });


if(process.stdin.isTTY) {
  if (process.argv.length < 3) {
    showHelp();
  } else {
    program.parse(process.argv);
  }
}
else {
  getArgs(function(argsAndPipe){
    if (argsAndPipe.length < 3) {
      showHelp();
    } else {
      program.parse(argsAndPipe);
    }
  });
}

// Catch missing actions
function showHelp(){
   console.log(chalk.yellow("\n  Error: Missing swagger specifications input file."));
   program.outputHelp();
   process.exit(1);
}
