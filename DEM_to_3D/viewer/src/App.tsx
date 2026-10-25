import { useScenarioRevision } from './features/access/useScenarioRevision';
import { useScenarioLabels } from './features/access/ScenarioLabels';
import { scenarioProperties } from './features/access/scenarioProperties';
import type { ScenarioTargetType } from './features/access/scenarioEdits';
import { useScenarioEdits } from './features/access/scenarioEdits';
import { useDemoSession } from './features/access/demoSession';
import { DemoSignIn } from './features/access/DemoSignIn';
import { CitizenWorkspace } from './features/access/CitizenWorkspace';
import { ResponseWorkspace } from './app/ResponseWorkspace';
import { WorkspaceStartup } from './app/WorkspaceStartup';
import { useWorkspaceInteraction } from './app/useWorkspaceInteraction';
import { useWorkspacePreferences } from './app/useWorkspacePreferences';
import { useTerrainWorkspace } from './features/terrain/useTerrainWorkspace';
import { lazy, Suspense } from 'react';
import { StandaloneGeometryWorkspace } from './app/StandaloneGeometryWorkspace';

const RouteFilmWorkspace = lazy(() => import('./features/route-film/RouteFilmWorkspace').then(module => ({default:module.RouteFilmWorkspace})));

export default function App(): JSX.Element {
  const preferences = useWorkspacePreferences();
  const query = new URLSearchParams(window.location.search);
  if (query.get('workspace') === 'routes')
    return <Suspense fallback={<p role="status">{preferences.locale === "vi" ? "Đang mở bản đồ…" : "Opening map…"}</p>}><RouteFilmWorkspace theme={preferences.theme} locale={preferences.locale} onChangeLocale={preferences.setLocale} /></Suspense>;
  if (query.get('workspace') === 'geodata')
    return <StandaloneGeometryWorkspace locale={preferences.locale} />;
  return <ResponseEntry preferences={preferences} />;
}

function ResponseEntry({
  preferences
}: {
  preferences: ReturnType<typeof useWorkspacePreferences>;
}): JSX.Element {
  const session = useDemoSession();
  const interaction = useWorkspaceInteraction();
  const switchRole = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    session.signOut();
  };
  const signIn: typeof session.signIn = (role, name, communityId) => {
    session.signIn(role, name, communityId);
  };
  const runtime = useTerrainWorkspace({
    // Only the coordination workspace shows 3D; residents and the sign-in screen never fetch the mesh.
    mapMode: session.identity?.role === 'manager' ? interaction.mapMode : '2d',
    on3DUnavailable: interaction.recover2D
  });
  const labels = useScenarioLabels(runtime.packet);
  const edits = useScenarioEdits(labels.packet, session.identity);
  const packet = labels.packet;
  const published = useScenarioRevision(runtime.packet?.datasetVersion ?? '');
  if (!runtime.packet || !packet)
    return (
      <WorkspaceStartup
        locale={preferences.locale}
        failed={runtime.startupError}
        failure={runtime.startupFailure}
        onRetry={runtime.retry}
      />
    );
  if (!session.identity)
    return (
      <DemoSignIn
        locale={preferences.locale}
        onChangeLocale={preferences.setLocale}
        communities={runtime.packet.communities}
        onSignIn={signIn}
      />
    );
  if (session.identity.role === 'resident')
    return (
      <div className="citizen-stage">
        <CitizenWorkspace
          onChangeLocale={preferences.setLocale}
          published={published.revision}
          locale={preferences.locale}
          identity={session.identity}
          onSignOut={switchRole}
          runtime={{ ...runtime, packet }}
          scenarioEdits={edits.edits}
        />
      </div>
    );
  const rename = (type: ScenarioTargetType, id: string, names: [string, string]) => {
    const current = edits.packet ?? packet;
    const feature = (type === 'community' ? current.communities : type === 'road' ? current.roads : type === 'hazard' ? current.hazards : current.responseSites).find(f => f.id === id);
    if (!feature) return false;
    const before = scenarioProperties(feature);
    return edits.record({ target: { type, id, name: names[0] },
      change: { kind: 'properties', from: before, to: { ...before, names } }, note: 'Cập nhật tên hiển thị' });
  };
  return (
    <ResponseWorkspace
      revision={published.revision}
      onReportRevision={published.change}
      identity={session.identity}
      onSignOut={switchRole}
      onRename={rename}
      scenarioEdits={edits}
      preferences={preferences}
      interaction={interaction}
      runtime={{ ...runtime, packet }}
    />
  );
}
