import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import "./EditData.css";
import config from "../../config";

const EditData = ({ setUser, isAuthorized }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { rowData, element } = location.state || {};
  const [formData, setFormData] = useState(null);
  const [publications, setPublications] = useState([]);
  const [readings, setReadings] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!rowData) {
      navigate("/dashboard");
      return;
    }

    // Initialize form with existing data
    setFormData({
      element,
      material: rowData.material,
      precursor: rowData.precursor,
      coreactant: rowData.coreactant,
      pretreatment: rowData.pretreatment,
      surface: rowData.surface,
      temperature: rowData.temperature,
    });

    setPublications(rowData.publications || []);

    // Fetch readings for each publication
    const fetchReadings = async () => {
      const allReadings = [];
      for (const pub of rowData.publications) {
        const queryParams = new URLSearchParams({
          element,
          material: rowData.material,
          precursor: rowData.precursor,
          coreactant: rowData.coreactant,
          surface: rowData.surface,
          temperature: rowData.temperature,
          pretreatment: rowData.pretreatment,
          publication: JSON.stringify(pub),
        });

        const response = await fetch(
          `${config.BACKEND_API_URL}/api/readings?${queryParams.toString()}`,
          { credentials: "include" }
        );
        const data = await response.json();
        allReadings.push({ publication: pub, readings: data });
      }
      setReadings(allReadings);
    };

    fetchReadings();
  }, [rowData, element, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Format the readings data correctly
      const formattedReadings = readings.map((reading) => ({
        publication: reading.publication,
        readings: Array.isArray(reading.readings) ? reading.readings : [],
      }));

      const payload = {
        original: {
          ...rowData,
          element,
        },
        updated: {
          ...formData,
          publications,
          readings: formattedReadings,
        },
      };

      console.log("Sending update payload:", payload); // Debug log

      const response = await fetch(
        `${config.BACKEND_API_URL}/api/update-data`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus("Data updated successfully!");
        setTimeout(() => navigate(`/comparison?element=${element}`), 1500);
      } else {
        setStatus(`Failed to update data: ${data.error || "Unknown error"}`);
        console.error("Update error:", data);
      }
    } catch (error) {
      console.error("Error updating data:", error);
      setStatus(`Failed to update data: ${error.message}`);
    }
  };

  if (!formData) return null;

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} />
      <div className="edit-data-container">
        <h2>Edit Dataset</h2>
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <section className="edit-section">
            <h3>Basic Information</h3>
            <div className="form-grid">
              {Object.entries(formData).map(
                ([key, value]) =>
                  key !== "element" && (
                    <div key={key} className="form-group">
                      <label>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )
              )}
            </div>
          </section>

          {/* Publications */}
          <section className="edit-section">
            <h3>Publications</h3>
            {publications.map((pub, index) => (
              <div key={index} className="publication-edit">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Author</label>
                    <input
                      type="text"
                      value={pub.author}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[index] = { ...pub, author: e.target.value };
                        setPublications(newPubs);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Journal</label>
                    <input
                      type="text"
                      value={pub.journal}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[index] = { ...pub, journal: e.target.value };
                        setPublications(newPubs);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Year</label>
                    <input
                      type="text"
                      value={pub.year}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[index] = { ...pub, year: e.target.value };
                        setPublications(newPubs);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>DOI</label>
                    <input
                      type="text"
                      value={pub.doi || ""}
                      onChange={(e) => {
                        const newPubs = [...publications];
                        newPubs[index] = { ...pub, doi: e.target.value };
                        setPublications(newPubs);
                      }}
                    />
                  </div>
                </div>

                {/* Readings for this publication */}
                <div className="readings-edit">
                  <h4>Readings</h4>
                  <textarea
                    value={readings[index]?.readings
                      .map((r) => `${r.cycles} ${r.thickness}`)
                      .join("\n")}
                    onChange={(e) => {
                      const newReadings = [...readings];
                      const parsedReadings = e.target.value
                        .split("\n")
                        .map((line) => {
                          const [cycles, thickness] = line.trim().split(/\s+/);
                          return {
                            cycles: parseFloat(cycles),
                            thickness: parseFloat(thickness),
                          };
                        })
                        .filter((r) => !isNaN(r.cycles) && !isNaN(r.thickness));

                      newReadings[index] = {
                        publication: pub,
                        readings: parsedReadings,
                      };
                      setReadings(newReadings);
                    }}
                    rows={10}
                    placeholder="Format: cycle thickness&#10;Example:&#10;0 0&#10;10 0.5"
                  />
                </div>
              </div>
            ))}
          </section>

          {status && <div className="status-message">{status}</div>}

          <div className="button-group">
            <button type="submit" className="save-button">
              Save Changes
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate(`/comparison?element=${element}`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default EditData;
