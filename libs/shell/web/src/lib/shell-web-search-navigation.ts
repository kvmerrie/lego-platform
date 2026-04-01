export function getNextSearchActiveIndex({
  activeIndex,
  itemCount,
  key,
}: {
  activeIndex: number;
  itemCount: number;
  key: 'ArrowDown' | 'ArrowUp' | 'Escape';
}): number {
  if (!itemCount || key === 'Escape') {
    return -1;
  }

  if (key === 'ArrowDown') {
    return activeIndex < 0 ? 0 : (activeIndex + 1) % itemCount;
  }

  return activeIndex < 0
    ? itemCount - 1
    : (activeIndex - 1 + itemCount) % itemCount;
}
