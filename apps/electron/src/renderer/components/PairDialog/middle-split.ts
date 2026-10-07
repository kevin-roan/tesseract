export function middleSplit(value: string): [string, string] {
  const middle = Math.ceil(value.length / 2);
  return [value.slice(0, middle), value.slice(middle)];
}
