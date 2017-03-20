/* Globals: insignia, configuration */

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

  document.getElementById('js-add-mapping').addEventListener('click', preventDefault(function addMapping(event) {
    let item = document.querySelector('.item').cloneNode(true)
    document.getElementById('js-pages-mapping').appendChild(item)
  }), false)

  document.getElementById('js-pages-mapping').addEventListener('click', preventDefault(function deleteMapping(event) {
    let target = event.target

    if (target.classList.contains('js-delete-mapping')) { // TODO: don't delete the last one
      target.parentElement.remove()
    }
  }), false)


  document.getElementById('save').addEventListener('click', function save() {
    let newValues = {}

    configuration.forEachDefault(function(key, value) {
      newValues[key] = getInputValue(elements[key])
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

  // Start multiselect
  insignia(document.querySelector('.js-input-destinations'))


  // Setup all `new` flags
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

  // Set existing values
  configuration.forEachCurrent(function(key, value) {
    if(! elements[key]) return

    elements[key].checked = value
    elements[key].value = value
  })


  // -----------------------------------------------------------------------------
  // Utils

  function getInputValue(input) {
    if (! input) return null
    if (input.type === 'checkbox') return input.checked
    return input.value
  }

  function preventDefault(fn) {
    return function(event) {
      event.preventDefault()
      fn(event)
    }
  }
})()
