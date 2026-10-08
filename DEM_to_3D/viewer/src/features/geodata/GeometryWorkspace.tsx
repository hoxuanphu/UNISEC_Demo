import { useEffect, useMemo, useState } from 'react';
import { GeometryError } from '../../geo/vector/types';
import { polygonCoverage } from '../../geo/vector/polygonCoverage';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { PanelResizeHandle } from '../../shared/ui/PanelResizeHandle';
import { downloadBlob } from '../../shared/downloadBlob';
import { SceneCatalog, SceneDetails, type SceneResult } from '../catalog/SceneCatalog';
import { useImageryCatalog } from '../catalog/useImageryCatalog';
import { sceneRecord, reviewScenePair } from '../catalog/imageryCatalog';
import { GeometryImport } from './GeometryImport';
import { GeometryLayers } from './GeometryLayers';
import { GeometryCoverage } from './GeometryCoverage';
import { GeometryMap } from './GeometryMap';
import { useGeometrySession } from './useGeometrySession';
import { useGeometryEditor, type GeometryMode } from './useGeometryEditor';
import { GeometryVertexEditor } from './GeometryVertexEditor';
import { createGeometryRecords } from './geometrySession';
import { GeometryToolbar } from './GeometryToolbar';
import { GeometryExport } from './GeometryExport';
import { geometryErrorText } from './geometryErrors';
import './geodata.css';

type Props = {
  locale: Locale;
  onClose: () => void;
  offline?: boolean;
  standalone?: boolean;
};
type Tab = 'layers' | 'aoi' | 'scenes';
const selectionKey = 'dear.imagery-selection.v1';
function readSelection(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(selectionKey) ?? '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string').slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

