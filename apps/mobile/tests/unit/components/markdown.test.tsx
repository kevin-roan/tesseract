import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import Markdown from "@/components/markdown";
import { resolveFace } from "@/components/markdown/faces";
import { Colors } from "@/theme";

const styleOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style);

describe("<Markdown />", () => {
  it("draws text in the app's faces and colors", async () => {
    await render(
      <Markdown color="bubbleAssistantText">
        {"# Plan\n\nPlain **bold** and *soft* with `code` and [docs](https://example.com).\n\n- one\n- two"}
      </Markdown>,
    );

    expect(styleOf("Plan").fontFamily).toBe("Exo2_600SemiBold");
    expect(styleOf("Plain ")).toMatchObject({ fontFamily: "NotoSans_400Regular", color: Colors.light.bubbleAssistantText });
    expect(styleOf("bold").fontFamily).toBe("NotoSans_600SemiBold");
    expect(styleOf("soft").fontFamily).toBe("NotoSans_400Regular_Italic");
    expect(styleOf("code")).toMatchObject({ fontFamily: "GeistMono_400Regular", backgroundColor: Colors.light.codeBackground });
    expect(styleOf("docs")).toMatchObject({ color: Colors.light.accentStrong, textDecorationLine: "underline" });
    expect(screen.getByText("one")).toBeOnTheScreen();
    expect(screen.getByText("two")).toBeOnTheScreen();
  });

  it("renders a fenced code block in the code face", async () => {
    await render(<Markdown>{"```ts\nconst a = 1;\n```"}</Markdown>);
    expect(styleOf("const a = 1;").fontFamily).toBe("GeistMono_400Regular");
  });
});

describe("resolveFace", () => {
  it("combines weight and slant into one registered face", () => {
    const body = { fontFamily: "NotoSans_400Regular" };
    expect(resolveFace({ ...body, fontWeight: "600", fontStyle: "italic" })).toEqual({ fontFamily: "NotoSans_600SemiBold_Italic" });
    expect(resolveFace({ ...body, fontWeight: "600" })).toEqual({ fontFamily: "NotoSans_600SemiBold" });
    expect(resolveFace({ fontFamily: "Exo2_600SemiBold", fontWeight: "700" })).toMatchObject({ fontFamily: "Exo2_700Bold" });
    expect(resolveFace({ fontFamily: "Unknown", fontWeight: "700" })).toEqual({ fontFamily: "Unknown", fontWeight: "700" });
  });
});
