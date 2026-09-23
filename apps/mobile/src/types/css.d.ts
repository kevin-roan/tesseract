/**
 * CSS is consumed on the web target only: plain stylesheets are imported for
 * their side effect (`@/global.css` declares the font variables), and CSS
 * modules resolve to a class-name map. Neither has types of its own, so declare
 * them here.
 */

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
