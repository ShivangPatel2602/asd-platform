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
  const [queryHistory, setQueryHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState([]);
  const [currentQueryId, setCurrentQueryId] = useState(null);

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
    loadQueryHistoryCount();
  }, []);

  useEffect(() => {
    if (showHistory) {
      loadQueryHistory();
    }
  }, [showHistory]);

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

  useEffect(() => {
    const params = [];
    if (selectedMaterial)
      params.push(`material=${encodeURIComponent(selectedMaterial)}`);
    if (selectedSurface)
      params.push(`surface=${encodeURIComponent(selectedSurface)}`);
    if (selectedTechnique)
      params.push(`technique=${encodeURIComponent(selectedTechnique)}`);
    const queryString = params.length ? `?${params.join("&")}` : "";
    if (location.search !== queryString) {
      navigate(`/filter${queryString}`, { replace: true });
    }
  }, [selectedMaterial, selectedSurface, selectedTechnique]);

  const loadQueryHistoryCount = async () => {
    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/query-history`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setQueryHistory(data.queries || []);
      }
    } catch (error) {
      console.error("Error loading query history count:", error);
    }
  };

  const loadQueryHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/query-history`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setQueryHistory(data.queries || []);
      } else {
        console.error("Failed to load query history");
      }
    } catch (error) {
      console.error("Error loading query history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

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
      setCurrentQueryId(data.query_id);
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
    setCurrentQueryId(null);
    setNaturalQuery("");
    setQueryError("");
  };

  const handleLoadHistoryQuery = (historyItem) => {
    setNaturalQuery(historyItem.query);
    setExtractedParams(historyItem.parameters);
    setCurrentQueryId(historyItem._id);
    setShowHistory(false);
  };

  const handleDeleteHistoryQuery = async (queryId, e) => {
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this query?")) {
      return;
    }

    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/query-history/${queryId}`,
        { method: "DELETE", credentials: "include" }
      );

      if (response.ok) {
        setQueryHistory(queryHistory.filter((q) => q._id !== queryId));
      } else {
        alert("Failed to delete query");
      }
    } catch (error) {
      console.error("Error deleting query:", error);
      alert("Failed to delete query");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedHistoryItems.length === 0) {
      alert("Please select queries to delete");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedHistoryItems.length} selected queries?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/query-history/bulk-delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query_ids: selectedHistoryItems }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQueryHistory(
          queryHistory.filter((q) => !selectedHistoryItems.includes(q._id))
        );
        setSelectedHistoryItems([]);
        alert(`Successfully deleted ${data.deleted_count} queries`);
      } else {
        alert("Failed to delete queries");
      }
    } catch (error) {
      console.error("Error bulk deleting queries:", error);
      alert("Failed to delete queries");
    }
  };

  const handleHistoryCheckbox = (queryId) => {
    setSelectedHistoryItems((prev) =>
      prev.includes(queryId)
        ? prev.filter((id) => id !== queryId)
        : [...prev, queryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedHistoryItems.length === queryHistory.length) {
      setSelectedHistoryItems([]);
    } else {
      setSelectedHistoryItems(queryHistory.map((q) => q._id));
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="filter-page-container">
        <h1>Filter Data</h1>
        <div className="query-history-section">
          <button
            className="toggle-history-btn"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "Hide Query History" : "View Query History"}{" "}
            <span className="history-count">({queryHistory.length})</span>
          </button>
          {showHistory && (
            <div className="history-panel">
              <div className="history-header">
                <h3>Your Past Queries</h3>
                <div className="history-actions">
                  {queryHistory.length > 0 && (
                    <>
                      <button
                        onClick={handleSelectAll}
                        className="select-all-btn"
                      >
                        {selectedHistoryItems.length === queryHistory.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                      {selectedHistoryItems.length > 0 && (
                        <button
                          onClick={handleBulkDelete}
                          className="bulk-delete-btn"
                        >
                          Delete Selected ({selectedHistoryItems.length})
                        </button>
                      )}
                      <button
                        onClick={loadQueryHistory}
                        className="refresh-history-btn"
                        disabled={loadingHistory}
                      >
                        {loadingHistory ? "Loading..." : "Refresh"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {loadingHistory ? (
                <div className="history-loading">Loading history...</div>
              ) : queryHistory.length === 0 ? (
                <div className="history-empty">
                  No query history yet. Try asking a natural language query
                  above!
                </div>
              ) : (
                <div className="history-list">
                  {queryHistory.map((item) => (
                    <div
                      key={item._id}
                      className={`history-item ${
                        selectedHistoryItems.includes(item._id)
                          ? "selected"
                          : ""
                      }`}
                    >
                      <div className="history-item-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedHistoryItems.includes(item._id)}
                          onChange={() => handleHistoryCheckbox(item._id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div
                        className="history-item-content"
                        onClick={() => handleLoadHistoryQuery(item)}
                      >
                        <div className="history-item-query">{item.query}</div>
                        <div className="history-item-meta">
                          <span className="history-timestamp">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                          {item.result_count !== null &&
                            item.result_count !== undefined && (
                              <span className="history-result-count">
                                {item.result_count} results
                              </span>
                            )}
                        </div>
                        <div className="history-item-params">
                          {Object.entries(item.parameters).map(
                            ([key, value]) => (
                              <span key={key} className="history-param-tag">
                                {key}: {value}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <button
                        className="history-item-delete"
                        onClick={(e) => handleDeleteHistoryQuery(item._id, e)}
                        title="Delete this query"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
