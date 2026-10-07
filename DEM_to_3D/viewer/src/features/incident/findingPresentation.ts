/** Keep extra detail, but do not repeat a finding already used as the title. */
export function findingAddsDetail(title: string, finding: string): boolean {
  const normalize = (text: string) => text.normalize('NFC').trim().replace(/[.!?]+$/, '').toLocaleLowerCase();
  return normalize(title) !== normalize(finding);
}
