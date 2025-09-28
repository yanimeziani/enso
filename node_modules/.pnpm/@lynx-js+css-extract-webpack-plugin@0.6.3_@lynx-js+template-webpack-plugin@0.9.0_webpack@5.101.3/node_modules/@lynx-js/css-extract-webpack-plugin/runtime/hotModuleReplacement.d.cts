declare function update(
  moduleId: string | number,
  options: unknown,
  cssId?: number,
): () => void;

export = update;
