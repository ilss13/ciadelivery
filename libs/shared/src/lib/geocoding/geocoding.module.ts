import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../app-config';
import { HttpGeocodingProvider } from './http-geocoding';
import { GEOCODING, GeocodingProvider } from './geocoding-provider';
import { StubGeocodingProvider } from './stub-geocoding';

@Global()
@Module({
  providers: [
    {
      provide: GEOCODING,
      useFactory: (config: AppConfig): GeocodingProvider =>
        createGeocoding(config),
      inject: [APP_CONFIG],
    },
  ],
  exports: [GEOCODING],
})
export class GeocodingModule {}

export function createGeocoding(config: AppConfig): GeocodingProvider {
  if (config.geocodingDriver === 'http') {
    return new HttpGeocodingProvider(config.geocodingUrl);
  }

  return new StubGeocodingProvider();
}
