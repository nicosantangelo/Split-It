;(function() {
  'use strict'

  // This script runs inside the injected iframe
  if (window.name !== 'splitit') return

  var html = document.documentElement

  var script = document.createElement('script')
  script.innerHTML = 'window.parent = window;'
  html.appendChild(script)

  html.addEventListener('mousemove', function(event) {
    chrome.extension.sendMessage({
      action: 'mousemove',
      data: { pageX: event.pageX, pageY: event.pageY }
    }, function() {})
  }, false)

  html.addEventListener('mouseup', function(event) {
    chrome.extension.sendMessage({ action:'mouseup' }, function() {})
  }, false)

  // Try to bypass the tendency of some sites to detect frames
  var externalAuth = document.querySelector('.external.authentication')
  if (externalAuth) externalAuth.target = '_blank'
})()
