import json
import tempfile
import unittest
from pathlib import Path
from workspace_configuration import workspace_manifest_path


class WorkspaceConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write_config(self, **extra):
        (self.root / 'workspace-config.json').write_text(json.dumps({'dataSource': 'prepared', **extra}))

    def test_selects_another_dataset_and_keeps_legacy_launchers_compatible(self):
        self.assertEqual(workspace_manifest_path(self.root)[0], self.root / 'scenarios/che-tao/v0.2/manifest.json')
        self.write_config(manifestUrl='/scenarios/alternate/v1/manifest.json', offline=True)
        path, config = workspace_manifest_path(self.root)
        self.assertEqual(path, self.root / 'scenarios/alternate/v1/manifest.json')
        self.assertTrue(config['offline'])

    def test_rejects_nonlocal_or_ambiguous_paths_and_offline_values(self):
        for url in ['https://outside.test/manifest.json', '/scenarios/../manifest.json', '/scenarios/a//manifest.json',
                    '/scenarios/%2e%2e/manifest.json', '/scenarios/a/manifest.json?q=1']:
            with self.subTest(url=url):
                self.write_config(manifestUrl=url)
                with self.assertRaisesRegex(ValueError, 'manifest URL'):
                    workspace_manifest_path(self.root)
        self.write_config(offline='true')
        with self.assertRaisesRegex(ValueError, 'offline'):
            workspace_manifest_path(self.root)
