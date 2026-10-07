import type { MouseEvent } from "react";
import type { InlineNode } from "./parser";
import { useOpenLink } from "./use-open-link";
import styles from "./MarkdownView.module.css";

export interface InlineProps {
  nodes: readonly InlineNode[];
}

export function Inline({ nodes }: InlineProps) {
  const openLink = useOpenLink();
  return <InlineNodes nodes={nodes} onLink={openLink} />;
}

function InlineNodes({ nodes, onLink }: InlineProps & { onLink: (url: string) => void }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "code":
        return (
          <code key={index} className={styles.inlineCode}>
            {node.text}
          </code>
        );
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            className={styles.link}
            tabIndex={-1}
            onClick={(event: MouseEvent) => {
              event.preventDefault();
              onLink(node.href);
            }}
          >
            {node.label}
          </a>
        );
      case "strong":
        return (
          <strong key={index} className={styles.strong}>
            <InlineNodes nodes={node.children} onLink={onLink} />
          </strong>
        );
      case "em":
        return (
          <em key={index}>
            <InlineNodes nodes={node.children} onLink={onLink} />
          </em>
        );
      case "strike":
        return (
          <s key={index}>
            <InlineNodes nodes={node.children} onLink={onLink} />
          </s>
        );
    }
  });
}
