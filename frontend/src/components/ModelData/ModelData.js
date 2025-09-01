import React, { useState } from "react";
import Navbar from "../Navbar/Navbar";
import "./ModelData.css";
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
import config from "../../config";

const parseInput = (input) => {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [x, y] = line.split(/[\s,]+/).map(Number);
      return isNaN(x) || isNaN(y) ? null : { x, y };
    })
    .filter(Boolean);
};

// Mathematical notation component
const MathVariable = ({ variable }) => {
  const mathMap = {
    nhat: (
      <span>
        n̂<sub>0</sub>
      </span>
    ),
    ndot0: (
      <span>
        ṅ<sub>0</sub>
      </span>
    ),
    td: (
      <span>
        t<sub>d</sub>
      </span>
    ),
  };
  return mathMap[variable] || variable;
};

// Variable descriptions component
const VariableDescriptions = () => (
  <div className="variable-descriptions">
    <h3>Model Parameters</h3>
    <div className="variable-item">
      <strong>
        <MathVariable variable="nhat" />
      </strong>{" "}
      - initial defect site density (nm<sup>-2</sup>)
    </div>
    <div className="variable-item">
      <strong>
        <MathVariable variable="ndot0" />
      </strong>{" "}
      - defect site generation rate (nm<sup>-2</sup> cycle<sup>-1</sup>)
    </div>
    <div className="variable-item">
      <strong>
        <MathVariable variable="td" />
      </strong>{" "}
      - defect site generation delay (cycles)
    </div>
  </div>
);

