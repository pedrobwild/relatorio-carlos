import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildMedia } from '../MediaUploader';

const ORIGINAL_CREATE = global.URL.createObjectURL;

beforeAll(() => {
  // jsdom não implementa URL.createObjectURL
  global.URL.createObjectURL = () => 'blob:mock://preview';
});

afterAll(() => {
  global.URL.createObjectURL = ORIGINAL_CREATE;
});

describe('buildMedia', () => {
  it('classifica imagens como type "image"', () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    const m = buildMedia(file);
    expect(m.type).toBe('image');
    expect(m.previewUrl).toContain('blob:');
    expect(m.file).toBe(file);
  });

  it('classifica vídeos como type "video"', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const m = buildMedia(file);
    expect(m.type).toBe('video');
  });

  it('cai em "image" quando o mime não bate com video/*', () => {
    // Tipo desconhecido deve ser tratado como imagem (default seguro pra preview).
    const file = new File(['x'], 'arquivo.bin', { type: 'application/octet-stream' });
    const m = buildMedia(file);
    expect(m.type).toBe('image');
  });
});
