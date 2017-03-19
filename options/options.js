/* Globals: configuration */

;(function() {
  'use strict'

  let saveTimeout = null
  let elements = {}

  let notice = document.getElementById('notice')

  configuration.forEachDefault(function(key, value) {
    elements[key] = document.getElementById(key)
  })

  // -----------------------------------------------------------------------------
  // Events

  document.getElementById('save').addEventListener('click', function save() {
    let newValues = {}

    configuration.forEachDefault(function(key, value) {
      if(elements[key]) {
        newValues[key] = elements[key].checked
      }
    })

    configuration.set(newValues, function() {
      notice.classList.remove('hidden')
      window.scrollTo(0, document.body.scrollHeight)
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(function() { notice.classList.add('hidden') }, 4000)
    })
  }, false)


  let closeButtons = document.getElementsByClassName('close-notice')
  Array.prototype.forEach.call(closeButtons, function(closeButton) {
    closeButton.addEventListener('click', function() {
      closeButton.parentElement.classList.add('hidden')
    }, false)
  })


  // -----------------------------------------------------------------------------
  // Start

  chrome.storage.local.get({ justUpdated: 0 }, function(items) {
    if (items.justUpdated > 0) {
      let newItems = document.getElementsByClassName('new')

      for(let i = 0; i < newItems.length; i++) {
        newItems[i].classList.remove('hidden')
      }

      items.justUpdated -= 1

      chrome.storage.local.set({ justUpdated: items.justUpdated })
    }
  })

  configuration.forEachCurrent(function(key, value) {
    if(! elements[key]) return

    elements[key].checked = value
    elements[key].value = value
  })
})()
