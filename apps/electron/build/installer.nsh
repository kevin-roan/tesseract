!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define MONOLITH_ENV_KEY "Environment"
!define MONOLITH_PATH_VALUE "Path"
!define MONOLITH_CLI_DIR "$INSTDIR\resources\bin"

!macro MONOLITH_PATH_FUNCTIONS PREFIX
  Function ${PREFIX}MonolithPathWithout
    Exch $R1
    Exch
    Exch $R0
    Push $R2
    Push $R3
    Push $R4
    Push $R5
    StrCpy $R2 ""
    StrCpy $R3 0
    StrCpy $R4 ""
    ${Do}
      StrCpy $R5 $R0 1 $R3
      ${If} $R5 == ";"
      ${OrIf} $R5 == ""
        ${If} $R4 != ""
        ${AndIf} $R4 != $R1
        ${AndIf} $R4 != "$R1\"
          ${If} $R2 == ""
            StrCpy $R2 $R4
          ${Else}
            StrCpy $R2 "$R2;$R4"
          ${EndIf}
        ${EndIf}
        StrCpy $R4 ""
        ${IfThen} $R5 == "" ${|} ${ExitDo} ${|}
      ${Else}
        StrCpy $R4 "$R4$R5"
      ${EndIf}
      IntOp $R3 $R3 + 1
    ${Loop}
    StrCpy $R0 $R2
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Exch
    Pop $R1
    Exch $R0
  FunctionEnd

  Function ${PREFIX}MonolithPathValueExists
    Push $R0
    Push $R1
    Push $R2
    StrCpy $R1 0
    StrCpy $R2 0
    ${Do}
      EnumRegValue $R0 HKCU "${MONOLITH_ENV_KEY}" $R1
      ${IfThen} $R0 == "" ${|} ${ExitDo} ${|}
      ${If} $R0 == "${MONOLITH_PATH_VALUE}"
        StrCpy $R2 1
        ${ExitDo}
      ${EndIf}
      IntOp $R1 $R1 + 1
    ${Loop}
    StrCpy $R0 $R2
    Pop $R2
    Pop $R1
    Exch $R0
  FunctionEnd

  Function ${PREFIX}MonolithUpdateUserPath
    Exch $R1
    Push $R0
    Push $R2
    ClearErrors
    ReadRegStr $R0 HKCU "${MONOLITH_ENV_KEY}" "${MONOLITH_PATH_VALUE}"
    ${If} ${Errors}
      Call ${PREFIX}MonolithPathValueExists
      Pop $R2
      ${If} $R2 == 1
        DetailPrint "Monolith: the user PATH could not be read, leaving it unchanged"
        Goto monolith_path_done
      ${EndIf}
      StrCpy $R0 ""
    ${EndIf}
    Push $R0
    Push "${MONOLITH_CLI_DIR}"
    Call ${PREFIX}MonolithPathWithout
    Pop $R2
    ${If} $R1 == "add"
      ${If} $R2 == ""
        StrCpy $R2 "${MONOLITH_CLI_DIR}"
      ${Else}
        StrCpy $R2 "$R2;${MONOLITH_CLI_DIR}"
      ${EndIf}
    ${EndIf}
    ${If} $R2 S== $R0
      Goto monolith_path_done
    ${EndIf}
    ${If} $R2 == ""
      DeleteRegValue HKCU "${MONOLITH_ENV_KEY}" "${MONOLITH_PATH_VALUE}"
    ${Else}
      WriteRegExpandStr HKCU "${MONOLITH_ENV_KEY}" "${MONOLITH_PATH_VALUE}" $R2
    ${EndIf}
    SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:${MONOLITH_ENV_KEY}" /TIMEOUT=5000
    monolith_path_done:
    Pop $R2
    Pop $R0
    Pop $R1
  FunctionEnd
!macroend

!ifdef BUILD_UNINSTALLER
  !insertmacro MONOLITH_PATH_FUNCTIONS "un."
!else
  !insertmacro MONOLITH_PATH_FUNCTIONS ""
!endif

!macro customInstall
  Push "add"
  Call MonolithUpdateUserPath
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    Push "remove"
    Call un.MonolithUpdateUserPath
  ${EndIf}
!macroend
