import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../utils/leafletSetup';
import L from 'leaflet';
import { Navigation, Compass, Target, Clock, Zap, Layers, Map as MapIcon, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MAP_TILES } from '../../../utils/mapTiles';
import './map-styles.css';
import axios from 'axios';

const createSemanticMarker = ({ emoji, background, border, size }) =>
    L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
        html: `
            <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: ${background}; border: 3px solid ${border}; box-shadow: 0 8px 18px rgba(0,0,0,0.2); font-size: ${Math.round(size * 0.45)}px; line-height: 1;">
                <span aria-hidden="true">${emoji}</span>
                <div style="position: absolute; bottom: -8px; left: 50%; width: 14px; height: 14px; background: ${background}; border-left: 3px solid ${border}; border-bottom: 3px solid ${border}; transform: translateX(-50%) rotate(-45deg);"></div>
            </div>
        `,
    });

const workerIcon = createSemanticMarker({
    emoji: '🚚',
    background: '#22c55e',
    border: '#ffffff',
    size: 46,
});

const customerIcon = createSemanticMarker({
    emoji: '🏠',
    background: '#2563eb',
    border: '#ffffff',
    size: 44,
});

// Calculate distance logic
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function MapController({ workerPos, customerLocation, triggerRecenter }) {
    const map = useMap();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (!workerPos || !customerLocation) return;
        if (!workerPos.lat || !workerPos.lng || !customerLocation.lat || !customerLocation.lng) return;

        if (isFirstLoad.current) {
            const bounds = L.latLngBounds([
                [customerLocation.lat, customerLocation.lng],
                [workerPos.lat, workerPos.lng]
            ]);
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
            isFirstLoad.current = false;
        }
    }, [workerPos, customerLocation, map]);

    useEffect(() => {
        if (triggerRecenter && workerPos && workerPos.lat && workerPos.lng) {
            map.flyTo([workerPos.lat, workerPos.lng], 16, { animate: true, duration: 1.5 });
        }
    }, [triggerRecenter, workerPos, map]);

    return null;
}

