;(function () {
  'use strict'


  configuration.get(function(config) {
    config = configuration.setMissingDefaultValues(config)

    try {
      let URL = document.URL

      console.log('[Split/It] Running Split/It with the following configuration', config)

      for (let baseURL in config.siteMapping) {
        if (document.URL.search(baseURL) === -1) continue

        // Current site settings
        let settings = {
          url: config.siteMapping[baseURL],
          options: config.optionsMapping[baseURL]
        }

        widthManager.setCurrent(settings.options.width)

        console.log(`[Split/It] Loading ${settings.url} into ${document.URL}`)
        return startExtension(settings) // break the loop
      }

      console.log(`[Split/It] Coudn't find a valid sidebar for ${document.URL}. Valid URLs are`, config.siteMapping)

    } catch (error) {
      console.warn('[Split/It] An error ocurred trying to run the extension', error)
    }
  })


  // -------------------------------------
  // Start

  function startExtension(settings) {
    let url = settings.url
    let options = settings.options

    iframe.load(url, options)
    resizing.load(url, options)
    actions.load(url, options)

    listenToChromeMessages()
    chromeMessages.activateIcon()

    if(! options.isVisible) iframe.hide()
  }

  function listenToChromeMessages() {
    chromeMessages.onMessage(function(request) {
      let $document = $(document)

      switch (request.action) {
        case 'mousemove':
          resizing.updatePageX(request.data.pageX)
          resizing.triggerMouseMove()
          break
        case 'mouseup':
          resizing.triggerMouseUp()
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

  const iframe = {
    id: '__splitit-embedded-frame',

    active: false,

    url: null,
    options: null,

    $html : [],
    $outer: [],

    load(url, options) {
      console.log(`[Split/It] Injecting ${url} as an iframe`)

      if (url) this.url = url
      if (options) this.options = options

      this.activate()

      if (this.outerFrameExists()) {
        this.resize()
        this.$outer.toggleClass('hidden', false)
      } else {
        let src = url.search('//') === -1 ? `//${url}` : url

        this.$outer = $('<div>', { id: this.id }).append(`<iframe name="splitit" src="${src}" frameborder="0"></iframe>`)
        this.resize()

        this.$outer.prependTo('body')
      }

      resizing.show()
      actions.show()
    },

    hide() {
      this.deactivate()

      resizing.hide()
      actions.hide()

      window.dispatchEvent(new Event('resize'))
    },

    resize() {
      if (this.options.hoverOver) {
      } else {
        // setup old width as prop, use it to recover on else
        this.$html.css({  'width': (100 - widthManager.current) + '%' }) // adjust html width
      }

      this.$outer.css({ 'width': widthManager.asPercentage() })
      window.dispatchEvent(new Event('resize'))
    },

    collapse() {
      this.$outer.stop(true, false).animate({ 'width': widthManager.asPercentage() }, 0)
    },

    toggle() {
      this.active ? this.hide() : this.load()
    },

    toggleHover() {
      if (! this.options) this.options = { hoverOver: false }

      this.options.hoverOver = ! this.options.hoverOver

      this.options.hoverOver ? this.actions.deattach() : this.actions.deattach()
      this.resize()
    },

    outerFrameExists() {
      return this.$outer.length > 0
    },

    activate() {
      this.$html  = $('html')
      this.$outer = $(`#${this.id}`)
      this.active = true
    },

    deactivate() {
      this.$html.css({ 'width': '100%' })
      this.$outer.toggleClass('hidden', true)
      this.active = false
    },

    getPosition(direction) {
      return this.$outer.position()
    }
  }


  const resizing = {
    isResizing: false,
    pageX: 0,

    $handle: $('<div>', { 'class': '__splitit-resizing-handle' }),
    $guide: $('<div>', { 'class': '__splitit-resizing-guide' }),

    load() {
      console.log('[Split/It] Adding resize handler')

      let startXPosition = null

      this.append()

      this.onResizeStart(function() {
        widthManager.record()
      })

      this.onResize(function(event) {
        if(! event) event = {}
        if(! startXPosition) startXPosition = event.pageX

        let xPosDiff = (event.pageX || resizing.pageX) - startXPosition
        xPosDiff = xPosDiff || 0

        widthManager.updateCurrentForMousePosition(xPosDiff)
      })

      this.onResizeEnd(function() {
        startXPosition = null

        iframe.resize()
        configuration.set({ optionsMapping: optionsMapping })
      })
    },

    append() {
      this.$guide.hide()
      this.$guide.appendTo('body')

      this.$handle.css('right', widthManager.asPercentage())
      this.$handle.appendTo('body')
    },

    triggerMouseDown() {},
    triggerMouseMove() {},
    triggerMouseUp() {},

    onResizeStart(callback) {
      this.triggerMouseDown = function(event) {
        this.isResizing = true

        callback(event)

        this.$guide.css('width', 0).show()
        $('body').css('cursor', 'move')
      }.bind(this)

      this.$handle.on('mousedown', preventDefault(this.triggerMouseDown))
    },

    onResize(callback) {
      this.triggerMouseMove = function(event) {
        if(! this.isResizing) return

        callback(event)

        this.$handle.css('right', widthManager.asPercentage())
        this.$guide.css(widthManager.currentCSS())
      }.bind(this)

      $(document).on('mousemove', this.triggerMouseMove)
    },

    onResizeEnd(callback) {
      this.triggerMouseUp = function(event) {
        if(! this.isResizing) return

        this.isResizing = false

        callback(event)

        this.$guide.hide()
        $('body').css('cursor', 'auto')
      }.bind(this)

      $(document).on('mouseup', preventDefault(this.triggerMouseUp))
    },

    show() {
      this.$handle.show()
    },

    hide() {
      this.$handle.hide()
    },

    updatePageX(pageX) {
      this.pageX = pageX + iframe.getPosition().left
    }
  }


  const actions = {
    id: '__splitit-actions',

    load(url, options) {
      if (! options.showMenu) return

      console.log('[Split/It] Adding Show/Hide buttons', URLToName(url))

      let gearPath = chrome.extension.getURL('images/gear.png')

      let actionsHTML = `<div id="${this.id}" class="${this.id}">
        <span class="__splitit-action">${URLToName(url)}: </span>
        <a href="#" class="__splitit-action __splitit-toggle">Hide</a>
        <a href="#" class="__splitit-action __splitit-toggle-hover">Deattach</a>
        <a href="#" class="__splitit-options">
          <img src="${gearPath}" alt="Grear" />
        </a>
      </div>`

      $('body').append(actionsHTML)

      $('.__splitit-toggle').click(preventDefault(function() {
        iframe.toggle()
      }))

      $('.__splitit-toggle-hover', el).click(preventDefault(function() {
        iframe.toggleHover()
      }))

      $('.__splitit-options', el).click(preventDefault(chromeMessages.openOptions))
    },

    show() {
      $('.__splitit-toggle').text(function(index, text) {
        return text.replace('Show', 'Hide')
      })

      chromeMessages.changeVisibility(true)
    },

    hide() {
      $('.__splitit-toggle').text(function(index, text) {
        return text.replace('Hide', 'Show')
      })

      chromeMessages.changeVisibility(false)
    },

    attach() {
      $('.__splitit-toggle-hover').text(function(index, text) {
        return text.replace('Attach', 'Deattach')
      })

      chromeMessages.changeHoverOver(true)
    },

    deattach() {
      $('.__splitit-toggle').text(function(index, text) {
        return text.replace('Deattach', 'Attach')
      })

      chromeMessages.changeHoverOver(false)
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
      let windowWidth = $(document).outerWidth()
      let percentage = 100 * xPosDiff / windowWidth

      this.current = Math.max(this.last - percentage,  100 * 100 / windowWidth)

      return this.current
    },

    currentCSS() {
      return this.last <= this.current
        ? { right: this.last + '%',    width: (this.current - this.last) + '%' }
        : { right: this.current + '%', width: (this.last - this.current) + '%' }
    },

    asPercentage() {
      return `${this.current}%`
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
      chrome.extension.sendMessage({ action: 'updateOption', key: key, value: value })
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

  function URLToName(url) {
    return url
      .replace(/https?:\/\/(www\.)?/, '') // remove protocol
      .split('.')                         // remove suffix
      .slice(0, -1)
      .join('.')
  }
})()
