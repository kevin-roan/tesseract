export function isTruncated(element: Element): boolean {
  return element.scrollWidth > element.clientWidth;
}