export function LiveTrackingMap({
    workerId,
    customerLocation,
    initialWorkerLocation,
    height = "400px"
}) {
    const { t } = useTranslation();
    const [workerPos, setWorkerPos] = useState(initialWorkerLocation);
    const [history, setHistory] = useState(initialWorkerLocation ? [[initialWorkerLocation.lat, initialWorkerLocation.lng]] : []);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [recenterCount, setRecenterCount] = useState(0);
    const [tileType, setTileType] = useState('streets');
    const [showTileMenu, setShowTileMenu] = useState(false);
    const [lastInitial, setLastInitial] = useState(initialWorkerLocation);
    const [eta, setEta] = useState(null);

    // Sync prop to state if it changes (e.g. after parent fetch)
    if (initialWorkerLocation && (
        !lastInitial ||
        initialWorkerLocation.lat !== lastInitial.lat ||
        initialWorkerLocation.lng !== lastInitial.lng
    )) {
        setLastInitial(initialWorkerLocation);
        setWorkerPos(initialWorkerLocation);
        if (history.length === 0) {
            setHistory([[initialWorkerLocation.lat, initialWorkerLocation.lng]]);
        }
    }

    useEffect(() => {
        const handleLocationUpdate = (event) => {
            const data = event.detail;
            if (data.workerProfileId === workerId && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                const newPos = { lat: data.latitude, lng: data.longitude };
                setWorkerPos(newPos);
                setHistory(prev => {
                    const next = [...prev, [data.latitude, data.longitude]];
                    return next.slice(-50);
                });
                setLastUpdated(new Date());
            }
        };
        window.addEventListener('upro:worker-location-updated', handleLocationUpdate);
        return () => window.removeEventListener('upro:worker-location-updated', handleLocationUpdate);
    }, [workerId]);

    // ETA calculation using OSRM (Open Source Routing Machine) to avoid CORS issues
    useEffect(() => {
        let mounted = true;
        async function fetchEta() {
            if (!workerPos || !customerLocation || !workerPos.lat || !customerLocation.lat) {
                if (mounted) setEta(null);
                return;
            }
            try {
                // OSRM format: lng,lat;lng,lat
                const url = `https://router.project-osrm.org/route/v1/driving/${workerPos.lng},${workerPos.lat};${customerLocation.lng},${customerLocation.lat}?overview=false`;
                const resp = await axios.get(url);
                const route = resp.data.routes && resp.data.routes[0];
                if (route && mounted) {
                    const durationMins = Math.ceil(route.duration / 60);
                    setEta(`${durationMins} min`);
                } else if (mounted) {
                    setEta(null);
                }
            } catch (err) {
                console.warn('Failed to fetch ETA:', err.message);
                if (mounted) setEta(null);
            }
        }
        fetchEta();

        // Polling ETA every 30 seconds to keep it fresh
        const interval = setInterval(fetchEta, 30000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [workerPos, customerLocation]);

    const distance = useMemo(() => {
        if (!workerPos || !customerLocation) return null;
        return calculateDistance(workerPos.lat, workerPos.lng, customerLocation.lat, customerLocation.lng);
    }, [workerPos, customerLocation]);
    const formattedLastUpdated = useMemo(() => {
        if (!lastUpdated || Number.isNaN(lastUpdated.getTime())) return 'N/A';
        return lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, [lastUpdated]);
    const etaMins = eta;
    const hasArrived = distance !== null && distance < 0.05; // 50 meters

    if (!customerLocation || typeof customerLocation.lat !== 'number' || typeof customerLocation.lng !== 'number' || isNaN(customerLocation.lat) || isNaN(customerLocation.lng)) {
        return (
            <div className="flex items-center justify-center bg-gray-50 dark:bg-dark-800 rounded-3xl border border-dashed border-gray-300 dark:border-dark-700" style={{ height }}>
                <div className="text-center p-6">
                    <MapIcon size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('Waiting for valid location...')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-black/5" style={{ height }}>

            {/* ETA Display */}
            {eta && (
                <div className="absolute top-4 right-4 z-[500] bg-white/90 dark:bg-dark-900/90 px-4 py-2 rounded-xl shadow-lg border border-brand-200 text-brand-700 dark:text-brand-300 text-xs font-bold pointer-events-auto">
                    <Clock size={16} className="inline mr-1" />
                    Worker arrives in {eta}
                </div>
            )}

            <MapContainer
                center={[customerLocation.lat, customerLocation.lng]}
                zoom={14}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                zoomControl={false}
                attributionControl={false}
                className="upro-engine-map"
            >
                <TileLayer url={MAP_TILES[tileType]} />

                {/* Service Area */}
                <Circle
                    center={[customerLocation.lat, customerLocation.lng]}
                    radius={120}
                    pathOptions={{ color: '#6366f1', fillOpacity: 0.1, weight: 2, dashArray: '6, 6' }}
                />

                {/* Customer Location Pin */}
                <Marker position={[customerLocation.lat, customerLocation.lng]} icon={customerIcon}>
                    <Popup className="upro-popup" autoPan={false}>
                        <div className="p-3 text-center min-w-[120px]">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 block mb-1">Customer Home</span>
                            <div className="h-px w-full bg-gray-100 dark:bg-white/10 my-1.5" />
                            <p className="text-[10px] text-gray-500 font-bold leading-tight">Service Site</p>
                        </div>
                    </Popup>
                </Marker>

                {/* Worker (INTERCHANGED TO SCOOTER) */}
                {workerPos && (
                    <Marker position={[workerPos.lat, workerPos.lng]} icon={workerIcon}>
                        <Popup className="upro-popup" autoPan={false}>
                            <div className="p-3 text-center min-w-[120px]">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 block mb-1">Delivery Professional</span>
                                <div className="h-px w-full bg-gray-100 dark:bg-white/10 my-1.5" />
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[10px] text-gray-500 font-bold">On the move</p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                <MapController workerPos={workerPos} customerLocation={customerLocation} triggerRecenter={recenterCount} />
            </MapContainer>

            {/* Top Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-white/90 dark:bg-dark-900/90 shadow-lg border border-white/20 pointer-events-auto">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute h-full w-full rounded-full bg-green-500 opacity-75"></span>
                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Live</span>
                    </div>

                    {/* Waiting for Worker Overlay */}
                    {!workerPos && (
                        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-[401] flex flex-col items-center justify-center pointer-events-none">
                            <div className="bg-white/80 dark:bg-dark-900/80 backdrop-blur-md px-8 py-6 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-500 pointer-events-auto">
                                <div className="p-4 bg-brand-500/10 rounded-2xl relative">
                                    <Navigation className="text-brand-500 animate-pulse" size={28} />
                                    <div className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute h-full w-full rounded-full bg-brand-500 opacity-75"></span>
                                        <span className="h-3 w-3 rounded-full bg-brand-500"></span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-base font-black tracking-tight text-gray-900 dark:text-white">Professional not tracking yet</p>
                                    <p className="text-[11px] text-gray-400 font-bold max-w-[200px] mt-1 line-clamp-2 leading-relaxed uppercase tracking-tighter">
                                        Tracking will become live as soon as the professional begins their journey.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Toolbar: Live Badge + Tile Switcher */}
                    <div className="relative pointer-events-auto">
                        <button
                            onClick={() => setShowTileMenu(!showTileMenu)}
                            className="p-2 rounded-full backdrop-blur-md bg-white/90 dark:bg-dark-900/90 shadow-lg border border-white/20 transition-all hover:bg-brand-500 hover:text-white"
                        >
                            <Layers size={14} />
                        </button>

                        {showTileMenu && (
                            <div className="absolute top-10 left-0 p-1.5 rounded-2xl backdrop-blur-xl bg-white/95 dark:bg-dark-900/95 shadow-2xl border border-white/10 flex flex-col gap-1 min-w-[120px]">
                                {Object.keys(MAP_TILES).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => { setTileType(type); setShowTileMenu(false); }}
                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-left transition-colors ${tileType === type ? 'bg-brand-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-60'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setRecenterCount(c => c + 1)}
                    className="p-2.5 rounded-full backdrop-blur-md bg-white/90 dark:bg-dark-900/90 shadow-lg border border-white/20 pointer-events-auto active:scale-90 transition-all hover:bg-brand-500 hover:text-white"
                >
                    <Target size={16} />
                </button>
            </div>

            {/* Bottom Logistics Card (Refined Approach) */}
            <div className="absolute bottom-6 left-6 right-6 z-[400] pointer-events-none group/logistics">
                <div className={`backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] rounded-3xl border p-5 pointer-events-auto flex items-center justify-between gap-8 transition-all duration-500 group-hover/logistics:translate-y-[-4px] ${hasArrived ? 'bg-emerald-500/10 border-emerald-500/50 dark:bg-emerald-900/20' : 'bg-white/95 dark:bg-dark-950/90 border-white/20'
                    }`}>
                    <div className="flex-1 flex items-center gap-5">
                        <div className={`p-3.5 rounded-2xl shadow-inner ${hasArrived ? 'bg-emerald-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            {hasArrived ? <CheckCircle size={22} /> : <Navigation size={22} className="animate-pulse" />}
                        </div>
                        <div className="flex flex-col">
                            {hasArrived ? (
                                <p className="text-2xl font-black tracking-tighter leading-none text-emerald-600 dark:text-emerald-400 uppercase">Arrived</p>
                            ) : (
                                <p className="text-3xl font-black tracking-tighter leading-none bg-gradient-to-br from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                                    {etaMins ? `${etaMins}m` : '--'}
                                </p>
                            )}
                            <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] mt-1.5 ml-0.5">
                                {hasArrived ? 'On-site Now' : 'Arrival Estimate'}
                            </p>
                        </div>
                    </div>

                    <div className="w-px h-12 bg-black/5 dark:bg-white/10" />

                    <div className="flex-1 flex items-center justify-end gap-5">
                        <div className="flex flex-col items-end">
                            <p className={`text-2xl font-black tracking-tighter leading-none ${hasArrived ? 'text-emerald-500' : 'text-brand-500'}`}>
                                {distance !== null ? (distance < 0.1 ? 'Nearby' : `${distance.toFixed(1)}k`) : '--'}
                            </p>
                            <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] mt-1.5 mr-0.5">Distance Left</p>
                        </div>
                        <div className={`p-3.5 rounded-2xl shadow-inner ${hasArrived ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            <Compass size={22} />
                        </div>
                    </div>
                </div>

                {/* Latency/Security Footer */}
                <div className="flex items-center justify-between px-6 mt-3">
                    <div className="flex items-center gap-1.5 opacity-30">
                        <Clock size={10} />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Feed Update: {formattedLastUpdated}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-40">
                        <Zap size={9} className="text-brand-500" />
                        <span className="text-[8px] font-black uppercase text-brand-500 tracking-tighter">Verified Stream</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
