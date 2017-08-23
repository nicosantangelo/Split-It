/* Globals: configuration */

;(function() {
  'use strict'

  const SELECTORS = {
    mapping     : '#js-pages-mapping',
    add         : '#js-add-mapping',

    items       : '.js-item',
    baseurl     : '[name="baseurl"]',
    iframesrc   : '[name="iframesrc"]',
    options     : 'ul.js-item-options li input',
    open        : '.js-open',

    delete      : '.js-delete-mapping',

    save        : '#js-save',

    notice      : '#js-notice',
    closeNotice : '.js-close-notice',

    itemTemplate: '#js-item-template',
  }


  // -----------------------------------------------------------------------------
  // Events

  // Add configuration
  document.querySelector(SELECTORS.add)
    .addEventListener('click', preventDefault(function() {
      getNewItem().inject()
    }), false)


  // Delete mappings (hooked to the parent for dynamic items)
  document.querySelector(SELECTORS.mapping)
    .addEventListener('click', function deleteMapping(event) {
      let target = event.target
      let deleteClass = SELECTORS.delete.slice(1) // remove the leading dot

      if (target.classList.contains(deleteClass)) {
        let itemEl = closest(target, 'item')
        if (itemEl) itemEl.remove()

        event.preventDefault()
      }
    }, false)


  // Save configuration
  document.querySelector(SELECTORS.save)
    .addEventListener('submit', preventDefault(function save(event) {
      let newValues = {
        siteMapping: buildSiteMapping(),
        optionsMapping: buildOptionsMapping()
      }

      configuration.set(newValues, notice.flash.bind(notice))

      // forEachItem(function(item) { item.revealSavedOptions() })
      // ga('send', 'event', 'Options', 'save', 'Saved options, with the configuration: ' + JSON.stringify(newValues))
    }), false)


  // Close notice
  document.querySelector(SELECTORS.closeNotice)
    .addEventListener('click', function() {
      closeButton.parentElement.classList.add('hidden')
    }, false)


  // -----------------------------------------------------------------------------
  // Start

  // Setup `new` flags
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

  // Add the saved configuration values to the HTML
  configuration.get(function(config) {
    revealElement(document.querySelector(SELECTORS.save))

    if (isEmptyObject(config.siteMapping)) {
      getNewItem().inject()

    } else {
      for (let baseURL in config.siteMapping) {
        let options = config.optionsMapping[baseURL]

        let item = getNewItem()

        item.setSaved(true)
        item.setBaseURL(baseURL)
        item.setIframeSrc(config.siteMapping[baseURL])

        item.forEachOption(function(option, name) {
          setInputValue(option, options[name])
        })

        item.inject()
      }
    }
  })


  // -----------------------------------------------------------------------------
  // Utils

  function revealElement(element) {
    setTimeout(function() {
      element.classList.add('in')
    }, 20)
  }

  function buildSiteMapping() {
    let siteMapping = {}

    forEachItem(function(item) {
      if (item.isValid()) {
        siteMapping[item.getBaseURL()] = item.getIframeSrc()
      }
    })

    return siteMapping
  }

  function buildOptionsMapping() {
    let optionsMapping = {}

    forEachItem(function(item) {
      if (! item.isValid()) return

      let options = {}

      item.forEachOption(function(option, name, index) {
        options[name] = getInputValue(option) || configuration.DEFAULT_OPTION[name]
      })

      optionsMapping[item.getBaseURL()] = options
    })

    return optionsMapping
  }

  function getNewItem() {
    let itemHTML = document.querySelector(SELECTORS.itemTemplate)
    let itemContainer = document.createElement('div')

    itemContainer.innerHTML = itemHTML.innerHTML

    return decorateItemElement(itemContainer.firstElementChild)
  }

  function forEachItem(callback) {
    return forEachElement(SELECTORS.items, function(itemElement, index) {
      callback(decorateItemElement(itemElement), index)
    })
  }

  function decorateItemElement(item) {
    return {
      saved: false,

      inject() {
        document.querySelector(SELECTORS.mapping).appendChild(item)

        // hook delete
        // hook open
        // on keydown => saved == false, hide open

        // if saved => show open

        revealElement(item)
      },

      // revealSavedOptions() {
      //   item.querySelector(SELECTORS.open).classList.remove('hidden')
      // },

      isValid: function() {
        return this.getBaseURL() && this.getIframeSrc()
      },

      setSaved(isSaved) {
        this.isSaved = isSaved

        // if true => show open
      },

      getBaseURL: function(value) {
        return item.querySelector(SELECTORS.baseurl).value
      },
      setBaseURL: function(value) {
        item.querySelector(SELECTORS.baseurl).value = value
      },

      getIframeSrc: function(value) {
        return item.querySelector(SELECTORS.iframesrc).value
      },
      setIframeSrc: function(value) {
        item.querySelector(SELECTORS.iframesrc).value = value
      },

      forEachOption: function(callback) {
        let options = item.querySelectorAll(SELECTORS.options)

        forEachElement(options, function(optionElement, index) {
          callback(optionElement, optionElement.name, index)
        })
      }
    }
  }

  let notice = {
    saveTimeout: null,
    el: document.querySelector(SELECTORS.notice),

    flash: function() {
      this.el.classList.remove('hidden')

      window.scrollTo(0, document.body.scrollHeight)

      clearTimeout(this.saveTimeout)
      this.saveTimeout = setTimeout(function() { this.el.classList.add('hidden') }.bind(this), 4000)
    }
  }


  function forEachElement(selectorOrElements, callback) {
    let items = typeof selectorOrElements === 'string'
      ? document.querySelectorAll(selectorOrElements)
      : selectorOrElements

    for(let i = 0; i < items.length; i++) {
      callback(items[i], i)
    }

    return items
  }

  function getInputValue(input) {
    if (! input) return null
    if (input.type === 'checkbox') return input.checked
    if (input.type === 'number') return parseFloat(input.value)
    return input.value
  }

  function setInputValue(input, value) {
    if (! input) return null
    if (input.type === 'checkbox') return input.checked = value
    return input.value = value
  }

  function preventDefault(fn) {
    return function(event) {
      event.preventDefault()
      fn(event)
    }
  }

  function closest(node, className) {
    while (node = node.parentNode) {
      if (node.classList && node.classList.contains(className)) {
        return node
      }
    }
  }

  function isEmptyObject(obj) {
    return Object.keys(obj).length === 0
  }
})()
