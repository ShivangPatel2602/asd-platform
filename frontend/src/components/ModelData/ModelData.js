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

const ModelData = ({ setUser, isAuthorized, user }) => {
  const [growthInput, setGrowthInput] = useState("");
  const [nonGrowthInput, setNonGrowthInput] = useState("");
  const [showPlot, setShowPlot] = useState(false);
  const [modelFitData, setModelFitData] = useState([]);
  const [scenarioResults, setScenarioResults] = useState({});
  const [bestScenario, setBestScenario] = useState("");
  const [bestRmse, setBestRmse] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

      setScenarioResults(result.all_scenarios);
      setBestScenario(result.best_scenario);
      setBestRmse(result.best_rmse);

      // Build combined data for chart using best scenario
      const allX = Array.from(
        new Set([
          ...result.growth.map(([x]) => x),
          ...result.nongrowth.map(([x]) => x),
          ...(result.model_x || []),
        ])
      ).sort((a, b) => a - b);

      const growthMap = Object.fromEntries(
        result.growth.map(([x, y]) => [x, y])
      );
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

      // Use index for equal spacing
      const indexedData = trimmedModelFitData.map((d, i) => ({
        ...d,
        xIndex: i,
        xLabel: d.x,
      }));

      setModelFitData(indexedData);
      setShowPlot(true);
    } catch (error) {
      console.error("Error processing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="model-data-container">
        <div className="model-data-left">
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
              <h3>Model Results</h3>
              <div className="best-scenario">
                <strong>Best Scenario:</strong> {bestScenario}
                <br />
                <strong>RMSE:</strong> {bestRmse.toExponential(4)}
              </div>
              <div className="all-scenarios">
                <h4>All Scenarios:</h4>
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
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    marginTop: 32,
                    position: "relative",
                  }}
                />
                {/* User data as dots */}
                <Line
                  type="none"
                  dataKey="growth"
                  name="Growth Surface Data"
                  stroke="#2563eb"
                  strokeWidth={0}
                  dot={{ r: 6, fill: "#2563eb" }}
                  connectNulls={false}
                />
                <Line
                  type="none"
                  dataKey="nonGrowth"
                  name="Non-Growth Surface Data"
                  stroke="#f59e42"
                  strokeWidth={0}
                  dot={{ r: 6, fill: "#f59e42" }}
                  connectNulls={false}
                />
                {/* Model fit curves */}
                <Line
                  type="monotone"
                  dataKey="modelNonGrowth"
                  name="Non-Growth Surface Fit"
                  stroke="#f59e42"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="modelGrowth"
                  name="Growth Surface Fit"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
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
