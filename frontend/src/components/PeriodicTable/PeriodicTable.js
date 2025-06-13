import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { periodicTableElements, categories } from "./elements";
import "./PeriodicTable.css";
import config from "../../config";

const PeriodicTable = ({ type, endpoint }) => {
  const [hoveredElement, setHoveredElement] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [elementsWithData, setElementsWithData] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${config.BACKEND_API_URL}/api/${endpoint}`)
      .then((res) => res.json())
      .then((data) => {
        setElementsWithData(new Set(data));
      })
      .catch((err) => console.error("Error fetching elements data:", err));
  }, [endpoint, type]);

  const handleElementClick = (symbol) => {
    if (type === "material") {
      navigate(`/comparison?element=${symbol}`);
    } else {
      navigate(`/comparison?surface=${symbol}`);
    }
  };

  const handleMouseEnter = (element, event) => {
    setHoveredElement(element);
    setMousePos({ x: event.clientX, y: event.clientY });
  };

  const renderElement = (position) => {
    const element = periodicTableElements[position];
    if (!element) return <div className="element empty" />;

    const hasData = elementsWithData.has(element.symbol);

    return (
      <button
        key={position}
        className={`element ${element.category} ${
          hasData ? "has-data" : "no-data"
        }`}
        onClick={() => handleElementClick(element.symbol)}
        onMouseEnter={(e) => handleMouseEnter(element, e)}
        onMouseLeave={() => setHoveredElement(null)}
      >
        <span className="atomic-number">{element.number}</span>
        <span className="symbol">{element.symbol}</span>
        <span className="name">{element.name}</span>
        {hasData && <span className="data-indicator">•</span>}
      </button>
    );
  };

  return (
    <div className="periodic-table-container">
      <div className="periodic-table">
        <div className="row">
          {renderElement("1-1")}
          <div className="element-spacer-first"></div>
          {renderElement("1-18")}
        </div>

        <div className="row">
          {renderElement("2-1")}
          {renderElement("2-2")}
          <div className="element-spacer"></div>
          {renderElement("2-13")}
          {renderElement("2-14")}
          {renderElement("2-15")}
          {renderElement("2-16")}
          {renderElement("2-17")}
          {renderElement("2-18")}
        </div>

        <div className="row">
          {renderElement("3-1")}
          {renderElement("3-2")}
          <div className="element-spacer"></div>
          {renderElement("3-13")}
          {renderElement("3-14")}
          {renderElement("3-15")}
          {renderElement("3-16")}
          {renderElement("3-17")}
          {renderElement("3-18")}
        </div>

        <div className="row">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
            (col) => renderElement(`4-${col}`)
          )}
        </div>

        <div className="row">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
            (col) => renderElement(`5-${col}`)
          )}
        </div>

        <div className="row">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
            (col) => renderElement(`6-${col}`)
          )}
        </div>

        <div className="row">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
            (col) => renderElement(`7-${col}`)
          )}
        </div>

        <div className="row spacer"></div>

        <div className="row lanthanides">
          <div className="element-spacer small"></div>
          {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((col) =>
            renderElement(`8-${col}`)
          )}
        </div>

        <div className="row actinides">
          <div className="element-spacer small"></div>
          {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((col) =>
            renderElement(`9-${col}`)
          )}
        </div>
      </div>

      {hoveredElement && (
        <div
          className="element-tooltip"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y + 10,
          }}
        >
          <h3>{hoveredElement.name}</h3>
          <p>Atomic Number: {hoveredElement.number}</p>
          <p>Category: {hoveredElement.category.replace("-", " ")}</p>
          <div
            className={`data-status ${
              elementsWithData.has(hoveredElement.symbol)
                ? "has-data"
                : "no-data"
            }`}
          >
            {elementsWithData.has(hoveredElement.symbol)
              ? "✓ Data Available"
              : "○ No Data Available"}
          </div>
        </div>
      )}

      <div className="category-legend">
        {Object.entries(categories).map(([category, color]) => (
          <div key={category} className="legend-item">
            <span
              className="color-box"
              style={{ backgroundColor: color }}
            ></span>
            <span className="category-name">
              {category.replace("-", " ").toUpperCase()}
            </span>
          </div>
        ))}
        <div className="data-availability-legend">
          <div className="legend-item">
            <div className="element-sample has-data">
              <span className="data-indicator">•</span>
            </div>
            <span>Data Available</span>
          </div>
          <div className="legend-item">
            <div className="element-sample no-data"></div>
            <span>No Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodicTable;
