var fs = require("fs"),
    chalk = require('chalk'),
    yaml = require('js-yaml');

module.exports = {

  defaultOptions : {
    'min_wait' : 1000,
    'max_wait' : 3000
  },

  // Validates input file is a swagger spec
  validFile : function(filename) {
    try {
      // Exists?
      stats = fs.lstatSync(filename);
      // Extension is .yaml or .json ?
      return (['yaml','json'].indexOf(filename.split('.').pop().toLowerCase()) != -1);
    } catch (e) {
      return false;
    }
  },

  // Convert a file
  convertFile : function(filename, options) {
    var contents = fs.readFileSync(filename);
    ext = filename.split('.').pop().toLowerCase();
    if (ext == "yaml") {
      return this.convertYAML(contents, options);
    } else {
      return this.convertJSON(contents, options);
    }
  },

  // Convert a JSON string
  convertJSON : function(contents, options) {
    return this.convertSpec(JSON.parse(contents), options);

  },

  // Convert a YAML string
  convertYAML : function(contents, options) {
    console.info(chalk.yellow("\nWarning: Currently $ref is not supported when using the YAML version and it imght results in bugs.\n"));
    return this.convertSpec(yaml.safeLoad(contents), options);
  },

  // Convert a swagger JSON Object
  convertSpec : function(swgObj, options) {
    var actualOptions = options;
    var locustfile = ""

    if (!actualOptions['host'] && swgObj['host']) { actualOptions['host'] = 'https://' + swgObj['host']}
    locustfile += this.locustfileHeader(options);
    for(path in swgObj.paths) {
      if (swgObj.paths[path]['get']) {
        locustfile += this.HTTPLocustGetFromPath(path, swgObj.paths[path]['get'], swgObj['basePath']);
      }
    }
    locustfile += this.locustfileFooter(options);

    return locustfile;
  },

  // Outputs a locustfile header (including class def)
  locustfileHeader : function(options) {
    var header = ""
    header += "from locust import HttpLocust, TaskSet, task\n"
    header += "\n"
    header += "class MyTaskSet(TaskSet):\n"

    return header;
  },

  // Outputs the locust class and the settings (host, min, max, etc).
  locustfileFooter : function(options) {
    var footer = ""
    footer += "class MyLocust(HttpLocust):\n"
    footer += "    task_set = MyTaskSet\n"
    for(currOpt in options){
      if (currOpt == "host") {
        footer += "    "+currOpt+' = "'+options[currOpt]+'"'+"\n"
      } else {
        footer += "    "+currOpt+" = "+options[currOpt]+"\n"
      }
    }
    return footer;
  },

  // Creates an HTTP Get task from swagger path object
  HTTPLocustGetFromPath : function(pathName, pathObj, basePath) {
    var task = "";
    task += "    @task\n";
    task += "    def "+this.taskNameFromPath(pathName, 'get')+"(self):\n";
    task += '        self.client.get("'+basePath+this.resolvedPathWithDefaults(pathName, pathObj)+'")'+"\n\n";

    return task;
  },

  // Normalizes paths to py method name (GET /path/to/{id} will become get_path_to_id)
  taskNameFromPath : function (path, method) {
    return method+path.toString().replace(/\//g,"_").replace(/[\{}]/g, "")
  },

  // Replaces Path-Parameters' holders in path with their default values.
  // Example: /path/to/{id} -> /path/to/1 
  resolvedPathWithDefaults : function(pathName, pathObj) {
    var resolvedPath = pathName;

    // If path has path params, replace them with their default values
    if (pathName.indexOf("{") != -1) {
      var pathParamsNames = pathName.split("{");
      pathParamsNames = pathParamsNames.slice(1, pathParamsNames.length).map(function(pt){return pt.split("}").shift()});
      for (currParam in pathParamsNames) {
        resolvedPath = resolvedPath.replace('{'+pathParamsNames[currParam]+'}', this.getParamDefault(pathParamsNames[currParam], pathObj['parameters']));
      }
    }

    // Collect required Query String Parameters (and their defaults)
    var requiredQSParams = [];
    for (currPathParam in pathObj['parameters']){
      if (pathObj['parameters'][currPathParam]['in'] == 'query' && pathObj['parameters'][currPathParam]['required']) {
        requiredQSParams.push(pathObj['parameters'][currPathParam]['name']+'='+pathObj['parameters'][currPathParam]['default']);
      }
    }

    // Add Query String to path
    if (requiredQSParams.length > 0) {
      resolvedPath += "?"+requiredQSParams.join("&")
    }

    return resolvedPath; 
  },

  // Finds the default value of parameter by its name.
  getParamDefault : function(paramName, pathParameters)  {
    for (currPathParam in pathParameters) {
      if (pathParameters[currPathParam]['name'] == paramName) {
        return pathParameters[currPathParam]['default'];
      }
    }

    throw new Error("Couldn't find default value of path param "+paramName);
  }
}
