import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
// Google Places API integration
import axios from 'axios';
import { clientEnv } from '../../../config/env';

const GOOGLE_PLACES_API_KEY = clientEnv.googlePlacesApiKey;
const GOOGLE_PLACES_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GOOGLE_PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

/**
 * AddressAutocomplete
 * 
 * A search input that provides address suggestions using OpenStreetMap Nominatim.
 * Returns the selected address string and its coordinates (lat, lng).
 */
export function AddressAutocomplete({ value, onChange, placeholder = "Search for your address...", className = "" }) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const abortControllerRef = useRef(null);
    const debounceTimeoutRef = useRef(null);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const fetchSuggestions = async (searchQuery) => {
        if (!GOOGLE_PLACES_API_KEY) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        if (searchQuery.length < 3) {
            setSuggestions([]);
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setIsLoading(true);

        try {
            const response = await axios.get(
                GOOGLE_PLACES_AUTOCOMPLETE_URL,
                {
                    params: {
                        input: searchQuery,
                        key: GOOGLE_PLACES_API_KEY,
                        language: 'en',
                        components: 'country:in', // restrict to India
                    },
                    signal: abortControllerRef.current.signal
                }
            );
            const predictions = response.data.predictions || [];
            setSuggestions(predictions);
            setShowDropdown(true);
        } catch (err) {
            if (!axios.isCancel(err) && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                console.error('Autocomplete error:', err);
                setSuggestions([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
    };

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (query.length < 3) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        debounceTimeoutRef.current = setTimeout(() => {
            fetchSuggestions(query);
        }, 400);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [query]);

    const handleSelect = async (item) => {
        setQuery(item.description);
        setShowDropdown(false);

        if (!GOOGLE_PLACES_API_KEY) {
            onChange({
                address: item.description,
                lat: null,
                lng: null,
                details: {},
            });
            return;
        }

        // Fetch place details for lat/lng and structured address
        try {
            const detailsResp = await axios.get(
                GOOGLE_PLACES_DETAILS_URL,
                {
                    params: {
                        place_id: item.place_id,
                        key: GOOGLE_PLACES_API_KEY,
                        language: 'en',
                    }
                }
            );
            const details = detailsResp.data.result;
            const location = details.geometry?.location || {};
            onChange({
                address: details.formatted_address || item.description,
                lat: location.lat || null,
                lng: location.lng || null,
                details: details.address_components || {},
            });
        } catch (err) {
            console.error('Place details error:', err);
            onChange({
                address: item.description,
                lat: null,
                lng: null,
                details: {},
            });
        }
    };

    const clearInput = () => {
        setQuery('');
        setSuggestions([]);
        setShowDropdown(false);
        onChange({ address: '', lat: null, lng: null });
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isLoading ? (
                        <Loader2 className="text-brand-500 animate-spin" size={20} />
                    ) : (
                        <Search className="text-gray-400 group-focus-within:text-brand-500 transition-colors" size={20} />
                    )}
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query.length >= 3 && setShowDropdown(true)}
                    placeholder={placeholder}
                    className="w-full pl-12 pr-10 py-3.5 rounded-xl border text-base outline-none transition-all shadow-sm
                            bg-gray-50 dark:bg-dark-900 border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-dark-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500
                        "
                />
                {query && (
                    <button
                        type="button"
                        onClick={clearInput}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {showDropdown && suggestions.length > 0 && (
                <div
                    className="absolute z-[100] mt-2 w-full rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 bg-white dark:bg-dark-800 border-gray-100 dark:border-dark-700"
                >
                    <div className="max-h-64 overflow-y-auto">
                        {suggestions.map((item, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => handleSelect(item)}
                                className={`w-full px-4 py-3 flex items-start gap-3 transition-colors text-left
                                        hover:bg-gray-50 dark:hover:bg-dark-700
                                    ${index !== suggestions.length - 1 ? 'border-b border-gray-50 dark:border-dark-700' : ''}`}
                            >
                                <div className="mt-0.5 p-1.5 rounded-lg bg-brand-50 dark:bg-dark-900">
                                    <MapPin size={16} className="text-brand-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                                        {item.description.split(',')[0]}
                                    </p>
                                    <p className="text-xs truncate text-gray-500 dark:text-gray-400">
                                        {item.description.split(',').slice(1).join(',').trim()}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="px-4 py-2 border-t text-[10px] text-gray-400 text-right bg-gray-50 dark:bg-dark-900/50 border-gray-100 dark:border-dark-700">
                        Data by Google Places
                    </div>
                </div>
            )}
        </div>
    );
}
