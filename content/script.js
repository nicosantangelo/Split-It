;(function () {
  'use strict'

  let extensionActive = true
  let insideIframe = false

  console.log("GKeep extension loading for '" + document.URL + "'...")

  configuration.get(function(config) {
    config = Object.assign({}, configuration.DEFAULT, config)

    let gearPath = chrome.extension.getURL('images/gear.png')
    let isVisible = true

    let $gmailHTML = null
    let $outerframe = null

    let globalPageX = 0

    let $handle = $('<div>', { 'class': '__drag-frame' })
    let $resizingBox = $('<div>', { 'class': '__resizing-box' })

    let currentWidth = config.iframeWidth || 25

    try {
      let URL = document.URL

      // TODO: Change this to work only on the selected urls
      // TODO: Add exceptions
      if (false) {
        addResizeHandle()
        loadIframe()
        addShowHideButton()

        if(! isVisible) hideIframe()
      }
    } catch (error) {
      console.warn("An error ocurred trying to run the extension", error)
    }

    function addResizeHandle() {
      $resizingBox.hide()
      $handle.css('right', currentWidth + '%')
      $('html body').append($handle).append($resizingBox)

      let isResizing = false
      let startPosition = null
      let baseWidth = null

      $(document).mousemove(event => {
        if(! isResizing) return

        if(! startPosition) {
          startPosition = event.pageX
        }

        let windowWidth = $(document).outerWidth()
        let diff = (event.pageX || globalPageX) - startPosition
        diff = diff || 0

        let percentage = 100 * diff / windowWidth

        currentWidth = Math.max(baseWidth - percentage,  100 * 100 / windowWidth)

        $handle.css('right', currentWidth + '%')

        let css = baseWidth <= currentWidth
          ? { right: baseWidth + '%',    width: (currentWidth - baseWidth) + '%' }
          : { right: currentWidth + '%', width: (baseWidth - currentWidth) + '%' }

        $resizingBox.css(css)
      })

      $handle.mousedown(preventDefault(() => {
        isResizing = true
        baseWidth = currentWidth

        $resizingBox.css('width', 0).show()
        $(document).css('cursor', 'move')
      }))

      $(document).mouseup(preventDefault(() => {
        if(! isResizing) return

        isResizing = false
        startPosition = null

        $resizingBox.hide()
        resizeIframe()
        $('body').css('cursor', 'auto')

        // Save configuration
        configuration.set({ iframeWidth: toFixed(currentWidth, 2) })
      }))
    }


    function addShowHideButton() {
      // TODO: Wording and class here
      let template = `<div class="__iframe-actions">
        <a href="#" class="onoff">Hide</a>
        <a href="#" class="options">
          <img src="${gearPath}" alt="Grear"/>
        </a>
      </div>`

      $('html body').append(template)

      $('.__iframe-actions .onoff').click(preventDefault(toggleIFrame))

      $('.__iframe-actions .options').click(preventDefault(() =>
        chrome.extension.sendMessage({ action: 'openOptions' })
      ))
    }

    function loadIframe() {
      $gmailHTML = $('html')
      extensionActive = true

      $outerframe = $('#embedded-frame')

      if ($outerframe.length === 0) {
        $outerframe = $('<div>', { id: 'embedded-frame' }).append(`<iframe src="${config.sitePage}" frameborder="0"></iframe>`)
        resizeIframe()

        $('html body').prepend($outerframe)

        if (config.expandOnHover) {
          $gmailHTML.mouseenter(collapseIframe)
          $outerframe.mouseout(collapseIframe)
        }
      }
      else {
        resizeIframe()
        $outerframe.toggleClass('hidden', false);
      }

      $handle.show()
      $('.__iframe-actions .onoff').text('Hide')
      chrome.extension.sendMessage({ action: 'visibleChange', data: { isVisible: true } }, function (response) {})
    }

    function collapseIframe() {
      insideIframe = false
      $outerframe.stop(true, false).animate({ 'width': currentWidth + '%' }, 0)
    }

    function resizeIframe() {
      $gmailHTML.css({  'width': (100 - currentWidth) + '%' })
      $outerframe.css({ 'width': currentWidth + '%' })

      window.dispatchEvent(new Event('resize'))
    }

    function hideIframe() {
      extensionActive = false

      $gmailHTML.css({ 'width': '100%' })
      $outerframe.toggleClass('hidden', true)
      $handle.hide()

      $('.__iframe-actions .onoff').text('Show')

      chrome.extension.sendMessage({ action: 'visibleChange', data: { isVisible: false } }, function (response) {})
    }

    function toggleIFrame() {
      insideIframe = false

      if (extensionActive) {
        hideIframe()
      } else {
        loadIframe()
      }
    }

    insideIframe = false

    chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
      const HOVER_WIDTH = '70%'

      if (request.action == 'mousemove') {
        let shouldAnimateFrame = config.expandOnHover && extensionActive && ! insideIframe

        if(shouldAnimateFrame && request.e.pageX > 50 && HOVER_WIDTH > currentWidth) {
          insideIframe = true
          $outerframe.stop(true, false).animate({ 'width': HOVER_WIDTH }, 0)
        }

        globalPageX = request.e.pageX + $outerframe.position().left
        $(document).trigger('mousemove')

      } else if (request.action == 'mouseup') {
        $(document).trigger('mouseup')
      }
    })

    console.log("Iframe finished loading.")
  })


  function preventDefault(fn) {
    return event => {
      event.preventDefault()
      fn(event)
    }
  }

  function toFixed(number, decimals) {
    return parseFloat(number.toFixed(decimals))
  }
})()
