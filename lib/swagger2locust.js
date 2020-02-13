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
  convertFile : function(filename, options, generateClient=false) {
    var contents = fs.readFileSync(filename);
    ext = filename.split('.').pop().toLowerCase();

    this.generateClient = generateClient;

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

    var methodsWithBody = ['post','put','patch','delete'];

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

      //look for methods that may include request body definition
      for (var i in methodsWithBody)
      {
          var methodName = methodsWithBody[i];
          if (swgObj.paths[path][methodName]) {
              locustfile += this.HTTPLocustGenericRequestFromPath(methodName, path, swgObj.paths[path][methodName], swgObj['basePath'], {'parameters':swgObj['parameters']});
          }
      }
    }

    locustfile += this.locustfileFooter(locustOptions);

    return locustfile;
  },

  // Outputs a locustfile header (including class def)
  locustfileHeader : function(options) {
    var header = ""
    header += "from locust import HttpLocust, TaskSet, task\n"
    if (this.generateClient) header += "from locust.clients import HttpSession\n"

    if (options["x-locust-import"]) {
      for (imp in options["x-locust-import"]) {
        header += "import "+options["x-locust-import"][imp]+"\n";
      }
    }
    header += "\n\n";
    if(this.generateClient)
    {
      header += "class MyHttpClient(HttpSession):\n"
    }
    else {
      header += "class MyTaskSet(TaskSet):\n"
    }

    return header;
  },

  // Outputs the locust class and the settings (host, min, max, etc).
  locustfileFooter : function(options) {
    var footer = "\n";

    if(this.generateClient)
    {
      footer += "class MyTaskSet(TaskSet):\n";
      footer += "    pass\n\n\n"
    }

    footer += "class MyLocust(HttpLocust):\n"
    footer += "    task_set = MyTaskSet\n"

    if(this.generateClient)
    {
      //add our custom client
      //see https://docs.locust.io/en/stable/testing-other-systems.html for reference on custom clients
      footer += "\n"
      footer += "    def __init__(self):\n";
      footer += "        super().__init__()\n";
      footer += "        self.client = MyHttpClient(self.host)\n\n";
    }

    for(currOpt in options){
      if (currOpt == "host") {
        footer += "    "+currOpt+' = "'+options[currOpt]+'"'+"\n"
      } else {
        footer += "    "+currOpt+" = "+options[currOpt]+"\n"
      }
    }
    return footer;
  },

  // Creates an HTTP task from swagger path object using specified method name
  HTTPLocustGenericRequestFromPath : function(method, pathName, pathObj, basePath, sharedDefinitions) {
    // TODO: use resolvedPath.paramsDict to get default parameters if generating taskset, not client
    var resolvedPath = this.resolvedPathWithDefaults(pathName, pathObj, sharedDefinitions);
    this.replaceReservedPythonNames(resolvedPath.paramsNames);

    var task = "";

    if(!this.generateClient) task += "    @task\n";

    task += "    def "+this.taskNameFromPath(pathName, method)+"(self"+ (resolvedPath.paramsNames.length > 0 ? ", "+ resolvedPath.paramsNames.join(', ') : "") +", **kwargs):\n";

    //avoid "undefined" in URIs
    if(!basePath) basePath = "";

    //actual request call
    task += '        return self'
    if(!this.generateClient)task+=".client"
    task +='.'+method+'("'+basePath+resolvedPath.path+'"'+(resolvedPath.paramsNames.length > 0 ? ('.format('+resolvedPath.paramsNames.join(',')+')') : '')+', name="'+pathName+'", **kwargs)'+"\n\n";

    return task;
  },


  // Creates an HTTP Get task from swagger path object
  HTTPLocustGetFromPath : function(pathName, pathObj, basePath, sharedDefinitions) {
      //TODO: probably need to eliminate this method in favor of HTTPLocustGenericRequestFromPath
      // TODO: use resolvedPath.paramsDict to get default parameters if generating taskset, not client
      var resolvedPath = this.resolvedPathWithDefaults(pathName, pathObj, sharedDefinitions);
      this.replaceReservedPythonNames(resolvedPath.paramsNames);

      var task = "";

      if(!this.generateClient) task += "    @task\n";

      task += "    def "+this.taskNameFromPath(pathName, 'get')+"(self"+ (resolvedPath.paramsNames.length > 0 ? ", "+ resolvedPath.paramsNames.join(', ') : "") +", **kwargs):\n";

      //avoid "undefined" in URIs
      if(!basePath) basePath = "";

    //actual request call
    task += '        return self'
    if(!this.generateClient)task+=".client"
    task +='.get'+'("'+basePath+resolvedPath.path+'"'+(resolvedPath.paramsNames.length > 0 ? ('.format('+resolvedPath.paramsNames.join(',')+')') : '')+', name="'+pathName+'", **kwargs)'+"\n\n";

      return task;
  },

  // Normalizes paths to py method name (GET /path/to-some/{id} will become get_path_to_some_id)
  taskNameFromPath : function (path, method) {
    let result =  method+path.toString().replace(/[\/-]/g,"_").replace(/[\{}]/g, "")
      //remove trailing underscore if generated
      return result.endsWith("_") ? result.slice(0, -1): result;
  },

  // Replaces Path-Parameters' holders in path with their default values.
  // Example: /path/to/{id} -> /path/to/1 
  resolvedPathWithDefaults : function(pathName, pathObj, sharedDefinitions) {
    var resolvedPath = pathName;
    var requiredParamValues = [];
    var currPlaceholder = 0;
    let paramsDict = {};

    // If path has path params, replace them with their default values
    if (pathName.indexOf("{") != -1) {
      var pathParamsNames = pathName.split("{");
      pathParamsNames = pathParamsNames.slice(1, pathParamsNames.length).map(function(pt){return pt.split("}").shift()});
      for (currParam in pathParamsNames) {
        resolvedPath = resolvedPath.replace('{'+pathParamsNames[currParam]+'}', '{'+currPlaceholder+'}');
        currPlaceholder += 1;
        requiredParamValues.push(this.getParamDefault(pathParamsNames[currParam], pathObj['parameters'], sharedDefinitions['parameters']));
        paramsDict[pathParamsNames[currParam]] = this.getParamDefault(pathParamsNames[currParam], pathObj['parameters'], sharedDefinitions['parameters'], false);
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
        paramsDict[actualParam['name']] = this.getParamDefault(actualParam['name'], pathObj['parameters'], sharedDefinitions['parameters'], false);
      }
    }

    // Add Query String to path
    if (requiredQSParams.length > 0) {
      resolvedPath += "?"+requiredQSParams.join("&")
    }

    return {path: resolvedPath, paramsNames: pathParamsNames ? pathParamsNames : [], paramsValues: requiredParamValues, paramsDict: paramsDict};
  },

  // Finds the default value of parameter by its name.
  getParamDefault : function(paramName, pathParameters, sharedParameters, doubleQuoting=true)  {
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
          if (doubleQuoting) {
            return '"' + pathParam['default'] + '"';
          }
          else
          {
            return pathParam['default'] == undefined ? "None" : pathParam['default'];
          }
        }
      }
    }
    throw new Error("Couldn't find default value of path param "+paramName);
  },

  replaceReservedPythonNames : function (nameArray) {

    let reservedNames= ["id"];

    for (let i = 0; i < nameArray.length; i++) {
      if(reservedNames.includes(nameArray[i]))
      {
        nameArray[i]="object_" + nameArray[i]
      }
    }

  }
};
