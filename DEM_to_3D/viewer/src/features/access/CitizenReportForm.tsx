import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "../../types/dear";
import { readFieldPhoto } from "../observations/photo";
import { photoCaptureTime, photoLocation, deviceLocal } from "../observations/captureMetadata";
import {
  photoLimits,
  type FieldObservation,
  type FieldPhoto,
  type AppPhotoCapture,
} from "../observations/model";
import { VoiceRecorder } from "../observations/VoiceRecorder";
import type { FieldVoice } from "../observations/voice";
import { PhotoPreview } from "../observations/PhotoPreview";
import { UiIcon } from "../../shared/ui/UiIcon";
import { CameraCapture, canStreamCamera } from "./CameraCapture";

/** A native picker remains available when the browser cannot stream its camera. */
const nativeCapture = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
export function CitizenReportForm({
  locale,
  observer,
  locationControl,
  accuracy,
  active,
  onSave,
  onPhotosChange,
}: {
  locale: Locale;
  observer: string;
  locationControl: ReactNode;
  accuracy: number | null;
  active: boolean;
  onSave: (o: FieldObservation) => boolean;
  onPhotosChange: (photos: FieldPhoto[]) => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const [photos, setPhotos] = useState<FieldPhoto[]>([]),
    [voice, setVoice] = useState<FieldVoice>(),
    [note, setNote] = useState(""),
    [observed, setObserved] = useState(""),
    [unknownZone, setUnknownZone] = useState(false),
    [busy, setBusy] = useState(false),
    [voiceBusy, setVoiceBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<FieldPhoto | null>(null),
    [cameraOpen, setCameraOpen] = useState(false);
  const camera = useRef<HTMLInputElement>(null),
    cameraButton = useRef<HTMLButtonElement>(null),
    restoreCameraFocus = useRef(false),
    library = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    reading = useRef(false),
    timeTouched = useRef(false);
  // Encoding/reading a captured photo briefly disables its trigger while the dialog closes.
  useEffect(() => {
    if (restoreCameraFocus.current && !cameraOpen && !busy) {
      restoreCameraFocus.current = false;
      cameraButton.current?.focus();
    }
  }, [cameraOpen, busy]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function updatePhotos(next: FieldPhoto[]) {
    setError('');
    setPhotos(next);
    onPhotosChange(next);
    if (!timeTouched.current) {
      const capture = next.map(photoCaptureTime).find(Boolean);
      setObserved(capture ? capture.instant ? deviceLocal(capture.instant) : capture.local : '');
      setUnknownZone(!!capture && !capture.instant);
    }
  }
  async function attach(files: File[], capture?: AppPhotoCapture) {
    if (reading.current) return;
    if (photos.length + files.length > photoLimits.count) {
      setError(t("Mỗi báo cáo tối đa 3 ảnh.", "Up to 3 photos per report."));
      return;
    }
    reading.current = true;
    setBusy(true);
    setError("");
    try {
      const added: FieldPhoto[] = [];
      for (const f of files) added.push(await readFieldPhoto(f, capture));
      if (!alive.current) return;
      updatePhotos([...photos, ...added]);
    } catch {
      if (alive.current)
        setError(
          t(
            "Không đọc được ảnh. Thử ảnh khác, tối đa 8 MB mỗi ảnh.",
            "Could not read photo. Try another image, up to 8 MB each.",
          ),
        );
    } finally {
      reading.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const photoInput = (
    ref: React.RefObject<HTMLInputElement>,
    capture?: "environment",
  ) => (
    <input
      ref={ref}
      type="file"
      accept="image/*,.heic,.heif"
      capture={capture}
      multiple={!capture}
      hidden
      aria-label={
        capture
          ? t("Chụp ảnh hiện trường", "Take a field photo")
          : t("Chọn ảnh hiện trường", "Choose field photos")
      }
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) void attach(files);
      }}
    />
  );
  return (
    <form
      className="citizen-report-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || voiceBusy) return;
        if (!photos.length && !voice && !note.trim()) {
          setError(
            t(
              "Thêm ảnh, ghi âm hoặc viết điều bạn thấy.",
              "Add a photo, a recording or a message.",
            ),
          );
          return;
        }
        const date = observed ? new Date(observed) : null;
        if (date && !Number.isFinite(date.getTime())) {
          setError(
            t("Kiểm tra thời gian xảy ra.", "Check the observation time."),
          );
          return;
        }
        const value: FieldObservation = {
          schema: "field-observation/v1",
          kind: "other",
          note: note.trim(),
          observer,
          observedAt: unknownZone ? "" : (date?.toISOString() ?? ""),
          ...(unknownZone && observed
            ? {
                observedLocalTime:
                  observed.length === 16 ? observed + ":00" : observed,
              }
            : {}),
          accuracyM: accuracy,
          status: "unreviewed",
          updatedAt: new Date().toISOString(),
          photos,
          ...(voice ? { voice } : {}),
        };
        if (onSave(value)) setError("");
        else
          setError(
            t(
              "Chưa lưu được báo cáo. Kiểm tra vị trí và dung lượng lưu trữ.",
              "Could not save report. Check the location and storage space.",
            ),
          );
      }}
    >
      <section className="citizen-card" aria-labelledby="citizen-photo-title">
        <h2 id="citizen-photo-title">{t("Ảnh", "Photos")}<small>{photos.length}/{photoLimits.count}</small></h2>
        <div className="citizen-capture-actions">
          {(nativeCapture() || canStreamCamera()) && (
            <button
              ref={cameraButton}
              type="button"
              className="button"
              disabled={busy || photos.length >= photoLimits.count}
              onClick={() => (canStreamCamera() ? setCameraOpen(true) : camera.current?.click())}
            >
              <UiIcon name="camera" size={20} />
              {t("Chụp ảnh", "Take photo")}
            </button>
          )}
          <button
            type="button"
            className="button"
            disabled={busy || photos.length >= photoLimits.count}
            onClick={() => library.current?.click()}
          >
            <UiIcon name="image" size={20} />
            {nativeCapture() || canStreamCamera() ? t("Ảnh có sẵn", "From gallery") : t("Chọn ảnh", "Choose photos")}
          </button>
        </div>
        {photoInput(camera, "environment")}
        {photoInput(library)}
        {busy && <p role="status" className="citizen-hint">{t("Đang đọc ảnh", "Reading photo")}</p>}
        {!!photos.length && (
          <ul className="citizen-photo-strip">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="citizen-photo-open"
                  aria-label={t("Xem ảnh", "View photo")}
                  onClick={() => setPreview(p)}
                >
                  <img src={p.preview} alt={p.name} />
                </button>
                <button
                  type="button"
                  className="citizen-photo-remove"
                  disabled={busy}
                  aria-label={t("Xóa ảnh", "Remove")}
                  title={t("Xóa ảnh", "Remove")}
                  onClick={() => updatePhotos(photos.filter(x => x.id !== p.id))}
                >
                  <UiIcon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!photos.length && <p className="citizen-hint citizen-photo-metadata" role="status">{
          photos.some(photo => photoCaptureTime(photo))
            ? photos.some(photo => photoLocation(photo))
              ? t('Đã đọc ngày chụp và vị trí.', 'Photo time and location found.')
              : t('Đã đọc ngày chụp. Ảnh chưa có vị trí.', 'Photo time found. No photo location.')
            : photos.some(photo => photoLocation(photo))
              ? t('Đã đọc vị trí. Ảnh chưa có ngày chụp.', 'Photo location found. No capture date.')
              : t('Ảnh chưa có ngày chụp và vị trí. Bạn có thể bổ sung bên dưới.', 'No photo time or location. You can add them below.')
        }</p>}
      </section>
      <section className="citizen-card" aria-labelledby="citizen-note-title">
        <h2 id="citizen-note-title">{t("Bạn thấy gì?", "What did you see?")}<small>{t("Viết hoặc ghi âm", "Type or record")}</small></h2>
        <textarea
          aria-labelledby="citizen-note-title"
          rows={3}
          maxLength={2000}
          value={note}
          placeholder={t("Ví dụ: đất đá lấp kín đường, xe máy không qua được", "For example: rocks cover the road, motorbikes cannot pass")}
          onChange={(e) => setNote(e.target.value)}
        />
        <VoiceRecorder
          voice={voice}
          onChange={setVoice}
          onBusyChange={setVoiceBusy}
          locale={locale}
          active={active}
          disabled={busy}
        />
      </section>
      {locationControl}
      <section className="citizen-card" aria-labelledby="citizen-time-title">
        <h2 id="citizen-time-title">{t("Thời gian xảy ra", "When it happened")}<small>{t("Nếu biết", "If known")}</small></h2>
        <input
          type="datetime-local"
          step="0.001"
          aria-labelledby="citizen-time-title"
          value={observed}
          onChange={(e) => {
            timeTouched.current = true;
            setUnknownZone(false);
            setObserved(e.target.value);
          }}
        />
        {unknownZone && (
          <p className="citizen-hint">
            {t("Giờ lấy từ ảnh, chưa có múi giờ.", "Time taken from the photo, without a time zone.")}
          </p>
        )}
        {observed && !unknownZone && !timeTouched.current && <p className="citizen-hint">{t('Giờ chụp được điền từ ảnh.', 'Capture time filled from the photo.')}</p>}
      </section>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="field-form-actions">
        <button
          type="submit"
          className="button primary"
          disabled={busy || voiceBusy}
        >
          <UiIcon name="send" size={18} />
          {t("Gửi báo cáo", "Send report")}
        </button>
      </div>
      {cameraOpen && <CameraCapture locale={locale} onCapture={(file, capture) => void attach([file], capture)} onClose={() => {restoreCameraFocus.current = true;setCameraOpen(false);}} />}
      {preview && (
        <PhotoPreview
          photo={preview}
          locale={locale}
          onClose={() => setPreview(null)}
        />
      )}
    </form>
  );
}
