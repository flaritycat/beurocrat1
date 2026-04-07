import { env } from "../../config/env";
import {
  type GeocodeResult,
  type GeocoderProvider,
  type LegalSourceProvider,
  type MunicipalitySourceProvider,
  type ProviderStatus,
  type PublicDatasetProvider,
  type SourceSuggestion,
  type TileConfig,
  type TileProvider,
} from "../../lib/providers";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

class TtlCache<T> {
  private readonly ttlMs: number;
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string) {
    const hit = this.store.get(key);
    if (!hit) {
      return null;
    }

    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return hit.value;
  }

  set(key: string, value: T) {
    this.store.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }
}

const geocodeCache = new TtlCache<GeocodeResult[]>(5 * 60 * 1000);

class StaticTileProvider implements TileProvider {
  readonly key = "default-tile-provider";

  config(): TileConfig {
    return {
      key: this.key,
      urlTemplate: env.tileUrlTemplate,
      attribution: env.tileAttribution,
    };
  }
}

class OsmGeocoderProvider implements GeocoderProvider {
  readonly key = "osm-nominatim";

  status(): ProviderStatus {
    return {
      key: this.key,
      enabled: env.geocoderEnabled,
      available: env.geocoderEnabled,
      message: env.geocoderEnabled ? undefined : "Kilde utilgjengelig",
    };
  }

  async geocode(query: string) {
    if (!env.geocoderEnabled) {
      return [];
    }

    const cacheKey = query.trim().toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL("/search", env.geocoderBaseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "no");

    const response = await fetch(url, {
      headers: {
        "User-Agent": env.geocoderUserAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Geokoder svarte med ${response.status}`);
    }

    const payload = (await response.json()) as Array<Record<string, unknown>>;
    const results = payload.map((entry) => ({
      label: String(entry.display_name ?? ""),
      lat: Number(entry.lat),
      lng: Number(entry.lon),
      municipality:
        typeof entry.address === "object" && entry.address
          ? String(
              (entry.address as Record<string, unknown>).municipality ??
                (entry.address as Record<string, unknown>).city ??
                "",
            ) || undefined
          : undefined,
      county:
        typeof entry.address === "object" && entry.address
          ? String((entry.address as Record<string, unknown>).county ?? "") || undefined
          : undefined,
      source: this.key,
    }));

    geocodeCache.set(cacheKey, results);
    return results;
  }
}

class StaticPublicDatasetProvider implements PublicDatasetProvider {
  readonly key = "norwegian-public-datasets";

  status(): ProviderStatus {
    return {
      key: this.key,
      enabled: env.publicDatasetProviderEnabled,
      available: env.publicDatasetProviderEnabled,
      message: env.publicDatasetProviderEnabled ? undefined : "Kilde utilgjengelig",
    };
  }

  async search(query: string) {
    if (!env.publicDatasetProviderEnabled) {
      return [];
    }

    const encoded = encodeURIComponent(query || "kommunal sak");
    return [
      {
        title: "Data.norge.no søk",
        publisher: "Digitaliseringsdirektoratet",
        source_type: "offentlig_datasett",
        source_url: `https://data.norge.no/search?search=${encoded}`,
        authority_level: "veiledende",
        notes: "Generelt søk i norske offentlige datasett.",
      },
      {
        title: "Geonorge søk",
        publisher: "Kartverket",
        source_type: "offentlig_datasett",
        source_url: `https://www.geonorge.no/sok?query=${encoded}`,
        authority_level: "veiledende",
        notes: "Relevante kart- og geodatasett for sted, plan og eiendom.",
      },
      {
        title: "Norgeskart",
        publisher: "Kartverket",
        source_type: "kartkilde",
        source_url: "https://norgeskart.no/",
        authority_level: "veiledende",
        notes: "Kartkilde for manuell kontroll av sted og eiendomskontekst.",
      },
    ];
  }
}

class StaticLegalSourceProvider implements LegalSourceProvider {
  readonly key = "manual-legal-sources";

  status(): ProviderStatus {
    return {
      key: this.key,
      enabled: env.legalSourceProviderEnabled,
      available: env.legalSourceProviderEnabled,
      message: env.legalSourceProviderEnabled ? undefined : "Kilde utilgjengelig",
    };
  }

