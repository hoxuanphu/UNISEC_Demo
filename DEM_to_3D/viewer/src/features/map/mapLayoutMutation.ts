/** Only changed obstacles or map ancestors can invalidate screen-space labels.
 * Image tiles and moving location dots are independent of those labels. */
export function mapLayoutMutation(change: MutationRecord, host: HTMLElement, obstacles: string): boolean {
  const target = change.target instanceof Element ? change.target : change.target.parentElement;
  if (target?.closest(obstacles)) return true;
  if (change.type === 'attributes') return Boolean(target?.contains(host));
  return [...change.addedNodes, ...change.removedNodes].some(node => node instanceof Element &&
    (node.matches(obstacles) || Boolean(node.querySelector(obstacles))));
}
