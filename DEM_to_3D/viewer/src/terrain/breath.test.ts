import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {expect,it} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,BufferGeometry} from 'three';
import {breathe,applyBreath,setBreathBase,applyWarningBreath} from './breath';
it('retains base fill opacity and separates urgent, review and routine emphasis',()=>{
 const root=new Group();const materials=(['urgent','review','routine'] as const).map(priority=>breathe(new MeshBasicMaterial({opacity:.2}),priority));
 materials.forEach(material=>root.add(new Mesh(new BufferGeometry(),material)));applyBreath(root,.4);
 materials.forEach((m,i)=>expect(m.opacity).toBeCloseTo([.08,.152,.2][i]));applyBreath(root,1);materials.forEach(m=>expect(m.opacity).toBe(.2));
});
it('restores a changed fill setting and settles without repeated render requests',()=>{
 const root=new Group(),material=breathe(new MeshBasicMaterial({opacity:.12}),'review');root.add(new Mesh(new BufferGeometry(),material));
 setBreathBase(material,.3);applyBreath(root,.4);applyBreath(root,1);expect(material.opacity).toBe(.3);expect(applyBreath(root,1)).toBe(false);
});

it('breathes the actual warning linewidth without accumulating scale or hiding the road',()=>{
 const material=new LineMaterial({linewidth:4.2,opacity:1});
 applyWarningBreath([material],.4);expect(material.linewidth).toBe(4.2);expect(material.opacity).toBe(.58);
 for(let i=0;i<20;i++)applyWarningBreath([material],1);
 expect(material.linewidth).toBeCloseTo(5.208);expect(material.opacity).toBe(1);
 applyWarningBreath([material],.4,false);expect(material.linewidth).toBe(4.2);expect(material.opacity).toBe(1);
 expect(applyWarningBreath([material],.4,false)).toBe(false);material.dispose();
});
