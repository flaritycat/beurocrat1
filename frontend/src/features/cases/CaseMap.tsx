import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Coordinates, GeocodeResult, MapObservation, TileConfig } from "../../lib/types";

type CaseMapProps = {
  coordinates: Coordinates | null;
  observations: MapObservation[];
  selectedResult: GeocodeResult | null;
  tileConfig: TileConfig | null;
};

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function CaseMap({ coordinates, observations, selectedResult, tileConfig }: CaseMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !tileConfig) {
      return;
    }

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView([59.9139, 10.7522], 9);

    L.tileLayer(tileConfig.urlTemplate, {
      attribution: tileConfig.attribution,
      maxZoom: 19,
    }).addTo(mapRef.current);

    layerGroupRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, [tileConfig]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) {
      return;
    }

    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    if (coordinates) {
      const marker = L.marker([coordinates.lat, coordinates.lng]).bindPopup("Lagret sakslokasjon");
      marker.addTo(layerGroup);
      bounds.extend(marker.getLatLng());
    }

    if (selectedResult) {
      const marker = L.circleMarker([selectedResult.lat, selectedResult.lng], {
        radius: 8,
        color: "#ab6e37",
        fillColor: "#d9a56d",
        fillOpacity: 0.85,
      }).bindPopup(`Søketreff: ${selectedResult.label}`);
      marker.addTo(layerGroup);
      bounds.extend(marker.getLatLng());
    }

    observations.forEach((observation) => {
      const geometry = observation.geometry_json;
      const layer = L.geoJSON(geometry as GeoJSON.GeoJsonObject, {
        pointToLayer(_feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 7,
            color: "#21414f",
            fillColor: "#4e7484",
            fillOpacity: 0.8,
          });
        },
      }).bindPopup(`<strong>${observation.title}</strong><br/>${observation.description ?? ""}`);

      layer.addTo(layerGroup);

      const layerBounds = layer.getBounds?.();
      if (layerBounds?.isValid()) {
        bounds.extend(layerBounds);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.25));
    }
  }, [coordinates, observations, selectedResult]);

  return <div className="map-canvas" ref={mapContainerRef} />;
}
