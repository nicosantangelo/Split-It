(function () {
  'use strict'

  // Easy access to log functions to be changed on build
  let log = console.log.bind(console, '[Split/It]')

  configuration.get(function(config) {
    config = configuration.setMissingDefaultValues(config)

    log('Running with the following configuration', config)

    for (let baseURL in config.siteMapping) {
      if (document.URL.search(getHostname(baseURL)) === -1) continue

      settings.load(baseURL, config)

      widthManager.setCurrent(settings.getOption('width'))

      log(`Loading ${settings.url} into ${document.URL}`)
      return startExtension() // break the loop
    }

    log(`Coudn't find a valid sidebar for ${document.URL}. Valid URLs are`, config.siteMapping)
  })


  // -------------------------------------
  // Start

  function startExtension() {
    iframe.load()

    listenToChromeMessages()
    chromeMessages.activateIcon()
  }

  function listenToChromeMessages() {
    chromeMessages.onMessage(function(request) {
      switch (request.action) {
        case 'mousemove':
          resizing.setPageX(request.data.pageX + iframe.getPosition().left)
          resizing.triggerResize()
          break
        case 'mouseup':
          resizing.triggerResizeEnd()
          break
        case 'toggle':
          iframe.toggle()
          break
        default:
          break
      }
    })
  }


  // -------------------------------------
  // Main Players

  const settings = {
    baseURL: null,

    url: null,
    options: null,

    load(baseURL, config) {
      this.baseURL = baseURL

      this.url = config.siteMapping[baseURL]
      this.options = config.optionsMapping[baseURL]
    },

    toggleOption(key) {
      let value = ! this.getOption(key)
      this.updateOption(key, value)
      return value
    },

    getOption(key) {
      return this.options[key]
    },

    updateOption(key, value) {
      this.options[key] = value

      let optionsMapping = {}
      optionsMapping[this.baseURL] = this.options

      configuration.set({ optionsMapping: optionsMapping })
    }
  }

  const iframe = {
    id: '__splitit-embedded-frame',

    html : null,
    outer: null,

    load() {
      log(`Injecting ${settings.url} as an iframe`)

      this.html  = document.documentElement

      this.outer = createElement('div', {
        id: this.id,
        innerHTML: `<iframe name="splitit" src="${settings.url}" frameborder="0" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>`
      })

      prepend(document.body, this.outer)

      if (settings.getOption('showMenu')) this.loadMenu()
      this.loadResizing()

      this.resize()

      if (! settings.getOption('isVisible')) this.hide()
      if (settings.getOption('hoverOver')) menu.detach()

      return this
    },

    loadMenu() {
      menu
        .load()
        .onToggle(this.toggle.bind(this))
        .onToggleHover(this.toggleHover.bind(this))
    },

    loadResizing() {
      resizing
        .load()
        .onResizeStart(function() {})
        .onResize(function() {})
        .onResizeEnd(this.resize.bind(this))
    },

    toggle() {
      settings.getOption('isVisible') ? this.hide() : this.show()

      let newIsVisible = settings.toggleOption('isVisible')
      chromeMessages.changeVisibility(newIsVisible)
    },

    toggleHover() {
      let newHoverOver = settings.toggleOption('hoverOver')
      chromeMessages.changeHoverOver(newHoverOver)

      this.resize()
      menu.detach()
    },

    show() {
      resizing.show()
      menu.show()

      this.resize()
      this.outer.classList.toggle('__splitit-hidden')
    },

    hide() {
      resizing.hide()
      menu.hide()

      css(this.html, { width: '100%' })
      this.outer.classList.toggle('__splitit-hidden')
    },

    resize() {
      if (settings.getOption('hoverOver')) {
        css(this.html, { width: '100%' })
      } else {
        css(this.html, { width: widthManager.getComplementPercentage() })
      }

      css(this.outer, { width: widthManager.getCurrentPercentage() })
      window.dispatchEvent(new Event('resize'))
    },

    getPosition() {
      let box = this.outer.getBoundingClientRect()

      return {
        top : box.top + window.pageYOffset,
        left: box.left + window.pageXOffset
      }
    }
  }


  const resizing = {
    isResizing: false,
    startXPosition: null,
    pageX: 0,

    $handle: null,
    $guide: null,

    load() {
      log('Adding resize handler')

      this.guide = createElement('div', { className: '__splitit-resizing-guide' })
      this.handle = createElement('div', { className: '__splitit-resizing-handle' })

      this.append()
      this.hookMouseEvents()

      return this
    },

    append() {
      hide(this.guide)
      document.body.appendChild(this.guide)

      css(this.handle, { right: widthManager.getCurrentPercentage() })
      document.body.appendChild(this.handle)
    },

    hookMouseEvents() {
      this.handle.addEventListener('mousedown', this.triggerResizeStart.bind(this))
      document.addEventListener('mousemove',    this.triggerResize.bind(this))
      document.addEventListener('mouseup',      this.triggerResizeEnd.bind(this))
    },

    onResizeStart(callback) {
      this._triggerResizeStart = callback
      return this
    },
    _triggerResizeStart() {},
    triggerResizeStart(event) {
      this.isResizing = true
      widthManager.record()

      this._triggerResizeStart(event)

      css(this.guide, { 'width': 0 })
      show(this.guide)
      css(document.body, { cursor: 'move' })
    },

    onResize(callback) {
      this._triggerResize = callback
      return this
    },
    _triggerResize() {},
    triggerResize(event) {
      if(! this.isResizing) return
      if(! event) event = {}
      if(! this.startXPosition) this.startXPosition = event.pageX

      let xPosDiff = (event.pageX || resizing.pageX) - this.startXPosition
      xPosDiff = xPosDiff || 0

      widthManager.updateCurrentForMousePosition(xPosDiff)

      this._triggerResize(event)

      css(this.handle, { right: widthManager.getCurrentPercentage() })
      css(this.guide, widthManager.currentCSS())
    },

    onResizeEnd(callback) {
      this._triggerResizeEnd = callback
      return this
    },
    _triggerResizeEnd(event) {},
    triggerResizeEnd(event) {
      if(! this.isResizing) return

      this.isResizing = false
      this.startXPosition = null

      this._triggerResizeEnd(event)

      settings.updateOption('width', widthManager.toFixed())

      hide(this.guide)
      css(document.body, { cursor: 'auto' })
    },

    show() {
      show(this.handle)
    },

    hide() {
      hide(this.handle)
    },

    setPageX(pageX) {
      this.pageX = pageX
    }
  }


  const menu = {
    id: '__splitit-menu',

    actions   : {},
    visibility: {},
    hover     : {},
    options   : {},

    textMap: {
      visibility: {
        Show: 'Hide',
        Hide: 'Show'
      },

      hover: {
        Attach: 'Detach',
        Detach: 'Attach'
      }
    },

    load() {
      log('Adding Show/Hide buttons', settings.url)

      let siteName = getHostname(settings.url)
      let gearPath = chrome.extension.getURL('images/gear.png')

      this.actions = createElement('div', {
        id: this.id,
        className: this.id,
        innerHTML: `<a class="__splitit-action" href="${settings.url}" target="_blank">${siteName}:</a>`
      })

      this.visibility = createElement('span', {
        className: '__splitit-action __js-splitit-toggle-visibility',
        innerHTML: 'Hide',
        onclick: function(event) { this._triggerToggleVisibility(event) }.bind(this)
      })

      this.hover = createElement('span', {
        className: '__splitit-action __js-splitit-toggle-hover',
        innerHTML: 'Detach',
        onclick: function(event) { this._triggerToggleHover(event) }.bind(this)
      })

      this.options = createElement('span', {
        className: '__splitit-options',
        innerHTML: `<img src="${gearPath}" alt="Grear" width="16" height="16" />`,
        onclick: chromeMessages.openOptions
      })

      this.append()

      return this
    },

    append() {
      this.actions.appendChild(this.visibility)
      this.actions.appendChild(this.hover)
      this.actions.appendChild(this.options)

      document.body.appendChild(this.actions)
    },

    _triggerToggleVisibility() {},
    onToggle(callback) {
      this._triggerToggleVisibility = callback
      return this
    },

    _triggerToggleHover() {},
    onToggleHover(callback) {
      this._triggerToggleHover = callback
      return this
    },

    show() {
      this.visibility.textContent = this.textMap['visibility']['Show']
    },
    hide() {
      this.visibility.textContent = this.textMap['visibility']['Hide']
    },

    attach() {
      this.hover.textContent = this.textMap['hover']['Attach']
    },
    detach() {
      this.hover.textContent = this.textMap['hover']['Detach']
    }
  }


  const widthManager = {
    current: null,
    last: null,

    setCurrent(width) {
      this.current = width || 25
    },

    record() {
      this.last = this.current
    },

    updateCurrentForMousePosition(xPosDiff) {
      let bodyWidth = getDocumentOuterWidth()
      let percentage = 100 * xPosDiff / bodyWidth

      this.current = Math.max(this.last - percentage,  100 * 100 / bodyWidth)

      return this.current
    },

    currentCSS() {
      return this.last <= this.current
        ? { right: this.last + '%',    width: (this.current - this.last) + '%' }
        : { right: this.current + '%', width: (this.last - this.current) + '%' }
    },

    getCurrentPercentage() {
      return `${this.current}%`
    },

    getComplementPercentage() {
      return `${100 - widthManager.current}%`
    },

    toFixed() {
      return toFixed(this.current, 2)
    }
  }

  const chromeMessages = Object.freeze({
    openOptions() {
      chrome.extension.sendMessage({ action: 'openOptions' })
    },

    changeVisibility(isVisible) {
      this.updateOption('isVisible', isVisible)
    },

    changeHoverOver(hoverOver) {
      this.updateOption('hoverOver', hoverOver)
    },

    activateIcon() {
      chrome.extension.sendMessage({ action: 'changeStatus', active: true })
    },

    updateOption(key, value) {
      chrome.extension.sendMessage({ action: 'updateOption', key: key, value: value, baseURL: settings.baseURL })
    },

    onMessage(callback) {
      chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
        callback(request)
      })
    }
  })


  // -------------------------------------
  // DOM Utils

  function createElement(name, props) {
    let el = document.createElement(name)
    Object.assign(el, props)
    return el
  }

  function prepend(parent, el) {
    parent.insertBefore(el, parent.firstElementChild)
  }

  function show(el) {
    el.classList.remove('__splitit-hidden')
  }

  function hide(el) {
    el.classList.add('__splitit-hidden')
  }

  function css(el, props) {
    for (let prop in props) {
      el.style[prop] = props[prop]
    }
  }

  function getDocumentOuterWidth() {
    return window.innerWidth
      || document.documentElement.clientWidth
      || document.body.clientWidth || document.body.offsetWidth
  }

  // -------------------------------------
  // Utils

  function toFixed(number, decimals) {
    return parseFloat(number.toFixed(decimals))
  }

  function getHostname(url) {
    return url
      .replace(/https?:\/\/(www\.)?/, '') // remove protocol
      .replace(/\/$/, '')                 // remove trailing slash
  }
})()
