'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

type LocationPickerMapProps = {
  center: [number, number];
  pin?: [number, number];
  onPick?: (latitude: number, longitude: number) => void;
};

function MapClickHandler({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapViewSync({ center, pin }: { center: [number, number]; pin?: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    const nextZoom = pin ? Math.max(map.getZoom(), 15) : map.getZoom();
    map.setView(pin ?? center, nextZoom, { animate: false });
    const timers = [
      window.setTimeout(() => map.invalidateSize(false), 0),
      window.setTimeout(() => map.invalidateSize(false), 260),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [center, map, pin]);

  return null;
}

export default function LocationPickerMap({ center, pin, onPick }: LocationPickerMapProps) {
  const markerIcon = useMemo(
    () => L.divIcon({
      className: 'map-pin-marker',
      html: '<span></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    }),
    [],
  );

  return (
    <MapContainer center={pin ?? center} zoom={14} className='location-picker-map' scrollWheelZoom preferCanvas>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        keepBuffer={4}
        updateWhenIdle
        updateWhenZooming={false}
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />
      {onPick && <MapClickHandler onPick={onPick} />}
      <MapViewSync center={center} pin={pin} />
      {pin && <Marker position={pin} icon={markerIcon} />}
    </MapContainer>
  );
}
