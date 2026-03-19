import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../utils/leafletSetup';
import { MAP_TILES } from '../../../utils/mapTiles';
import { toFixedSafe } from '../../../utils/numberFormat';
import { Layers, Map as MapIcon, Mountain, Satellite, Moon, Zap } from 'lucide-react';
import './map-styles.css';

const LAYER_OPTIONS = [
    { id: 'streets', label: 'Streets', icon: MapIcon, tile: MAP_TILES.streets },
    { id: 'satellite', label: 'Satellite', icon: Satellite, tile: MAP_TILES.satellite },
    { id: 'terrain', label: 'Terrain', icon: Mountain, tile: MAP_TILES.terrain },
    { id: 'dark', label: 'Dark', icon: Moon, tile: MAP_TILES.dark },
];

/**
 * MiniMap
 *
 * A refined, premium map with an interactive layer switcher.
 * Supports streets, satellite, terrain, and dark map styles.
 * Now supports visual radius visualization.
 */
export function MiniMap({ lat, lng, height = "200px", zoom = 14, radius = 0 }) {
    const [activeLayer, setActiveLayer] = useState('satellite');
    const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

    const latitude = Number(lat);
    const longitude = Number(lng);
    const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

    if (!hasValidCoords) return null;

    const position = { lat: latitude, lng: longitude };
    const currentTile = LAYER_OPTIONS.find(l => l.id === activeLayer)?.tile || MAP_TILES.streets;

    return (
        <div
            className="relative w-full rounded-2xl overflow-hidden border-2 transition-all duration-300 shadow-xl border-gray-50 bg-white dark:border-white/5 dark:bg-dark-900"
            style={{ height }}
        >
            <MapContainer
                center={position}
                zoom={zoom}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                boxZoom={false}
                keyboard={false}
                className="upro-branded-minimap"
            >
                <TileLayer key={activeLayer} url={currentTile} />
                <Marker position={position} />
                
                {radius > 0 && (
                    <Circle
                        center={position}
                        radius={radius * 1000}
                        pathOptions={{
                            fillColor: '#3b82f6',
                            fillOpacity: 0.1,
                            color: '#3b82f6',
                            weight: 1,
                            dashArray: '4, 4'
                        }}
                    />
                )}
            </MapContainer>

            {/* Premium Sophisticated Overlays */}
            <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-t from-black/5 to-transparent dark:from-dark-950/40" />

            {/* Layer Switcher Button */}
            <div className="absolute top-3 right-3 z-[400]">
                <button
                    onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
                    className={`
                        p-2 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-200
                        hover:scale-105 active:scale-95
                        bg-white/90 text-gray-600 border-black/5 hover:bg-white hover:text-gray-900
                        dark:bg-dark-950/80 dark:text-gray-300 dark:border-white/10 dark:hover:bg-dark-800/90 dark:hover:text-white
                        ${isLayerMenuOpen ? 'ring-2 ring-brand-500/40' : ''}
                    `}
                    title="Switch map layer"
                >
                    <Layers size={16} />
                </button>

                {/* Layer Dropdown */}
                {isLayerMenuOpen && (
                    <div className={`
                        absolute top-full right-0 mt-2 w-40 rounded-xl overflow-hidden shadow-2xl border
                        animate-in fade-in slide-in-from-top-2 duration-200
                        bg-white/95 border-gray-200 backdrop-blur-xl dark:bg-dark-900/95 dark:border-white/10
                    `}>
                        {LAYER_OPTIONS.map(layer => {
                            const Icon = layer.icon;
                            const isActive = activeLayer === layer.id;
                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => {
                                        setActiveLayer(layer.id);
                                        setIsLayerMenuOpen(false);
                                    }}
                                    className={`
                                        w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold transition-all
                                        ${isActive
                                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                                        }
                                    `}
                                >
                                    <Icon size={14} className={isActive ? 'text-brand-500' : 'opacity-50'} />
                                    <span className="uppercase tracking-wider text-[10px]">{layer.label}</span>
                                    {isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Branded HUD Items */}
            <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2">
                {radius > 0 && (
                    <div className="px-2 py-1 rounded-lg bg-brand-500/90 text-white text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 shadow-lg backdrop-blur-md">
                        <Zap size={10} />
                        {radius} KM RADIAL SIGNAL
                    </div>
                )}
            </div>

            {/* Branded Coordinate Badge */}
            <div className="absolute bottom-3 right-3 z-[400] px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest shadow-lg border backdrop-blur-md select-none bg-white/90 text-gray-500 border-black/5 dark:bg-dark-950/80 dark:text-gray-400 dark:border-white/5">
                <span className="opacity-40 mr-1.5 uppercase font-black tracking-tighter">Coord:</span>
                {toFixedSafe(latitude, 4, '0.0000')}, {toFixedSafe(longitude, 4, '0.0000')}
            </div>
        </div>
    );
}
