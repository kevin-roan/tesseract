import { Suspense } from "react";
import { Navigate, useParams, type RouteObject } from "react-router";
import { DEFAULT_PAGE, ROUTE } from "../../shared/routes";
import { GalleryPage } from "../gallery/GalleryPage";
import { OnboardingShell } from "../onboarding/shell";
import { Shell } from "../shell/Shell";
import { useTrayStatus } from "./connection";
import { runtime } from "./runtime";
import { findPage } from "./registry/pages";

function PageRoute() {
  const { pageId = DEFAULT_PAGE } = useParams();
  const page = findPage(pageId);
  if (!page) return <Navigate to={ROUTE.page(DEFAULT_PAGE)} replace />;
  const Component = page.component;
  return (
    <Suspense fallback={null}>
      <Component key={page.id} />
    </Suspense>
  );
}

function ShellRoute() {
  useTrayStatus();
  return <Shell />;
}

function RootRedirect() {
  return <Navigate to={runtime.windowKind === "onboarding" ? ROUTE.onboarding("welcome") : ROUTE.page(DEFAULT_PAGE)} replace />;
}

export const ROUTES: RouteObject[] = [
  { path: "/onboarding/:step?", element: <OnboardingShell /> },
  { path: "/gallery/:entry?", element: <GalleryPage /> },
  {
    path: "/",
    element: <ShellRoute />,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: ":pageId/*", element: <PageRoute /> },
    ],
  },
];
