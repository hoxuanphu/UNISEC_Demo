"""Explicit richer network fixture for bypass/bridge/flood UI regressions.

Production remains the sourced corridor. Never make this fixture a fallback dataset.
"""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]

def install_network_fixture(context,url,cluster_hazards=False):
    packet=json.loads((ROOT/'src/data/fixtures/che-tao-network.json').read_text(encoding='utf-8'))
    if cluster_hazards:
        # Keep the dense selection fixture inside the shipped DEM even in offline 3D.
        prepared=json.loads((ROOT/'public/scenarios/che-tao/v0.3/incident.json').read_text(encoding='utf-8'))
        anchor=prepared['hazards'][0]['projected']
        for index,hazard in enumerate(packet['hazards']):
            hazard['projected']={'x':anchor['x']+index*2,'y':anchor['y']+index*2}
    manifest=json.loads((ROOT/'public/scenarios/che-tao/v0.3/manifest.json').read_text(encoding='utf-8'))
    for key in ['fieldData','referenceData','fieldPhotos','analysisImagery','terrainContext','residentPresence']:
        manifest.pop(key,None)
    payload=json.dumps(packet,ensure_ascii=False).encode('utf-8')
    manifest.update(datasetVersion=packet['datasetVersion'],incidentId=packet['incident']['id'],snapshotAt=packet['incident']['asOf'],
                    counts={key:len(packet[key]) for key in ['communities','roads','hazards']})
    manifest['workspace']={'url':'/scenarios/browser-network/incident.json','sha256':hashlib.sha256(payload).hexdigest(),'byteLength':len(payload)}
    context.route(url+'/scenarios/che-tao/v0.3/manifest.json',lambda route:route.fulfill(json=manifest))
    context.route(url+'/scenarios/browser-network/incident.json',lambda route:route.fulfill(body=payload,content_type='application/json'))
    return packet
