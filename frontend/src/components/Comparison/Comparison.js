import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import config from "../../config";
import DeleteModal from "../DeleteModal/DeleteModal";
import "./Comparison.css";
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

const MaterialSelector = ({ setUser, isAuthorized, user }) => {
  const [element, setElement] = useState("");
  const [elementData, setElementData] = useState([]);
  const [selectedPublications, setSelectedPublications] = useState({});
  const [showChart, setShowChart] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState({});
  const [selectivityData, setSelectivityData] = useState([]);
  const [deleteModalConfig, setDeleteModalConfig] = useState({
    isOpen: false,
    type: null,
    rowData: null,
    publications: null,
  });
  const [showPlots, setShowPlots] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [selectedPublication, setSelectedPublication] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const filterDropdownRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  const API_BASE_URL = `${config.BACKEND_API_URL}/api`;

  const params = new URLSearchParams(location.search);
  const elementParam = params.get("element");
  const surfaceParam = params.get("surface");
  const materialParam = params.get("material");
  const techniqueParam = params.get("technique");
  const isSurfaceMode = !!surfaceParam;

  const elementModeColumns = [
    "material",
    "technique",
    "precursor",
    "coreactant",
    "pretreatment",
    "surface",
  ];
  const surfaceModeColumns = [
    "surface",
    "material",
    "technique",
    "precursor",
    "coreactant",
    "pretreatment",
  ];

  const getUniqueValues = (data, column) => {
    const values = new Set();
    data.forEach((row) => {
      if (row[column] && row[column].trim()) {
        values.add(row[column]);
      }
    });
    return Array.from(values).sort();
  };

  const filteredElementData = useMemo(() => {
    if (Object.keys(columnFilters).length === 0) {
      return elementData;
    }

    return elementData.filter((row) => {
      return Object.entries(columnFilters).every(([column, selectedValues]) => {
        if (selectedValues.length === 0) return true;
        return selectedValues.includes(row[column]);
      });
    });
  }, [elementData, columnFilters]);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    if (materialParam || techniqueParam) {
      const query = [];
      if (materialParam)
        query.push(`material=${encodeURIComponent(materialParam)}`);
      if (surfaceParam)
        query.push(`surface=${encodeURIComponent(surfaceParam)}`);
      if (techniqueParam)
        query.push(`technique=${encodeURIComponent(techniqueParam)}`);
      fetch(`${API_BASE_URL}/filter-data?${query.join("&")}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.length === 0) {
            setError("no-data");
          } else {
            setElementData(data);
          }
        })
        .catch((err) => {
          setError("Failed to fetch filtered data");
        })
        .finally(() => setIsLoading(false));
    } else if (elementParam) {
      setElement(elementParam);
      fetch(`${API_BASE_URL}/element-data?element=${elementParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.length === 0) {
            setError("no-data");
          } else {
            setElementData(data);
          }
        })
        .catch((err) => {
          console.error("Error fetching materials:", err);
          navigate("/dashboard");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (surfaceParam) {
      setElement(surfaceParam);
      fetch(`${API_BASE_URL}/element-data-by-surface?surface=${surfaceParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.length === 0) {
            setError("no-data");
          } else {
            setElementData(data);
          }
        })
        .catch((err) => {
          console.error("Error fetching surface data:", err);
          navigate("/dashboard");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      navigate("/dashboard"); // Redirect if no element parameter
    }
  }, [location, navigate]);

  useEffect(() => {
    if (elementData.length > 0) {
      if (elementData.some((row) => !row.element)) {
        setElementData((prev) =>
          prev.map((row) => ({
            ...row,
            element: row.element || element,
          }))
        );
      }
    }
  }, [elementData, element]);

  useEffect(() => {
    if (isSurfaceMode && elementData.length > 0) {
      if (elementData.some((row) => !row.element)) {
        setElementData((prev) =>
          prev.map((row) => ({
            ...row,
            element: row.element || element,
          }))
        );
      }
    }
  }, [isSurfaceMode, elementData, element]);

  useEffect(() => {
    if (location.state) {
      const {
        selectedPublications: restoredSelections,
        readings: restoredReadings,
        showPlots: restoredShowPlots,
        showChart: restoredShowChart,
      } = location.state;

      if (restoredSelections && restoredReadings) {
        console.log("Restoring state from navigation:", {
          selectedPublications: restoredSelections,
          readings: restoredReadings,
          showPlots: restoredShowPlots,
          showChart: restoredShowChart,
        });

        setSelectedPublications(restoredSelections);
        setReadings(restoredReadings);
        setShowChart(restoredShowChart || false);
        setShowPlots(restoredShowPlots || false);
        window.history.replaceState(
          {},
          "",
          location.pathname + location.search
        );
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (Object.keys(selectedPublications).length > 0) {
      const stateToSave = {
        selectedPublications,
        timestamp: Date.now(),
      };
      localStorage.setItem("comparisonPageState", JSON.stringify(stateToSave));
    } else {
      localStorage.removeItem("comparisonPageState");
    }
  }, [selectedPublications]);
  const mergedRows = useMemo(() => {
    return getOptimallyMergedRows(
      filteredElementData,
      isSurfaceMode ? surfaceModeColumns : elementModeColumns
    );
  }, [filteredElementData, isSurfaceMode]);

  useEffect(() => {
    if (elementData.length > 0 && !location.state) {
      restoreStateFromLocalStorage();
    }
  }, [elementData, mergedRows]);

  const handlePublicationSelect = (rowKey, publication) => {
    setSelectedPublications((prev) => {
      const currentRowSelections = prev[rowKey] || [];
      const authorName =
        publication.authors?.[0] || publication.author || "Unknown";
      const isAlreadySelected = currentRowSelections.some((pub) => {
        const pubAuthorName = pub.authors?.[0] || pub.author || "Unknown";
        return pubAuthorName === authorName;
      });

      const compositeKey = `${rowKey}-${authorName}`;

      if (isAlreadySelected) {
        const updatedRowSelections = currentRowSelections.filter(
          (pub) => pub.author !== publication.author
        );

        setReadings((prevReadings) => {
          const newReadings = { ...prevReadings };
          delete newReadings[compositeKey];

          if (Object.keys(newReadings).length === 0) {
            setShowChart(false);
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

  const handleEditClick = (rowData) => {
    navigate(`/edit-data/${element}`, {
      state: {
        rowData,
        element,
      },
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

  const handleFilterChange = (column, value) => {
    setColumnFilters((prev) => {
      const currentFilters = prev[column] || [];
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter((v) => v !== value)
        : [...currentFilters, value];

      if (newFilters.length === 0) {
        const { [column]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [column]: newFilters };
    });
  };

  const clearColumnFilter = (column) => {
    setColumnFilters((prev) => {
      const { [column]: _, ...rest } = prev;
      return rest;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
  };

  function renderChemicalFormula(formula) {
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

    console.log(
      "Fetching readings with params:",
      Object.fromEntries(queryParams.entries())
    );

    fetch(`${API_BASE_URL}/readings?${queryParams.toString()}`, {
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
        const normalizedData = data.map((reading) => ({
          ...reading,
          cycles: Number(reading.cycles),
          thickness: Number(reading.thickness),
        }));
        setReadings((prev) => ({
          ...prev,
          [compositeKey]: normalizedData,
        }));
        setShowChart(true);
        setShowPlots(true);
      })
      .catch((err) => {
        console.error("Error fetching readings:", err);
        setError(`Failed to fetch reading data: ${err.message}`);
      });
  };

  const restoreStateFromLocalStorage = () => {
    const savedState = localStorage.getItem("comparisonPageState");
    if (savedState && elementData.length > 0) {
      try {
        const { selectedPublications: saved, timestamp } =
          JSON.parse(savedState);
        if (Date.now() - timestamp < 3600000) {
          setSelectedPublications(saved);
          Object.entries(saved).forEach(([rowKey, publications]) => {
            const row = mergedRows.find((r) => getRowKey(r) === rowKey);
            if (row) {
              publications.forEach((publication) => {
                const compositeKey = `${rowKey}-${publication.author}`;
                fetchDataForRow(row, publication, compositeKey);
              });
            }
          });
        } else {
          localStorage.removeItem("comparisonPageState");
        }
      } catch (error) {
        console.error("Error restoring state:", error);
        localStorage.removeItem("comparisonPageState");
      }
    }
  };

  const handleCollapsePlots = () => {
    setShowPlots(false);
  };

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

  const handleDOIClick = (doi) => {
    if (!doi) return;

    const doiUrl = doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
    window.open(doiUrl, "_blank");
  };

  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return "Unknown";
    if (typeof authors === "string") return authors;

    if (authors.length === 1) return authors[0];
    return `${authors[0]} et al.`;
  };

  const handleInfoClick = (publication, e) => {
    e.stopPropagation();
    setSelectedPublication(publication);
    setShowInfoModal(true);
  };

  const PublicationInfoModal = ({ publication, onClose }) => {
    if (!publication) return null;

    const formatModalAuthors = (authors) => {
      if (!authors || authors.length === 0) return "Not specified";
      if (typeof authors === "string") return authors;
      return authors.join(", ");
    };

    return (
      <>
        <div className="modal-backdrop" onClick={onClose} />
        <div className="publication-info-modal">
          <div className="modal-header">
            <h3>Publication Details</h3>
            <button className="modal-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-content">
            <div className="modal-field">
              <label>Title:</label>
              <p>{publication.title || "Not specified"}</p>
            </div>

            <div className="modal-field">
              <label>Authors:</label>
              <p>{formatModalAuthors(publication.authors)}</p>
            </div>

            <div className="modal-field">
              <label>Journal:</label>
              <p>
                {publication.journal_full ||
                  publication.journal ||
                  "Not specified"}
              </p>
            </div>

            <div className="modal-grid">
              <div className="modal-field">
                <label>Year:</label>
                <p>{publication.year || "Not specified"}</p>
              </div>

              <div className="modal-field">
                <label>Volume:</label>
                <p>{publication.volume || "Not specified"}</p>
              </div>

              <div className="modal-field">
                <label>Issue:</label>
                <p>{publication.issue || "Not specified"}</p>
              </div>

              <div className="modal-field">
                <label>Pages:</label>
                <p>{publication.pages || "Not specified"}</p>
              </div>
            </div>

            <div className="modal-field">
              <label>DOI:</label>
              {publication.doi ? (
                <a
                  href={
                    publication.doi.startsWith("http")
                      ? publication.doi
                      : `https://doi.org/${publication.doi}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-doi-link"
                >
                  {publication.doi}
                </a>
              ) : (
                <p>Not specified</p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const CombinedPublicationDOICell = ({ publications, index, onSelect }) => {
    const currentSelections = selectedPublications[index] || [];

    return (
      <div className="combined-pub-doi-cell">
        <div className="publications-list">
          {publications.map((pub, pubIndex) => (
            <div
              key={pubIndex}
              className="publication-entry"
              data-pub-index={pubIndex}
            >
              <span
                className={`publication-tag ${
                  currentSelections.some(
                    (p) =>
                      (p.authors?.[0] || p.author) ===
                      (pub.authors?.[0] || pub.author)
                  )
                    ? "selected"
                    : ""
                }`}
                onClick={() => onSelect(index, pub)}
                title={pub.authors ? `Authors: ${pub.authors.join(", ")}` : ""}
              >
                <span className="publication-index">{pubIndex + 1}</span>
                {`${formatAuthors(pub.authors || [pub.author])}, ${
                  pub.journal
                } ${pub.year}`}
                <button
                  className="info-icon-button"
                  onClick={(e) => handleInfoClick(pub, e)}
                  title="View publication details"
                >
                  ℹ️
                </button>
                {pub.doi && (
                  <button
                    className="doi-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDOIClick(pub.doi);
                    }}
                    title="Open DOI link"
                  >
                    🔗
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleJumpToRow = (rowNum) => {
    const tableBody = document.querySelector("tbody");
    const targetRow = tableBody?.children[rowNum - 1];

    if (targetRow) {
      targetRow.classList.add("highlighted-row");
      targetRow.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setTimeout(() => {
        targetRow.classList.remove("highlighted-row");
      }, 3000);
    }
  };

  const TableControls = ({ totalRows, currentRows, onJumpToRow }) => {
    const [jumpRow, setJumpRow] = useState("");

    return (
      <div className="table-stats">
        <div className="rows-info">
          <span>
            Showing {currentRows} of {totalRows} entries
          </span>
          <span className="data-quality-indicator">
            Research Quality: {Math.round((currentRows / totalRows) * 100)}%
            Coverage
          </span>
        </div>
        <div className="search-controls">
          <div className="jump-to-row">
            <span>Jump to:</span>
            <input
              type="number"
              className="jump-input"
              placeholder="Row #"
              value={jumpRow}
              onChange={(e) => setJumpRow(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  onJumpToRow(parseInt(jumpRow));
                  setJumpRow("");
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleClearSelections = () => {
    setSelectedPublications({});
    setReadings({});
    setShowChart(false);
    setShowPlots(false);
    localStorage.removeItem("comparisonPageState");
  };

  const calculateAxisRanges = () => {
    const allReadings = Object.values(readings).flat();
    const allCycles = allReadings.map((r) => r.cycles);
    const allThickness = allReadings.map((r) => r.thickness);

    const maxCycle = Math.max(...allCycles);
    const maxThickness = Math.max(...allThickness);

    const cycleInterval = maxCycle <= 100 ? 10 : maxCycle <= 200 ? 20 : 50;
    const thicknessInterval = Math.ceil(maxThickness / 10);

    const cycleDomain = [
      0,
      Math.ceil(maxCycle / cycleInterval) * cycleInterval,
    ];
    const thicknessDomain = [
      0,
      Math.ceil(maxThickness / thicknessInterval) * thicknessInterval,
    ];

    return {
      cycleInterval,
      thicknessInterval,
      cycleDomain,
      thicknessDomain,
    };
  };

  const combinedData = () => {
    if (Object.keys(readings).length === 0) return [];

    const allCycles = new Set();
    Object.values(readings).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((r) => allCycles.add(r.cycles));
      }
    });

    return Array.from(allCycles)
      .sort((a, b) => a - b)
      .map((cycle) => {
        const obj = { cycle };
        Object.entries(readings).forEach(([compositeKey, arr]) => {
          if (Array.isArray(arr)) {
            const found = arr.find((r) => r.cycles === cycle);
            if (found) obj[compositeKey] = found.thickness;
          }
        });
        return obj;
      });
  };

  const renderLines = () => {
    const colors = [
      "#8884d8",
      "#82ca9d",
      "#ffc658",
      "#ff7300",
      "#00C49F",
      "#FFBB28",
    ];

    return Object.entries(readings)
      .map(([compositeKey, rowReadings], i) => {
        if (!Array.isArray(rowReadings) || rowReadings.length === 0)
          return null;

        const lastDash = compositeKey.lastIndexOf("-");
        const rowKey = compositeKey.substring(0, lastDash);
        const authorName = compositeKey.substring(lastDash + 1);

        const row = mergedRows.find((r) => getRowKey(r) === rowKey);
        if (!row) return null;

        const publication = row.publications.find((pub) => {
          const pubAuthorName = pub.authors?.[0] || pub.author || "Unknown";
          return pubAuthorName === authorName;
        });
        if (!publication) return null;

        const displayName = `${row.surface} (${publication.author}${
          publication.journal ? `, ${publication.journal}` : ""
        }${publication.year ? ` ${publication.year}` : ""})`;

        return (
          <Line
            key={compositeKey}
            type="linear"
            dataKey={compositeKey}
            stroke={colors[i % colors.length]}
            name={displayName}
            dot={{
              r: 8,
              fill: colors[i % colors.length],
              stroke: "#fff",
              strokeWidth: 2,
            }}
            activeDot={false}
            connectNulls={true}
            strokeWidth={4}
            legendType="plainline"
            isAnimationActive={false}
          />
        );
      })
      .filter(Boolean);
  };

  const calculateSelectivity = () => {
    const selectedReadings = Object.values(readings);

    if (selectedReadings.length !== 2) {
      setSelectivityData([]);
      return;
    }

    const [data1, data2] = selectedReadings;
    if (!Array.isArray(data1) || !Array.isArray(data2)) {
      console.error("Invalid data format for selectivity calculation");
      setSelectivityData([]);
      return;
    }

    const selectivityPoints = [];

    const cycles1 = new Set(data1.map((r) => r.cycles));
    const cycles2 = new Set(data2.map((r) => r.cycles));
    const commonCycles = [...cycles1].filter((cycle) => cycles2.has(cycle));

    commonCycles.forEach((cycle) => {
      const t1 = data1.find((r) => r.cycles === cycle)?.thickness;
      const t2 = data2.find((r) => r.cycles === cycle)?.thickness;

      if (t1 != null && t2 != null) {
        selectivityPoints.push({
          cycle,
          thickness: Math.max(t1, t2),
          selectivity: Math.abs(t1 - t2) / (t1 + t2),
        });
      }
    });

    setSelectivityData(selectivityPoints);
  };

  useEffect(() => {
    calculateSelectivity();
  }, [readings]);

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

  const handleDeletePublications = (row) => {
    setDeleteModalConfig({
      isOpen: true,
      type: "publications",
      rowData: row,
      publications: row.publications,
      title: isAuthorized ? "Delete Publications" : "Unauthorized",
      message: isAuthorized
        ? "Select the publications you want to delete:"
        : "You don't have permission to delete entries.",
    });
  };

  const handleModelDataRedirect = () => {
    const readingsArray = Object.values(readings);
    if (readingsArray.length !== 2) return;

    const [data1, data2] = readingsArray;
    const growthData = data1
      .map((reading) => `${reading.cycles} ${reading.thickness}`)
      .join("\n");
    const nonGrowthData = data2
      .map((reading) => `${reading.cycles} ${reading.thickness}`)
      .join("\n");
    const selectionState = {
      selectedPublications,
      readings,
      showPlots: true,
      showChart: true,
    };
    navigate("/model-data", {
      state: {
        growthInput: growthData,
        nonGrowthInput: nonGrowthData,
        autoCompute: true,
        returnTo: {
          path: location.pathname + location.search,
          state: selectionState,
        },
      },
    });
  };

  useEffect(() => {
    if (showPlots) {
      setTimeout(() => {
        const chartContainers = document.querySelectorAll(
          ".plots-container .chart-container"
        );
        chartContainers.forEach((container, index) => {
          container.style.animationDelay = `${0.6 + index * 0.2}s`;
          container.classList.add("animate-in");
        });
      }, 100);
    }
  }, [showPlots]);

  const renderActionButtons = (row) => (
    <div className="action-buttons">
      <button
        className="edit-button"
        onClick={() => handleEditClick(row)}
        title="Edit this dataset"
      >
        <span>✏️</span>
      </button>
      {isAuthorized && (
        <>
          <button
            className="delete-button"
            onClick={() => handleDeleteRow(row)}
            title="Delete entire row"
          >
            <span>🗑️</span>
          </button>
          {row.publications.length > 1 && (
            <button
              className="delete-publications-button"
              onClick={() => handleDeletePublications(row)}
              title="Delete specific publications"
            >
              <span>📄❌</span>
            </button>
          )}
        </>
      )}
    </div>
  );

  const handleDeleteConfirm = async (selectedPublications) => {
    try {
      const { type, rowData } = deleteModalConfig;

      const response = await fetch(`${API_BASE_URL}/delete-data`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          type,
          element: element,
          rowData,
          publications: selectedPublications,
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const error = await response.json();
        console.error("Delete error:", error);
      }
    } catch (error) {
      console.error("Error deleting data:", error);
    } finally {
      setDeleteModalConfig({
        isOpen: false,
        type: null,
        rowData: null,
        publications: null,
      });
    }
  };

  const FilterableHeader = ({ column, label }) => {
    const uniqueValues = getUniqueValues(elementData, column);
    const filterCount = columnFilters[column]?.length || 0;
    const headerRef = useRef(null);
    const dropdownRef = useRef(null);

    const handleToggleFilter = (e) => {
      e.stopPropagation();
      if (activeFilterColumn === column) {
        setActiveFilterColumn(null);
      } else {
        setActiveFilterColumn(column);
      }
    };

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (activeFilterColumn === column) {
          const clickedInsideHeader = headerRef.current?.contains(event.target);
          const clickedInsideDropdown = dropdownRef.current?.contains(
            event.target
          );

          if (!clickedInsideHeader && !clickedInsideDropdown) {
            setActiveFilterColumn(null);
          }
        }
      };

      if (activeFilterColumn === column) {
        // Use 'click' instead of 'mousedown'
        document.addEventListener("click", handleClickOutside, true);

        return () =>
          document.removeEventListener("click", handleClickOutside, true);
      }
    }, [activeFilterColumn, column]);

    return (
      <th
        className="filterable-header"
        ref={headerRef}
        style={{ zIndex: activeFilterColumn === column ? 102 : 100 }}
      >
        <div className="header-content">
          <span>{label}</span>
          <button
            className={`filter-toggle ${
              activeFilterColumn === column ? "active" : ""
            } ${filterCount > 0 ? "has-filters" : ""}`}
            onClick={handleToggleFilter}
          >
            {filterCount > 0 ? `${filterCount}` : "▼"}
          </button>
        </div>
        {activeFilterColumn === column && (
          <div
            ref={dropdownRef}
            className="filter-dropdown-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="filter-header">
              <span>Filter {label}</span>
              {filterCount > 0 && (
                <button
                  className="clear-column-filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearColumnFilter(column);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="filter-options-scroll">
              <div className="filter-options">
                {uniqueValues.map((value) => (
                  <label key={value} className="filter-option">
                    <input
                      type="checkbox"
                      checked={columnFilters[column]?.includes(value) || false}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleFilterChange(column, value);
                      }}
                    />
                    <span className="filter-value">{value}</span>
                    <span className="filter-count">
                      {
                        elementData.filter((row) => row[column] === value)
                          .length
                      }
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="comparison-container">
        <h2>Data for {element}</h2>

        {isLoading ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>Loading data...</p>
            </div>
          </div>
        ) : error === "no-data" ? (
          <div className="no-data-container">
            <div className="no-data-content">
              <div className="no-data-icon">📊</div>
              <h3>No Data Available</h3>
              <p>There is currently no data available for {element}.</p>
              <p>Would you like to contribute by adding some data?</p>
              <button
                className="upload-redirect-button"
                onClick={() => navigate("/upload-data")}
              >
                <span>⬆️</span>
                Upload Data
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}
            <div className={`main-content ${showPlots ? "with-plots" : ""}`}>
              <div className={`table-section ${showPlots ? "with-plots" : ""}`}>
                <div className="table-container">
                  <TableControls
                    totalRows={elementData.length}
                    currentRows={filteredElementData.length}
                    onJumpToRow={handleJumpToRow}
                  />
                  {Object.keys(columnFilters).length > 0 && (
                    <button
                      className="clear-all-filters-btn"
                      onClick={clearAllFilters}
                    >
                      Clear All Filters ({Object.keys(columnFilters).length})
                    </button>
                  )}
                  <table className={isSurfaceMode ? "surface-mode-table" : ""}>
                    <thead>
                      <tr>
                        {isSurfaceMode ? (
                          <>
                            <FilterableHeader
                              column="surface"
                              label="Surface"
                            />
                            <FilterableHeader
                              column="material"
                              label="Material"
                            />
                            <FilterableHeader
                              column="technique"
                              label="Technique"
                            />
                            <FilterableHeader
                              column="precursor"
                              label="Precursor"
                            />
                            <FilterableHeader
                              column="coreactant"
                              label="Coreactant"
                            />
                            <FilterableHeader
                              column="pretreatment"
                              label="Pretreatment"
                            />
                            <th>Source</th>
                            <th>Edit</th>
                          </>
                        ) : (
                          <>
                            <FilterableHeader
                              column="material"
                              label="Material"
                            />
                            <FilterableHeader
                              column="technique"
                              label="Technique"
                            />
                            <FilterableHeader
                              column="precursor"
                              label="Precursor"
                            />
                            <FilterableHeader
                              column="coreactant"
                              label="Coreactant"
                            />
                            <FilterableHeader
                              column="pretreatment"
                              label="Pretreatment"
                            />
                            <FilterableHeader
                              column="surface"
                              label="Surface"
                            />
                            <th>Source</th>
                            <th>Edit</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {mergedRows.map((row) => {
                        const rowKey = getRowKey(row);
                        return (
                          <tr key={rowKey}>
                            {!isSurfaceMode ? (
                              <>
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
                              </>
                            ) : (
                              <>
                                {row.spans.surface > 0 && (
                                  <td rowSpan={row.spans.surface}>
                                    {renderChemicalFormula(row.surface)}
                                  </td>
                                )}
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
                              </>
                            )}
                            <td>
                              <CombinedPublicationDOICell
                                publications={row.publications}
                                index={rowKey}
                                onSelect={handlePublicationSelect}
                              />
                            </td>
                            <td>{renderActionButtons(row)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {showPlots && (
                <div
                  className={`plots-section${showPlots ? " with-plots" : ""}`}
                >
                  <div className="plots-header">
                    <button
                      className="collapse-plots-btn"
                      onClick={handleCollapsePlots}
                    >
                      <span>✕</span>
                      Collapse Plots
                    </button>
                    {Object.keys(readings).length === 2 && (
                      <button
                        className="model-data-btn"
                        onClick={handleModelDataRedirect}
                      >
                        <span>📊</span>
                        Model Data
                      </button>
                    )}
                    <button
                      className="clear-button"
                      onClick={handleClearSelections}
                    >
                      <span>🗑️</span>
                      Clear Choices
                    </button>
                  </div>
                  <div className="plots-container">
                    <div className="chart-container">
                      <h3>Cycle vs Thickness</h3>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart
                          data={combinedData()}
                          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                          />
                          <XAxis
                            dataKey="cycle"
                            type="number"
                            domain={calculateAxisRanges().cycleDomain}
                            ticks={Array.from(
                              {
                                length:
                                  Math.floor(
                                    calculateAxisRanges().cycleDomain[1] /
                                      calculateAxisRanges().cycleInterval
                                  ) + 1,
                              },
                              (_, i) => i * calculateAxisRanges().cycleInterval
                            )}
                            tick={{ fontSize: 16, fontWeight: 500 }}
                            label={{
                              value: "Number of Cycles",
                              position: "bottom",
                              offset: 0,
                              fontSize: 18,
                              fontWeight: 600,
                            }}
                            stroke="#666"
                            strokeWidth={2}
                          />
                          <YAxis
                            label={{
                              value: "Thickness (nm)",
                              angle: -90,
                              position: "insideLeft",
                              offset: 10,
                              fontSize: 18,
                              fontWeight: 600,
                            }}
                            domain={calculateAxisRanges().thicknessDomain}
                            stroke="#666"
                            strokeWidth={2}
                            tick={{ fontSize: 16, fontWeight: 500 }}
                            ticks={Array.from(
                              {
                                length:
                                  Math.floor(
                                    calculateAxisRanges().thicknessDomain[1] /
                                      calculateAxisRanges().thicknessInterval
                                  ) + 1,
                              },
                              (_, i) =>
                                i * calculateAxisRanges().thicknessInterval
                            )}
                          />
                          <Tooltip
                            formatter={(value, name) => {
                              const [index, author] = name.split("-");
                              const numValue = Number(value);
                              return [`${numValue.toFixed(2)} nm`, author];
                            }}
                            labelFormatter={(value) => `Cycles: ${value}`}
                          />
                          <Legend
                            verticalAlign="bottom"
                            align="center"
                            layout="horizontal"
                            wrapperStyle={{
                              position: "relative",
                              marginTop: "20px",
                              width: "100%",
                            }}
                            content={({ payload }) => {
                              if (!payload) return null;
                              return (
                                <div className="chart-legend-container">
                                  {payload.map((entry, index) => (
                                    <div key={index} className="legend-item">
                                      <div
                                        className="legend-line"
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="legend-text">
                                        {entry.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          {renderLines()}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {selectivityData.length > 0 && (
                      <div className="chart-container">
                        <h3>Selectivity</h3>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart
                            data={selectivityData}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              strokeWidth={1.5}
                            />
                            <XAxis
                              dataKey="thickness"
                              type="number"
                              stroke="#666"
                              strokeWidth={2}
                              tick={{ fontSize: 16, fontWeight: 500 }}
                              label={{
                                value: "Thickness of Thicker Film (nm)",
                                position: "bottom",
                                offset: 0,
                                fontSize: 18,
                                fontWeight: 600,
                              }}
                            />
                            <YAxis
                              stroke="#666"
                              strokeWidth={2}
                              tick={{ fontSize: 16, fontWeight: 500 }}
                              label={{
                                value: "Selectivity",
                                angle: -90,
                                position: "insideLeft",
                                offset: 10,
                                fontSize: 18,
                                fontWeight: 600,
                              }}
                              domain={[0, 1]}
                            />
                            <Tooltip
                              formatter={(value) => value.toFixed(3)}
                              labelFormatter={(value) => `Cycle: ${value}`}
                            />
                            <Line
                              type="monotone"
                              dataKey="selectivity"
                              stroke="#ff7300"
                              dot={{
                                fill: "#ff7300",
                                r: 8,
                                strokeWidth: 2,
                                stroke: "#fff",
                              }}
                              strokeWidth={4}
                              connectNulls={true}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {showInfoModal && (
          <PublicationInfoModal
            publication={selectedPublication}
            onClose={() => {
              setShowInfoModal(false);
              setSelectedPublication(null);
            }}
          />
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
    </>
  );
};

export default MaterialSelector;
