import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadUploadedModels, pairUploadedFiles, releaseUploadedModels, selectUploadedFiles } from './upload';

const mockTexture = vi.hoisted(() => ({ decode: vi.fn() }));
vi.mock('./texture', async (original) => ({
  ...await original<typeof import('./texture')>(),
  decodeTextureFile: mockTexture.decode,
}));

function modelScene(withUv = true): Group {
  const scene = new Group();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  if (withUv) geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  scene.add(new Mesh(geometry, new MeshStandardMaterial()));
  return scene;
}

function stubParser(scene: Group): void {
  vi.spyOn(GLTFLoader.prototype, 'parse').mockImplementation((_data, _path, onLoad) => {
    onLoad({ scene } as GLTF);
  });
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); mockTexture.decode.mockReset(); });

describe('uploaded model resources', () => {
  it('retains external image resources when selecting one glTF', () => {
    const model = new File(['{}'], 'model.gltf');
    const image = new File(['image'], 'diffuse.png');
    const files = selectUploadedFiles([model, image], 'single');
    expect(files).toContain(image);
    expect(pairUploadedFiles(files)[0].resources).toContain(image);
  });

  it('resolves uploaded glTF images through the local resource manager', async () => {
    const scene = modelScene();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:model').mockReturnValueOnce('blob:image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let resolved = '';
    vi.spyOn(GLTFLoader.prototype, 'parse').mockImplementation(function (this: GLTFLoader, _data, _path, onLoad) {
      resolved = this.manager.resolveURL('https://uploads.invalid/diffuse.png');
      onLoad({ scene } as GLTF);
    });
    const models = await loadUploadedModels([new File(['{}'], 'model.gltf'), new File(['image'], 'diffuse.png')]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(resolved).toBe('blob:image');
    releaseUploadedModels(models);
  });

  it('disposes a parsed model if a later texture decode fails', async () => {
    const scene = modelScene();
    stubParser(scene);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:model');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const mesh = scene.children[0] as Mesh<BufferGeometry, MeshStandardMaterial>;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(mesh.material, 'dispose');
    mockTexture.decode.mockRejectedValue(new Error('Invalid image'));
    await expect(loadUploadedModels([new File(['model'], 'model.glb'), new File(['bad'], 'model.png')])).rejects.toThrow('Invalid image');
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalled();
  });

  it('disposes the unattached texture when the model has no UV coordinates', async () => {
    const scene = modelScene(false);
    stubParser(scene);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:model');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const texture = new Texture();
    const dispose = vi.spyOn(texture, 'dispose');
    mockTexture.decode.mockResolvedValue({ texture, width: 1, height: 1 });
    await expect(loadUploadedModels([new File(['model'], 'model.glb'), new File(['image'], 'model.png')])).rejects.toThrow(/UV/);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
