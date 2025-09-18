import React, { useState } from "react";
import "./PDFUploader.css";

const PDFUploader = ({ onDataExtracted, isLoading, setIsLoading }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch("/api/extract-pdf-data", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (result.status === "success") {
        onDataExtracted(result.data, result.confidence);
      } else {
        alert(`Extraction failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="pdf-uploader">
      <div
        className={`upload-zone ${dragActive ? "drag-active" : ""} ${
          isLoading ? "loading" : ""
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="upload-loading">
            <div className="spinner"></div>
            <p>Extracting data from PDF...</p>
            <p className="loading-subtitle">This may take a moment</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">📄</div>
            <p className="upload-text">
              Drag and drop a research paper PDF here, or
            </p>
            <label className="upload-button">
              <input
                type="file"
                accept=".pdf"
                onChange={handleChange}
                style={{ display: "none" }}
              />
              Choose File
            </label>
            <p className="upload-hint">
              AI will extract ASD parameters to fill the form
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PDFUploader;
