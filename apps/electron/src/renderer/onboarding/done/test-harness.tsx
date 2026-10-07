import { MotionConfig } from "motion/react";
import { useState, type ReactElement } from "react";
import type { RouteObject } from "react-router";
import { renderRoutes } from "../../test/render";
import { FooterTargetContext } from "../shared/footer-context";

function WithFooter({ children }: { children: ReactElement }) {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  return (
    <MotionConfig reducedMotion="always" skipAnimations>
      <FooterTargetContext.Provider value={footer}>{children}</FooterTargetContext.Provider>
      <footer ref={setFooter} data-testid="footer" />
    </MotionConfig>
  );
}

export function renderStep(step: ReactElement, path: string) {
  const routes: RouteObject[] = [
    { path: "/onboarding/:step", element: <WithFooter>{step}</WithFooter> },
    { path: "/:page", element: <div data-testid="main-page" /> },
  ];
  return renderRoutes(routes, path);
}
