var fs = require("fs"),
    yaml = require('js-yaml');

module.exports = {

  defaultOptions : {
    'min_wait' : 1000,
    'max_wait' : 000
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
    var actualOptions = options || this.defaultOptions;
    var locustfile = ""

    actualOptions['host'] = 'https://' + swgObj['host']
    locustfile += this.locustfileHeader(options);
    for(path in swgObj.paths) {
      if (swgObj.paths[path]['get']) {
        locustfile += this.HTTPLocustGetFromPath(path, swgObj.paths[path]['get']);
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

  locustfileFooter : function(options) {
    var footer = ""
    footer += "class MyLocust(Locust):\n"
    footer += "    task_set = MyTaskSet\n"
    for(currOpt in options){
      footer += "    "+currOpt+" = "+options[currOpt]+"\n"
    }
    return footer;
  },

  HTTPLocustGetFromPath : function(pathName, pathObj) {
    var task = "";
    task += "    @task\n";
    task += "    def "+this.taskNameFromPath(pathName, 'get')+"(self):\n";
    task += '        self.client.get("'+this.resolvedPathWithDefaults(pathName, pathObj)+'")'+"\n\n";

    return task;
  },

  taskNameFromPath : function (path, method) {
    return method+""+path.toString().replace(/\//g,"_").replace(/[\{}]/g, "")
  },

  resolvedPathWithDefaults : function(pathName, pathObj) {
    // No path params
    if (pathName.indexOf("{") == -1) {
      return pathName;
    } else { // Path has params
      var pathParamsNames = pathName.split("{");
      pathParamsNames = pathParamsNames.slice(1, pathParamsNames.length).map(function(pt){return pt.split("}").shift()});
      var resolvedPath = pathName;
      for (currParam in pathParamsNames) {
        resolvedPath = resolvedPath.replace('{'+pathParamsNames[currParam]+'}', this.getPathParamDefault(pathParamsNames[currParam], pathObj['parameters']));
      }
      return resolvedPath;
    }
  },
  
  getPathParamDefault : function(paramName, pathParameters)  {
    for (currPathParam in pathParameters) {
      if (pathParameters[currPathParam]['name'] == paramName) {
        return pathParameters[currPathParam]['default'];
      }
    }

    throw new Error("Couldn't find default value of path param "+paramName);
  }
}
