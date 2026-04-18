import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ScanLine, ChevronRight, Bell, Search,
  UserSearch, MapPin, Phone, Loader2, Map as MapIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import 'leaflet/dist/leaflet.css';

const DoctorSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultSpecialty = location.state?.defaultSpecialty || '';
  const diagnosisHint = location.state?.diagnosis || '';

  const [loc, setLoc] = useState('');
  const [specialty, setSpecialty] = useState(defaultSpecialty);
  const [doctors, setDoctors] = useState([]);
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [searchNote, setSearchNote] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [MapComponents, setMapComponents] = useState(null);
  const perPage = 6;

  // Lazy-load leaflet only in browser to avoid SSR issues
  useEffect(() => {
    import('react-leaflet').then(rl => {
      import('leaflet').then(L => {
        // Fix leaflet default marker icons
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      });
      setMapComponents({ MapContainer: rl.MapContainer, TileLayer: rl.TileLayer, Marker: rl.Marker, Popup: rl.Popup });
    });
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const res = await axios.get('https://nominatim.openstreetmap.org/reverse', { params: { lat, lon: lng, format: 'json' } });
          const l = res.data.address?.suburb || res.data.address?.city || res.data.address?.village || '';
          setLoc(l);
        } catch {}
      },
      () => setGeoError(true)
    );
  }, []);

  const geocode = async (s) => {
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', { params: { q: s + ', India', format: 'json', limit: 1 } });
      if (res.data?.length) return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
    } catch {}
    return null;
  };

  const handleSearch = async () => {
    if (!loc) { alert('Please enter a location.'); return; }
    setLoading(true); setSearchNote(''); setDoctors([]); setCurrentPage(1);
    try {
      const center = await geocode(loc);
      if (center) setCoords(center);
      const res = await axios.get('http://127.0.0.1:8000/api/search-doctors', { params: { location: loc, specialty, lat: center?.lat, lng: center?.lng } });
      let results = Array.isArray(res.data) ? res.data : [];
      if (results.length === 0 && specialty.trim()) {
        const fb = await axios.get('http://127.0.0.1:8000/api/search-doctors', { params: { location: loc, specialty: '', lat: center?.lat, lng: center?.lng } });
        results = Array.isArray(fb.data) ? fb.data : [];
        if (results.length) setSearchNote('No exact specialty match found. Showing nearby doctors.');
      }
      setDoctors(results);
      if (results.length === 0) setSearchNote('No nearby doctors found. Try a nearby city or broader specialty.');
    } catch { alert('Failed to fetch doctors. Please try again.'); }
    finally { setLoading(false); }
  };

  const paginated = doctors.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeTab="doctor" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <UserSearch className="w-4 h-4 text-sky-500" />
            <span className="text-gray-900 font-semibold">Find Doctors Near You</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="px-8 py-6 max-w-5xl mx-auto w-full space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Doctor Search</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {diagnosisHint ? `Finding ${specialty || 'specialists'} for: ${diagnosisHint}` : 'Find verified doctors and clinics near you.'}
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="doctor-search-location"
                    placeholder="Enter city or suburb"
                    value={loc}
                    onChange={e => setLoc(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Specialty</label>
                <div className="relative">
                  <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="doctor-search-specialty"
                    placeholder="e.g. Cardiologist"
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>
              <button
                id="doctor-search-btn"
                onClick={handleSearch}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all text-sm"
              >
                {loading && <Loader2 className="animate-spin w-4 h-4" />}
                Search
              </button>
            </div>

            {geoError && (
              <p className="text-sm text-amber-600 font-medium mt-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Could not detect your location automatically. Please type it above.
              </p>
            )}
            {searchNote && (
              <p className="text-sm text-amber-600 font-medium mt-3">{searchNote}</p>
            )}
          </div>

          {/* Map */}
          {coords && MapComponents ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] overflow-hidden">
              <MapComponents.MapContainer
                key={`${coords.lat}-${coords.lng}`}
                center={[coords.lat, coords.lng]}
                zoom={13}
                className="h-[360px] w-full"
              >
                <MapComponents.TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                />
                {doctors.map((doc, i) => {
                  const lat = parseFloat(doc.lat);
                  const lng = parseFloat(doc.lng);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  return (
                    <MapComponents.Marker key={i} position={[lat, lng]}>
                      <MapComponents.Popup>
                        <strong>{doc.name}</strong><br />{doc.specialty}<br />{doc.phone}
                      </MapComponents.Popup>
                    </MapComponents.Marker>
                  );
                })}
              </MapComponents.MapContainer>
            </div>
          ) : !loading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                <MapIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm">Map will appear here after searching or when location is detected.</p>
            </div>
          )}

          {/* Doctor Cards */}
          {paginated.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">
                {doctors.length} Doctor{doctors.length !== 1 ? 's' : ''} Found
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginated.map((doc, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                        <UserSearch className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{doc.name}</h3>
                        <p className="text-xs text-blue-600 font-medium mt-0.5">{doc.specialty}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />{doc.location}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3.5 h-3.5 shrink-0" />{doc.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`mailto:${doc.email || ''}`, '_blank')}
                      className="mt-4 w-full text-center text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl py-2 transition-colors"
                    >
                      Contact
                    </button>
                  </div>
                ))}
              </div>

              {doctors.length > perPage && (
                <div className="flex justify-center gap-3 pt-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    ← Prev
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-500">Page {currentPage}</span>
                  <button disabled={currentPage * perPage >= doctors.length} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && doctors.length === 0 && loc && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-10 text-center">
              <p className="text-gray-400 text-sm italic">No doctors found. Try a nearby city or a broader specialty.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DoctorSearch;
