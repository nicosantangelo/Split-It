;(function () {
  var DEFAULT_CONFIGURATION = {
    siteMapping   : {}, // On `base` show `iframe` { base: iframe }
    iframeWidth   : 25,
    isVisible     : true
  }

  var configuration = {
    DEFAULT: DEFAULT_CONFIGURATION,

    forEachDefault: function(callback) {
      for(var prop in DEFAULT_CONFIGURATION) {
        callback(prop, DEFAULT_CONFIGURATION[prop])
      }
    },

    get: function(key, callback) {
      if (typeof key === 'function') {
        callback = key
        chrome.storage.sync.get(DEFAULT_CONFIGURATION, callback)
      } else {
        chrome.storage.sync.get(key, function(result) {
          callback(result[key])
        })
      }
    },

    set: function(values, callback) {
      chrome.storage.sync.set(values, callback)
    },

    onChanged: function(callback) {
      chrome.storage.onChanged.addListener(function(changes, namespace) {
        callback(changes)
      })
    },

    forEachCurrent: function(callback) {
      configuration.get(function (config) {
        for(var prop in config) {
          callback(prop, config[prop])
        }
      })
    }
  }

  window.configuration = configuration
})()
