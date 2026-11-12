
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "../api";
import useTableFilter from "../hooks/useTableFilter";
import { TableFilter } from "../components/TableFilter";
import Modal from "../components/Modal";
import { DeleteIcon, EditIcon, ViewIcon } from "../components/ActionIcons";

const API_URL = "http://localhost:5001/api";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = { Accept: "application/json" };

const MAP_CENTER = [-29.5, 27.5];
const MAP_ZOOM = 6;

const vendorFilterColumns = [
  { key: "vendor_name", label: "Vendor Name" },
  { key: "business_name", label: "Business Name" },
  { key: "telephone", label: "Telephone" },
  { key: "area", label: "Trading Area" },
  { key: "status", label: "Status" },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function markerIcon(label, color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;"><span style="transform:rotate(45deg);">${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

function cleanAreaName(value) {
  if (!value) return "";
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function pickPlaceName(address = {}, displayName = "") {
  const parts = [
    address.suburb,
    address.neighbourhood,
    address.village,
    address.hamlet,
    address.town,
    address.city,
    address.municipality,
    address.county,
    address.state_district,
    address.state,
    address.region,
  ].filter(Boolean);

  if (parts.length) return parts.slice(0, 2).join(", ");

  return cleanAreaName(displayName);
}

async function reverseGeocodeDirect(lat, lng) {
  const response = await fetch(
    `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) throw new Error("Reverse geocode failed.");

  const data = await response.json();
  return pickPlaceName(data.address || {}, data.display_name || "");
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await apiFetch(
      `/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.area) return data.area;
    }
  } catch {
    // Fall through to the browser-side lookup below.
  }

  try {
    return await reverseGeocodeDirect(lat, lng);
  } catch {
    return "";
  }
}

function placeLabel(place) {
  return place.label || place.displayName || "";
}

function geolocationErrorMessage(error) {
  if (!window.isSecureContext) {
    return (
      "Location only works on a secure page. Open the app at " +
      "http://localhost:5173 (not a network IP address) and try again."
    );
  }

  switch (error?.code) {
    case 1:
      return (
        "Location permission is blocked. Click the site controls icon in the " +
        "browser address bar, allow Location, then reload the page."
      );
    case 2:
      return (
        "Your device could not determine its location. Turn on Windows " +
        "Location Services (Settings > Privacy & security > Location) and try again."
      );
    case 3:
      return "Finding your location timed out. Please try again.";
    default:
      return "Could not get your location.";
  }
}

function getPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getCurrentPositionWithRetry() {
  try {
    return await getPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  } catch (error) {
    if (error?.code === 1) throw error;

    return getPosition({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000,
    });
  }
}

async function searchPlacesDirect(query) {
  const response = await fetch(
    `${NOMINATIM_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}` +
      "&limit=5&addressdetails=1",
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) throw new Error("Search failed.");

  const data = await response.json();

  return (Array.isArray(data) ? data : []).map((place) => ({
    id: place.place_id,
    lat: place.lat,
    lng: place.lon,
    label: pickPlaceName(
      place.address || {},
      place.name || place.display_name || ""
    ),
    displayName: place.display_name || "",
  }));
}

async function searchPlaces(query) {
  try {
    const response = await apiFetch(
      `/geocode/search?q=${encodeURIComponent(query)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.results)) return data.results;
    }
  } catch {
    // Fall through to the browser-side lookup below.
  }

  return searchPlacesDirect(query);
}

function LocationPicker({ latitude, longitude, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const focusRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [resolving, setResolving] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  function choosePoint(lat, lng, focus = false) {
    focusRef.current = focus;
    onSelectRef.current(lat, lng);
    setResolving(true);
    setPlaceError("");

    const coordinateLabel = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;

    reverseGeocode(lat, lng)
      .then((place) => {
        const cleaned = cleanAreaName(place) || place?.trim?.() || "";
        const label = cleaned || coordinateLabel;

        onSelectRef.current(lat, lng, label);
        setQuery(label);

        if (!cleaned) {
          setPlaceError(
            "Could not detect the place name — the coordinates were added to the trading area. You can edit it."
          );
        }
      })
      .catch(() => {
        onSelectRef.current(lat, lng, coordinateLabel);
        setQuery(coordinateLabel);
        setPlaceError(
          "Could not detect the place name — the coordinates were added to the trading area. You can edit it."
        );
      })
      .finally(() => setResolving(false));
  }

  async function handleSearch(event) {
    event.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError("");
    setResults([]);

    try {
      const found = await searchPlaces(trimmed);

      if (!found.length) {
        setSearchError("No places found. Try a different name.");
      } else {
        setResults(found);
      }
    } catch {
      setSearchError("Could not search for places right now.");
    } finally {
      setSearching(false);
    }
  }

  function selectPlace(place) {
    const lat = Number(place.lat).toFixed(7);
    const lng = Number(place.lng).toFixed(7);
    const label = cleanAreaName(placeLabel(place));

    onSelectRef.current(lat, lng, label);
    mapRef.current?.setView([Number(lat), Number(lng)], 15);
    setResults([]);
    setQuery(label);
  }

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    map.on("click", (event) => {
      choosePoint(
        event.latlng.lat.toFixed(7),
        event.latlng.lng.toFixed(7)
      );
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (latitude === "" || longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], {
        icon: markerIcon("📍", "#166b45"),
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }

    if (focusRef.current) {
      focusRef.current = false;
      map.flyTo([lat, lng], 16, { duration: 1.2 });
    } else {
      map.setView([lat, lng], Math.max(map.getZoom(), 13));
    }
  }, [latitude, longitude]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    setResolving(true);
    setPlaceError("");

    getCurrentPositionWithRetry()
      .then((position) => {
        choosePoint(
          position.coords.latitude.toFixed(7),
          position.coords.longitude.toFixed(7),
          true
        );
      })
      .catch((error) => {
        setResolving(false);
        alert(geolocationErrorMessage(error));
      });
  }

  return (
    <div className="vendor-location-picker">
      <form className="vendor-map-search" onSubmit={handleSearch}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place (e.g. Maseru, Mafeteng, Gauteng)..."
          aria-label="Search for a place"
        />
        <button type="submit" disabled={searching}>
          {searching ? "Searching..." : "Search place"}
        </button>
      </form>

      {searchError && <p className="vendor-map-search-error">{searchError}</p>}

      {results.length > 0 && (
        <ul className="vendor-map-results">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => selectPlace(place)}>
                {placeLabel(place)}
                <span className="vendor-map-result-sub">{place.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={containerRef} className="vendor-map" />
      <div className="vendor-map-actions">
        {resolving && <p>Looking up the place name...</p>}
        {placeError && <p className="vendor-map-search-error">{placeError}</p>}
        <button type="button" onClick={useMyLocation}>
          Use my current location
        </button>
        {(latitude !== "" || longitude !== "") && (
          <button
            type="button"
            onClick={() => onSelectRef.current("", "")}
          >
            Clear pin
          </button>
        )}
      </div>
    </div>
  );
}

function VendorLocationView({ vendor }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const vendorMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [geocodedLocation, setGeocodedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);

  const savedLat = Number(vendor.latitude);
  const savedLng = Number(vendor.longitude);
  const hasSavedLocation =
    vendor.latitude !== null &&
    vendor.latitude !== "" &&
    vendor.longitude !== null &&
    vendor.longitude !== "" &&
    Number.isFinite(savedLat) &&
    Number.isFinite(savedLng);

  const savedLocation = useMemo(
    () => (hasSavedLocation ? { lat: savedLat, lng: savedLng } : null),
    [hasSavedLocation, savedLat, savedLng]
  );

  const [resolvingVendor, setResolvingVendor] = useState(
    () => !hasSavedLocation && Boolean(vendor.area)
  );

  const vendorLocation = savedLocation || geocodedLocation;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      vendorMarkerRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (hasSavedLocation || !vendor.area) return undefined;

    let cancelled = false;

    async function findVendorLocation() {
      try {
        let results = await searchPlaces(vendor.area);

        if (!results.length && vendor.area.includes("(")) {
          results = await searchPlaces(vendor.area.split("(")[0].trim());
        }

        if (cancelled) return;

        const first = results[0];
        if (
          first &&
          Number.isFinite(Number(first.lat)) &&
          Number.isFinite(Number(first.lng))
        ) {
          setGeocodedLocation({
            lat: Number(first.lat),
            lng: Number(first.lng),
          });
        }
      } catch {
        // Leave geocodedLocation empty; the UI explains it is unavailable.
      } finally {
        if (!cancelled) setResolvingVendor(false);
      }
    }

    findVendorLocation();

    return () => {
      cancelled = true;
    };
  }, [vendor.area, hasSavedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !vendorLocation) return;

    if (vendorMarkerRef.current) vendorMarkerRef.current.remove();

    vendorMarkerRef.current = L.marker(
      [vendorLocation.lat, vendorLocation.lng],
      { icon: markerIcon("🏪", "#166b45") }
    )
      .addTo(map)
      .bindPopup(`${vendor.vendor_name} — ${vendor.area}`);
  }, [vendorLocation, vendor.vendor_name, vendor.area]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    if (userMarkerRef.current) userMarkerRef.current.remove();

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: markerIcon("🧭", "#2563eb"),
    })
      .addTo(map)
      .bindPopup("Your location");
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (vendorLocation && userLocation) {
      map.fitBounds(
        L.latLngBounds(
          [vendorLocation.lat, vendorLocation.lng],
          [userLocation.lat, userLocation.lng]
        ).pad(0.3)
      );
    } else if (vendorLocation) {
      map.setView([vendorLocation.lat, vendorLocation.lng], 14);
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [vendorLocation, userLocation]);

  function findMe() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocationError("Could not get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    setUserLocation(null);
    setLocationError("");
    setLocating(false);
    findMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id]);

  const distance =
    vendorLocation && userLocation
      ? haversineKm(
          vendorLocation.lat,
          vendorLocation.lng,
          userLocation.lat,
          userLocation.lng
        )
      : null;

  return (
    <div className="vendor-location-view">
      <div ref={containerRef} className="vendor-map vendor-map-view" />

      <div className="vendor-distance">
        <button
          type="button"
          className="refresh-button"
          onClick={findMe}
          disabled={locating}
        >
          {locating ? "Getting your location..." : "Refresh distance from me"}
        </button>

        {locationError && <p className="vendor-distance-error">{locationError}</p>}

        {resolvingVendor && (
          <p className="vendor-distance-note">
            Finding this vendor's location from the trading area...
          </p>
        )}

        {!resolvingVendor && !vendorLocation && (
          <p className="vendor-distance-note">
            No map location was saved for this vendor and the trading area
            could not be found.
          </p>
        )}

        {distance !== null && (
          <p className="vendor-distance-result">
            Distance from your location to <strong>{vendor.vendor_name}</strong> (
            {vendor.area}): <strong>{distance.toFixed(1)} km</strong>
          </p>
        )}

        {distance !== null && (
          <p className="vendor-distance-note">
            Your location: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
            {" — "}Vendor: {vendorLocation.lat.toFixed(5)},{" "}
            {vendorLocation.lng.toFixed(5)}
            {!hasSavedLocation ? " (estimated from trading area)" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

const initialForm = {
  vendor_name: "",
  business_name: "",
  telephone: "",
  area: "",
  registration_date: "",
  status: "active",
  latitude: "",
  longitude: "",
};

export default function Vendors() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  async function loadVendors() {
    setError("");
    setDataLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/vendors`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to load vendors.");
      }
      setVendors(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Could not load vendors.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.latitude === "" || form.longitude === "") {
      setError("Please select the trading area location on the map.");
      return;
    }

    setLoading(true);

    try {
      const url = editingId
        ? `${API_URL}/vendors/${editingId}`
        : `${API_URL}/vendors`;
      const method = editingId ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to register vendor.");
      }

      setMessage(
        result.message ||
          (editingId
            ? "Street vendor updated successfully!"
            : "Street vendor registered successfully!")
      );
      setForm({ ...initialForm });
      setEditingId(null);
      setFormOpen(false);
      await loadVendors();
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the server. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(vendor) {
    setForm({
      vendor_name: vendor.vendor_name || "",
      business_name: vendor.business_name || "",
      telephone: vendor.telephone || "",
      area: vendor.area || "",
      registration_date: vendor.registration_date
        ? new Date(vendor.registration_date).toISOString().split("T")[0]
        : "",
      status: vendor.status || "active",
      latitude: vendor.latitude ?? "",
      longitude: vendor.longitude ?? "",
    });
    setEditingId(vendor.id);
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this vendor?")) return;
    setDeletingId(id);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/vendors/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to delete vendor.");
      }
      setMessage(result.message || "Vendor deleted successfully.");
      await loadVendors();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function handleReset() {
    setForm({ ...initialForm });
    setEditingId(null);
    setViewingVendor(null);
    setMessage("");
    setError("");
  }

  function openForm() {
    handleReset();
    setFormOpen(true);
  }

  function closeForm() {
    handleReset();
    setFormOpen(false);
  }

  function handleView(vendor) {
    setViewingVendor(vendor);
    setMessage("");
    setError("");
  }

  const vendorFilter = useTableFilter(vendors);

  return (
    <main className="vendor-page">
      <header className="vendor-heading">
        <h1>Street Vendors</h1>

        <div className="header-actions">
          <button type="button" className="new-order-button" onClick={openForm}>
            + Register Vendor
          </button>
        </div>
      </header>

      {message && (
        <div className="vendor-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="vendor-error" role="alert">
          {error}
        </div>
      )}

      <section className="vendor-table-card">
        <div className="vendor-table-heading">
          <h2>Registered Vendors</h2>
          <TableFilter
            columns={vendorFilterColumns}
            rows={vendors}
            filterKey={vendorFilter.filterKey}
            filterValue={vendorFilter.filterValue}
            onChange={vendorFilter.changeFilter}
            onClear={vendorFilter.clearFilter}
          />
        </div>
        {dataLoading ? (
          <p>Loading vendors...</p>
        ) : vendors.length === 0 ? (
          <p>No vendors registered yet.</p>
        ) : vendorFilter.filteredRows.length === 0 ? (
          <p>No vendors match your filter.</p>
        ) : (
          <div className="table-wrapper">
            <table className="vendor-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Vendor Name</th>
                  <th>Business Name</th>
                  <th>Telephone</th>
                  <th>Trading Area</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendorFilter.filteredRows.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>{vendor.id}</td>
                    <td>{vendor.vendor_name}</td>
                    <td>{vendor.business_name || "-"}</td>
                    <td>{vendor.telephone}</td>
                    <td>{vendor.area}</td>
                    <td>
                      {vendor.registration_date
                        ? new Date(vendor.registration_date).toISOString().split("T")[0]
                        : ""}
                    </td>
                    <td>{vendor.status}</td>
                    <td className="action-buttons">
                      <button
                        type="button"
                        className="edit-btn"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => handleEdit(vendor)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="delete-btn"
                        title={deletingId === vendor.id ? "Deleting..." : "Delete"}
                        aria-label={deletingId === vendor.id ? "Deleting..." : "Delete"}
                        onClick={() => handleDelete(vendor.id)}
                        disabled={deletingId === vendor.id}
                      >
                        <DeleteIcon />
                      </button>
                      <button
                        type="button"
                        className="view-btn"
                        title="View"
                        aria-label="View"
                        onClick={() => handleView(vendor)}
                      >
                        <ViewIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <Modal
          title={editingId ? "Edit Street Vendor" : "Register Street Vendor"}
          subtitle="Enter the vendor's details and pin their trading area on the map."
          onClose={closeForm}
          size="large"
        >
          <section className="vendor-form-card">
            <form onSubmit={handleSubmit}>
          <div className="vendor-form-grid">
            <div className="vendor-field">
              <label htmlFor="vendor_name">Vendor Name *</label>
              <input
                id="vendor_name"
                name="vendor_name"
                type="text"
                value={form.vendor_name}
                onChange={handleChange}
                placeholder="Enter vendor's full name"
                required
                maxLength={100}
              />
            </div>

            <div className="vendor-field">
              <label htmlFor="business_name">Business Name</label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                value={form.business_name}
                onChange={handleChange}
                placeholder="Enter business name"
                maxLength={150}
              />
            </div>

            <div className="vendor-field">
              <label htmlFor="telephone">Telephone *</label>
              <input
                id="telephone"
                name="telephone"
                type="tel"
                value={form.telephone}
                onChange={handleChange}
                placeholder="Enter telephone number"
                required
                maxLength={30}
              />
            </div>

            <div className="vendor-field">
              <label htmlFor="area">Trading Area *</label>
              <input
                id="area"
                name="area"
                type="text"
                value={form.area}
                onChange={handleChange}
                placeholder="Please enter trading area name"
                required
                maxLength={150}
              />
            </div>

            <div className="vendor-field vendor-field-full">
              <label>Select Trading Area on Map *</label>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onSelect={(lat, lng, place) =>
                  setForm((current) => ({
                    ...current,
                    latitude: lat,
                    longitude: lng,
                    area: place ? place : current.area,
                  }))
                }
              />
            </div>

            <div className="vendor-field">
              <label htmlFor="registration_date">
                Registration Date *
              </label>
              <input
                id="registration_date"
                name="registration_date"
                type="date"
                value={form.registration_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="vendor-field">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="vendor-form-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingId ? "Update Vendor" : "Register Vendor"}
            </button>

            <button
              type="button"
              className="vendor-reset-button"
              onClick={handleReset}
            >
              Clear Form
            </button>

            <button
              type="button"
              className="vendor-reset-button"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>
            </form>
          </section>
        </Modal>
      )}

      {viewingVendor && (
        <Modal
          title="Vendor Details"
          subtitle={viewingVendor.vendor_name}
          onClose={() => setViewingVendor(null)}
          size="large"
        >
          <section className="order-details">
            <div className="order-details-info">
              <p>
                <strong>Vendor Name:</strong>{" "}
                {viewingVendor.vendor_name}
              </p>

              <p>
                <strong>Business Name:</strong>{" "}
                {viewingVendor.business_name || "—"}
              </p>

              <p>
                <strong>Telephone:</strong>{" "}
                {viewingVendor.telephone}
              </p>

              <p>
                <strong>Trading Area:</strong>{" "}
                {viewingVendor.area}
              </p>

              <p>
                <strong>Registration Date:</strong>{" "}
                {viewingVendor.registration_date
                  ? new Date(
                      viewingVendor.registration_date
                    ).toLocaleDateString()
                  : "—"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {viewingVendor.status || "—"}
              </p>
            </div>

            <VendorLocationView key={viewingVendor.id} vendor={viewingVendor} />
          </section>
        </Modal>
      )}
    </main>
  );
}
