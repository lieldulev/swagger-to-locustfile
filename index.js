#!/usr/bin/env node

var program = require('commander'),
    chalk = require('chalk'),
    s2l = require('./lib/swagger2locust');

program
  .arguments('<file>')
  //.option('-u, --username <username>', 'The user to authenticate as')
  //.option('-p, --password <password>', 'The user\'s password')
  .action(function(file) {
    if (!s2l.validFile(file)) {
      console.error(chalk.red("Error: File not found or not a valid swagger yaml/json file: "+file));
      console.log(chalk.yellow("Hint: Check that file exsits and extension is either .json or .yaml"));
    } 
    else {
      console.log(s2l.convertFile(file, {}));
    }
  })
  .parse(process.argv);
