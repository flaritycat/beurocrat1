export type ProviderStatus = {
  key: string;
  enabled: boolean;
  available: boolean;
  message?: string;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  municipality?: string;
  county?: string;
  source: string;
};

export type SourceSuggestion = {
  title: string;
  publisher: string;
  source_type: string;
  source_url: string;
  authority_level: string;
  notes?: string;
};

export type TileConfig = {
  key: string;
  urlTemplate: string;
  attribution: string;
};

export interface GeocoderProvider {
  readonly key: string;
  status(): ProviderStatus;
  geocode(query: string): Promise<GeocodeResult[]>;
}

export interface TileProvider {
  readonly key: string;
  config(): TileConfig;
}

export interface PublicDatasetProvider {
  readonly key: string;
  status(): ProviderStatus;
  search(query: string): Promise<SourceSuggestion[]>;
}

export interface LegalSourceProvider {
  readonly key: string;
  status(): ProviderStatus;
  suggest(issueType?: string): Promise<SourceSuggestion[]>;
}

export interface MunicipalitySourceProvider {
  readonly key: string;
  status(): ProviderStatus;
  suggest(municipality?: string): Promise<SourceSuggestion[]>;
}
