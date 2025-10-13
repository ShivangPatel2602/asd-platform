import React, { useState } from "react";
import "./PDFUploader.css";

const PDFUploader = ({ onDataExtracted, isLoading, setIsLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError("PDF file is too large. Maximum size is 10MB");
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      console.log("Uploading PDF:", file.name, "Size:", file.size);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_API_URL || ""}/api/extract-pdf-data`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      // Check if response has content
      const contentType = response.headers.get("content-type");
      console.log("Content-Type:", contentType);

      // Get response text first to see what we're actually getting
      const responseText = await response.text();
      console.log("Response text:", responseText);

      // Check if response is empty
      if (!responseText || responseText.trim() === "") {
        throw new Error("Server returned empty response");
      }

      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("JSON parse error:", jsonError);
        console.error("Response was:", responseText);
        throw new Error(
          `Invalid JSON response from server: ${responseText.substring(0, 100)}`
        );
      }

      console.log("Parsed result:", result);

      if (response.ok && result.status === "success") {
        console.log("Extraction successful:", result.data);
        onDataExtracted(result.data, result.confidence);
        setError(null);
      } else {
        const errorMsg = result.error || result.message || "Extraction failed";
        console.error("Extraction error:", result);
        setError(errorMsg);
        alert(`Extraction failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Network/Parse error:", error);
      const errorMsg = error.message || "Unknown error occurred";
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
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
            <p className="loading-subtitle">This may take 30-60 seconds</p>
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
              AI will extract ASD parameters to fill the form (Max 10MB)
            </p>
            {error && <div className="upload-error">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default PDFUploader;
