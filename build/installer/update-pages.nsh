; Included when customWelcomePage EXPANDS, after common.nsh. NSIS does not
; permit a macro declaration nested directly inside another macro declaration.
!macroundef skipPageIfUpdated
!macro skipPageIfUpdated
  !define MUI_PAGE_CUSTOMFUNCTION_PRE MyTracerSkipRecognizedUpdate
!macroend
