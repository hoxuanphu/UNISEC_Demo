import { ResponseWorkspace } from './app/ResponseWorkspace';
import { WorkspaceStartup } from './app/WorkspaceStartup';
import { useWorkspaceInteraction } from './app/useWorkspaceInteraction';
import { useWorkspacePreferences } from './app/useWorkspacePreferences';
import { useTerrainWorkspace } from './features/terrain/useTerrainWorkspace';

export default function App(): JSX.Element {
  const preferences = useWorkspacePreferences();
  const interaction = useWorkspaceInteraction();
  const runtime = useTerrainWorkspace({ mapMode: interaction.mapMode, on3DUnavailable: interaction.recover2D });
  if (!runtime.packet) return <WorkspaceStartup locale={preferences.locale} failed={runtime.startupError} onRetry={runtime.retry}/>;
  return <ResponseWorkspace preferences={preferences} interaction={interaction} runtime={{ ...runtime, packet: runtime.packet }}/>;
}
