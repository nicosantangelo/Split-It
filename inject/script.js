;(function() {
  'use strict'

  // This script runs inside the injected iframe
  if (window.name !== 'splitit') return

  $('html')
    .mousemove(function(event) {
      chrome.extension.sendMessage({
        action: 'mousemove',
        data: { pageX: event.pageX, pageY: event.pageY }
      }, identity)
    })
    .mouseup(function(event) {
      chrome.extension.sendMessage({ action:'mouseup' }, identity)
    })

  // Try to bypass the tendency of some sites to detect frames
  $('.external.authentication').attr('target', '_blank')
  $('body').attr('id', 'extension-base')

  function identity(x) { return x }
})()
