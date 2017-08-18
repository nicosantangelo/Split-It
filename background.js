/* Globals: configuration */

// -----------------------------------------------------------------------------
// Messages from the front-end

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  switch (request.action) {
    case 'openOptions':
      openOptionsPage()
      break
    case 'changeVisibility':
      configuration.set({ isVisible: request.data.isVisible })
      break
    case 'changeStatus':
      let iconSuffix = request.active ? '' : '-inactive'

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
})


// -----------------------------------------------------------------------------
// Extension icon popup clicked

chrome.browserAction.onClicked.addListener(function(tab) {
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

  chrome.storage.local.set(options, openOptionsPage)
})


// -----------------------------------------------------------------------------
// Intercept Web Requests

configuration.get('siteMapping', function(siteMapping) {
  let baseURLs = Object.keys(siteMapping)
  let hostURLs = getObjectValues(siteMapping)

  let hosts = hostURLs.map(getHostVariations).join(' ')

  chrome.webRequest.onHeadersReceived.addListener(function(details) {
    if (! containsAnyOf(baseURLs, details.url)) return

    let responseHeaders = details.responseHeaders

    for (let i = 0; i < responseHeaders.length; i++) {
      let header = responseHeaders[i]

      if (isCSPHeader(header)) {
        let newCSP = header.value
          .replace('script-src', `script-src ${hosts}`)
          .replace('child-src', `child-src ${hosts}`)
          .replace('style-src', `style-src ${hosts}`)
          .replace('frame-src', `frame-src ${hosts}`)

        header.value = newCSP

      } else if (isFrameHeader(header)) {
        responseHeaders.splice(i, 1) // Removes the header
      }
    }

    return { responseHeaders: responseHeaders }

  }, {
    urls: ['<all_urls>'],
    types: ['main_frame']
  }, ['blocking', 'responseHeaders'])

  chrome.webRequest.onHeadersReceived.addListener(function(details) {
    if (! containsAnyOf(hostURLs, details.url)) return

    let responseHeaders = details.responseHeaders

    for (let i = 0; i < responseHeaders.length; i++) {
      let header = responseHeaders[i]

      if (isCSPHeader(header)) {
        let newCSP = header.value.search('frame-ancestors') !== -1 ? '' : header.value

        header.value = newCSP

      } else if (isFrameHeader(header)) {
        responseHeaders.splice(i, 1) // Remove header
      }
    }

    return { responseHeaders: responseHeaders }

  }, {
    urls: [ '*://*/*' ], // Pattern to match all http(s) pages
    types: [ 'sub_frame' ]
  }, ['blocking', 'responseHeaders'])
})


// -----------------------------------------------------------------------------
// Utils

function openOptionsPage() {
  let optionsId  = chrome.i18n.getMessage("@@extension_id") + '/options.html'
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

function getHostVariations(url) {
  // Takes a full url and tries to generate the different host versions
  // from: "https://reddit.com" to "www.reddit.com reddit.com"
  url = url.replace(/https?:\/\/(www\.)?/, '')

  return `www.${url} ${url}`
}


function containsAnyOf(values, searched) {
  return values.some(function(value) {
    return ~searched.search(value)
  })
}

function getObjectValues(obj) {
  if (! obj) return []

  return Object.keys(obj).map(function(property) { return obj[property] })
}
