import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from prepare_local_network import prepare


class LocalNetworkTests(unittest.TestCase):
    def test_endpoint_attachment_splits_target_but_interior_crossing_does_not(self):
        doc='''<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Style id="g"><LineStyle><color>ff00ff00</color></LineStyle></Style>
        <Style id="r"><LineStyle><color>ff0000ff</color></LineStyle></Style>
        <Placemark><name>Main</name><styleUrl>#g</styleUrl><LineString><coordinates>104.03,21.72 104.04,21.72</coordinates></LineString></Placemark>
        <Placemark><name>Branch</name><styleUrl>#r</styleUrl><LineString><coordinates>104.035,21.72005 104.035,21.725</coordinates></LineString></Placemark>
        <Placemark><name>Crossing</name><styleUrl>#g</styleUrl><LineString><coordinates>104.037,21.718 104.037,21.722</coordinates></LineString></Placemark>
        <Placemark><name>Outlier</name><styleUrl>#g</styleUrl><LineString><coordinates>105.94,20.98 105.95,20.98</coordinates></LineString></Placemark>
        </Document></kml>'''
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'network.kmz'
            with zipfile.ZipFile(path,'w') as archive:archive.writestr('doc.kml',doc)
            data=prepare(path)
            self.assertEqual(data,prepare(path),'Preparation must be reproducible')
        self.assertEqual(len(data['sourceRoads']),3)
        self.assertEqual(len(data['roads']),4)
        self.assertEqual(data['sourceRoads'][1]['coordinates'][0],[104.035,21.72005])
        self.assertEqual(data['topology']['excluded'],[{'placemarkIndex':3,'reason':'outside-che-tao-aoi'}])
        self.assertEqual(len(data['topology']['snaps']),1)
        self.assertLess(data['topology']['snaps'][0]['offsetM'],15)
        self.assertGreater(data['topology']['snaps'][0]['offsetM'],1)
        main=[road for road in data['roads'] if road['sourceRoadId']=='kmz-0']
        branch=next(road for road in data['roads'] if road['sourceRoadId']=='kmz-1')
        crossing=next(road for road in data['roads'] if road['sourceRoadId']=='kmz-2')
        self.assertEqual(branch['status'],'blocked')
        self.assertEqual(main[0]['points'][-1],branch['points'][0])
        self.assertEqual(main[1]['points'][0],branch['points'][0])
        self.assertEqual(len(crossing['points']),2)
        self.assertFalse(data['topology']['crossingsConnected'])
        self.assertIsNone(data['source']['observedAt'])


if __name__=='__main__':unittest.main()
