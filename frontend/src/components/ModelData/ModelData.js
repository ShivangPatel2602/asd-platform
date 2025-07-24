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
  // Expects lines of "x y" or "x,y" or "x\ty"
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
  const [growthData, setGrowthData] = useState([]);
  const [nonGrowthData, setNonGrowthData] = useState([]);
  const [showPlot, setShowPlot] = useState(false);

  const handlePlot = async () => {
    const growthArr = parseInput(growthInput).map(({ x, y }) => [x, y]);
    const nonGrowthArr = parseInput(nonGrowthInput).map(({ x, y }) => [x, y]);
    const response = await fetch(`${config.BACKEND_API_URL}/api/an-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ growth: growthArr, nongrowth: nonGrowthArr }),
    });
    const result = await response.json();
    setGrowthData(result.growth.map(([x, y]) => ({ x, y })));
    setNonGrowthData(result.nongrowth.map(([x, y]) => ({ x, y })));
    setShowPlot(true);
  };

  // Combine x values for chart
  const allX = Array.from(
    new Set([...growthData.map((d) => d.x), ...nonGrowthData.map((d) => d.x)])
  ).sort((a, b) => a - b);

  const chartData = allX.map((x) => ({
    x,
    growth: growthData.find((d) => d.x === x)?.y ?? null,
    nonGrowth: nonGrowthData.find((d) => d.x === x)?.y ?? null,
  }));

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
              placeholder="e.g.\n1 2\n2 3\n3 4"
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
              placeholder="e.g.\n1 1\n2 1.5\n3 2"
              rows={8}
            />
          </div>
          <button className="plot-btn" onClick={handlePlot}>
            Plot Data
          </button>
        </div>
        <div className="model-data-right">
          {showPlot && (growthData.length > 0 || nonGrowthData.length > 0) ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  label={{ value: "X", position: "bottom", fontSize: 16 }}
                />
                <YAxis
                  label={{
                    value: "Y",
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
                {growthData.length > 0 && (
                  <Line
                    type="none"
                    dataKey="growth"
                    name="Growth Surface"
                    stroke="#2563eb"
                    strokeWidth={0}
                    dot={{ r: 6, fill: "#2563eb" }}
                    connectNulls={false}
                  />
                )}
                {nonGrowthData.length > 0 && (
                  <Line
                    type="none"
                    dataKey="nonGrowth"
                    name="Non-Growth Surface"
                    stroke="#f59e42"
                    strokeWidth={0}
                    dot={{ r: 6, fill: "#f59e42" }}
                    connectNulls={false}
                  />
                )}
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
