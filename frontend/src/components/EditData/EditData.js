import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import "./EditData.css";
import config from "../../config";
import AuthorsInput from "../Form/AuthorsInput";

const EditData = ({ setUser, isAuthorized, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { rowData, element } = location.state || {};
  const [formData, setFormData] = useState(null);
  const [publications, setPublications] = useState([]);
  const [readings, setReadings] = useState([]);
  const [status, setStatus] = useState("");
  const [textareaContent, setTextareaContent] = useState({});
  const [publicationFields, setPublicationFields] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

    const initialPublicationFields = rowData.publications.map((pub) => ({
      material: rowData.material,
      technique: rowData.technique || "",
      precursor: rowData.precursor,
      coreactant: rowData.coreactant,
      pretreatment: rowData.pretreatment,
      surface: rowData.surface,
      temperature: rowData.temperature,
      hasCustomFields: false,
    }));

    setPublicationFields(initialPublicationFields);

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
        cycles: cycles === "0" ? 0 : parseFloat(cycles) || "",
        thickness: thickness === "0" ? 0 : parseFloat(thickness) || "",
      };
    });
  };

  const handleReadingsChange = (index, value) => {
    setTextareaContent((prev) => ({
      ...prev,
      [index]: value,
    }));

    const parsedReadings = processReadingsText(value);

    setReadings((prev) => {
      const newReadings = [...prev];
      newReadings[index] = {
        publication: readings[index]?.publication || publications[index],
        readings: parsedReadings,
      };
      return newReadings;
    });
  };

  useEffect(() => {
    if (readings.length > 0 && isInitialLoad) {
      const content = {};
      readings.forEach((reading, index) => {
        content[index] =
          reading.readings
            ?.map((r) => `${r.cycles} ${r.thickness}`)
            ?.join("\n") || "";
      });
      setTextareaContent(content);
      setIsInitialLoad(false);
    }
  }, [readings, isInitialLoad]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const allPubs = publications.map((pub, index) => {
      const { author, ...cleanPub } = pub;
      if (!cleanPub.authors || cleanPub.authors.length === 0) {
        cleanPub.authors = author ? [author] : [];
      }
      
      return {
        ...cleanPub,
        parentFields: publicationFields[index].hasCustomFields
          ? publicationFields[index]
          : formData,
      };
    });

      const groups = {};
      allPubs.forEach((pub, idx) => {
        const key = [
          pub.parentFields.material,
          pub.parentFields.technique,
          pub.parentFields.precursor,
          pub.parentFields.coreactant,
          pub.parentFields.pretreatment,
          pub.parentFields.surface,
          pub.parentFields.temperature,
        ].join("|");
        if (!groups[key]) {
          groups[key] = {
            ...pub.parentFields,
            publications: [],
            readings: [],
          };
        }
        groups[key].publications.push(pub);
        groups[key].readings.push(readings[idx]);
      });

      // Prepare a single payload with all groups
      const payload = {
        original: {
          ...rowData,
          element,
        },
        updatedGroups: Object.values(groups).map((group) => ({
          ...group,
          readings: group.readings.map((reading) => ({
            publication: reading.publication,
            readings: reading.readings.filter(
              (r) => r.cycles !== "" || r.thickness !== ""
            ),
          })),
        })),
      };

      // Send a single request
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

      if (!response.ok) throw new Error("Update failed");

      setStatus("Data updated successfully!");
      setTimeout(() => {
        navigate(`/comparison?element=${element}`, { replace: true });
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error updating data:", error);
      setStatus(`Failed to update data: ${error.message}`);
    }
  };

  if (!formData) return null;

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
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
                <div className="publication-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={publicationFields[index].hasCustomFields}
                      onChange={(e) => {
                        const newFields = [...publicationFields];
                        newFields[index].hasCustomFields = e.target.checked;
                        setPublicationFields(newFields);
                      }}
                    />
                    Customize parent fields for this publication
                  </label>
                </div>
                {publicationFields[index].hasCustomFields && (
                  <div className="custom-fields-section">
                    <h4>Custom Parent Fields</h4>
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
                                value={publicationFields[index][key]}
                                onChange={(e) => {
                                  const newFields = [...publicationFields];
                                  newFields[index][key] = e.target.value;
                                  setPublicationFields(newFields);
                                }}
                              />
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}
                <div className="form-grid">
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

                <div className="authors-edit-section">
                  <h4>Authors</h4>
                  <AuthorsInput
                    authors={pub.authors || [pub.author || ""]}
                    onAuthorsChange={(authors) => {
                      const newPubs = [...publications];
                      const { author, ...pubWithoutAuthor } = newPubs[index];
                      newPubs[index] = {
                        ...pubWithoutAuthor,
                        authors,
                      };
                      setPublications(newPubs);
                    }}
                  />
                </div>

                <div className="readings-edit">
                  <h4>Readings</h4>
                  <textarea
                    value={textareaContent[index] || ""}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(
                        /[^0-9.\s\n]/g,
                        ""
                      );
                      handleReadingsChange(index, sanitized);
                    }}
                    // onKeyDown={(e) => {
                    //   if (e.key === "Enter") return;

                    //   const allowedKeys = [
                    //     "Backspace",
                    //     "Delete",
                    //     "ArrowLeft",
                    //     "ArrowRight",
                    //     "ArrowUp",
                    //     "ArrowDown",
                    //     "Tab",
                    //     " ",
                    //     ".",
                    //   ];
                    //   const isNumber = /^[0-9]$/;

                    //   if (
                    //     !isNumber.test(e.key) &&
                    //     !allowedKeys.includes(e.key)
                    //   ) {
                    //     e.preventDefault();
                    //   }
                    // }}
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
