import {expect,it} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,BufferGeometry} from 'three';
import {breathe,applyBreath,setBreathBase} from './breath';
it('retains base fill opacity and separates urgent, review and routine emphasis',()=>{
 const root=new Group();const materials=(['urgent','review','routine'] as const).map(priority=>breathe(new MeshBasicMaterial({opacity:.2}),priority));
 materials.forEach(material=>root.add(new Mesh(new BufferGeometry(),material)));applyBreath(root,.4);
 materials.forEach((m,i)=>expect(m.opacity).toBeCloseTo([.08,.152,.2][i]));applyBreath(root,1);materials.forEach(m=>expect(m.opacity).toBe(.2));
});
it('restores a changed fill setting and settles without repeated render requests',()=>{
 const root=new Group(),material=breathe(new MeshBasicMaterial({opacity:.12}),'review');root.add(new Mesh(new BufferGeometry(),material));
 setBreathBase(material,.3);applyBreath(root,.4);applyBreath(root,1);expect(material.opacity).toBe(.3);expect(applyBreath(root,1)).toBe(false);
});
