/* Globals: configuration */

;(function() {
  'use strict'

  // Easy access to log functions to be changed on build
  let log = console.log.bind(console, '[Split/It]')

  const SELECTORS = {
    mapping     : '#js-pages-mapping',
    add         : '#js-add-mapping',

    items       : '.js-item',
    baseurl     : '[name="baseurl"]',
    iframesrc   : '[name="iframesrc"]',
    options     : 'ul.js-item-options li input',

    open        : '.js-open-mapping',
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


  // Save configuration
  document.querySelector(SELECTORS.save)
    .addEventListener('submit', preventDefault(function save(event) {
      let newValues = mapping.build()

      log('Saving new configuration', newValues)

      configuration.set(newValues, notice.flash.bind(notice))
      forEachItem(function(item) { item.setSaved(true) })

      ga('send', 'event', 'Options', 'save', 'Saved options, with the configuration: ' + JSON.stringify(newValues))
    }), false)


  // Close notice
  document.querySelector(SELECTORS.closeNotice)
    .addEventListener('click', function(event) {
      event.target.parentElement.classList.add('hidden')
    }, false)


  // -----------------------------------------------------------------------------
  // Start

  // Add the saved configuration values to the HTML
  configuration.get(function(config) {
    log('Starting options with configuration', config)

    if (isEmptyObject(config.siteMapping)) {
      getNewItem().inject()

    } else {
      for (let baseURL in config.siteMapping) {
        let options = config.optionsMapping[baseURL]
        if (! options) continue

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

    revealElement(document.querySelector(SELECTORS.save))
  })


  // -----------------------------------------------------------------------------
  // Item

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

      inject: function() {
        document.querySelector(SELECTORS.mapping).appendChild(item)

        this.hookKeydown()
        this.hookDelete()
        this.toggleOpenOption()

        revealElement(item)
      },

      hookKeydown: function() {
        let inputsSelector = [ SELECTORS.baseurl, SELECTORS.iframesrc ].join(',')

        item.querySelector(inputsSelector)
          .addEventListener('keydown', function() {
            this.isSaved = false
            this.toggleOpenOption()
          }.bind(this), false)
      },

      hookDelete: function() {
        item.querySelector(SELECTORS.delete)
          .addEventListener('click', preventDefault(item.remove.bind(item)), false)
      },

      isValid: function() {
        return this.getBaseURL() && this.getIframeSrc()
      },

      setSaved: function(isSaved) {
        this.isSaved = isSaved
        this.toggleOpenOption()
      },

      toggleOpenOption: function() {
        let openEl = item.querySelector(SELECTORS.open)

        if (this.isSaved) {
          openEl.dataset.balloon = `Open "${this.getBaseURL()}" with "${this.getIframeSrc()}" as split.`
          openEl.href = this.getBaseURL()
          openEl.classList.remove('hidden')
        } else {
          openEl.dataset.balloon = ''
          openEl.href = '#'
          openEl.classList.add('hidden')
        }
      },

      getBaseURL: function(value) {
        let url = item.querySelector(SELECTORS.baseurl).value
        return upsertURLProtocol(url)
      },
      setBaseURL: function(value) {
        item.querySelector(SELECTORS.baseurl).value = value
      },

      getIframeSrc: function(value) {
        let url = item.querySelector(SELECTORS.iframesrc).value
        return upsertURLProtocol(url)
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


  // -----------------------------------------------------------------------------
  // Notice

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


  // -----------------------------------------------------------------------------
  // Mapping

  let mapping = {
    build: function() {
      return {
        siteMapping: this.buildSite(),
        optionsMapping: this.buildOptions()
      }
    },

    buildSite: function() {
      let siteMapping = {}

      forEachItem(function(item) {
        if (item.isValid()) {
          siteMapping[item.getBaseURL()] = item.getIframeSrc()
        }
      })

      return siteMapping
    },

    buildOptions: function() {
      let optionsMapping = {}

      forEachItem(function(item) {
        if (! item.isValid()) return

        let options = {}

        item.forEachOption(function(option, name, index) {
          let value = getInputValue(option)
          options[name] = value == null ? configuration.DEFAULT_OPTION[name] : value
        })

        optionsMapping[item.getBaseURL()] = options
      })

      return optionsMapping
    }
  }


  // -----------------------------------------------------------------------------
  // Utils

  function revealElement(element) {
    setTimeout(function() {
      element.classList.add('in')
    }, 20)
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

  function upsertURLProtocol(url) {
    if (url.search(/https?:\/\//) === -1) {
      url = 'https://' + url
    }

    return url
  }

  function isEmptyObject(obj) {
    return ! obj || Object.keys(obj).length === 0
  }
})()
