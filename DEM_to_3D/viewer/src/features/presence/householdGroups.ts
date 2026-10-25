type Anchor = { id: string; x: number; y: number };
export type HouseholdGroup = Anchor & { members: string[] };

/** A symbol is the 22 px disc; its count shows only while in hand. Discs closer than this would
 * crowd each other, so the pair is drawn as one merged disc rather than one hiding the other. */
const MERGE_PX = 30;
const touching = (a: Anchor, b: Anchor) => Math.hypot(a.x - b.x, a.y - b.y) < MERGE_PX;

/** Group nearby symbols at a member's actual position. A selected household stays individual. */
export function householdGroups(anchors: readonly Anchor[], selectedId?: string | null): HouseholdGroup[] {
  const groups: HouseholdGroup[] = [];
  for (const anchor of [...anchors].sort((a, b) => a.id.localeCompare(b.id))) {
    const group = anchor.id === selectedId ? undefined : groups.find(item => item.id !== selectedId && touching(anchor, item));
    if (group) group.members.push(anchor.id);
    else groups.push({ ...anchor, members: [anchor.id] });
  }
  return groups;
}
