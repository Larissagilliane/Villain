import clsx from 'clsx'
import React, { useState, useEffect } from 'react'
import OpenSeaDragon from 'openseadragon'
import OSDConfig from '@/osd.config'
import RenderError from '@/components/renderError'
import ToolbarConsumer from '@/components/toolbar'
import { getKeyByValue, debounce } from '@/lib/utils'
import { memoizeZoomClamp, memoizeZoomPercent } from '@/lib/zoom-parser'
import { fullscreenElement, onFullscreenChange } from '@/lib/full-screen'
// Icons
import { mdiImageBrokenVariant } from '@mdi/js'

const CanvasRender = ({
  id,
  container,
  renderError,
  initialPage,
  mangaMode,
  bookMode,
  updateCotextState,
  totalPages,
  currentPage,
}) => {
  //To do
  // static defaultProps = {
  //   initialPage: 0,
  // }

  // constructor(props) {
  //   super(props)
  //   this.viewer = null
  //   this.browser = null
  //   this.isScrolling = false
  //   this.OSDContainer = React.createRef()
  //   this.clearScrollingDelay = null
  // }

  useEffect(() => {
    initOpenSeaDragon()
    renderPage(initialPage)

    // Page changed

    // Render new valid page
    if (currentPage >= 0 && currentPage < totalPages) {
      renderPage(currentPage)
    }

    // Page changed

    if (bookMode) {
      // Trigger re-render layout
      renderLayout()
      fitBounds()
    }

    // Re-render layout when mangaMode and there and book mode is active
    if (mangaMode && bookMode) {
      renderLayout()
    }
    return function cleanup() {
      // Remove event listeners
      onFullscreenChange(container, 'remove', handleFullscreenChange)
      // Destroy OpenSeaDragon viewer
      this.viewer.destroy()
      this.viewer = null
    }
  })

  const fitPagesLegacy = () => {
    const { viewport, world } = this.viewer
    const bounds = world.getHomeBounds()
    viewport.fitBoundsWithConstraints(bounds, true)
  }

  const fitPages = orientation => {
    const { viewport, world } = this.viewer

    if (!orientation) {
      fitPagesLegacy()
    }

    if (orientation === 'vertical') {
      viewport.fitVertically(true)
    }

    if (orientation === 'horizontal') {
      viewport.fitHorizontally(true)
    }
  }

  const renderLayout = () => {
    const { world } = this.viewer

    const pos = new OpenSeaDragon.Point(0, 0)
    const count = world.getItemCount()

    // Cache tile data
    let bounds = null
    // first page
    let firstPage = null
    let firstPageIndex = bookMode && mangaMode && count > 1 ? 1 : 0
    let firstPageBounds = null
    // Next page
    let nextPage = null
    let nextPageBounds = null
    let nextPageIndex = bookMode && mangaMode ? 0 : 1

    if (count > 0) {
      // Page view (single page)
      firstPage = world.getItemAt(firstPageIndex)
      firstPageBounds = firstPage.getBounds()

      // Book view ( two pages )
      if (count > 1) {
        nextPage = world.getItemAt(nextPageIndex)
        nextPageBounds = nextPage.getBounds()

        // Auto resize page to fit first page height
        if (firstPageBounds.height > nextPageBounds.height) {
          nextPage.setHeight(firstPageBounds.height, true)
          // Recalculate bounds
          nextPageBounds = nextPage.getBounds()
        }

        // Auto resize page to fit next page height
        if (nextPageBounds.height > firstPageBounds.height) {
          firstPage.setHeight(nextPageBounds.height, true)
          // Recalculate bounds
          firstPageBounds = firstPage.getBounds()
        }
      }

      // Set position for first page
      if (firstPage && firstPageBounds) {
        firstPage.setPosition(pos, true)
        pos.x += firstPageBounds.width
      }

      // Set position for next page
      if (nextPage && nextPageBounds) {
        nextPage.setPosition(pos, true)
        pos.x += nextPageBounds.width
      }
    }
  }

  // Get the max target zoom
  const getTargetZoom = (scale = 1) => {
    let zooms = []
    const { viewport, world } = this.viewer
    const count = world.getItemCount()

    for (let i = 0; i < count; i++) {
      zooms[i] = world.getItemAt(i).imageToViewportZoom(scale)
    }

    return Math.max(zooms) || zooms[0]
  }

  const updateZoomLimits = () => {
    const { viewport } = this.viewer
    const targetZoom = 0.9
    const realTargetZoom = this.getTargetZoom()
    const imageBounds = this.viewer.world.getHomeBounds()
    const viewportBounds = viewport.getBounds()
    const imageAspect = imageBounds.width / imageBounds.height
    const viewportAspect = viewportBounds.width / viewportBounds.height
    const aspectFactor = imageAspect / viewportAspect
    const zoomFactor = (aspectFactor >= 1 ? 1 : aspectFactor) * targetZoom
    const zoom = zoomFactor / imageBounds.width
    const minZoom = realTargetZoom <= zoom ? realTargetZoom : zoom
    viewport.defaultZoomLevel = minZoom
    viewport.minZoomLevel = minZoom
    viewport.maxZoomLevel = realTargetZoom
  }

  const updateZoom = (scale = 1) => {
    const { viewport } = this.viewer
    const max = viewport.getMaxZoom()
    const min = viewport.getMinZoom()

    if (scale) {
      // Clamp zoom value
      let zoom = memoizeZoomClamp(scale, max, min)
      // Update
      viewport.zoomTo(zoom, true)
      viewport.ensureVisible(true)
    }
  }

  const zoomIn = () => {
    const { viewport } = this.viewer
    const max = viewport.getMaxZoom()
    const zoom = viewport.getZoom()
    const currentZoom = memoizeZoomPercent(zoom, max)
    updateZoom(currentZoom + 10)
  }

  const zoomOut = () => {
    const { viewport } = this.viewer
    const max = viewport.getMaxZoom()
    const zoom = viewport.getZoom()
    const currentZoom = memoizeZoomPercent(zoom, max)
    updateZoom(currentZoom - 10)
  }

  const zoomToOriginalSize = () => {
    const targetZoom = this.getTargetZoom()
    this.viewer.viewport.zoomTo(targetZoom, null, true)
  }

  const handleError = error => {
    this.viewer.close()
    updateContextState({ renderError: true })
  }

  const handleFullscreenChange = () => {
    const fullscreen = fullscreenElement() !== null
    updateContextState({ fullscreen })
    this.updateZoomLimits()
  }

  const handleZoom = ({ zoom }) => {
    const { viewport } = this.viewer
    const min = viewport.getMinZoom()
    const max = viewport.getMaxZoom()
    const currentZoom = memoizeZoomPercent(zoom, max)
    const canZoomIn = zoom < max && currentZoom < 100
    const canZoomOut = zoom > min
    updateContextState({ currentZoom, canZoomIn, canZoomOut })
  }

  const handleZoomOptimized = debounce(event => {
    // Unable to update zoom on scroll inside this event handler:
    // - Bad peformance from multiple context update state calls
    // - Small delay for text updating noticeable.
    if (!this.isScrolling) {
      handleZoom(event)
    }
  }, 200)

  const handleScrollOptimized = () => {
    // Reset scrolling flag
    isScrolling = true
    // Clear our timeout throughout the scroll
    window.clearTimeout(this.clearScrollingDelay)
    // Set a timeout to run after scrolling ends
    clearScrollingDelay = setTimeout(() => {
      this.isScrolling = false
      handleZoomOptimized({ zoom: this.viewer.viewport.getZoom() })
    }, 400)
  }

  initOpenSeaDragon = () => {
    const { id, container, pages, renderError, updateContextState } = this.props

    // Detect browser vendor
    this.browser = getKeyByValue(OpenSeaDragon.BROWSERS, OpenSeaDragon.Browser.vendor)

    // Create viewer
    this.viewer = OpenSeaDragon({
      element: this.OSDContainer.current,
      tileSources: pages[0],
      ...OSDConfig,
    })

    // Events handler
    this.viewer.addHandler('open', () => {
      this.renderLayout()
      this.fitBounds()

      // Prevent unessesart context updates
      if (renderError) {
        updateContextState({ renderError: false })
      }
    })

    // Events handler
    this.viewer.addHandler('resize', () => {
      updateZoomLimits()
    })

    // Fallback to improve peformance on zoom upodates"
    // Fix issue with animations and peformance, see:
    // https://github.com/btzr-io/Villain/issues/66
    this.viewer.addHandler('zoom', handleZoomOptimized)
    // Optimized scroll event
    this.viewer.addHandler('canvas-scroll', handleScrollOptimized)

    this.viewer.addHandler('open-failed', handleError)

    onFullscreenChange(container, 'add', handleFullscreenChange)
  }

  const renderPage = index => {
    const page = getPage(index)
    page && this.viewer.open(page)
  }

  const renderCover = () => {
    renderPage(0)
  }

  const fitBounds = () => {
    const { viewport } = this.viewer
    fitPages()
    updateZoomLimits()
    viewport.zoomTo(viewport.getMinZoom(), null, true)
  }

  return (
    <React.Fragment>
      <ToolbarConsumer
        container={container}
        updateZoom={updateZoom}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
      />
      <div ref={this.OSDContainer} className={'villain-canvas'} />
      {renderError && (
        <RenderError message={'Invalid image'} icon={mdiImageBrokenVariant} />
      )}
    </React.Fragment>
  )
}

export default CanvasRender
