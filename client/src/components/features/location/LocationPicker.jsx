import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../utils/leafletSetup';
import { MapPin, Navigation, Globe, Layers, Zap } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MAP_TILES, MAP_TILE_ATTRIBUTION } from '../../../utils/mapTiles';
import { toFixedSafe } from '../../../utils/numberFormat';

/**
 * MapEvents
 * Internal helper to handle map clicks
 */
function MapEvents({ onLocationSelect }) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng);
        },
    });
    return null;
}

/**
 * ChangeView
 * Internal helper to center map when coordinates change externaly
 */
function ChangeView({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, 15);
        }
    }, [center, map]);
    return null;
}

/**
 * LocationPicker
 * 
 * A visual map picker combined with address autocomplete.
 */
export function LocationPicker({ onChange, initialLocation = null, className = '', radius = 0 }) {
    const { t } = useTranslation();
    // State for local position
    const [position, setPosition] = useState(() => {
        if (initialLocation && typeof initialLocation.lat === 'number' && typeof initialLocation.lng === 'number' && !isNaN(initialLocation.lat) && !isNaN(initialLocation.lng)) {
            return { lat: initialLocation.lat, lng: initialLocation.lng };
        }
        return { lat: 19.0760, lng: 72.8777 }; // Default Mumbai coordinates
    });

    const [address, setAddress] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Sync state with initialLocation if it changes (e.g. after profile fetch)
    useEffect(() => {
        if (initialLocation && typeof initialLocation.lat === 'number' && typeof initialLocation.lng === 'number' && !isNaN(initialLocation.lat) && !isNaN(initialLocation.lng)) {
            setPosition({ lat: initialLocation.lat, lng: initialLocation.lng });
        }
    }, [initialLocation]);

    const handleLocationChange = useCallback((latlng, addr = '') => {
        const lat = Number(latlng?.lat);
        const lng = Number(latlng?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        setPosition({ lat, lng });
        // Using functional update to avoid 'address' dependency loop
        setAddress(prev => {
            const finalAddr = addr || prev;
            onChange({
                lat,
                lng,
                address: finalAddr
            });
            return finalAddr;
        });
    }, [onChange]);

    const handleAutocompleteSelect = (data) => {
        const latlng = { lat: data.lat, lng: data.lng };
        setIsCalibrating(true);
        handleLocationChange(latlng, data.address);
        setIsCalibrating(false);
    };

    const handleMapClick = (latlng) => {
        setIsCalibrating(true);
        fetchReverseGeocode(latlng.lat, latlng.lng);
    };

    const fetchReverseGeocode = useCallback(async (lat, lng) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`);
            const data = await response.json();
            if (data.address) {
                const addr = data.address;
                const hasShegaon = (value) => String(value || '').toLowerCase().includes('shegaon');
                const isShegaon = 
                    hasShegaon(addr.village) || 
                    hasShegaon(addr.town) || 
                    hasShegaon(addr.suburb) ||
                    hasShegaon(data.display_name);
                const formattedAddress = isShegaon 
                    ? `Shegaon, Buldhana, Maharashtra - 444203`
                    : (data.display_name || '');
                setAddress(formattedAddress);
                handleLocationChange({ lat, lng }, formattedAddress);
                if (isShegaon) {
                    toast.success(t('High-precision location synced for Shegaon.'));
                }
            } else {
                toast.error(t('Could not parse address from map.'));
            }
        } catch (err) {
            console.error('Reverse geocode error:', err);
            toast.error(t('Could not parse address from map.'));
        } finally {
            setIsCalibrating(false);
        }
    }, [handleLocationChange, t]);

    const getUserLocation = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser.');
            return;
        }

        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            toast.error('Location access requires HTTPS (or localhost in development).');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                handleLocationChange(latlng);
                fetchReverseGeocode(latlng.lat, latlng.lng);
                setIsLocating(false);
            },
            (error) => {
                setIsLocating(false);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error('Location access denied. Please allow location in browser settings.');
                } else if (error.code === error.TIMEOUT) {
                    toast.error('Location request timed out. Please try again.');
                } else {
                    toast.error('Could not detect your current location.');
                }
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
        );
    }, [handleLocationChange, fetchReverseGeocode]);

    // Proactive Auto-Location: If no position provided, try to detect current user city.
    // This must be declared after getUserLocation to avoid use-before-initialization crashes.
    useEffect(() => {
        if (!initialLocation) {
            getUserLocation();
        }
    }, [initialLocation, getUserLocation]);

    const [mapType, setMapType] = useState('satellite');

    return (
        <div className="space-y-4">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative group">
                    <AddressAutocomplete
                        value={address}
                        onChange={handleAutocompleteSelect}
                        className="w-full"
                    />
                </div>
                <button
                    type="button"
                    onClick={getUserLocation}
                    disabled={isLocating}
                    className="h-14 px-6 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all 
                             shadow-lg active:scale-95 disabled:opacity-50
                             bg-white dark:bg-dark-900 border-gray-100 dark:border-dark-700 
                             text-gray-700 dark:text-gray-200 hover:border-brand-500/50 hover:text-brand-600
                            "
                >
                    <Navigation size={18} className={`${isLocating ? 'animate-pulse text-brand-500' : 'text-neutral-400'}`} />
                    <span className="text-sm font-black uppercase tracking-widest">{t('Current Location')}</span>
                </button>
            </div>

            <div className={`relative h-72 rounded-3xl overflow-hidden border-2 shadow-2xl border-gray-100 shadow-brand-500/10 dark:border-dark-700 dark:shadow-brand-500/5 ${className}`}>
                {position && typeof position.lat === 'number' && typeof position.lng === 'number' && !isNaN(position.lat) && !isNaN(position.lng) ? (
                    <MapContainer
                        center={position}
                        zoom={13}
                        style={{ height: '100%', width: '100%', zIndex: 1 }}
                        zoomControl={false}
                        attributionControl={false}
                    >
                        <ChangeView center={position} />
                        {mapType === 'streets' ? (
                            <TileLayer
                                url={MAP_TILES.streets}
                                attribution={MAP_TILE_ATTRIBUTION}
                            />
                        ) : (
                            <TileLayer
                                url={MAP_TILES.satellite}
                                attribution={MAP_TILE_ATTRIBUTION}
                            />
                        )}
                        <Marker position={position} />
                        
                        {/* Visual Service Radius Indicator */}
                        {radius > 0 && (
                            <Circle
                                center={position}
                                radius={radius * 1000}
                                pathOptions={{
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.15,
                                    color: '#3b82f6',
                                    weight: 2,
                                    dashArray: '5, 10'
                                }}
                            />
                        )}
                        
                        <MapEvents onLocationSelect={handleMapClick} />
                    </MapContainer>
                ) : (
                    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-dark-800">
                        <div className="text-center">
                            <Layers className="mx-auto text-gray-300 mb-2 animate-pulse" size={40} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('Calibrating Map...')}</p>
                        </div>
                    </div>
                )}

                {/* Floating Controls Overlay - Stacked Cleanly */}
                <div className="absolute top-6 right-6 z-[400] flex flex-col items-end gap-3 pointer-events-none">
                    {/* Map Calibration Badge */}
                    <div className="px-5 py-3 bg-dark-950/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="relative">
                            <div className={`w-3 h-3 rounded-full ${isCalibrating ? 'bg-yellow-400 animate-pulse' : 'bg-brand-500'} shadow-[0_0_12px_rgba(var(--brand-500-rgb),0.8)]`} />
                            {isCalibrating && <Zap size={14} className="absolute -top-1 -right-1 text-yellow-500 animate-bounce" />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white leading-none mb-1">
                                {isCalibrating ? t('Calibrating...') : t('Active Hub')}
                            </span>
                            {radius > 0 && <span className="text-[8px] font-bold text-white/40 leading-none">{radius} KM RADIUS ENABLED</span>}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
                        className="pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all active:scale-95 
                                 bg-white/90 border-white/20 dark:bg-dark-950/90 dark:border-dark-700 text-brand-500
                                 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-600"
                        title={`Switch to ${mapType === 'streets' ? 'Satellite' : 'Streets'} View`}
                    >
                        {mapType === 'streets' ? <Globe size={20} /> : <Layers size={20} />}
                    </button>
                </div>

                {/* Coordinate Display Overlay */}
                <div className="absolute bottom-6 left-6 z-[400] px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md text-[10px] font-black tracking-widest uppercase
                                bg-dark-950/80 text-neutral-400 border border-white/5">
                    {toFixedSafe(position?.lat, 6, '0.000000')} <span className="text-brand-500 mx-1">/</span> {toFixedSafe(position?.lng, 6, '0.000000')}
                </div>
            </div>

            {address && (
                <div className="p-4 rounded-xl border flex items-start gap-3 bg-opacity-50 bg-brand-50 border-brand-100 dark:bg-brand-900/10 dark:border-brand-800/20">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                        <MapPin size={16} className="text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-0.5 text-gray-500 dark:text-gray-400">Selected Location</p>
                        <p className="text-sm leading-snug font-medium text-gray-800 dark:text-gray-200">{address}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