const BestScenarioParams = ({ scenario, params, rmse, onParamsChange }) => {
  const [editableParams, setEditableParams] = useState({
    nhat: 0,
    ndot0: 0,
    td: 0,
  });
  const [isEditing, setIsEditing] = useState(false);

  // Initialize editableParams when component receives new props
  React.useEffect(() => {
    console.log("BestScenarioParams: Received props:", {
      scenario,
      params,
      rmse,
    });

    const activeLabels = getParamLabels(scenario);
    const newParams = {
      nhat: 0,
      ndot0: 0,
      td: 0,
    };

    // Set active parameters from the params array
    activeLabels.forEach((label, index) => {
      if (params && params.length > index) {
        newParams[label] = params[index];
      }
    });

    console.log("BestScenarioParams: Setting editable params:", newParams);
    setEditableParams(newParams);
  }, [scenario, params]);

  const getParamLabels = (scenario) => {
    const labels = [];
    if (scenario.toLowerCase().includes("nhat")) labels.push("nhat");
    if (scenario.toLowerCase().includes("ndot0")) labels.push("ndot0");
    if (scenario.toLowerCase().includes("td")) labels.push("td");
    return labels;
  };

  // Get active parameter labels for the current scenario
  const activeParamLabels = getParamLabels(scenario);

  // Always show all three parameters
  const allParamLabels = ["nhat", "ndot0", "td"];

  const getParamValue = (label) => {
    const activeIndex = activeParamLabels.indexOf(label);
    if (activeIndex !== -1 && params && params.length > activeIndex) {
      return params[activeIndex];
    }
    return 0; // Default value for inactive parameters
  };

  const isParamActive = (label) => {
    return activeParamLabels.includes(label);
  };

  const handleParamChange = (param, value) => {
    console.log(`Parameter change: ${param} = ${value}`);
    setEditableParams((prev) => ({
      ...prev,
      [param]: parseFloat(value) || 0,
    }));
  };

  const handleApplyChanges = () => {
    console.log("Applying parameter changes:", editableParams);

    // IMPORTANT: Always send all three parameters in [nhat, ndot0, td] order
    const newParams = [
      editableParams.nhat,
      editableParams.ndot0,
      editableParams.td,
    ];

    console.log("Sending parameters to backend:", newParams);
    console.log("Current scenario:", scenario);

    onParamsChange(newParams);
    setIsEditing(false);
  };

  const handleReset = () => {
    const resetParams = {
      nhat: getParamValue("nhat"),
      ndot0: getParamValue("ndot0"),
      td: getParamValue("td"),
    };
    setEditableParams(resetParams);
    setIsEditing(false);
  };

  return (
    <div className="best-scenario-params">
      <h3>Best Scenario: {scenario}</h3>
      <div className="rmse-display">
        <strong>RMSE:</strong> {rmse?.toExponential(4) || "N/A"}
      </div>

      <div className="params-display">
        <h4>Parameter Values:</h4>
        <div style={{ fontSize: "0.8em", color: "#666", marginBottom: "8px" }}>
          Active parameters: [{activeParamLabels.join(", ")}]
        </div>
        {allParamLabels.map((label) => (
          <div key={label} className="param-row">
            <span
              className={`param-label ${
                isParamActive(label) ? "active" : "inactive"
              }`}
            >
              <MathVariable variable={label} />:
              {!isParamActive(label) && (
                <span className="inactive-note"> (inactive)</span>
              )}
            </span>
            {isEditing ? (
              <input
                type="number"
                value={editableParams[label]}
                onChange={(e) => handleParamChange(label, e.target.value)}
                step="0.0001"
                className="param-input"
                style={{
                  backgroundColor: isParamActive(label) ? "#fff" : "#f5f5f5",
                  color: isParamActive(label) ? "#000" : "#666",
                }}
              />
            ) : (
              <span
                className={`param-value ${
                  isParamActive(label) ? "active" : "inactive"
                }`}
              >
                {getParamValue(label).toExponential(4)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="param-controls">
        {!isEditing ? (
          <button
            className="edit-params-btn"
            onClick={() => setIsEditing(true)}
          >
            Modify Parameters
          </button>
        ) : (
          <div className="edit-controls">
            <button className="apply-btn" onClick={handleApplyChanges}>
              Apply Changes
            </button>
            <button className="cancel-btn" onClick={handleReset}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom legend component
const CustomLegend = (props) => {
  const { payload } = props;

  return (
    <div className="custom-legend">
      <div className="legend-row">
        <div className="legend-item">
          <div
            className="legend-symbol dot"
            style={{ backgroundColor: "#2563eb" }}
          ></div>
          <span>Growth Surface Data</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-symbol line"
            style={{ backgroundColor: "#2563eb" }}
          ></div>
          <span>Growth Surface Fit</span>
        </div>
      </div>
      <div className="legend-row">
        <div className="legend-item">
          <div
            className="legend-symbol dot"
            style={{ backgroundColor: "#f59e42" }}
          ></div>
          <span>Non-Growth Surface Data</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-symbol line"
            style={{ backgroundColor: "#f59e42" }}
          ></div>
          <span>Non-Growth Surface Fit</span>
        </div>
      </div>
    </div>
  );
};

const ModelData = ({ setUser, isAuthorized, user }) => {
  const [growthInput, setGrowthInput] = useState("");
  const [nonGrowthInput, setNonGrowthInput] = useState("");
  const [showPlot, setShowPlot] = useState(false);
  const [modelFitData, setModelFitData] = useState([]);
  const [scenarioResults, setScenarioResults] = useState({});
  const [bestScenario, setBestScenario] = useState("");
  const [bestRmse, setBestRmse] = useState(0);
  const [bestParams, setBestParams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [originalGrowthData, setOriginalGrowthData] = useState([]);
  const [originalNonGrowthData, setOriginalNonGrowthData] = useState([]);

  const processModelResults = (result) => {
    setScenarioResults(result.all_scenarios);
    setBestScenario(result.best_scenario);
    setBestRmse(result.best_rmse);
    setBestParams(result.best_params);

    // Store original data for parameter modification
    setOriginalGrowthData(result.growth);
    setOriginalNonGrowthData(result.nongrowth);

    // Build combined data for chart
    const allX = Array.from(
      new Set([
        ...result.growth.map(([x]) => x),
        ...result.nongrowth.map(([x]) => x),
        ...(result.model_x || []),
      ])
    ).sort((a, b) => a - b);

    const growthMap = Object.fromEntries(result.growth.map(([x, y]) => [x, y]));
    const nonGrowthMap = Object.fromEntries(
      result.nongrowth.map(([x, y]) => [x, y])
    );
    const modelGrowthMap = Object.fromEntries(
      (result.model_x || []).map((x, i) => [
        x,
        result.model_growth_y?.[i] ?? null,
      ])
    );
    const modelNonGrowthMap = Object.fromEntries(
      (result.model_x || []).map((x, i) => [
        x,
        result.model_nongrowth_y?.[i] ?? null,
      ])
    );

    const modelFitData = allX.map((x) => ({
      x,
      growth: growthMap[x] ?? null,
      nonGrowth: nonGrowthMap[x] ?? null,
      modelGrowth: modelGrowthMap[x] ?? null,
      modelNonGrowth: modelNonGrowthMap[x] ?? null,
    }));

    // Trim model fit to just beyond last user x
    const maxUserX = Math.max(
      ...result.growth.map(([x]) => x),
      ...result.nongrowth.map(([x]) => x)
    );
    const model_x = result.model_x || [];
    let cutoffIndex = model_x.findIndex((x) => x > maxUserX);
    if (cutoffIndex === -1) cutoffIndex = model_x.length;
    const trimmedModelFitData = modelFitData.slice(0, cutoffIndex + 1);

    const indexedData = trimmedModelFitData.map((d, i) => ({
      ...d,
      xIndex: i,
      xLabel: d.x,
    }));

    setModelFitData(indexedData);
    setShowPlot(true);
  };

  const handlePlot = async () => {
    setIsLoading(true);
    setShowPlot(false);

    try {
      const growthArr = parseInput(growthInput).map(({ x, y }) => [x, y]);
      const nonGrowthArr = parseInput(nonGrowthInput).map(({ x, y }) => [x, y]);

      const response = await fetch(`${config.BACKEND_API_URL}/api/an-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ growth: growthArr, nongrowth: nonGrowthArr }),
      });
      const result = await response.json();

      processModelResults(result);
    } catch (error) {
      console.error("Error processing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParamsChange = async (newParams) => {
    console.log("=== PARAMETER CHANGE DEBUG ===");
    console.log("Original growth data:", originalGrowthData);
    console.log("Original non-growth data:", originalNonGrowthData);
    console.log("Best scenario:", bestScenario);
    console.log("New parameters:", newParams);

    setIsLoading(true);

    try {
      const payload = {
        growth: originalGrowthData,
        nongrowth: originalNonGrowthData,
        customParams: {
          scenario: bestScenario,
          params: newParams,
        },
      };

      console.log(
        "Sending payload to backend:",
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch(`${config.BACKEND_API_URL}/api/an-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      console.log("Received response from backend:", result);

      if (result.error) {
        console.error("Backend returned error:", result.error);
        alert(`Error: ${result.error}`);
        return;
      }

      processModelResults(result);
    } catch (error) {
      console.error("Error recomputing with new parameters:", error);
      alert(`Error recomputing: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="model-data-container">
        <div className="model-data-left">
          <VariableDescriptions />

          <div className="input-group">
            <label htmlFor="growth-input">
              Growth Surface Data (x, y per line)
            </label>
            <textarea
              id="growth-input"
              value={growthInput}
              onChange={(e) => setGrowthInput(e.target.value)}
              placeholder="e.g.\n0 0\n25 1.5\n96 6\n144 9.1\n240 15.2\n336 21.5"
              rows={8}
            />
          </div>
          <div className="input-group">
            <label htmlFor="non-growth-input">
              Non-Growth Surface Data (x, y per line)
            </label>
            <textarea
              id="non-growth-input"
              value={nonGrowthInput}
              onChange={(e) => setNonGrowthInput(e.target.value)}
              placeholder="e.g.\n0 0\n25 0.5\n96 2\n144 3.1\n240 5.2\n336 7.5"
              rows={8}
            />
          </div>
          <button
            className="plot-btn"
            onClick={handlePlot}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Plot Data"}
          </button>

          {/* Display scenario results */}
          {showPlot && Object.keys(scenarioResults).length > 0 && (
            <div className="scenario-results">
              <h3>All Scenarios</h3>
              <div className="all-scenarios">
                {Object.entries(scenarioResults).map(([name, result]) => (
                  <div
                    key={name}
                    className={`scenario-item ${
                      name === bestScenario ? "best" : ""
                    }`}
                  >
                    <strong>{name}:</strong> RMSE ={" "}
                    {result.rmse.toExponential(4)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="model-data-right">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <div className="loading-message">
                Processing data and running model scenarios...
              </div>
            </div>
          ) : showPlot && modelFitData.length > 0 ? (
            <div className="plot-container">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={modelFitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="xIndex"
                    tickFormatter={(i) => modelFitData[i]?.xLabel ?? ""}
                    label={{
                      value: "Cycle Number",
                      position: "bottom",
                      fontSize: 16,
                    }}
                  />
                  <YAxis
                    label={{
                      value: "Thickness (nm)",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 16,
                    }}
                  />
                  <Tooltip />
                  <Legend content={<CustomLegend />} />

                  {/* User data as dots only */}
                  <Line
                    type="none"
                    dataKey="growth"
                    stroke="#2563eb"
                    strokeWidth={0}
                    dot={{ r: 6, fill: "#2563eb" }}
                    connectNulls={false}
                    legendType="none"
                  />
                  <Line
                    type="none"
                    dataKey="nonGrowth"
                    stroke="#f59e42"
                    strokeWidth={0}
                    dot={{ r: 6, fill: "#f59e42" }}
                    connectNulls={false}
                    legendType="none"
                  />

                  {/* Model fit curves only */}
                  <Line
                    type="monotone"
                    dataKey="modelGrowth"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="modelNonGrowth"
                    stroke="#f59e42"
                    strokeWidth={2}
                    dot={false}
                    legendType="none"
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Best scenario parameters */}
              <BestScenarioParams
                scenario={bestScenario}
                params={bestParams}
                rmse={bestRmse}
                onParamsChange={handleParamsChange}
              />
            </div>
          ) : (
            <div className="plot-placeholder">
              Enter data and click "Plot Data" to see the chart.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ModelData;
