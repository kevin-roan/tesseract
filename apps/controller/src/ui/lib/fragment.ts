/**
 * Reads secrets from the URL fragment (never sent to the server) and removes
 * them from the address bar and history right away.
 */
export function takeFragment(): URLSearchParams {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (window.location.hash) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  return params;
}
