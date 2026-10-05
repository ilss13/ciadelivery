import { createServer, RequestListener, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { HttpGeocodingProvider } from './http-geocoding';

describe('HttpGeocodingProvider', () => {
  let server: Server;
  let baseUrl = '';

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('reads latitude and longitude from a local server', async () => {
    server = await listen((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      expect(url.searchParams.get('line')).toBe('Rua A');
      expect(url.searchParams.get('postalCode')).toBe('01001000');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ latitude: -23.55, longitude: -46.63 }));
    });
    const provider = new HttpGeocodingProvider(baseUrl);
    await expect(
      provider.geocode({
        line: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01001000',
      }),
    ).resolves.toEqual({ latitude: -23.55, longitude: -46.63 });
  });

  it('returns ADDRESS_NOT_FOUND when the body has no coordinates', async () => {
    server = await listen((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({}));
    });
    const provider = new HttpGeocodingProvider(baseUrl);
    await expect(
      provider.geocode({
        line: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01001000',
      }),
    ).rejects.toMatchObject({ code: 'ADDRESS_NOT_FOUND', statusCode: 422 });
  });

  it('returns GEOCODING_UNAVAILABLE when the server does not answer', async () => {
    server = await listen(() => undefined);
    const provider = new HttpGeocodingProvider(baseUrl, 30);
    await expect(
      provider.geocode({
        line: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01001000',
      }),
    ).rejects.toMatchObject({ code: 'GEOCODING_UNAVAILABLE', statusCode: 503 });
  });

  function listen(handler: RequestListener): Promise<Server> {
    const created = createServer(handler);
    server = created;
    return new Promise((resolve) => {
      created.listen(0, '127.0.0.1', () => {
        const address = created.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/geocode`;
        resolve(created);
      });
    });
  }
});
