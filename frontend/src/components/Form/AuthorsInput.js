import React from "react";
import "./AuthorsInput.css";

const AuthorsInput = ({ authors, onAuthorsChange }) => {
  const handleAuthorChange = (index, value) => {
    const newAuthors = [...authors];
    newAuthors[index] = value;
    onAuthorsChange(newAuthors);
  };

  const addAuthor = () => {
    onAuthorsChange([...authors, ""]);
  };

  const removeAuthor = (index) => {
    if (authors.length > 1) {
      onAuthorsChange(authors.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="authors-input-container">
      {authors.map((author, index) => (
        <div key={index} className="author-input-row">
          <div className="author-input-wrapper">
            <label>Author {index + 1}</label>
            <input
              type="text"
              value={author}
              onChange={(e) => handleAuthorChange(index, e.target.value)}
              placeholder={
                index === 0 ? "First author (required)" : "Additional author"
              }
              required={index === 0}
            />
          </div>
          {authors.length > 1 && (
            <button
              type="button"
              className="remove-author-btn"
              onClick={() => removeAuthor(index)}
            >
              🗑️
            </button>
          )}
        </div>
      ))}
      <button type="button" className="add-author-btn" onClick={addAuthor}>
        ➕ Add Author
      </button>
    </div>
  );
};

export default AuthorsInput;
