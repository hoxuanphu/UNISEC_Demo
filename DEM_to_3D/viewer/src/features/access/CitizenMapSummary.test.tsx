import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CitizenMapSummary} from './CitizenMapSummary';
import type {ScenarioRoute} from '../../types/dear';
it('shows a blockage as a warning, without a distance or start action suggesting travel',()=>{
 const route={name:['Đường chính','Main road'],status:'blocked',lengthKm:32.1,segs:[{status:'blocked'}]} as ScenarioRoute;
 const html=renderToStaticMarkup(<CitizenMapSummary route={route} locale="en" onCloseRoad={()=>{}} onDetails={()=>{}} onFind={()=>{}} onPlaces={()=>{}} loadError={false} onRetry={()=>{}}/>);
 expect(html).toContain('No passable route found');expect(html).toContain('View blocked sections');expect(html).not.toContain('32.1');expect(html).not.toContain('citizen-route-label');expect(html).not.toContain('citizen-primary');
});
