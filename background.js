/*eslint strict: ["error", "global"]*/

'use strict'

// Easy access to log functions to be changed on build
let log = console.log.bind(console, '[Split/It]')
let group = console.group.bind(console)
let groupEnd = console.groupEnd.bind(console)

// -----------------------------------------------------------------------------
// Messages from the front-end

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  let iconSuffix = ''

  log(`Got a new ${request.action} message with action`, request)

  switch (request.action) {
    case 'openOptions':
      openOptionsPage()
      break
    case 'updateOption':
      configuration.get(function(config) {
        config.optionsMapping[request.baseURL][request.key] = request.value

        configuration.set({ optionsMapping: config.optionsMapping })
      })

      break
    case 'changeStatus':
      iconSuffix = request.active ? '' : '-inactive'

      chrome.browserAction.setIcon({
        path: {
          19: `icons/19${iconSuffix}.png`,
          38: `icons/38${iconSuffix}.png`
        },
        tabId: sender.tab.id
      })
      break
    default:
      chrome.tabs.sendMessage(sender.tab.id, request, function (response) {})
      break
  }

  return true
})


// -----------------------------------------------------------------------------
// Extension icon popup clicked

chrome.browserAction.onClicked.addListener(function(tab) {
  log('Extension button pressed')
  chrome.tabs.sendMessage(tab.id, { action: 'toggle' }, function() {})
})


// -----------------------------------------------------------------------------
// On installed/updated

chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason !== 'install') return

  let options = {}

  if(details.reason === 'install') {
    options['firstInstall'] = true
  }

  if(details.reason === 'update') {
    options['justUpdated'] = 2
  }

  configuration.set(options, openOptionsPage)
  requestURLs.load()
})


// -----------------------------------------------------------------------------
// Intercept Web Requests

let requestURLs = {
  base: [],
  iframe: [],

  load() {
    configuration.get('siteMapping', this.set.bind(this))
  },
  listenForChanges() {
    configuration.onChange(function(changes) {
      if (! changes.siteMapping) return

      this.set(changes.siteMapping.newValue)
    }.bind(this))
  },
  set: function(mapping) {
    if (isEmptyObject(mapping)) {
      this.reset()
    } else {
      log('Setting new configuration mapping', mapping)

      this.base = Object.keys(mapping).map(getHostname)
      this.iframe = getObjectValues(mapping).map(getHostname)
    }
  },
  containsBase(url) {
    return containsAnyOf(url, this.base)
  },
  containsIframe(url) {
    return containsAnyOf(url, this.iframe)
  },
  getIframeHostVariations: function() {
    return this.iframe.map(getHostVariations).join(' ')
  },
  reset: function() {
    log('Resetting values')

    this.base = []
    this.iframe = []
  },
  isEmpty: function() {
    return this.base.length === 0 || this.iframe.length === 0
  }
}


requestURLs.load()

// Start listening
interceptBaseHeaders()
interceptIframeHeaders()
requestURLs.listenForChanges()


function interceptBaseHeaders() {
  chrome.webRequest.onHeadersReceived.addListener(function(details) {
    if (requestURLs.isEmpty()) return
    if (! requestURLs.containsBase(details.url)) return

    let responseHeaders = details.responseHeaders

    group('baseHeaders')
    log('Mingiling with header', details.url)
    log('Before', responseHeaders)

    for (let i = 0; i < responseHeaders.length; i++) {
      let header = responseHeaders[i]

      if (isCSPHeader(header)) {
        log('Replacing ICP header', header)

        let hosts = requestURLs.getIframeHostVariations()

        let newCSP = header.value
          .replace('script-src', `script-src ${hosts}`)
          .replace('child-src', `child-src ${hosts}`)
          .replace('style-src', `style-src ${hosts}`)
          .replace('frame-src', `frame-src ${hosts}`)

        header.value = newCSP

      } else if (isFrameHeader(header)) {
        log('Removing frame header', header)

        responseHeaders.splice(i, 1) // Removes the header
      }
    }

    log('After', responseHeaders)
    groupEnd('baseHeaders')

    return { responseHeaders: responseHeaders }

  }, {
    urls: ['<all_urls>'],
    types: ['main_frame']
  }, ['blocking', 'responseHeaders'])
}

function interceptIframeHeaders() {
  chrome.webRequest.onHeadersReceived.addListener(function(details) {
    if (requestURLs.isEmpty()) return
    if (! requestURLs.containsIframe(details.url)) return

    let responseHeaders = details.responseHeaders

    group('hostHeaders')
    log('Mingiling with header', details.url)
    log('Before', responseHeaders)

    for (let i = 0; i < responseHeaders.length; i++) {
      let header = responseHeaders[i]

      if (isCSPHeader(header)) {
        log('Replacing ICP header', header)

        let newCSP = header.value.search('frame-ancestors') !== -1 ? '' : header.value

        header.value = newCSP

      } else if (isFrameHeader(header)) {
        log('Removing frame header', header)

        responseHeaders.splice(i, 1) // Remove header
      }
    }

    log('After', responseHeaders)
    groupEnd('hostHeaders')

    return { responseHeaders: responseHeaders }

  }, {
    urls: [ '*://*/*' ], // Pattern to match all http(s) pages
    types: [ 'sub_frame' ]
  }, ['blocking', 'responseHeaders'])
}


// -----------------------------------------------------------------------------
// Utils

function openOptionsPage() {
  let optionsId  = chrome.i18n.getMessage('@@extension_id') + '/options.html'
  let optionsURL = chrome.extension.getURL('options/options.html')

  chrome.tabs.getAllInWindow(null, function (tabs) {
    // If the options page is already open, focus on it
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i]

      if (tab.url && tab.url.indexOf(optionsId) !== -1) {
        chrome.tabs.update(tab.id, { selected: true })
        return
      }
    }

    // Otherwise, open it in a new tab
    chrome.tabs.create({ url: optionsURL })
  })
}


function isCSPHeader(header) {
  return /content-security-policy/.test(header.name.toLowerCase())
}

function isFrameHeader(header) {
  let headerName = header.name.toLowerCase()
  return headerName == 'x-frame-options' || headerName == 'frame-options'
}

function getHostVariations(hostname) {
  // Takes a hostname and tries to generate the different host versions
  // from: "reddit.com" to "www.reddit.com reddit.com"
  return `www.${hostname} ${hostname}`
}

function getHostname(url) {
  return url
    .replace(/https?:\/\/(www\.)?/, '') // remove protocol
    .replace(/\/$/, '')                 // remove trailing slash
}

function containsAnyOf(baseStr, searchTerms) {
  return searchTerms.some(function(searched) {
    return baseStr.search(searched) !== -1
  })
}

function getObjectValues(obj) {
  if (! obj) return []

  return Object.keys(obj).map(function(property) { return obj[property] })
}

function isEmptyObject(obj) {
  return ! obj || Object.keys(obj).length === 0
}

