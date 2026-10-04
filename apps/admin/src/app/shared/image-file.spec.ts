import { imageFileMessage, MAX_IMAGE_BYTES } from './image-file';

describe('imageFileMessage', () => {
  it('accepts a png within the size limit', () => {
    expect(imageFileMessage({ type: 'image/png', size: 120 })).toBeNull();
  });

  it('explains a rejected type in Portuguese', () => {
    expect(imageFileMessage({ type: 'text/plain', size: 12 })).toBe(
      'Envie uma imagem JPEG, PNG ou WebP.',
    );
  });

  it('explains a file above 2 MB in Portuguese', () => {
    expect(
      imageFileMessage({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }),
    ).toBe('A imagem pode ter no máximo 2 MB.');
  });
});
