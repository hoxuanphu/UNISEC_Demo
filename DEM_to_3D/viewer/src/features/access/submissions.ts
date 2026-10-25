import type { GeometryRecord } from "../../geo/vector/types";
import type { DemoIdentity } from "./demoSession";
export const submissionKey = "dearSubmission";
export type Submission = {
  schema: "field-submission/v1";
  authorId: string;
  authorName: string;
  deviceId?: string;
  role: "resident" | "manager";
  homeCommunityId: string | null;
  submittedAt: string;
  locationSource: "map" | "device" | "photo" | "manual" | "community";
  locationCommunityId?: string;
  review: {
    status: "pending" | "checked" | "needs-info" | "rejected";
    note: string;
    reviewer: string;
    reviewedAt: string;
  };
};
export function submissionOf(record: GeometryRecord): Submission | null {
  try {
    const raw = record.feature.properties[submissionKey],
      s = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (record.feature.geometry.type !== "Point") return null;
    if (
      s?.schema !== "field-submission/v1" ||
      !["resident", "manager"].includes(s.role) ||
      typeof s.authorId !== "string" ||
      typeof s.authorName !== "string" ||
      !s.authorName.trim() ||
      s.authorName.length > 160 ||
      s.authorId.length > 256 ||
      (s.deviceId !== undefined && (typeof s.deviceId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(s.deviceId))) ||
      typeof s.review?.reviewer !== "string" ||
      typeof s.review?.reviewedAt !== "string" ||
      !Number.isFinite(Date.parse(s.submittedAt)) ||
      !["map", "device", "photo", "manual", "community"].includes(
        s.locationSource,
      ) ||
      (s.locationSource === "community" &&
        (typeof s.locationCommunityId !== "string" ||
          !s.locationCommunityId ||
          s.locationCommunityId.length > 160)) ||
      !["pending", "checked", "needs-info", "rejected"].includes(
        s.review?.status,
      ) ||
      typeof s.review.note !== "string" ||
      s.review.note.length > 2000
    )
      return null;
    return s as Submission;
  } catch {
    return null;
  }
}
/** A village point is representative, never an exact incident location. */
export function submissionLocationLabel(
  record: GeometryRecord,
  locale: "vi" | "en",
): string {
  const s = submissionOf(record);
  return s?.locationSource === "community"
    ? locale === "vi"
      ? "Vị trí gần đúng theo thôn/bản. Cần xác định vị trí hiện trường."
      : "Approximate village location. The incident location needs checking."
    : "";
}
export function canEditSubmission(
  identity: DemoIdentity,
  record: GeometryRecord,
): boolean {
  const s = submissionOf(record);
  return (
    identity.role === "manager" ||
    (!!s &&
      s.authorId === identity.id &&
      ["pending", "needs-info"].includes(s.review.status))
  );
}
export function newSubmission(
  identity: DemoIdentity,
  source: Submission["locationSource"],
  deviceId?: string,
): Submission {
  return {
    schema: "field-submission/v1",
    authorId: identity.id,
    authorName: identity.name,
    ...(deviceId ? {deviceId} : {}),
    role: identity.role,
    homeCommunityId: identity.communityId,
    submittedAt: new Date().toISOString(),
    locationSource: source,
    review: { status: "pending", note: "", reviewer: "", reviewedAt: "" },
  };
}
