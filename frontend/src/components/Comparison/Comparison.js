import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import config from "../../config";
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

const MaterialSelector = ({ setUser, isAuthorized }) => {
  const [element, setElement] = useState("");
  const [elementData, setElementData] = useState([]);
  const [selectedPublications, setSelectedPublications] = useState({});
  const [showChart, setShowChart] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState({});
  const [selectivityData, setSelectivityData] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  const API_BASE_URL = `${config.BACKEND_API_URL}/api`;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const elementParam = params.get("element");
    if (elementParam) {
      setElement(elementParam);
      setIsLoading(true);
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
    } else {
      navigate("/dashboard"); // Redirect if no element parameter
    }
  }, [location, navigate]);

  const handlePublicationSelect = (rowIndex, publication) => {
    setSelectedPublications((prev) => {
      const currentRowSelections = prev[rowIndex] || [];
      const isAlreadySelected = currentRowSelections.some(
        (pub) => pub.author === publication.author
      );

      if (isAlreadySelected) {
        const updatedRowSelections = currentRowSelections.filter(
          (pub) => pub.author !== publication.author
        );

        setReadings((prevReadings) => {
          const newReadings = { ...prevReadings };
          delete newReadings[`${rowIndex}-${publication.author}`];

          if (Object.keys(newReadings).length === 0) {
            setShowChart(false);
          }

          return newReadings;
        });

        return {
          ...prev,
          [rowIndex]: updatedRowSelections.length
            ? updatedRowSelections
            : undefined,
        };
      } else {
        const updatedRowSelections = [
          ...(currentRowSelections || []),
          publication,
        ].slice(-2);

        const row = elementData[rowIndex];
        const compositeKey = `${rowIndex}-${publication.author}`;
        fetchDataForRow(row, publication, compositeKey);

        return {
          ...prev,
          [rowIndex]: updatedRowSelections,
        };
      }
    });
  };

  const fetchDataForRow = (row, publication, compositeKey) => {
    const queryParams = new URLSearchParams({
      element: element,
      material: row.material,
      precursor: row.precursor,
      coreactant: row.coreactant,
      surface: row.surface,
      pretreatment: row.pretreatment,
      publication: JSON.stringify(publication),
    });

    fetch(`${API_BASE_URL}/readings?${queryParams.toString()}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setReadings((prev) => ({
          ...prev,
          [compositeKey]: data,
        }));
        setShowChart(true);
      })
      .catch((err) => {
        console.error("Error fetching readings:", err);
        setError("Failed to fetch reading data");
      });
  };

  const getMergedRows = (data) => {
    // First, create groups based on material -> precursor -> coreactant -> pretreatment hierarchy
    const groupAndSort = (rows) => {
      const groups = {};

      // Group by material
      rows.forEach((row) => {
        if (!groups[row.material]) {
          groups[row.material] = {};
        }

        if (!groups[row.material][row.precursor]) {
          groups[row.material][row.precursor] = {};
        }

        if (!groups[row.material][row.precursor][row.coreactant]) {
          groups[row.material][row.precursor][row.coreactant] = {};
        }

        if (
          !groups[row.material][row.precursor][row.coreactant][row.pretreatment]
        ) {
          groups[row.material][row.precursor][row.coreactant][
            row.pretreatment
          ] = [];
        }

        groups[row.material][row.precursor][row.coreactant][
          row.pretreatment
        ].push(row);
      });

      return groups;
    };

    // Convert nested groups back to flat array with optimal ordering
    const flattenGroups = (groups) => {
      const result = [];

      Object.entries(groups).forEach(([material, precursors]) => {
        Object.entries(precursors).forEach(([precursor, coreactants]) => {
          Object.entries(coreactants).forEach(([coreactant, pretreatments]) => {
            // Sort pretreatments to maximize merging
            const pretreatmentGroups = {};
            Object.entries(pretreatments).forEach(([pretreatment, rows]) => {
              if (!pretreatmentGroups[pretreatment]) {
                pretreatmentGroups[pretreatment] = [];
              }
              pretreatmentGroups[pretreatment].push(...rows);
            });

            // Convert pretreatment groups to array and sort for optimal merging
            const sortedPretreatments = Object.entries(pretreatmentGroups).sort(
              ([a], [b]) => {
                // Sort by group size (descending) then alphabetically
                const sizeA = pretreatmentGroups[a].length;
                const sizeB = pretreatmentGroups[b].length;
                if (sizeB !== sizeA) return sizeB - sizeA;
                return a.localeCompare(b);
              }
            );

            // Add rows to result maintaining the hierarchy
            sortedPretreatments.forEach(([_, rows]) => {
              result.push(...rows);
            });
          });
        });
      });

      return result;
    };

    // Reorder the data for optimal merging
    const groupedData = groupAndSort(data);
    const orderedData = flattenGroups(groupedData);

    // Calculate spans for the reordered data
    const mergedData = [];
    let currentRowSpans = {
      material: 1,
      precursor: 1,
      coreactant: 1,
      pretreatment: 1,
    };
    let previousValues = {
      material: orderedData[0].material,
      precursor: orderedData[0].precursor,
      coreactant: orderedData[0].coreactant,
      pretreatment: orderedData[0].pretreatment,
    };

    // Add first row
    mergedData.push({
      ...orderedData[0],
      spans: {
        material: 1,
        precursor: 1,
        coreactant: 1,
        pretreatment: 1,
      },
    });

    // Process remaining rows
    for (let i = 1; i < orderedData.length; i++) {
      const row = orderedData[i];
      const newRow = { ...row, spans: {} };

      // Calculate spans while maintaining hierarchy
      if (row.material === previousValues.material) {
        mergedData[mergedData.length - currentRowSpans.material].spans
          .material++;
        newRow.spans.material = 0;
        currentRowSpans.material++;
      } else {
        newRow.spans.material = 1;
        currentRowSpans.material = 1;
        previousValues.material = row.material;
        // Reset dependent spans
        currentRowSpans.precursor = 1;
        currentRowSpans.coreactant = 1;
        currentRowSpans.pretreatment = 1;
      }

      if (
        row.precursor === previousValues.precursor &&
        newRow.spans.material === 0
      ) {
        mergedData[mergedData.length - currentRowSpans.precursor].spans
          .precursor++;
        newRow.spans.precursor = 0;
        currentRowSpans.precursor++;
      } else {
        newRow.spans.precursor = 1;
        currentRowSpans.precursor = 1;
        previousValues.precursor = row.precursor;
        // Reset dependent spans
        currentRowSpans.coreactant = 1;
        currentRowSpans.pretreatment = 1;
      }

      if (
        row.coreactant === previousValues.coreactant &&
        newRow.spans.precursor === 0
      ) {
        mergedData[mergedData.length - currentRowSpans.coreactant].spans
          .coreactant++;
        newRow.spans.coreactant = 0;
        currentRowSpans.coreactant++;
      } else {
        newRow.spans.coreactant = 1;
        currentRowSpans.coreactant = 1;
        previousValues.coreactant = row.coreactant;
        // Reset dependent spans
        currentRowSpans.pretreatment = 1;
      }

      if (
        row.pretreatment === previousValues.pretreatment &&
        newRow.spans.coreactant === 0
      ) {
        mergedData[mergedData.length - currentRowSpans.pretreatment].spans
          .pretreatment++;
        newRow.spans.pretreatment = 0;
        currentRowSpans.pretreatment++;
      } else {
        newRow.spans.pretreatment = 1;
        currentRowSpans.pretreatment = 1;
        previousValues.pretreatment = row.pretreatment;
      }

      mergedData.push(newRow);
    }

    return mergedData;
  };

  const handleDOIClick = (doi) => {
    if (!doi) return;

    const doiUrl = doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
    window.open(doiUrl, "_blank");
  };

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
              {pub.author}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const DOICell = ({ publications }) => {
    return (
      <div className="doi-list">
        {publications.map((pub, pubIndex) => (
          <div key={pubIndex} className="doi-entry" data-pub-index={pubIndex}>
            <span className="doi-wrapper">
              <span className="doi-index">{pubIndex + 1}.</span>
              {pub.doi ? (
                <span
                  className="doi-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDOIClick(pub.doi);
                  }}
                  title={`View publication: ${pub.author} (${pub.doi})`}
                >
                  {pub.doi} 📄
                </span>
              ) : (
                <span className="doi-not-available">Not uploaded</span>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const handleClearSelections = () => {
    setSelectedPublications({});
    setReadings({});
    setShowChart(false);
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

    return Object.entries(readings)
      .reduce((result, [compositeKey, rowReadings]) => {
        if (!Array.isArray(rowReadings) || rowReadings.length === 0)
          return result;

        const sortedReadings = [...rowReadings].sort(
          (a, b) => a.cycles - b.cycles
        );

        sortedReadings.forEach((reading) => {
          const existingPoint = result.find(
            (p) => p.cycle === reading.cycles
          ) || {
            cycle: reading.cycles,
          };
          existingPoint[compositeKey] = reading.thickness;
          if (!result.find((p) => p.cycle === reading.cycles)) {
            result.push(existingPoint);
          }
        });

        return result;
      }, [])
      .sort((a, b) => a.cycle - b.cycle);
  };

  const renderLines = () => {
    return Object.entries(readings)
      .map(([compositeKey, rowReadings], i) => {
        if (!Array.isArray(rowReadings) || rowReadings.length === 0)
          return null;

        const colors = [
          "#8884d8",
          "#82ca9d",
          "#ffc658",
          "#ff7300",
          "#00C49F",
          "#FFBB28",
        ];
        const [rowIndex, authorName] = compositeKey.split("-");

        return (
          <Line
            key={compositeKey}
            type="linear"
            dataKey={compositeKey}
            stroke={colors[i % colors.length]}
            name={`${elementData[rowIndex].surface} (${authorName})`}
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

  const chartStyles = {
    // Hide the legend symbols that appear at the top
    ".recharts-default-legend .recharts-legend-item-symbol": {
      display: "none !important",
    },
  };

  const calculateSelectivity = () => {
    const selectedReadings = Object.values(readings);

    if (selectedReadings.length !== 2) {
      setSelectivityData([]);
      return;
    }

    const [data1, data2] = selectedReadings;
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

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} />
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
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Precursor</th>
                    <th>Co-reactant</th>
                    <th>Pretreatment</th>
                    <th>Surface</th>
                    <th>Publications</th>
                    <th>DOI</th>
                  </tr>
                </thead>
                <tbody>
                  {getMergedRows(elementData).map((row, index) => (
                    <tr key={index}>
                      {row.spans.material > 0 && (
                        <td rowSpan={row.spans.material}>{row.material}</td>
                      )}
                      {row.spans.precursor > 0 && (
                        <td rowSpan={row.spans.precursor}>{row.precursor}</td>
                      )}
                      {row.spans.coreactant > 0 && (
                        <td rowSpan={row.spans.coreactant}>{row.coreactant}</td>
                      )}
                      {row.spans.pretreatment > 0 && (
                        <td rowSpan={row.spans.pretreatment}>
                          {row.pretreatment}
                        </td>
                      )}
                      <td>{row.surface}</td>
                      <td>
                        <PublicationCell
                          publications={row.publications}
                          index={index}
                          onSelect={handlePublicationSelect}
                        />
                      </td>
                      <td>
                        <DOICell publications={row.publications} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showChart && (
              <>
                <div className="clear-button-container">
                  <button
                    className="clear-button"
                    onClick={handleClearSelections}
                  >
                    <span>🗑️</span>
                    Clear Choices
                  </button>
                </div>
                <div className="charts-wrapper">
                  <div className="chart-container">
                    <h3>Cycle vs Thickness</h3>
                    <ResponsiveContainer width="100%" aspect={1}>
                      <LineChart
                        data={combinedData()}
                        margin={{ top: 20, right: 110, left: 20, bottom: 20 }}
                        style={chartStyles}
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
                          tick={{ fontSize: 20, fontWeight: 500 }}
                          label={{
                            value: "Number of Cycles",
                            position: "bottom",
                            offset: 0,
                            fontSize: 22,
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
                            fontSize: 22,
                            fontWeight: 600,
                          }}
                          domain={calculateAxisRanges().thicknessDomain}
                          stroke="#666"
                          strokeWidth={2}
                          tick={{ fontSize: 20, fontWeight: 500 }}
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
                        <Legend
                          verticalAlign="middle"
                          align="right"
                          layout="vertical"
                          wrapperStyle={{
                            paddingLeft: "20px",
                            position: "absolute",
                            right: 0,
                            top: "50%",
                            transform: "translateY(-50%)",
                            backgroundColor: "rgba(255, 255, 255, 0.8)",
                            border: "1px solid #eee",
                            borderRadius: "4px",
                          }}
                          content={({ payload }) => {
                            if (!payload) return null;
                            return (
                              <div style={{ padding: "8px" }}>
                                {payload.map((entry, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      marginBottom: "8px",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "40px",
                                        height: "3px",
                                        backgroundColor: entry.color,
                                        marginRight: "8px",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        color: "#1f2937",
                                        fontSize: "16px",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Tooltip
                          formatter={(value) =>
                            value !== null ? `${value} nm` : "No data"
                          }
                          labelFormatter={(value) => `Cycle: ${value}`}
                          contentStyle={{
                            fontSize: "16px",
                            fontWeight: 500,
                          }}
                        />
                        {renderLines()}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {selectivityData.length > 0 && (
                    <div className="chart-container">
                      <h3>Selectivity</h3>
                      <ResponsiveContainer width="100%" aspect={1}>
                        <LineChart
                          data={selectivityData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default MaterialSelector;
