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
    return this.convertSpec(yaml.safeLoad(contents), options);
  },

  // Convert a swagger JSON Object
  convertSpec : function(swgObj, options) {
    var locustfile = ""

    var locustOptions = JSON.parse(JSON.stringify(options));
    var pythonOptions = {};

    if (!locustOptions['host'] && swgObj['host']) {
      locustOptions['host'] = 'https://' + swgObj['host'];
    }

    if (swgObj['x-locust-import']) {
      pythonOptions['x-locust-import'] = swgObj['x-locust-import'];
    }

    locustfile += this.locustfileHeader(pythonOptions);

    for(path in swgObj.paths) {
      if (swgObj.paths[path]['get']) {
        locustfile += this.HTTPLocustGetFromPath(path, swgObj.paths[path]['get'], swgObj['basePath'], {'parameters':swgObj['parameters']});
      }
      else if (swgObj.paths[path]['post']) {
          locustfile += this.HTTPLocustPostFromPath(path, swgObj.paths[path]['post'], swgObj['basePath'], {'parameters':swgObj['parameters']});
      }
    }

    locustfile += this.locustfileFooter(locustOptions);

    return locustfile;
  },

  // Outputs a locustfile header (including class def)
  locustfileHeader : function(options) {
    var header = ""
    header += "from locust import HttpLocust, TaskSet, task\n"
    if (options["x-locust-import"]) {
      for (imp in options["x-locust-import"]) {
        header += "import "+options["x-locust-import"][imp]+"\n";
      }
    }
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
  HTTPLocustGetFromPath : function(pathName, pathObj, basePath, sharedDefinitions) {
    var task = "";
    task += "    @task\n";
    task += "    def "+this.taskNameFromPath(pathName, 'get')+"(self):\n";
    var resolvedPath = this.resolvedPathWithDefaults(pathName, pathObj, sharedDefinitions);
    //avoid "undefined" in URIs
    if(!basePath) basePath = "";
    task += '        self.client.get("'+basePath+resolvedPath.path+'"'+(resolvedPath.paramsValues.length > 0 ? ('.format('+resolvedPath.paramsValues.join(',')+')') : '')+', name="'+pathName+'")'+"\n\n";

    return task;
  },


  // Creates an HTTP Post task from swagger path object
  HTTPLocustPostFromPath : function(pathName, pathObj, basePath, sharedDefinitions) {
      var task = "";
      task += "    @task\n";
      task += "    def "+this.taskNameFromPath(pathName, 'post')+"(self):\n";
      var resolvedPath = this.resolvedPathWithDefaults(pathName, pathObj, sharedDefinitions);
      //avoid "undefined" in URIs
      if(!basePath) basePath = "";
      task += '        self.client.post("'+basePath+resolvedPath.path+'"'+(resolvedPath.paramsValues.length > 0 ? ('.format('+resolvedPath.paramsValues.join(',')+')') : '')+', name="'+pathName+'")'+"\n\n";

      return task;
  },

  // Normalizes paths to py method name (GET /path/to-some/{id} will become get_path_to_some_id)
  taskNameFromPath : function (path, method) {
    return method+path.toString().replace(/[\/-]/g,"_").replace(/[\{}]/g, "")
  },

  // Replaces Path-Parameters' holders in path with their default values.
  // Example: /path/to/{id} -> /path/to/1 
  resolvedPathWithDefaults : function(pathName, pathObj, sharedDefinitions) {
    var resolvedPath = pathName;
    var requiredParamValues = [];
    var currPlaceholder = 0;

    // If path has path params, replace them with their default values
    if (pathName.indexOf("{") != -1) {
      var pathParamsNames = pathName.split("{");
      pathParamsNames = pathParamsNames.slice(1, pathParamsNames.length).map(function(pt){return pt.split("}").shift()});
      for (currParam in pathParamsNames) {
        resolvedPath = resolvedPath.replace('{'+pathParamsNames[currParam]+'}', '{'+currPlaceholder+'}');
        currPlaceholder += 1;
        requiredParamValues.push(this.getParamDefault(pathParamsNames[currParam], pathObj['parameters'], sharedDefinitions['parameters']));
      }
    }

    // Collect required Query String Parameters (and their defaults)
    var requiredQSParams = [];
    for (currPathParam in pathObj['parameters']){
      var actualParam = pathObj['parameters'][currPathParam];

      // If ref, get the actual param definition
      if (actualParam['$ref']) {
        var paramId = actualParam['$ref'].split('/').pop();
        actualParam = sharedDefinitions['parameters'][paramId];
      }

      // If required, collect
      if (actualParam['in'] == 'query' && actualParam['required']) {
        requiredQSParams.push(actualParam['name']+'={'+currPlaceholder+'}');
        currPlaceholder += 1;
        requiredParamValues.push(this.getParamDefault(actualParam['name'], pathObj['parameters'], sharedDefinitions['parameters']));
      }
    }

    // Add Query String to path
    if (requiredQSParams.length > 0) {
      resolvedPath += "?"+requiredQSParams.join("&")
    }

    return {path: resolvedPath, paramsValues: requiredParamValues}; 
  },

  // Finds the default value of parameter by its name.
  getParamDefault : function(paramName, pathParameters, sharedParameters)  {
    for (currPathParam in pathParameters) {

      var pathParam = pathParameters[currPathParam];

      if (pathParam['$ref']) {
        var paramId = pathParam['$ref'].split('/').pop();
        pathParam = sharedParameters[paramId];
      }

      if (pathParam['name'] == paramName) {
        if (pathParam['x-locust-value']) {
          return pathParam['x-locust-value'];
        } else {
          return '"'+pathParam['default']+'"';
        }
      }
    }
    throw new Error("Couldn't find default value of path param "+paramName);
  }
}
