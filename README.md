# swagger-to-locustfile
A CLI tool that creates [locust.io](http://locust.io) tasks file (locustfile.py) from [Swagger/OpenAPI Spec](https://github.com/OAI/OpenAPI-Specification).

## Requirements
* Node JS (4.0 & up)

## Installation

Best option is:

  1. `$ git clone https://github.com/DataGreed/swagger-to-locustfile.git`
  2. `$ cd swagger-to-locustfile`
  3. `$ npm -g install`
  4. You are good to go.

## Currently Supports
* Grabbing the host field for the spec.
* Generating tasks for GET/POST/PUT/UPDATE/DELETE endpoints.
* Replacing Path-Parameters holders with their default value.
* Appending the required query string parameters and their default values.
* Swagger/OAI vendor extensions (`x-locust-import` and `x-locust-value`) to override default values with custom python expressions.
* Command Line Options allow overriding `min_wait`, `min_max` and `host`

## Future Plans / Open Issues
* Extracting body/params for POST/PUT/DELETE/UPDATE endpoints.
* Support *required* headers

## Usage

__Basically:__

`$ swagger2locust /path/to/swagger.json  > /tmp/locustfile.py`

_Or you can pipe the spec:_


`$ cat /path/to/spec.yaml | swagger2locust`


__Full Usage:__

```
  Usage: swagger2locust [options] <file>

  Options:

    -h, --help         output usage information
    -V, --version      output the version number
    -m, --min <n>      minimum time, in milliseconds, that a simulated user will wait between executing each task (default: 1000).
    -x, --max <n>      maximum time, in milliseconds, that a simulated user will wait between executing each task (default: 3000).
    -H, --host <host>  The host attribute is a URL prefix (i.e. “http://google.com”) to the host that is to be loaded.

```

## Custom Swagger/OAI fields

### x-locust-import

You can add `x-locust-import` to your root node (same level as `host` field) to specify extra imports for your locust file. _This is useful if you need access to an import when you write an expression in `x-locust-value`._

So for the following swagger spec:

<table>
<tr><td>JSON</td><td>YAML</td></tr>
<tr><td><pre>
{
  "swagger" : "2.0",
...
  "host" : "subdomain.domain.tld",
  "x-locust-import" : ["time"],
...
}
</pre></td><td><pre>
swagger: "2.0"
...
host: "subdomain.domain.tld"
x-locust-import: 
  - "time"
...
</pre></td></tr>
</table>
The `locustfile.py` will have the following imports:

```.py
from locust import HttpLocust, TaskSet, task
import time

class MyTaskSet(TaskSet):
...
```

### x-locust-value

`x-locust-value` allows you to write a python expression that replaces the hardcoded
default value of a field. 
Example:

The following spec file

<table>
<tr><td>JSON</td><td>YAML</td></tr>
<tr><td><pre>
...
"paths" : {
  "/required/qs/params-with-x-locust-value" : {
    "get" : {
      "parameters" : [ {
        "name" : "sreq_timestamp_param",
        "in" : "query",
        "description" : "Some timestamp.",
        "required" : true,
        "type" : "number",
        "default" : 1455134652,
        "x-locust-value" : "str(int(time.time()))"
      } ]
    }
  }
}
...
</pre></td><td style="valign:top"><pre>
...
paths: 
  /required/qs/params-with-x-locust-value: 
    get: 
      parameters: - 
        name: "req_timestamp_param"
        in: "query"
        description: "Some timestamp."
        required: true
        type: "number"
        default: 1455134652
        x-locust-value: "str(int(time.time()))"
...




</pre></td></tr></table>

Will result in the following line in `locustfile.py` (__`x-locust-value`
overrrides `default`__): 

```.py
...
@task
    def get_required_qs_params_with_x_locust_value(self):
        self.client.get("/api/v1/required/qs/params-with-x-locust-value?some_required_timestamp_param={0}".format(str(int(time.time()))))
...
```

While omitting `x-locust-value` field will result in the following line:

```.py
...
@task
    def get_required_qs_params_without_x_locust_value(self):
        self.client.get("/api/v1/required/qs/params-with-x-locust-value?some_required_timestamp_param={0}".format("1455134652"))
...
```


## Contribute 
  * fork
  * create a branch on your fork.
  * pull-request to master branch here.
  * win.

### Thanks

- [@DataGreed](https://github.com/DataGreed) (PR #13)
  
## License

### ISC License (ISC)
Copyright (c) 2016, Liel Dulev

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
