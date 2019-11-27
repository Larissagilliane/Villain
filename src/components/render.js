import React from 'react'
import CanvasRender from './canvasRender'
import { ReaderContext } from '../context'

const CanvasRenderConsumer = React.memo(({ container }) => {
  return (
    <ReaderContext.Consumer>
      {({
        // State
        ready,
        error,
        hover,
        pages,
        bookMode,
        mangaMode,
        totalPages,
        currentPage,
        renderError,
        allowFullScreen,
        allowGlobalShortcuts,
        // Actions
        getPage,
        updateState,
      }) => {
        const shouldRender = ready && !error

        return (
          shouldRender && (
            <CanvasRender
              hover={hover}
              pages={pages}
              container={container}
              currentPage={currentPage}
              getPage={getPage}
              bookMode={bookMode}
              mangaMode={mangaMode}
              totalPages={totalPages}
              renderError={renderError}
              allowFullScreen={allowFullScreen}
              allowGlobalShortcuts={allowGlobalShortcuts}
              updateContextState={updateState}
            />
          )
        )
      }}
    </ReaderContext.Consumer>
  )
})

export default CanvasRenderConsumer
