import React, { useEffect, useState } from "react";
import Navbar from "../Navbar/Navbar";
import "./FilterPage.css";
import config from "../../config";

const FilterPage = ({ setUser, isAuthorized, user }) => {
  const [materials, setMaterials] = useState([]);
  const [surfaces, setSurfaces] = useState([]);
  const [techniques, setTechniques] = useState([]);

  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedSurface, setSelectedSurface] = useState("");
  const [selectedTechnique, setSelectedTechnique] = useState("");

  const [tableData, setTableData] = useState([]);
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

  // Handle submit to fetch filtered data
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetch(
      `${config.BACKEND_API_URL}/api/filter-data?material=${selectedMaterial}&surface=${selectedSurface}&technique=${selectedTechnique}`
    )
      .then((res) => res.json())
      .then((data) => setTableData(data))
      .finally(() => setLoading(false));
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
        </form>

        {tableData.length > 0 && (
          <div className="filter-table-wrapper">
            <table className="filter-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Surface</th>
                  <th>Technique</th>
                  <th>Precursor</th>
                  <th>Co-reactant</th>
                  <th>Pretreatment</th>
                  <th>Temperature</th>
                  <th>Publications</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.material}</td>
                    <td>{row.surface}</td>
                    <td>{row.technique}</td>
                    <td>{row.precursor}</td>
                    <td>{row.coreactant}</td>
                    <td>{row.pretreatment}</td>
                    <td>{row.temperature}</td>
                    <td>
                      {row.publications &&
                        row.publications.map((pub, i) => (
                          <div key={i}>
                            {pub.author}, {pub.journal} {pub.year}
                          </div>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default FilterPage;
