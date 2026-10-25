type Anchor = { id: string; x: number; y: number };
export type HouseholdGroup = Anchor & { members: string[] };

/** Group nearby symbols at a member's actual position. A selected household stays individual. */
export function householdGroups(anchors: readonly Anchor[], selectedId?: string | null): HouseholdGroup[] {
  const groups: HouseholdGroup[] = [];
  for (const anchor of [...anchors].sort((a, b) => a.id.localeCompare(b.id))) {
    const group = anchor.id === selectedId ? undefined : groups.find(item =>
      item.id !== selectedId && Math.hypot(anchor.x - item.x, anchor.y - item.y) < 40);
    if (group) group.members.push(anchor.id);
    else groups.push({ ...anchor, members: [anchor.id] });
  }
  return groups;
}
