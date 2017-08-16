;(function () {
  'use strict'

  let extensionActive = true

  let $handle = $('<div>', { 'class': '__drag-frame' })
  let $resizingBox = $('<div>', { 'class': '__resizing-box' })

  let gearPath = chrome.extension.getURL('images/gear.png')

  configuration.get(function(config) {
    config = Object.assign({}, configuration.DEFAULT, config)

    let isVisible = config.isVisible != null ? config.isVisible : true

    widthManager.setCurrent(config.iframeWidth)

    try {
      let URL = document.URL
      let ran = false

      console.log('[Split/It] Running Split/It with the current configuration', config)

      // TODO: Add exceptions
      for(let baseURL in config.siteMapping) {
        if (document.URL.search(baseURL) !== -1) {
          let url = config.siteMapping[baseURL]
          ran = true

          console.log(`[Split/It] Loading ${url} into ${document.URL}`)
          start(url)
          break
        }
      }

      if (! ran) console.log(`[Split/It] Coudn't find a valid sidebar for ${document.URL}. Valid options are ${config.siteMapping}`)

    } catch (error) {
      console.warn('[Split/It] An error ocurred trying to run the extension', error)
    }

    function start(url) {
      addResizeHandle()
      iframe.load(url)
      addShowHideButton(url)

      if(! isVisible) iframe.hide()
    }

    function addResizeHandle() {
      console.log('[Split/It] Adding resize handler')

      $resizingBox.hide()
      $handle.css('right', widthManager.asPercentage())
      $('html body').append($handle).append($resizingBox)

      let isResizing = false
      let startXPosition = null

      $(document).mousemove(function(event) {
        if(! isResizing) return
        if(! startXPosition) startXPosition = event.pageX

        let xPosDiff = (event.pageX || 0) - startXPosition
        xPosDiff = xPosDiff || 0

        widthManager.updateCurrentForMousePosition(xPosDiff)

        $handle.css('right', widthManager.asPercentage())
        $resizingBox.css(widthManager.currentCSS())
      })

      $handle.mousedown(preventDefault(function() {
        isResizing = true
        widthManager.record()

        $resizingBox.css('width', 0).show()
        $(document).css('cursor', 'move')
      }))

      $(document).mouseup(preventDefault(function() {
        if(! isResizing) return

        isResizing = false
        startXPosition = null

        $resizingBox.hide()
        iframe.resize()
        $('body').css('cursor', 'auto')

        // Save configuration
        configuration.set({ iframeWidth: widthManager.toFixed() })
      }))
    }


    function addShowHideButton(url) {
      console.log('[Split/It] Adding Show/Hide buttons', URLToName(url))

      // TODO: Wording and class here
      let template = `<div class="__iframe-actions">
        <a href="#" class="onoff">Hide ${URLToName(url)}</a>
        <a href="#" class="options">
          <img src="${gearPath}" alt="Grear"/>
        </a>
      </div>`

      $('html body').append(template)

      $('.__iframe-actions .onoff').click(preventDefault(function() {
        iframe.toggle(url)
      }))
      $('.__iframe-actions .options').click(preventDefault(chromeMessages.openOptions))
    }
  })


  // -------------------------------------
  // Utils

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

        console.log(this.$outer)
        this.$outer.prependTo('body')
      }

      $handle.show()

      $('.__iframe-actions .onoff').text(function(index, text) {
        return text.replace('Show', 'Hide')
      })

      chromeMessages.changeVisibility(true)
    },

    hide() {
      this.deactivate()

      $handle.hide()

      $('.__iframe-actions .onoff').text(function(index, text) {
        return text.replace('Hide', 'Show')
      })

      chromeMessages.changeVisibility(false)
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
