(function () {
  'use strict'


  configuration.get(function(config) {
    config = configuration.setMissingDefaultValues(config)

    try {
      console.log('[Split/It] Running Split/It with the following configuration', config)

      for (let baseURL in config.siteMapping) {
        if (document.URL.search(getHostname(baseURL)) === -1) continue

        settings.load(baseURL, config)

        widthManager.setCurrent(settings.getOption('width'))

        console.log(`[Split/It] Loading ${settings.url} into ${document.URL}`)
        return startExtension() // break the loop
      }

      console.log(`[Split/It] Coudn't find a valid sidebar for ${document.URL}. Valid URLs are`, config.siteMapping)

    } catch (error) {
      console.warn('[Split/It] An error ocurred trying to run the extension', error)
    }
  })


  // -------------------------------------
  // Start

  function startExtension() {
    iframe.load()

    listenToChromeMessages()
    chromeMessages.activateIcon()

    if(! settings.getOption('isVisible')) iframe.hide()
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

    $html : [],
    $outer: [],

    load() {
      console.log(`[Split/It] Injecting ${settings.url} as an iframe`)

      this.activate()

      if (this.outerFrameExists()) {
        this.show()
      } else {
        this.$outer = jQuery('<div>', { id: this.id }).append(`<iframe name="splitit" src="${settings.url}" frameborder="0"></iframe>`)
        this.resize()

        this.$outer.prependTo('body')
      }

      this.loadActions()
      this.loadResizing()

      return this
    },

    loadActions() {
      actions
        .load()
        .attachToggle(this.toggle.bind(this))
        .attachToggleHover(this.toggleHover.bind(this))
    },

    loadResizing() {
      resizing
        .load()
        .attachResizeStart(function() {})
        .attachResize(function() {})
        .attachResizeEnd(this.resize.bind(this))
    },

    toggle() {
      settings.getOption('isVisible') ? this.hide() : this.show()

      let newIsVisible = settings.toggleOption('isVisible')
      chromeMessages.changeVisibility(newIsVisible)
    },

    toggleHover() {
      let newHoverOver = settings.toggleOption('hoverOver')
      chromeMessages.changeVisibility(newHoverOver)

      this.resize()
    },

    show() {
      this.resize()

      resizing.toggle()
      actions.toggle('visibility')

      this.$outer.toggleClass('hidden', false)
    },

    hide() {
      this.deactivate()

      resizing.toggle()
      actions.toggle('visibility')

      window.dispatchEvent(new Event('resize'))
    },

    resize() {
      if (settings.getOption('hoverOver')) {
        this.$html.css({ 'width': this.$html.__splititwidth })
      } else {
        this.$html.__splititwidth = this.$html.css('width')
        this.$html.css({ 'width': widthManager.getComplementPercentage() })
      }

      this.$outer.css({ 'width': widthManager.getCurrentPercentage() })
      window.dispatchEvent(new Event('resize'))
    },

    collapse() {
      this.$outer.stop(true, false).animate({ 'width': widthManager.getCurrentPercentage() }, 0)
    },

    outerFrameExists() {
      return this.$outer.length > 0
    },

    activate() {
      this.$html  = jQuery('html')
      this.$outer = jQuery(`#${this.id}`)
    },

    deactivate() {
      this.$html.css({ 'width': '100%' })
      this.$outer.toggleClass('hidden', true)
    },

    getPosition(direction) {
      return this.$outer.position()
    }
  }


  const resizing = {
    isResizing: false,
    startXPosition: null,
    pageX: 0,

    $handle: null,
    $guide: null,

    load() {
      console.log('[Split/It] Adding resize handler')

      this.$handle = jQuery('<div>', { 'class': '__splitit-resizing-handle' })
      this.$guide = jQuery('<div>', { 'class': '__splitit-resizing-guide' })

      this.append()

      return this
    },

    append() {
      this.$guide.hide()
      this.$guide.appendTo('body')

      this.$handle.css('right', widthManager.getCurrentPercentage())
      this.$handle.appendTo('body')
    },

    attachResizeStart(callback) {
      this.$handle.on('mousedown', preventDefault(function(event) {
        this.isResizing = true
        widthManager.record()

        callback && callback(event)

        this.$guide.css('width', 0).show()
        jQuery('body').css('cursor', 'move')
      }.bind(this)))

      return this
    },

    // TODO: This is not the best API (missbehaves if called more than once), but it works for now
    attachResize(callback) {
      jQuery(document)
        .off('mousemove.splitit')
        .on('mousemove.splitit', function(event) {
          this.triggerResize(event, callback)
        }.bind(this))

      return this
    },
    triggerResize(event, callback) {
      if(! this.isResizing) return
      if(! event) event = {}
      if(! this.startXPosition) this.startXPosition = event.pageX

      let xPosDiff = (event.pageX || resizing.pageX) - this.startXPosition
      xPosDiff = xPosDiff || 0

      widthManager.updateCurrentForMousePosition(xPosDiff)

      callback && callback(event)

      this.$handle.css('right', widthManager.getCurrentPercentage())
      this.$guide.css(widthManager.currentCSS())
    },

    attachResizeEnd(callback) {
      jQuery(document)
        .off('mouseup.splitit')
        .on('mouseup.splitit', preventDefault(function(event) {
          this.triggerResizeEnd(event, callback)
        }.bind(this)))

      return this
    },
    triggerResizeEnd(event, callback) {
      if(! this.isResizing) return

      this.isResizing = false
      this.startXPosition = null

      callback && callback(event)

      settings.updateOption('width', widthManager.current)

      this.$guide.hide()
      jQuery('body').css('cursor', 'auto')
    },

    toggle() {
      this.$handle.toggle()
    },

    setPageX(pageX) {
      this.pageX = pageX
    }
  }


  const actions = {
    id: '__splitit-actions',

    load() {
      if (! settings.getOption('showMenu')) return

      let siteName = getHostname(settings.url)
      let gearPath = chrome.extension.getURL('images/gear.png')

      console.log('[Split/It] Adding Show/Hide buttons', siteName)

      let actionsHTML = `<div id="${this.id}" class="${this.id}">
        <span class="__splitit-action">${siteName}: </span>
        <a href="#" class="__splitit-action __splitit-toggle-visibility">Hide</a>
        <a href="#" class="__splitit-action __splitit-toggle-hover">Deattach</a>
        <a href="#" class="__splitit-options">
          <img src="${gearPath}" alt="Grear" />
        </a>
      </div>`

      jQuery('body').append(actionsHTML)

      jQuery('.__splitit-options').on('click', preventDefault(chromeMessages.openOptions))

      return this
    },

    attachToggle(callback) {
      jQuery('.__splitit-toggle-visibility').on('click', preventDefault(function(event) {
        callback(event)
      }))
      return this
    },

    attachToggleHover(callback) {
      jQuery('.__splitit-toggle-hover').on('click', preventDefault(function(event) {
        callback(event)
      }))
      return this
    },

    toggle(key) {
      let toggleEl = document.querySelector(`.__splitit-toggle-${key}`)
      if (! toggleEl) throw new Error(`Tried to toggle a ${key} action, which does not exist`)

      let textMap = {
        visibility: {
          Show: 'Hide',
          Hide: 'Show'
        },

        hover: {
          Deattach: 'Attach',
          Attach: 'Deattach'
        }
      }[key]

      let text = toggleEl.textContent
      toggleEl.textContent = toggleEl.textContent.replace(text, textMap[text])
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
      let windowWidth = jQuery(document).outerWidth()
      let percentage = 100 * xPosDiff / windowWidth

      this.current = Math.max(this.last - percentage,  100 * 100 / windowWidth)

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
  // Utils

  function preventDefault(fn) {
    return function(event) {
      event.preventDefault()
      fn(event)
    }
  }

  function toFixed(number, decimals) {
    return parseFloat(number.toFixed(decimals))
  }

  function getHostname(url) {
    return url
      .replace(/https?:\/\/(www\.)?/, '') // remove protocol
      .replace(/\/$/, '')                 // remove trailing slash
  }
})()
