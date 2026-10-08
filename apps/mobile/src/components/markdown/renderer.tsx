import type { ReactNode } from "react";
import { ScrollView, Text, View, type TextStyle } from "react-native";
import { Renderer } from "react-native-marked";

import { resolveFace } from "./faces";
import type { MarkdownStyles } from "./styles";

/**
 * Draws markdown with the app's styles: block layout comes from `MarkdownStyles`
 * instead of the library defaults, and every run of text is set in a registered
 * face so bold and italic match the rest of the app.
 */
export default class ThemedRenderer extends Renderer {
  constructor(private readonly styles: MarkdownStyles) {
    super({ selectable: true });
  }

  paragraph(children: ReactNode[]): ReactNode {
    return super.paragraph(children, this.styles.paragraph);
  }

  blockquote(children: ReactNode[]): ReactNode {
    return super.blockquote(children, this.styles.blockquote);
  }

  heading(text: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.heading(text, resolveFace(style));
  }

  code(text: string): ReactNode {
    return (
      <View key={this.getKey()} style={this.styles.code}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text selectable style={this.styles.codeText}>
            {text.replace(/\n$/, "")}
          </Text>
        </ScrollView>
      </View>
    );
  }

  hr(): ReactNode {
    return super.hr(this.styles.hr);
  }

  listItem(children: ReactNode[]): ReactNode {
    return super.listItem(children, this.styles.listItem);
  }

  list(ordered: boolean, li: ReactNode[], _listStyle?: unknown, textStyle?: TextStyle, startIndex?: number): ReactNode {
    return (
      <View key={this.getKey()} style={this.styles.list}>
        {super.list(ordered, li, this.styles.listMarker, resolveFace(textStyle), startIndex)}
      </View>
    );
  }

  escape(text: string, style?: TextStyle): ReactNode {
    return super.escape(text, resolveFace(style));
  }

  link(children: string | ReactNode[], href: string, style?: TextStyle, title?: string): ReactNode {
    return super.link(children, href, resolveFace(style), title);
  }

  strong(children: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.strong(children, resolveFace(style));
  }

  em(children: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.em(children, resolveFace(style));
  }

  codespan(text: string, style?: TextStyle): ReactNode {
    return super.codespan(text, resolveFace(style));
  }

  del(children: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.del(children, resolveFace(style));
  }

  text(text: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.text(text, resolveFace(style?.fontFamily ? style : this.styles.text));
  }

  html(text: string | ReactNode[], style?: TextStyle): ReactNode {
    return super.html(text, resolveFace(style));
  }

  table(header: ReactNode[][], rows: ReactNode[][][]): ReactNode {
    return super.table(header, rows, this.styles.table, this.styles.tableRow, this.styles.tableCell);
  }
}
