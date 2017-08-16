;(function () {
  'use strict'

  configuration.get(function(config) {
    config = Object.assign({}, configuration.DEFAULT, config)

    try {
      let URL = document.URL
      let ran = false

      console.log('[Split/It] Running Split/It with the current configuration', config)

      widthManager.setCurrent(config.iframeWidth)

      // TODO: Add exceptions
      for(let baseURL in config.siteMapping) {
        if (document.URL.search(baseURL) !== -1) {
          let url = config.siteMapping[baseURL]

          console.log(`[Split/It] Loading ${url} into ${document.URL}`)
          start(url, config.isVisible)
          ran = true
          break
        }
      }

      if (! ran) console.log(`[Split/It] Coudn't find a valid sidebar for ${document.URL}. Valid options are ${config.siteMapping}`)

    } catch (error) {
      console.warn('[Split/It] An error ocurred trying to run the extension', error)
    }
  })

  function start(url, isVisible) {
    iframe.load(url)
    resizing.load(url)
    actions.load(url)

    if(! isVisible) iframe.hide()
  }


  // -------------------------------------
  // Main Players

  const iframe = {
    id: '__splitit-embedded-frame',

    active: false,
    $html : [],
    $outer: [],

    load(src) {
      console.log(`[Split/It - iframe] Injecting ${src} as an iframe`)

      this.activate()

      if (this.outerFrameExists()) {
        this.resize()
        this.$outer.toggleClass('hidden', false)
      } else {
        this.$outer = $('<div>', { id: this.id }).append(`<iframe src="${src}" frameborder="0"></iframe>`)
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
      // this.$html.css({  'width': (100 - widthManager.current) + '%' }) adjust html width
      this.$outer.css({ 'width': widthManager.asPercentage() })
      window.dispatchEvent(new Event('resize'))
    },

    collapse() {
      this.$outer.stop(true, false).animate({ 'width': widthManager.asPercentage() }, 0)
    },

    toggle(url) {
      this.active ? this.hide() : this.load(url)
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
    }
  }


  const resizing = {
    isResizing: false,

    $handle: $('<div>', { 'class': '__resizing-handle' }),
    $guide: $('<div>', { 'class': '__resizing-guide' }),

    load() {
      console.log('[Split/It] Adding resize handler')

      let startXPosition = null

      this.append()

      this.onResizeStart(function() {
        widthManager.record()
      })

      this.onResize(function(event) {
        if(! startXPosition) startXPosition = event.pageX

        let xPosDiff = (event.pageX || 0) - startXPosition
        xPosDiff = xPosDiff || 0

        widthManager.updateCurrentForMousePosition(xPosDiff)
      })

      this.onResizeEnd(function() {
        startXPosition = null

        iframe.resize()
        configuration.set({ iframeWidth: widthManager.toFixed() }) // Save configuration
      })
    },

    append() {
      this.$guide.hide()
      this.$guide.appendTo('body')

      this.$handle.css('right', widthManager.asPercentage())
      this.$handle.appendTo('body')
    },

    onResizeStart(callback) {
      let onMouseDown = function(event) {
        this.isResizing = true

        callback(event)

        this.$guide.css('width', 0).show()
        $('body').css('cursor', 'move')
      }.bind(this)

      this.$handle.mousedown(preventDefault(onMouseDown))
    },

    onResize(callback) {
      let onMouseMove = function(event) {
        if(! this.isResizing) return

        callback(event)

        this.$handle.css('right', widthManager.asPercentage())
        this.$guide.css(widthManager.currentCSS())
      }.bind(this)

      $(document).mousemove(onMouseMove)
    },

    onResizeEnd(callback) {
      let onMouseUp = function(event) {
        if(! this.isResizing) return

        this.isResizing = false

        callback(event)

        this.$guide.hide()
        $('body').css('cursor', 'auto')
      }.bind(this)

      $(document).mouseup(preventDefault(onMouseUp))
    },

    show() {
      this.$handle.show()
    },

    hide() {
      this.$handle.hide()
    }
  }


  const actions = {
    id: '__splitit-actions',

    load(url) {
      console.log('[Split/It] Adding Show/Hide buttons', URLToName(url))

      let gearPath = chrome.extension.getURL('images/gear.png')

      let actionsHTML = `<div id="${this.id}" class="${this.id}">
        <a href="#" class="__splitit-onoff">Hide ${URLToName(url)}</a>
        <a href="#" class="__splitit-options">
          <img src="${gearPath}" alt="Grear" />
        </a>
      </div>`

      $('body').append(actionsHTML)

      $('.__splitit-onoff').click(preventDefault(function() {
        iframe.toggle(url)
      }))
      $('.__splitit-options').click(preventDefault(chromeMessages.openOptions))
    },

    show() {
      $('.__splitit-onoff').text(function(index, text) {
        return text.replace('Show', 'Hide')
      })

      chromeMessages.changeVisibility(true)
    },

    hide() {
      $('.__splitit-onoff').text(function(index, text) {
        return text.replace('Hide', 'Show')
      })

      chromeMessages.changeVisibility(false)
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


  // -------------------------------------
  // Utils

  const chromeMessages = Object.freeze({
    openOptions() {
      chrome.extension.sendMessage({ action: 'openOptions' })
    },

    changeVisibility(isVisible) {
      chrome.extension.sendMessage({ action: 'changeVisibility', data: { isVisible: isVisible } })
    }
  })

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
