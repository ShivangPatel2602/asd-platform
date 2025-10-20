import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import "./FilterPage.css";
import config from "../../config";

const FilterPage = ({ setUser, isAuthorized, user }) => {
  const [materials, setMaterials] = useState([]);
  const [surfaces, setSurfaces] = useState([]);
  const [techniques, setTechniques] = useState([]);
  const [naturalQuery, setNaturalQuery] = useState("");
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [extractedParams, setExtractedParams] = useState(null);
  const [queryError, setQueryError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    fetch(`${config.BACKEND_API_URL}/api/all-filters`)
      .then((res) => res.json())
      .then((data) => {
        setMaterials(data.materials);
        setSurfaces(data.surfaces);
        setTechniques(data.techniques);
      });
  }, []);

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

  const handleNaturalQuerySubmit = async (e) => {
    e.preventDefault();
    if (!naturalQuery.trim()) {
      setQueryError("Please enter a query");
      return;
    }

    setIsProcessingQuery(true);
    setQueryError("");
    setExtractedParams(null);

    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/extract-filter-params`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query: naturalQuery }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to process query");
      }

      const data = await response.json();
      setExtractedParams(data.parameters);
    } catch (error) {
      console.error("Error processing query:", error);
      setQueryError("Failed to process your query. Please try again.");
    } finally {
      setIsProcessingQuery(false);
    }
  };

  const handleApplyExtractedParams = () => {
    const params = extractedParams;
    const queryParams = [];
    if (params.material)
      queryParams.push(`material=${encodeURIComponent(params.material)}`);
    if (params.surface)
      queryParams.push(`surface=${encodeURIComponent(params.surface)}`);
    if (params.technique)
      queryParams.push(`technique=${encodeURIComponent(params.technique)}`);

    const queryString = queryParams.length ? `?${queryParams.join("&")}` : "";
    navigate(`/comparison${queryString}`);
  };

  const handleClearExtracted = () => {
    setExtractedParams(null);
    setNaturalQuery("");
    setQueryError("");
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="filter-page-container">
        <h1>Filter Data</h1>
        <div className="natural-query-section">
          <h2>Natural Language Query</h2>
          <p>
            Ask in plain English, e.g., "Show me SiO2 material deposited on
            Dilute HF surface"
          </p>

          <form
            onSubmit={handleNaturalQuerySubmit}
            className="natural-query-form"
          >
            <div className="query-input-wrapper">
              <textarea
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
                placeholder="Type your query here..."
                className="natural-query-input"
                rows="3"
                disabled={isProcessingQuery}
              />
              <button
                type="submit"
                className="query-submit-btn"
                disabled={isProcessingQuery || !naturalQuery.trim()}
              >
                {isProcessingQuery ? "Processing..." : "Process Query"}
              </button>
            </div>
          </form>

          {queryError && <div className="query-error">{queryError}</div>}

          {extractedParams && (
            <div className="extracted-params-display">
              <div className="extracted-header">
                <h3>Extracted Parameters</h3>
                <button
                  onClick={handleClearExtracted}
                  className="clear-extracted-btn"
                >
                  Clear
                </button>
              </div>

              <div className="params-grid">
                {Object.entries(extractedParams).map(([key, value]) => (
                  <div key={key} className="param-item">
                    <span className="param-label">
                      {key.charAt(0).toUpperCase() + key.slice(1)}:
                    </span>
                    <span className="param-value">{value}</span>
                  </div>
                ))}
              </div>

              <div className="extracted-actions">
                <button
                  onClick={handleApplyExtractedParams}
                  className="apply-params-btn"
                >
                  View Results
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <h2>Manual Filter Selection</h2>
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
