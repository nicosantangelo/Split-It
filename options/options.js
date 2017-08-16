/* Globals: insignia, configuration */

;(function() {
  'use strict'

  const SELECTORS = {
    mapping    : '#js-pages-mapping',
    add        : '#js-add-mapping',
    save       : '#js-save',
    delete     : '.js-delete-mapping',
    template   : '.js-item-template',
    iframeSrcs : '.js-input-iframesrc',
    baseURLs   : '.js-input-baseurls',
    closeNotice: '.js-close-notice',
  }

  let saveTimeout = null
  let multiselectElements = []
  let elements = {}

  let notice = document.getElementById('notice')

  configuration.forEachDefault(function(key, value) {
    elements[key] = document.getElementById(key)
  })

  // -----------------------------------------------------------------------------
  // Events

  // Add configuration
  document.querySelector(SELECTORS.add)
    .addEventListener('click', preventDefault(addMapping), false)


  // Delete mappings
  document.querySelector(SELECTORS.mapping)
    .addEventListener('click', preventDefault(function deleteMapping(event) {
      let target = event.target
      let items = document.querySelectorAll('.item')

      if (target.classList.contains(SELECTORS.delete.slice(1))) {
        target.parentElement.remove()
      }
    }), false)


  // Save configuration
  document.querySelector(SELECTORS.save)
    .addEventListener('click', function save() {
      let newValues = {}

      // Default primitive values
      configuration.forEachDefault(function(key, value) {
        newValues[key] = getInputValue(elements[key])
      })

      // Site mapping
      let iframeSrcs = document.querySelectorAll(SELECTORS.iframeSrcs)
      let siteMapping = {}

      for(let i = 0; i < iframeSrcs.length; i++) {
        let src = iframeSrcs[i].value
        let baseURLs = multiselectElements[i].value()

        if (src && baseURLs) {
          baseURLs.forEach(function(base) { siteMapping[base] = src })
        }
      }
      newValues.siteMapping = siteMapping

      // Actual save
      configuration.set(newValues, function() {
        notice.classList.remove('hidden')
        window.scrollTo(0, document.body.scrollHeight)
        clearTimeout(saveTimeout)
        saveTimeout = setTimeout(function() { notice.classList.add('hidden') }, 4000)
      })
    }, false)


  // Close notice
  document.querySelector(SELECTORS.closeNotice)
    .addEventListener('click', function() {
      closeButton.parentElement.classList.add('hidden')
    }, false)


  // -----------------------------------------------------------------------------
  // Start

  // Start multiselect
  createMultiselectElements(SELECTORS.baseURLs)

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
    if (typeof value === 'object') {
      if (key !== 'siteMapping') return

      // Add the siteMapping values to the HTML, not pretty, but it works
      let baseURLs = Object.keys(value)

      console.log(value)

      for(let i = 0; i < baseURLs.length; i++) {
        if (i >= 1) addMapping()

        let baseURL = baseURLs[i]

        let baseElements = document.querySelectorAll(SELECTORS.baseURLs)
        let iframeElements = document.querySelectorAll(SELECTORS.iframeSrcs)

        baseElements[i].value = baseURL
        iframeElements[i].value = value[baseURL]
      }

    } else {
      if(! elements[key]) return

      elements[key].checked = value
      elements[key].value = value
    }
  })


  // -----------------------------------------------------------------------------
  // Utils

  function addMapping() {
    let template = document.querySelector(SELECTORS.template)
    let item = document.createElement('div')

    item.innerHTML = template.innerHTML

    document.querySelector(SELECTORS.mapping).appendChild(item)

    createMultiselectElements(SELECTORS.baseURLs)
  }

  function createMultiselectElements(selector) {
    let elements = document.querySelectorAll(selector)

    for (let i = 0; i < elements.length; i++) {
      try {
        multiselectElements.push(insignia(elements[i]))
      } catch(e) {}
    }
  }

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
