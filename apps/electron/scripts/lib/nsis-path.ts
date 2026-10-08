export const NSIS_TEST_INSTDIR = "C:\\inst";
export const NSIS_TEST_RESULT = "result.txt";

export interface NsisPathCase {
  name: string;
  initial?: string | null;
  action: "add" | "remove";
  expected: string | null;
}

export const NSIS_PATH_CASES: readonly NsisPathCase[] = [
  { name: "add", initial: "C:\\foo;%USERPROFILE%\\bin", action: "add", expected: "C:\\foo;%USERPROFILE%\\bin;C:\\inst\\resources\\bin" },
  { name: "add-again", action: "add", expected: "C:\\foo;%USERPROFILE%\\bin;C:\\inst\\resources\\bin" },
  { name: "remove", action: "remove", expected: "C:\\foo;%USERPROFILE%\\bin" },
  {
    name: "remove-variants",
    initial: "C:\\INST\\Resources\\Bin\;C:\\a;;C:\\inst\\resources\\bin;C:\\b",
    action: "remove",
    expected: "C:\\a;C:\\b",
  },
  { name: "add-missing", initial: null, action: "add", expected: "C:\\inst\\resources\\bin" },
  { name: "remove-only", action: "remove", expected: null },
];

const MISSING = "<missing>";

function windowsPath(path: string): string {
  return `Z:${path.replace(/\//g, "\\")}`;
}

function setInitial(initial: string | null | undefined): string[] {
  if (initial === undefined) return [];
  if (initial === null) return ['  DeleteRegValue HKCU "Environment" "Path"'];
  return [`  WriteRegExpandStr HKCU "Environment" "Path" "${initial}"`];
}

export function nsisPathScript(includeFile: string, resultFile: string): string {
  const steps = NSIS_PATH_CASES.flatMap((step) => [
    ...setInitial(step.initial),
    `  Push "${step.action}"`,
    "  Call TesseractUpdateUserPath",
    `  Push "${step.name}"`,
    "  Call Dump",
  ]);
  return [
    "Unicode true",
    "SilentInstall silent",
    "RequestExecutionLevel user",
    'OutFile "path-test.exe"',
    `!include "${includeFile}"`,
    "Var Out",
    "Function Dump",
    "  Exch $R9",
    "  ClearErrors",
    '  ReadRegStr $R8 HKCU "Environment" "Path"',
    `  \${If} \${Errors}`,
    `    StrCpy $R8 "${MISSING}"`,
    `  \${EndIf}`,
    '  FileWrite $Out "$R9=$R8$\\n"',
    "  Pop $R9",
    "FunctionEnd",
    "Section",
    `  StrCpy $INSTDIR "${NSIS_TEST_INSTDIR}"`,
    `  FileOpen $Out "${windowsPath(resultFile)}" w`,
    ...steps,
    "  FileClose $Out",
    "SectionEnd",
    "",
  ].join("\n");
}

export function nsisPathMismatches(output: string): string[] {
  const actual = new Map(
    output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)] as const;
      }),
  );
  return NSIS_PATH_CASES.flatMap((step) => {
    const expected = step.expected ?? MISSING;
    const got = actual.get(step.name);
    return got === expected ? [] : [`${step.name}: expected ${expected}, got ${got ?? "nothing"}`];
  });
}
