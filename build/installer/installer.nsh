; electron-builder 26.15.3 assisted installer hooks. No replacement installer script.
!include "${__FILEDIR__}\update-scope.nsh"
!define MUI_WELCOMEFINISHPAGE_BITMAP_STRETCH FitControl
!define MUI_UNWELCOMEFINISHPAGE_BITMAP_STRETCH FitControl

!ifndef BUILD_UNINSTALLER
!define MUI_FINISHPAGE_TITLE "$myTracerFinishTitle"
!define MUI_FINISHPAGE_TEXT "$myTracerFinishText"
Var myTracerFinishTitle
Var myTracerFinishText
Var myTracerUpdateScope
Var myTracerUpdatePath
Var myTracerUpdated
Var myTracerDirectoryOverride
Var myTracerUserPath
Var myTracerUserUninstallCommand
Var myTracerMachinePath
Var myTracerMachineUninstallCommand
Var myTracerUserExists
Var myTracerMachineExists
!endif

!macro customHeader
  ; Native dialog units and controls still handle DPI; no bundled UI font.
  SetFont /LANG=2052 "Microsoft YaHei UI" 9
!macroend

!macro customInit
  StrCpy $myTracerFinishTitle "$(MUI_TEXT_FINISH_INFO_TITLE)"
  StrCpy $myTracerFinishText "$(MUI_TEXT_FINISH_INFO_TEXT)"
  ${If} $LANGUAGE == 2052
    StrCpy $myTracerFinishTitle "MyTracer 安装完成"
    StrCpy $myTracerFinishText "MyTracer 已安装到这台电脑。$\r$\n$\r$\n点击“完成”关闭安装向导。"
  ${EndIf}
  StrCpy $myTracerUpdated "0"
  ${If} ${isUpdated}
    StrCpy $myTracerUpdated "1"
  ${EndIf}
  ; Explicit scope switches keep upstream semantics, never mix a recognized
  ; user path with an explicit all-users selection (or vice versa).
  ${If} ${isForAllUsers}
  ${OrIf} ${isForCurrentUser}
    StrCpy $myTracerUpdated "0"
  ${EndIf}
  !insertmacro GetDParameter $myTracerDirectoryOverride
  ; .onInit has already selected the correct registry view for x64.
  ReadRegStr $myTracerUserPath HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $myTracerUserUninstallCommand HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  ReadRegStr $myTracerMachinePath HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $myTracerMachineUninstallCommand HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  StrCpy $myTracerUserExists "0"
  StrCpy $myTracerMachineExists "0"
  ${If} ${FileExists} "$myTracerUserPath\${APP_EXECUTABLE_FILENAME}"
    StrCpy $myTracerUserExists "1"
  ${EndIf}
  ${If} ${FileExists} "$myTracerMachinePath\${APP_EXECUTABLE_FILENAME}"
    StrCpy $myTracerMachineExists "1"
  ${EndIf}
  !insertmacro MyTracerSelectUpdateScope
  ; The upstream inner-instance branch precedes customInstallMode and always
  ; selects machine scope. HKCU may now belong to a different admin account.
  ${If} ${UAC_IsInnerInstance}
  ${AndIf} $myTracerUpdated == "1"
    !insertmacro MyTracerSelectElevatedUpdateScope
    ${If} $myTracerUpdateScope == ""
      ; Never let the upstream inner shortcut choose a new default path when
      ; the existing machine installation cannot be confirmed after elevation.
      ${If} $LANGUAGE == 2052
        MessageBox MB_OK|MB_ICONSTOP "无法确认原安装位置。本次更新已停止，请关闭向导后手动运行安装程序。"
      ${Else}
        MessageBox MB_OK|MB_ICONSTOP "The existing installation could not be confirmed. Close this update and run the installer manually."
      ${EndIf}
      Quit
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    ${If} $myTracerUpdateScope == "user"
      StrCpy $isForceCurrentInstall "1"
    ${ElseIf} $myTracerUpdateScope == "machine"
      ; Upstream owns elevation, cancellation and the inner process. Refusing
      ; UAC exits this attempt without installing as a different user/scope.
      StrCpy $isForceMachineInstall "1"
    ${EndIf}
  !endif
!macroend

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
  ; common.nsh is loaded before this hook. Replace its unconditional --updated
  ; page skip only here, before assistedInstaller emits license/directory pages.
  !include "${BUILD_RESOURCES_DIR}\installer\update-pages.nsh"
  Function MyTracerSkipRecognizedUpdate
    ${If} $myTracerUpdateScope != ""
      Abort
    ${EndIf}
  FunctionEnd
!macroend

!macro customPageAfterChangeDir
  ; This hook is after upstream's instFilesPre definition but before INSTFILES.
  !define /redef MUI_PAGE_CUSTOMFUNCTION_PRE MyTracerInstFilesPre
  Function MyTracerInstFilesPre
    ${If} $myTracerUpdateScope != ""
      ; Preserve even an existing custom folder without "MyTracer" in its name.
      StrCpy $INSTDIR $myTracerUpdatePath
    ${Else}
      Call instFilesPre
    ${EndIf}
  FunctionEnd
!macroend
