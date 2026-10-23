; Pure decision macro, shared by the installer and the executable NSIS fixture.
; Inputs are raw records, NOT upstream flags (which command-line options can alter).
!macro MyTracerSelectUpdateScope
  StrCpy $myTracerUpdateScope ""
  StrCpy $myTracerUpdatePath ""
  ${If} $myTracerUpdated == "1"
  ${AndIf} $myTracerDirectoryOverride == ""
    ${If} $myTracerUserPath != ""
    ${AndIf} $myTracerUserUninstallCommand == '"$myTracerUserPath\${UNINSTALL_FILENAME}" /currentuser'
    ${AndIf} $myTracerUserExists == "1"
    ${AndIf} $myTracerMachinePath == ""
    ${AndIf} $myTracerMachineUninstallCommand == ""
      StrCpy $myTracerUpdateScope "user"
      StrCpy $myTracerUpdatePath $myTracerUserPath
    ${ElseIf} $myTracerMachinePath != ""
    ${AndIf} $myTracerMachineUninstallCommand == '"$myTracerMachinePath\${UNINSTALL_FILENAME}" /allusers'
    ${AndIf} $myTracerMachineExists == "1"
    ${AndIf} $myTracerUserPath == ""
    ${AndIf} $myTracerUserUninstallCommand == ""
      StrCpy $myTracerUpdateScope "machine"
      StrCpy $myTracerUpdatePath $myTracerMachinePath
    ${EndIf}
  ${EndIf}
!macroend

; Elevation may change HKCU. The outer process already selected machine scope;
; confirm its records again, never infer a fresh install from missing records.
!macro MyTracerSelectElevatedUpdateScope
  StrCpy $myTracerUpdateScope ""
  StrCpy $myTracerUpdatePath ""
  ${If} $myTracerMachinePath != ""
  ${AndIf} $myTracerMachineUninstallCommand == '"$myTracerMachinePath\${UNINSTALL_FILENAME}" /allusers'
  ${AndIf} $myTracerMachineExists == "1"
  ${AndIf} $myTracerDirectoryOverride == ""
    StrCpy $myTracerUpdateScope "machine"
    StrCpy $myTracerUpdatePath $myTracerMachinePath
  ${EndIf}
!macroend
