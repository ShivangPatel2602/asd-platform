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
  const [cursorPositions, setCursorPositions] = useState({});
  const [textareaContent, setTextareaContent] = useState({});

  useEffect(() => {
    if (!rowData) {
      navigate("/dashboard");
      return;
    }

    setFormData({
      element,
      material: rowData.material,
      technique: rowData.technique || "",
      precursor: rowData.precursor,
      coreactant: rowData.coreactant,
      pretreatment: rowData.pretreatment,
      surface: rowData.surface,
      temperature: rowData.temperature,
    });

    setPublications(rowData.publications || []);

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

  const processReadingsText = (text) => {
    return text.split("\n").map((line) => {
      const [cycles, thickness] = line.split(/\s+/);
      return {
        cycles: cycles === "0" ? 0 : cycles || "",
        thickness: thickness === "0" ? 0 : thickness || "",
      };
    });
  };

  const handleReadingsChange = (index, value, cursorStart, cursorEnd) => {
    // Immediately update textarea content to maintain cursor position
    setTextareaContent((prev) => ({
      ...prev,
      [index]: value,
    }));

    // Process the readings but preserve empty lines
    const parsedReadings = processReadingsText(value);

    setReadings((prev) => {
      const newReadings = [...prev];
      newReadings[index] = {
        publication: readings[index]?.publication || publications[index],
        // Don't filter out empty readings during editing
        readings: parsedReadings,
      };
      return newReadings;
    });

    // Store cursor position
    setCursorPositions((prev) => ({
      ...prev,
      [index]: { start: cursorStart, end: cursorEnd },
    }));
  };

  useEffect(() => {
    if (readings.length > 0) {
      const content = {};
      readings.forEach((reading, index) => {
        content[index] =
          reading.readings
            ?.map((r) => `${r.cycles} ${r.thickness}`)
            ?.join("\n") || "";
      });
      setTextareaContent(content);
    }
  }, [readings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formattedReadings = readings.map((reading) => ({
        publication: reading.publication,
        readings: reading.readings.filter(
          (r) => r.cycles !== "" || r.thickness !== ""
        ),
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
                    value={textareaContent[index] || ""}
                    onChange={(e) => {
                      const cursorStart = e.target.selectionStart;
                      const cursorEnd = e.target.selectionEnd;
                      handleReadingsChange(
                        index,
                        e.target.value,
                        cursorStart,
                        cursorEnd
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") return;

                      const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                        "Tab",
                        " ",
                        ".",
                      ];
                      const isNumber = /^[0-9]$/;

                      if (
                        !isNumber.test(e.key) &&
                        !allowedKeys.includes(e.key)
                      ) {
                        e.preventDefault();
                      }
                    }}
                    ref={(element) => {
                      if (element && cursorPositions[index]) {
                        element.setSelectionRange(
                          cursorPositions[index].start,
                          cursorPositions[index].end
                        );
                      }
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
