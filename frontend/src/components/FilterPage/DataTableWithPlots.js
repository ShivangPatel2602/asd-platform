import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DeleteModal from "../DeleteModal/DeleteModal";
import "./DataTableWithPlots.css"; // You can import Comparison.css here for column widths
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Utility for merged rows (copy from Comparison.js)
function getOptimallyMergedRows(data, columns) {
  if (!data.length) return [];
  const sorted = [...data].sort((a, b) => {
    for (const col of columns) {
      if ((a[col] || "") < (b[col] || "")) return -1;
      if ((a[col] || "") > (b[col] || "")) return 1;
    }
    return 0;
  });
  const mergedRows = [];
  const prevValues = {};
  const rowSpans = {};
  for (let i = 0; i < sorted.length; i++) {
    const row = { ...sorted[i], spans: {} };
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (i === 0) {
        row.spans[col] = 1;
        rowSpans[col] = 1;
        prevValues[col] = row[col];
      } else {
        let parentSame = true;
        for (let pc = 0; pc < c; pc++) {
          if (sorted[i][columns[pc]] !== sorted[i - 1][columns[pc]]) {
            parentSame = false;
            break;
          }
        }
        if (parentSame && row[col] === prevValues[col]) {
          let prevIndex = i - 1;
          while (prevIndex >= 0 && mergedRows[prevIndex].spans[col] === 0) {
            prevIndex--;
          }
          if (prevIndex >= 0) {
            mergedRows[prevIndex].spans[col]++;
          }
          row.spans[col] = 0;
          rowSpans[col]++;
        } else {
          row.spans[col] = 1;
          rowSpans[col] = 1;
          prevValues[col] = row[col];
        }
      }
    }
    mergedRows.push(row);
  }
  return mergedRows;
}

// Utility for chemical formula rendering (copy from Comparison.js)
function renderChemicalFormula(formula) {
  if (!formula) return "";
  return formula.split(/(\s+)/).map((word, i) => {
    const parts = [];
    let lastIndex = 0;
    const regex = /([A-Za-z\)])(\d+)/g;
    let match;
    while ((match = regex.exec(word)) !== null) {
      if (match.index > lastIndex) {
        parts.push(word.slice(lastIndex, match.index));
      }
      parts.push(match[1]);
      parts.push(<sub key={i + "-" + match.index}>{match[2]}</sub>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < word.length) {
      parts.push(word.slice(lastIndex));
    }
    return parts.length ? parts : word;
  });
}