  async suggest(issueType?: string) {
    if (!env.legalSourceProviderEnabled) {
      return [];
    }

    const common: SourceSuggestion[] = [
      {
        title: "Forvaltningsloven",
        publisher: "Lovdata",
        source_type: "lov",
        source_url: "https://lovdata.no/dokument/NL/lov/1967-02-10",
        authority_level: "autoritativ",
        notes: "Relevant for utredningsplikt, begrunnelse, klage og saksbehandling.",
      },
      {
        title: "Offentleglova",
        publisher: "Lovdata",
        source_type: "lov",
        source_url: "https://lovdata.no/dokument/NL/lov/2006-05-19-16",
        authority_level: "autoritativ",
        notes: "Relevant ved innsynsbegjæring og dokumenttilgang.",
      },
    ];

    if (issueType === "byggesak" || issueType === "plan") {
      common.push({
        title: "Plan- og bygningsloven",
        publisher: "Lovdata",
        source_type: "lov",
        source_url: "https://lovdata.no/dokument/NL/lov/2008-06-27-71",
        authority_level: "autoritativ",
        notes: "Relevant ved byggesaker, terrenginngrep og planforhold.",
      });
    }

    return common;
  }
}

class StaticMunicipalitySourceProvider implements MunicipalitySourceProvider {
  readonly key = "municipality-source-suggestions";

  status(): ProviderStatus {
    return {
      key: this.key,
      enabled: env.municipalitySourceProviderEnabled,
      available: env.municipalitySourceProviderEnabled,
      message: env.municipalitySourceProviderEnabled ? undefined : "Kilde utilgjengelig",
    };
  }

  async suggest(municipality?: string) {
    if (!env.municipalitySourceProviderEnabled) {
      return [];
    }

    const normalized = municipality ? municipality.toLowerCase() : "kommunen";

    return [
      {
        title: `Kommunens postjournal og innsyn for ${municipality ?? "aktuell kommune"}`,
        publisher: "norge.no",
        source_type: "kommunalt_dokument",
        source_url: "https://www.norge.no/",
        authority_level: "kontekstuell",
        notes: `Bruk norge.no som startpunkt for å finne offisiell portal for ${municipality ?? normalized} og deretter postjournal eller innsynsløsning.`,
      },
      {
        title: `Kommunale planer og saksinnsyn for ${municipality ?? "aktuell kommune"}`,
        publisher: "norge.no",
        source_type: "kommunalt_dokument",
        source_url: "https://www.norge.no/",
        authority_level: "kontekstuell",
        notes: `Bruk offisiell kommuneportal for ${municipality ?? normalized} til å lete etter planportal, saksarkiv eller byggesaksinnsyn.`,
      },
    ];
  }
}

const geocoderProvider = new OsmGeocoderProvider();
const tileProvider = new StaticTileProvider();
const publicDatasetProvider = new StaticPublicDatasetProvider();
const legalSourceProvider = new StaticLegalSourceProvider();
const municipalitySourceProvider = new StaticMunicipalitySourceProvider();

export async function geocodeLocation(query: string) {
  try {
    return {
      status: geocoderProvider.status(),
      results: await geocoderProvider.geocode(query),
    };
  } catch {
    return {
      status: {
        ...geocoderProvider.status(),
        available: false,
        message: "Kilde utilgjengelig",
      },
      results: [],
    };
  }
}

export async function searchMapContext(query?: string, municipality?: string, issueType?: string) {
  const [geocodeData, datasets, legalSources, municipalitySources] = await Promise.all([
    query ? geocodeLocation(query) : Promise.resolve({ status: geocoderProvider.status(), results: [] }),
    publicDatasetProvider.search(query ?? municipality ?? "kommunal sak"),
    legalSourceProvider.suggest(issueType),
    municipalitySourceProvider.suggest(municipality),
  ]);

  return {
    tiles: tileProvider.config(),
    providers: {
      geocoder: geocodeData.status,
      publicDatasets: publicDatasetProvider.status(),
      legalSources: legalSourceProvider.status(),
      municipalitySources: municipalitySourceProvider.status(),
    },
    results: {
      places: geocodeData.results,
      datasets,
      legalSources,
      municipalitySources,
    },
  };
}
