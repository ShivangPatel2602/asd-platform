import React from "react";
import "./LabeledInput.css";

const LabeledInput = ({id, label, value, onChange, required = true, type="text", placeholder = ""}) => (
    <div className="labeled-input">
        <label htmlFor={id}>
            {label}
        </label>
        <input 
            id={id}
            name={id}
            type={type}
            placeholder={placeholder || label}
            value={value}
            onChange={onChange}
            required={required}
        />
    </div>
);

export default LabeledInput;