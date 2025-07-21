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

  const handlePlot = () => {
    setGrowthData(parseInput(growthInput));
    setNonGrowthData(parseInput(nonGrowthInput));
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
                <Legend />
                {growthData.length > 0 && (
                  <Line
                    type="monotone"
                    dataKey="growth"
                    name="Growth Surface"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot
                  />
                )}
                {nonGrowthData.length > 0 && (
                  <Line
                    type="monotone"
                    dataKey="nonGrowth"
                    name="Non-Growth Surface"
                    stroke="#f59e42"
                    strokeWidth={3}
                    dot
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
