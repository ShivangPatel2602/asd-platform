import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import "./FilterPage.css";
import config from "../../config";

const FilterPage = ({ setUser, isAuthorized, user }) => {
  const [materials, setMaterials] = useState([]);
  const [surfaces, setSurfaces] = useState([]);
  const [techniques, setTechniques] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();

  // Read initial filter values from URL
  const params = new URLSearchParams(location.search);
  const [selectedMaterial, setSelectedMaterial] = useState(
    params.get("material") || ""
  );
  const [selectedSurface, setSelectedSurface] = useState(
    params.get("surface") || ""
  );
  const [selectedTechnique, setSelectedTechnique] = useState(
    params.get("technique") || ""
  );
  const [loading, setLoading] = useState(false);

  // Fetch all options on mount
  useEffect(() => {
    fetch(`${config.BACKEND_API_URL}/api/all-filters`)
      .then((res) => res.json())
      .then((data) => {
        setMaterials(data.materials);
        setSurfaces(data.surfaces);
        setTechniques(data.techniques);
      });
  }, []);

  // Fetch filtered options whenever a selection changes
  useEffect(() => {
    fetch(
      `${config.BACKEND_API_URL}/api/filter-options?material=${selectedMaterial}&surface=${selectedSurface}&technique=${selectedTechnique}`
    )
      .then((res) => res.json())
      .then((data) => {
        setMaterials(data.materials);
        setSurfaces(data.surfaces);
        setTechniques(data.techniques);
      });
  }, [selectedMaterial, selectedSurface, selectedTechnique]);

  // Update URL when filters change
  useEffect(() => {
    const params = [];
    if (selectedMaterial)
      params.push(`material=${encodeURIComponent(selectedMaterial)}`);
    if (selectedSurface)
      params.push(`surface=${encodeURIComponent(selectedSurface)}`);
    if (selectedTechnique)
      params.push(`technique=${encodeURIComponent(selectedTechnique)}`);
    const queryString = params.length ? `?${params.join("&")}` : "";
    // Only update if different to avoid infinite loop
    if (location.search !== queryString) {
      navigate(`/filter${queryString}`, { replace: true });
    }
    // eslint-disable-next-line
  }, [selectedMaterial, selectedSurface, selectedTechnique]);

  // On submit, navigate to /comparison with query params
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    const params = [];
    if (selectedMaterial)
      params.push(`material=${encodeURIComponent(selectedMaterial)}`);
    if (selectedSurface)
      params.push(`surface=${encodeURIComponent(selectedSurface)}`);
    if (selectedTechnique)
      params.push(`technique=${encodeURIComponent(selectedTechnique)}`);
    const queryString = params.length ? `?${params.join("&")}` : "";
    setLoading(false);
    navigate(`/comparison${queryString}`);
  };

  const handleClear = () => {
    setSelectedMaterial("");
    setSelectedSurface("");
    setSelectedTechnique("");
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="filter-page-container">
        <h1>Filter Data</h1>
        <form className="filter-dropdowns" onSubmit={handleSubmit}>
          <div className="filter-group">
            <label>Material</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
            >
              <option value="">All</option>
              {materials.map((mat) => (
                <option key={mat} value={mat}>
                  {mat}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Surface</label>
            <select
              value={selectedSurface}
              onChange={(e) => setSelectedSurface(e.target.value)}
            >
              <option value="">All</option>
              {surfaces.map((surf) => (
                <option key={surf} value={surf}>
                  {surf}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Technique</label>
            <select
              value={selectedTechnique}
              onChange={(e) => setSelectedTechnique(e.target.value)}
            >
              <option value="">All</option>
              {techniques.map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          </div>
          <button
            className="filter-submit-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Loading..." : "Submit"}
          </button>
          <button
            type="button"
            className="filter-clear-btn"
            onClick={handleClear}
            disabled={loading}
            style={{ marginLeft: "16px" }}
          >
            Clear Filters
          </button>
        </form>
      </div>
    </>
  );
};

export default FilterPage;
