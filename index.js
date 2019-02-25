var wd = require('wd');
var urlparse = require('url').parse;
var urlformat = require('url').format;

var WebDriverInstance = function (baseBrowserDecorator, args, logger) {
  var log = logger.create('WebDriver');

  var config = args.config || {
    hostname: '127.0.0.1',
    port: 4444
  };
  var self = this;

  // Intialize with default values
  var spec = {
    platform: 'ANY',
    testName: 'Karma test',
    tags: [],
    version: ''
  };

  Object.keys(args).forEach(function (key) {
    var value = args[key];
    switch (key) {
    case 'browserName':
      break;
    case 'platform':
      break;
    case 'testName':
      break;
    case 'tags':
      break;
    case 'version':
      break;
    case 'config':
      // ignore
      return;
    }
    spec[key] = value;
  });

  if (!spec.browserName) {
    throw new Error('browserName is required!');
  }

  baseBrowserDecorator(this);

  this.name = spec.browserName + ' via Remote WebDriver';

  // Handle x-ua-compatible option same as karma-ie-launcher(copy&paste):
  //
  // Usage :
  //   customLaunchers: {
  //     IE9: {
  //       base: 'WebDriver',
  //       config: webdriverConfig,
  //       browserName: 'internet explorer',
  //       'x-ua-compatible': 'IE=EmulateIE9'
  //     }
  //   }
  //
  // This is done by passing the option on the url, in response the Karma server will
  // set the following meta in the page.
  //   <meta http-equiv="X-UA-Compatible" content="[VALUE]"/>
  function handleXUaCompatible(args, urlObj) {
    if (args['x-ua-compatible']) {
      urlObj.query['x-ua-compatible'] = args['x-ua-compatible'];
    }
  }

  this._start = function (url) {
    var urlObj = urlparse(url, true);

    handleXUaCompatible(spec, urlObj);

    delete urlObj.search; //url.format does not want search attribute
    url = urlformat(urlObj);

    log.debug('WebDriver config: ' + JSON.stringify(config));
    log.debug('Browser capabilities: ' + JSON.stringify(spec));

    self.driver = wd.remote(config, 'promiseChain');
    WDIO_BROWSER = null;
    self.browser = self.driver.init(spec, function (err, sessionID, capabilities) {
      if (err) {
        log.info('Driver error: ' + err);
      } else {
        log.debug('Driver inited with session ' + sessionID + ' and ' + capabilities + ' capabilities');
        WDIO_BROWSER = self.browser;
      }
    });

    self.driver.on('status', function(info) {
      log.debug('Driver status: ' + info);
    });
    self.driver.on('command', function(eventType, command, response) {
      log.debug('Driver command: ' + eventType + ' ' + command + ' ' + (response || ''));
    });
    self.driver.on('http', function(meth, path, data) {
      log.debug('Driver HTTP: ' + meth + ' ' + path + ' ' + (data || ''));
    });

    var interval = args.pseudoActivityInterval && setInterval(function() {
      log.debug('Imitate activity');
      self.browser.title();
    }, args.pseudoActivityInterval);

    self.browser
        .get(url)
        .done();

    self._process = {
      kill: function() {
        WDIO_BROWSER = null;
        interval && clearInterval(interval);
        self.driver.quit(function() {
          log.info('Killed ' + spec.testName + '.');
          self._onProcessExit(self.error ? -1 : 0, self.error);
        });
      }
    };
  };

  // We can't really force browser to quit so just avoid warning about SIGKILL
  this._onKillTimeout = function(){};
};

WebDriverInstance.prototype = {
  name: 'WebDriver',

  DEFAULT_CMD: {
    linux: require('wd').path,
    darwin: require('wd').path,
    win32: require('wd').path
  },
  ENV_CMD: 'WEBDRIVER_BIN'
};

WebDriverInstance.$inject = ['baseBrowserDecorator', 'args', 'logger'];


//////////////////
var path = require('path');
var pattern = function(file) {
    return {pattern: file, included: true, served: true, watched: false};
};
function WebDriverBind (config, logger) {
    var log = logger.create('WebDriverBind');
    const adapterPath = path.join(__dirname, 'lib.js');
    log.debug('append adapter path ' + adapterPath);
    config.files.unshift(pattern(adapterPath));
    config.middleware = config.middleware || []
    config.middleware.push('WebDriverMiddleware');
    log.debug('append middleware WebDriverMiddleware');
}
WebDriverBind.$inject = ['config', 'logger'];

var json = require('body-parser').json();

var WDIO_BROWSER = null;

function WebDriverMiddleware (logger) {
    var log = logger.create('WebDriverMiddleware');
    var previousResult = null;

    return function ActualWebDriverMiddleware (request, response, next) {
        if (/\/\$wdRPC\$/.test(request.normalizedUrl)) {
            if (!WDIO_BROWSER) {
                log.error('WDIO RPC: NO WDIO_BROWSER BROWSER');
                next(new ReferenceError('WDIO RPC: NO WDIO_BROWSER BROWSER'));
                return;
            }
            json(request, response, function () {
                var data = request.body;
                // { method: STR, args: ARR }
                var method = data.method;
                var args;
                try {
                    args = JSON.parse(data.args);
                } catch (e) {
                    log.error('WDIO RPC: Error due parsing args: ' + data.args);
                    next(e);
                    return;
                }
                if (!Array.isArray(args)) {
                    args = [args];
                }
                args = args.map(function (arg) {
                    return arg === '$INDEX_PREV$' ? previousResult : arg;
                });
                if (method in WDIO_BROWSER) {
                    const argsWithCallback = [].concat(args).concat(function (err, operationResponse) {
                        previousResult = operationResponse;
                        log.debug(`WD RPC CALL ${method} WITH GOT ERR ${err} AND RESULT ${operationResponse} DONE`);
                        if (err) {
                            next(err);
                            return;
                        }
                        var result;
                        try {
                            result = JSON.stringify({ result: operationResponse });
                        } catch (e) {
                            result = JSON.stringify({ result: '[ native value ]' });
                        }
                        response.end(result);
                    });
                    log.debug(`WD RPC CALL ${method} WITH ${args} WAIT FOR RESULT`);
                    WDIO_BROWSER[method].apply(WDIO_BROWSER, argsWithCallback);
                } else {
                    next(new ReferenceError('WDIO RPC: NO METHOD  => ' + method));
                }
            });
        } else {
            next();
        }
    };
}
WebDriverMiddleware.$inject = ['logger'];

// PUBLISH DI MODULE
module.exports = {
  'launcher:WebDriver': ['type', WebDriverInstance],
  'framework:WebDriverBind': ['factory', WebDriverBind],
  'middleware:WebDriverMiddleware': ['factory', WebDriverMiddleware],
};
