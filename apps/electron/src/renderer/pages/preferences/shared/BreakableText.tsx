import { Fragment } from "react";
import { PATH_BREAK_AFTER } from "./constants";

export function BreakableText({ text }: { text: string }) {
  const parts = text.split(PATH_BREAK_AFTER);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <>
              {PATH_BREAK_AFTER}
              <wbr />
            </>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}