const DataTableWithPlots = ({
  data,
  isAuthorized,
  user,
  setUser,
  API_BASE_URL = null, // Pass if you want to use a custom API base
}) => {
  const [selectedPublications, setSelectedPublications] = useState({});
  const [readings, setReadings] = useState({});
  const [showPlots, setShowPlots] = useState(false);
  const [deleteModalConfig, setDeleteModalConfig] = useState({
    isOpen: false,
    type: null,
    rowData: null,
    publications: null,
  });
  const navigate = useNavigate();

  // You may want to set API_BASE_URL from config if not passed
  const apiBase =
    API_BASE_URL || (window.config && window.config.BACKEND_API_URL + "/api");

  // Columns (same as Comparison.js)
  const columns = [
    "material",
    "technique",
    "precursor",
    "coreactant",
    "pretreatment",
    "surface",
  ];

  // Merged rows
  const mergedRows = getOptimallyMergedRows(data, columns);

  // Publication selection logic (copy from Comparison.js)
  const handlePublicationSelect = (rowKey, publication) => {
    setSelectedPublications((prev) => {
      const currentRowSelections = prev[rowKey] || [];
      const isAlreadySelected = currentRowSelections.some(
        (pub) => pub.author === publication.author
      );
      const compositeKey = `${rowKey}-${publication.author}`;
      if (isAlreadySelected) {
        const updatedRowSelections = currentRowSelections.filter(
          (pub) => pub.author !== publication.author
        );
        setReadings((prevReadings) => {
          const newReadings = { ...prevReadings };
          delete newReadings[compositeKey];
          if (Object.keys(newReadings).length === 0) {
            setShowPlots(false);
          }
          return newReadings;
        });
        return {
          ...prev,
          [rowKey]: updatedRowSelections.length
            ? updatedRowSelections
            : undefined,
        };
      } else {
        const updatedRowSelections = [
          ...(currentRowSelections || []),
          publication,
        ].slice(-2);
        const row = mergedRows.find((r) => getRowKey(r) === rowKey);
        fetchDataForRow(row, publication, compositeKey);
        return {
          ...prev,
          [rowKey]: updatedRowSelections,
        };
      }
    });
  };

  function getRowKey(row) {
    return [
      row.element,
      row.material,
      row.technique,
      row.precursor,
      row.coreactant,
      row.pretreatment,
      row.surface,
      row.temperature,
    ].join("|");
  }

  // Fetch readings for plot
  const fetchDataForRow = (row, publication, compositeKey) => {
    const publicationData = {
      author: publication.author,
      journal: publication.journal || "",
      year: publication.year || "",
      doi: publication.doi || "",
    };
    const queryParams = new URLSearchParams({
      element: row.element,
      material: row.material,
      precursor: row.precursor,
      coreactant: row.coreactant,
      surface: row.surface,
      pretreatment: row.pretreatment,
      temperature: row.temperature || "",
      publication: JSON.stringify(publicationData),
    });
    fetch(`${apiBase}/readings?${queryParams.toString()}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to fetch readings");
        }
        return res.json();
      })
      .then((data) => {
        setReadings((prev) => ({
          ...prev,
          [compositeKey]: data,
        }));
        setShowPlots(true);
      })
      .catch((err) => {
        // handle error
      });
  };

  // Edit and delete logic (copy from Comparison.js)
  const handleEditClick = (rowData) => {
    navigate(`/edit-data/${rowData.element || rowData.material}`, {
      state: {
        rowData,
        element: rowData.element,
      },
    });
  };

  const handleDeleteRow = (row) => {
    setDeleteModalConfig({
      isOpen: true,
      type: "row",
      rowData: row,
      publications: null,
      title: isAuthorized ? "Delete Row" : "Unauthorized",
      message: isAuthorized
        ? "Are you sure you want to delete this entire row? This action cannot be undone."
        : "You don't have permission to delete entries.",
    });
  };

  const handleDeleteConfirm = async (selectedPublications) => {
    try {
      const { type, rowData } = deleteModalConfig;
      const response = await fetch(`${apiBase}/delete-data`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          type,
          element: rowData.element,
          rowData,
          publications: selectedPublications,
        }),
      });
      if (response.ok) {
        window.location.reload();
      }
    } finally {
      setDeleteModalConfig({
        isOpen: false,
        type: null,
        rowData: null,
        publications: null,
      });
    }
  };

  // Publication cell
  const PublicationCell = ({ publications, index, onSelect }) => {
    const currentSelections = selectedPublications[index] || [];
    return (
      <div className="publications-list">
        {publications.map((pub, pubIndex) => (
          <div
            key={pubIndex}
            className="publication-entry"
            data-pub-index={pubIndex}
          >
            <span
              className={`publication-tag ${
                currentSelections.some((p) => p.author === pub.author)
                  ? "selected"
                  : ""
              }`}
              onClick={() => onSelect(index, pub)}
            >
              <span className="publication-index">{pubIndex + 1}</span>
              {`${pub.author}, ${pub.journal} ${pub.year}`}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Table rendering (copy thead/tbody from Comparison.js, use mergedRows)
  return (
    <div className="comparison-container">
      <div className="main-content">
        <div className={`table-section${showPlots ? " with-plots" : ""}`}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Technique</th>
                  <th>Precursor</th>
                  <th>Co-reactant</th>
                  <th>Pretreatment</th>
                  <th>Surface</th>
                  <th>Dataset</th>
                  <th>Publication</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {mergedRows.map((row) => {
                  const rowKey = getRowKey(row);
                  return (
                    <tr key={rowKey}>
                      {row.spans.material > 0 && (
                        <td rowSpan={row.spans.material}>
                          {renderChemicalFormula(row.material)}
                        </td>
                      )}
                      {row.spans.technique > 0 && (
                        <td rowSpan={row.spans.technique}>
                          {renderChemicalFormula(row.technique)}
                        </td>
                      )}
                      {row.spans.precursor > 0 && (
                        <td rowSpan={row.spans.precursor}>
                          {renderChemicalFormula(row.precursor)}
                        </td>
                      )}
                      {row.spans.coreactant > 0 && (
                        <td rowSpan={row.spans.coreactant}>
                          {renderChemicalFormula(row.coreactant)}
                        </td>
                      )}
                      {row.spans.pretreatment > 0 && (
                        <td rowSpan={row.spans.pretreatment}>
                          {renderChemicalFormula(row.pretreatment)}
                        </td>
                      )}
                      {row.spans.surface > 0 && (
                        <td rowSpan={row.spans.surface}>
                          {renderChemicalFormula(row.surface)}
                        </td>
                      )}
                      <td>
                        <PublicationCell
                          publications={row.publications}
                          index={rowKey}
                          onSelect={handlePublicationSelect}
                        />
                      </td>
                      <td>
                        {/* You can add DOI cell here if needed */}
                        {row.publications.map((pub, i) => (
                          <div key={i}>
                            {pub.doi ? (
                              <a
                                href={`https://doi.org/${pub.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {pub.doi}
                              </a>
                            ) : (
                              <span style={{ color: "#aaa" }}>No DOI</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td>
                        <button
                          className="edit-button"
                          onClick={() => handleEditClick(row)}
                          title="Edit this dataset"
                        >
                          <span>✏️</span>
                        </button>
                        {isAuthorized && (
                          <button
                            className="delete-button"
                            onClick={() => handleDeleteRow(row)}
                            title="Delete entire row"
                          >
                            <span>🗑️</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {/* Plots section (copy from Comparison.js, use readings state) */}
        {showPlots && (
          <div className={`plots-section${showPlots ? " with-plots" : ""}`}
          
          ></div>
        )}
      </div>
      <DeleteModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig({ isOpen: false })}
        onConfirm={handleDeleteConfirm}
        title={deleteModalConfig.title}
        message={deleteModalConfig.message}
        publications={deleteModalConfig.publications}
        isMultiSelect={deleteModalConfig.type === "publications"}
        isAuthorized={isAuthorized}
      />
    </div>
  );
};

export default DataTableWithPlots;
