/* Globals: configuration */

// -----------------------------------------------------------------------------
// Messages from the front-end

chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
  switch(request.action) {
    case 'openOptions':
      openOptionsPage()
      break
    case 'changeVisibility':
      configuration.set({ isVisible: request.data.isVisible })
      break
    default:
      break
  }
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

// TODO: Update on options save
configuration.get('sitePage', function(sitePage) {
  let hosts = getHostVariations(sitePage)

  chrome.webRequest.onHeadersReceived.addListener(function(details) {
    let responseHeaders = details.responseHeaders

    for (let i = 0; i < responseHeaders.length; i++) {
      let header = responseHeaders[i]
      let isCSPHeader = /content-security-policy/i.test(header.name)

      if (isCSPHeader) {
        let newCSP = header.value
          .replace('script-src', `script-src ${hosts}`)
          .replace('child-src', `child-src ${hosts}`)
          .replace('style-src', `style-src ${hosts}`)
          .replace('frame-src', `frame-src ${hosts}`)

        header.value = newCSP
      } else if (isFrameHeader(header)) {
        responseHeaders.splice(i, 1) // Remove header
      }
    }

    return { responseHeaders: responseHeaders }

  }, {
    urls: ['<all_urls>'],
    types: ['main_frame']
  }, ['blocking', 'responseHeaders'])
})


chrome.webRequest.onHeadersReceived.addListener(function(info) {
 let responseHeaders = info.responseHeaders

  for (let i = 0; i < responseHeaders.length; i++) {
    let header = responseHeaders[i]

    if (isFrameHeader(header)) {
      responseHeaders.splice(i, 1) // Remove header
    }
  }

  return { responseHeaders: responseHeaders }

}, {
  urls: [ '*://*/*' ], // Pattern to match all http(s) pages
  types: [ 'sub_frame' ]
}, ['blocking', 'responseHeaders'])


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
