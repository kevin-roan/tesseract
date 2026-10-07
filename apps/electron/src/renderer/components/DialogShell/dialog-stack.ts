const stack: string[] = [];

export function pushDialog(id: string): () => void {
  stack.push(id);
  return () => {
    const index = stack.lastIndexOf(id);
    if (index >= 0) stack.splice(index, 1);
  };
}

export function isTopDialog(id: string): boolean {
  return stack[stack.length - 1] === id;
}

export function openDialogCount(): number {
  return stack.length;
}
