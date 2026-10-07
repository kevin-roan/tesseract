declare module "@novnc/novnc" {
  const RFB: new (target: HTMLElement, urlOrChannel: unknown, options?: unknown) => EventTarget;
  export default RFB;
}
