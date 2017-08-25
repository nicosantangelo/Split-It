;(function () {
  var DEFAULT_CONFIGURATION = {
    siteMapping   : {}, // On `base` show `iframe` { base: iframe }
    optionsMapping: {}  // On `base` apply `options` { base: options }
  }

  var DEFAULT_OPTION_CONFIGURATION = {
    width    : 40,
    showMenu : true,
    hoverOver: false,
    isVisible: true
  }

  var configuration = {
    DEFAULT: DEFAULT_CONFIGURATION,
    DEFAULT_OPTION: DEFAULT_OPTION_CONFIGURATION,

    forEachDefault: function(callback) {
      for(var prop in DEFAULT_CONFIGURATION) {
        callback(prop, DEFAULT_CONFIGURATION[prop])
      }
    },

    forEachDefaultOption: function(callback) {
      for(var prop in DEFAULT_OPTION_CONFIGURATION) {
        callback(prop, DEFAULT_OPTION_CONFIGURATION[prop])
      }
    },

    get: function(key, callback) {
      if (typeof key === 'function') {
        callback = key
        chrome.storage.sync.get(DEFAULT_CONFIGURATION, callback)
      } else {
        chrome.storage.sync.get(key, function(result) {
          callback(result[key] || DEFAULT_CONFIGURATION[key])
        })
      }
    },

    set: function(values, callback) {
      chrome.storage.sync.set(values, callback)
    },

    onChange: function(callback) {
      chrome.storage.onChanged.addListener(function(changes, namespace) {
        callback(changes)
      })
    },

    forEachCurrent: function(callback) {
      configuration.get(function(config) {
        for(var prop in config) {
          callback(prop, config[prop])
        }
      })
    },

    setMissingDefaultValues: function(obj) {
      var config  = Object.assign({}, DEFAULT_CONFIGURATION, obj)

      for (var option in config.optionsMapping) {
        config.optionsMapping[option] = Object.assign({}, DEFAULT_OPTION_CONFIGURATION, config.optionsMapping[option])
      }

      return config
    }
  }

  window.configuration = configuration
})()