/** Composition only: geometry drafts, published response data and catalog selections are separate. */
export function GeometryWorkspace({
  locale,
  onClose,
  offline = false,
  standalone = false
}: Props): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const session = useGeometrySession(),
    editor = useGeometryEditor(),
    repository = useImageryCatalog();
  const [tab, setTab] = useState<Tab>('layers'),
    [mobileTab, setMobileTab] = useState<'data' | 'map'>('data');
  const [snapping, setSnapping] = useState(false),
    [exportScope, setExportScope] = useState('all');
  const [selectedScenes, setSelectedScenes] = useState(readSelection),
    [results, setResults] = useState<SceneResult[]>([]);
  const [queryAoi, setQueryAoi] = useState<string | null>(null),
    [sceneId, setSceneId] = useState<string | null>(null);
  const [showScenes, setShowScenes] = useState(true),
    [sceneView, setSceneView] = useState<{
      version: number;
      id: string | null;
    } | null>(null);
  const aoi = session.records.find((record) => record.role === 'aoi');
  const selected = session.records.find((record) => record.id === session.selectedId);
  const scene = repository.catalog?.scenes.find((record) => record.id === sceneId);
  const analysis = useMemo(() => {
    try {
      return { result: polygonCoverage(session.records), error: null };
    } catch {
      return { result: null, error: new GeometryError('analysis') };
    }
  }, [session.records]);
  const mapRecords = useMemo(() => {
    if (!repository.catalog) return session.records;
    const existing = new Set(session.records.map((record) => record.id));
    const candidates = results.map((row) => row.scene);
    const focused =
      scene ?? repository.catalog.scenes.find((item) => `scene:${item.id}` === sceneView?.id);
    if (focused && !candidates.some((candidate) => candidate.id === focused.id))
      candidates.push(focused);
    return [
      ...session.records,
      ...candidates
        .map((candidate) => ({
          ...sceneRecord(candidate, repository.catalog!.source.retrievedAt),
          visible: showScenes
        }))
        .filter((record) => !existing.has(record.id))
    ];
  }, [session.records, results, scene, sceneView, showScenes, repository.catalog]);
  useEffect(() => {
    try {
      localStorage.setItem(selectionKey, JSON.stringify(selectedScenes));
    } catch {
      session.setError(new GeometryError('storage'));
    }
  }, [selectedScenes]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (editor.active) return;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape' && sceneId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSceneId(null);
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ['z', 'y'].includes(key) &&
        !(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')
      ) {
        event.preventDefault();
        if (key === 'y' || event.shiftKey) session.redo();
        else session.undo();
      }
    };
    document.addEventListener('keydown', keys, true);
    return () => document.removeEventListener('keydown', keys, true);
  });
  const select = (id: string) => {
    if (editor.active) return;
    const candidate = repository.catalog?.scenes.find((item) => `scene:${item.id}` === id);
    if (candidate) {
      setSceneId(candidate.id);
      return;
    }
    session.select(id);
    setSceneId(null);
    setTab('layers');
  };
  const start = (mode: GeometryMode) => {
    session.setError(null);
    setSceneId(null);
    setSceneView(null);
    setMobileTab('map');
    if (mode === 'edit' && selected) {
      editor.start(mode, selected.id, selected.feature.geometry);
      setTab('aoi');
    } else editor.start(mode);
  };
  const finish = () => {
    try {
      const geometry = editor.result();
      if (editor.mode === 'edit' && editor.recordId)
        session.replaceGeometry(editor.recordId, geometry);
      else if (aoi) {
        session.replaceGeometry(aoi.id, geometry, true);
        session.select(aoi.id);
      } else
        session.add(
          createGeometryRecords(
            {
              features: [{ type: 'Feature', properties: { name: 'AOI' }, geometry }],
              format: 'drawing'
            },
            t('Vẽ trên bản đồ', 'Map drawing'),
            'aoi'
          )
        );
      editor.cancel();
      session.setError(null);
      setTab('aoi');
    } catch (error) {
      session.setError(error);
    }
  };
  const exportRecords =
    exportScope === 'aoi'
      ? session.records.filter((record) => record.role === 'aoi')
      : session.records;
  const download = (text: string, name: string, type = 'application/json') =>
    downloadBlob(new Blob([text], { type }), name);
  const addScenes = () => {
    try {
      const additions = (
        repository.catalog?.scenes.filter((item) => selectedScenes.includes(item.id)) ?? []
      ).map((item) => sceneRecord(item, repository.catalog!.source.retrievedAt));
      const existing = new Set(session.records.map((record) => record.id));
      const fresh = additions.filter((record) => !existing.has(record.id));
      if (fresh.length) session.add(fresh);
      setSceneId(null);
      setSceneView(null);
      setTab('layers');
    } catch (error) {
      session.setError(error);
    }
  };
  const error = session.error || analysis.error;
  const working = editor.active || session.busy;
  return (
    <div
      className="geodata-workspace"
      role={standalone ? undefined : 'dialog'}
      aria-modal={standalone ? undefined : true}
      aria-labelledby="geodata-title"
      data-mobile-tab={mobileTab}
    >
      <header className="geodata-header">
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={
            standalone
              ? t('Về bản đồ ứng phó', 'Back to response map')
              : t('Đóng dữ liệu GIS', 'Close GIS data')
          }
          title={t('Về bản đồ ứng phó', 'Back to response map')}
        >
          <UiIcon name="back" />
        </button>
        <div>
          <h1 id="geodata-title">{t('Dữ liệu GIS', 'GIS data')}</h1>
          <span>{t('Vùng quan tâm · Lớp · Cảnh ảnh', 'Area of interest · Layers · Imagery')}</span>
        </div>
        <span className="geodata-local">{t('Workspace cục bộ', 'Local workspace')}</span>
      </header>
      <GeometryToolbar
        locale={locale}
        editor={editor}
        busy={session.busy}
        canUndo={session.canUndo}
        canRedo={session.canRedo}
        onUndo={session.undo}
        onRedo={session.redo}
        hasSelection={Boolean(selected)}
        aoiName={aoi?.name}
        snapping={snapping}
        onSnap={setSnapping}
        onStart={start}
        onFinish={finish}
        onCancel={() => {
          editor.cancel();
          session.setError(null);
        }}
      />
      <nav
        className="geodata-mobile-tabs"
        aria-label={t('Không gian dữ liệu GIS', 'GIS workspace')}
      >
        <button aria-pressed={mobileTab === 'data'} onClick={() => setMobileTab('data')}>
          {t('Dữ liệu', 'Data')}
        </button>
        <button
          aria-pressed={mobileTab === 'map'}
          onClick={() => {
            setSceneId(null);
            setMobileTab('map');
          }}
        >
          {t('Bản đồ', 'Map')}
        </button>
      </nav>
      {error && (
        <div className="geodata-error" role="alert">
          <UiIcon name="uncertain" />
          <span>{geometryErrorText(error, locale)}</span>
          <button
            className="icon-button"
            onClick={() => session.setError(null)}
            aria-label={t('Đóng lỗi nhập', 'Dismiss import error')}
          >
            <UiIcon name="close" />
          </button>
        </div>
      )}
      <div className="geodata-body">
        <aside
          className="geodata-sidebar"
          aria-label={t('Quản lý dữ liệu GIS', 'GIS data controls')}
        >
          <nav className="geodata-tabs" role="tablist" aria-label={t('Công việc GIS', 'GIS tasks')}>
            {(['layers', 'aoi', 'scenes'] as const).map((id, index) => (
              <button
                key={id}
                id={`geo-tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`geo-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(event) => {
                  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                    event.preventDefault();
                    const next = (['layers', 'aoi', 'scenes'] as const)[
                      (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3
                    ];
                    setTab(next);
                    document.getElementById(`geo-tab-${next}`)?.focus();
                  }
                }}
              >
                {id === 'layers'
                  ? t('Lớp', 'Layers')
                  : id === 'aoi'
                    ? 'AOI'
                    : t('Cảnh ảnh', 'Imagery')}
              </button>
            ))}
          </nav>
          <div className="geodata-sidebar-scroll">
            <div
              id="geo-panel-layers"
              role="tabpanel"
              aria-labelledby="geo-tab-layers"
              hidden={tab !== 'layers'}
            >
              <GeometryImport
                locale={locale}
                busy={session.busy}
                disabled={editor.active}
                count={session.records.length}
                onFiles={async (files, role) => {
                  setSceneView(null);
                  return session.importFiles(files, role);
                }}
                onText={(text, role) => {
                  setSceneView(null);
                  return session.importText(text, role);
                }}
              />
              <GeometryLayers
                records={session.records}
                selectedId={session.selectedId}
                locale={locale}
                disabled={working}
                onSelect={(id) => {
                  session.select(id);
                  setSceneId(null);
                }}
                onUpdate={session.update}
                onRemove={session.remove}
                onFit={(id) => {
                  setSceneView(null);
                  session.fit(id);
                }}
              />
              {results.length > 0 && (
                <label className="geodata-section geodata-scene-visibility">
                  <input
                    type="checkbox"
                    checked={showScenes}
                    onChange={(event) => setShowScenes(event.target.checked)}
                  />
                  {t('Phạm vi cảnh tìm được', 'Search result footprints')}
                </label>
              )}
            </div>
            <div
              id="geo-panel-aoi"
              role="tabpanel"
              aria-labelledby="geo-tab-aoi"
              hidden={tab !== 'aoi'}
            >
              <section className="geodata-section">
                <h2>{t('Vùng quan tâm', 'Area of interest')}</h2>
                {aoi ? (
                  <>
                    <p>{aoi.name}</p>
                    <div className="geodata-actions">
                      <button
                        className="button"
                        disabled={working}
                        onClick={() => {
                          session.select(aoi.id);
                          editor.start('edit', aoi.id, aoi.feature.geometry);
                          setMobileTab('map');
                        }}
                      >
                        <UiIcon name="edit" />
                        {t('Chỉnh đỉnh AOI', 'Edit AOI vertices')}
                      </button>
                      <button
                        className="button"
                        disabled={working}
                        onClick={() => setTab('scenes')}
                      >
                        <UiIcon name="search" />
                        {t('Tìm cảnh ảnh', 'Find imagery')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="geodata-empty">
                    {t(
                      'Vẽ vùng hoặc gán một polygon làm AOI trong tab Lớp.',
                      'Draw an area or assign a polygon as AOI in Layers.'
                    )}
                  </p>
                )}
              </section>
              {editor.mode === 'edit' && editor.draft.geometry && (
                <GeometryVertexEditor
                  geometry={editor.draft.geometry}
                  locale={locale}
                  onMove={editor.move}
                />
              )}
              <GeometryCoverage locale={locale} coverage={analysis.result} onSelect={select} />
            </div>
            <div
              id="geo-panel-scenes"
              role="tabpanel"
              aria-labelledby="geo-tab-scenes"
              hidden={tab !== 'scenes'}
            >
              <SceneCatalog
                locale={locale}
                {...repository}
                disabled={working}
                onRetry={repository.retry}
                aoi={aoi}
                results={results}
                queryAoi={queryAoi}
                selected={selectedScenes}
                onSelection={setSelectedScenes}
                onResults={(rows, signature) => {
                  setResults(rows);
                  setQueryAoi(signature);
                  setSceneView(null);
                }}
                onInspect={(item) => setSceneId(item.id)}
                onAdd={addScenes}
                onExport={() => {
                  if (!aoi || !repository.catalog) return;
                  const scenes = repository.catalog.scenes.filter((item) =>
                    selectedScenes.includes(item.id)
                  );
                  download(
                    JSON.stringify(
                      {
                        type: 'imagery-selection',
                        version: 1,
                        aoi: aoi.feature,
                        catalogSource: repository.catalog.source,
                        scenes,
                        review:
                          aoi.feature.geometry.type === 'Polygon' ||
                          aoi.feature.geometry.type === 'MultiPolygon'
                            ? reviewScenePair(scenes, aoi.feature.geometry)
                            : 'count',
                        rasterLoaded: false
                      },
                      null,
                      2
                    ),
                    'dear-imagery-selection.json'
                  );
                }}
              />
            </div>
          </div>
          <GeometryExport
            locale={locale}
            exportRecords={exportRecords}
            exportScope={exportScope}
            onScope={setExportScope}
            disabled={working}
            onError={session.setError}
          />
        </aside>
        <PanelResizeHandle locale={locale} storageKey="dear.geodata.panel-width" />
        <GeometryMap
          records={mapRecords}
          selectedId={scene ? `scene:${scene.id}` : session.selectedId}
          locale={locale}
          offline={offline}
          viewRequest={sceneView ?? session.viewRequest}
          onSelect={select}
          editor={editor}
          snapping={snapping}
          onFinish={finish}
          onCancel={() => {
            editor.cancel();
            session.setError(null);
          }}
          intersection={analysis.result?.intersection ?? null}
        />
        {scene && (
          <SceneDetails
            scene={scene}
            locale={locale}
            onClose={() => setSceneId(null)}
            onFit={() => {
              setSceneView((previous) => ({
                version: (previous?.version ?? session.viewRequest.version) + 1,
                id: `scene:${scene.id}`
              }));
              setShowScenes(true);
              setMobileTab('map');
              if (window.matchMedia('(max-width:1100px)').matches) setSceneId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
