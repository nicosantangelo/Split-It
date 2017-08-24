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
      console.log(`[Split/It] Injecting ${settings.url} as an iframe`)

      this.activate()

      this.outer = createElement('div', {
        id: this.id,
        innerHTML: `<iframe name="splitit" src="${settings.url}" frameborder="0"></iframe>`
      })

      prepend(document.body, this.outer)

      this.loadActions()
      this.loadResizing()

      this.resize()

      if (! settings.getOption('isVisible')) this.hide()
      if (settings.getOption('hoverOver')) actions.toggle('hover')

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
      chromeMessages.changeHoverOver(newHoverOver)

      this.resize()
      actions.toggle('hover')
    },

    show() {
      resizing.toggle()
      actions.toggle('visibility')

      this.outer.classList.toggle('__splitit-hidden')
    },

    hide() {
      this.deactivate()

      resizing.toggle()
      actions.toggle('visibility')
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

    activate() {
      this.html  = document.documentElement
      this.outer = document.getElementById(this.id)
    },

    deactivate() {
      css(this.html, { width: '100%' })
      this.outer.classList.toggle('__splitit-hidden')
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
      console.log('[Split/It] Adding resize handler')

      this.handle = createElement('div', { className: '__splitit-resizing-handle' })
      this.guide = createElement('div', { className: '__splitit-resizing-guide' })

      this.append()

      return this
    },

    append() {
      hide(this.guide)
      document.body.appendChild(this.guide)

      css(this.handle, { right: widthManager.getCurrentPercentage() })
      document.body.appendChild(this.handle)
    },

    attachResizeStart(callback) {
      this.handle.addEventListener('mousedown', preventDefault(function(event) {
        this.isResizing = true
        widthManager.record()

        callback && callback(event)

        css(this.guide, { 'width': 0 })
        show(this.guide)
        css(document.body, { cursor: 'move' })
      }.bind(this)))

      return this
    },

    // TODO: This is not the best API (missbehaves if called more than once), but it works for now
    attachResize(callback) {
      document.addEventListener('mousemove', function(event) {
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

      css(this.handle, { right: widthManager.getCurrentPercentage() })
      css(this.guide, widthManager.currentCSS())
    },

    attachResizeEnd(callback) {
      document.addEventListener('mouseup', preventDefault(function(event) {
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

      hide(this.guide)
      css(document.body, { cursor: 'auto' })
    },

    toggle() {
      toggle(this.handle)
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

      let actionsEl = createElement('div', {
        id: this.id,
        className: this.id,
        innerHTML: `
          <a class="__splitit-action" target="_blank">${siteName}: </a>
          <span class="__splitit-action __splitit-toggle-visibility">Hide</span>
          <span class="__splitit-action __splitit-toggle-hover">Deattach</span>
        `
      })
      let optionsEl = createElement('span', {
        className: '__splitit-options',
        innerHTML: `<img src="${gearPath}" alt="Grear" />`,
        onclick: chromeMessages.openOptions
      })

      actionsEl.appendChild(optionsEl)
      document.body.appendChild(actionsEl)

      return this
    },

    attachToggle(callback) {
      document.querySelector('.__splitit-toggle-visibility')
        .addEventListener('click', function(event) {
          callback(event)
        }, false)
      return this
    },

    attachToggleHover(callback) {
      document.querySelector('.__splitit-toggle-hover')
        .addEventListener('click', function(event) {
          callback(event)
        }, false)
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
      let bodyWidth = document.body.offsetWidth
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

  function toggle(el) {
    el.classList.toggle('__splitit-hidden')
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

  function preventDefault(fn) {
    return function(event) {
      event.preventDefault()
      fn(event)
    }
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
